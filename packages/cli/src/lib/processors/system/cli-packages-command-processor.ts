import {
    CliForegroundColor,
    CliModuleRegistry,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
    ICliKeyValueStore,
    joinShellWords,
} from '@qodalis/cli-core';
import {
    CliKeyValueStore_TOKEN,
    CliModuleRegistry_TOKEN,
    CliPackageManagerService_TOKEN,
    CliProcessorsRegistry_TOKEN,
} from '../../tokens';
import {
    CdnSourceName,
    ScriptLoaderService,
} from '../../services/script-loader';
import { CliPackageManagerService } from '../../services/cli-package-manager';
import {
    CliPackageInstaller,
    UpdateResult,
    writeCandidates,
} from './packages/package-installer';
import {
    AvailablePackage,
    collectAvailablePackages,
    fetchRegistryDocument,
    filterPackages,
    PackageRegistryDocument,
} from './packages/package-search';
import {
    applyMarketplaceOptions,
    MarketplaceClient,
    MarketplacePluginSummary,
    MarketplaceRequestError,
    MarketplaceSession,
    pickResolvedPlugin,
} from './packages/marketplace';
import {
    installStatus,
    marketplaceRows,
    writeMarketplaceInfo,
} from './packages/package-marketplace-output';
import { API_VERSION } from '../../version';
import {
    writeExamples,
    writeHint,
    writeNoPackages,
    writeSourceList,
    writeSourceSummary,
    writeUsage,
} from './packages/package-help';
import {
    isNewerVersion,
    parsePackageSpec,
    splitPackageArgs,
    toFullPackageName,
} from './packages/package-utils';
import {
    PackageListRow,
    packageDisplayName,
    writePackageList,
} from './packages/package-list';

/** The docs page on publishing a plugin to the marketplace. */
export const PUBLISHING_GUIDE_URL =
    'https://cli.qodalis.com/docs/publishing-plugins';

/** `pkg browse` reads at most this many marketplace pages of 100. */
const BROWSE_MAX_PAGES = 5;

/** Run `fn` with an AbortSignal tied to the command's Ctrl+C. */
async function withAbortSignal<T>(
    context: ICliExecutionContext,
    fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
    const controller = new AbortController();
    const subscription = context.onAbort.subscribe(() => controller.abort());
    try {
        return await fn(controller.signal);
    } finally {
        subscription.unsubscribe();
    }
}

/** `pkg`: install, update and remove CLI plugins at runtime from npm/CDN sources. */
export class CliPackagesCommandProcessor implements ICliCommandProcessor {
    readonly command = 'pkg';

    readonly aliases = ['packages'];

    description = 'Manage packages in the cli';

    author = DefaultLibraryAuthor;

    readonly version = '1.1.0';

    readonly processors: ICliCommandProcessor[];

    readonly metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '📦',
        module: 'system',
        // Enforced only when an auth module is loaded
        requiredPermissions: ['system:packages'],
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            cdnSource: 'unpkg',
        },
    };

    private readonly loader = new ScriptLoaderService();
    private readonly manager = new CliPackageManagerService();
    private readonly installer = new CliPackageInstaller(
        this.loader,
        this.manager,
    );

    constructor() {
        this.processors = [
            this.lsCommand(),
            this.browseCommand(),
            this.searchCommand(),
            this.infoCommand(),
            this.addCommand(),
            this.removeCommand(),
            this.versionsCommand(),
            this.checkCommand(),
            this.updateCommand(),
            this.sourceCommand(),
            this.publishCommand(),
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writeUsage(context, [
            [
                'pkg ls',
                t.t(
                    'cli.pkg.help.list_installed_packages',
                    'List installed packages',
                ),
            ],
            [
                'pkg browse',
                t.t(
                    'cli.pkg.help.browse_all_available_packages',
                    'Browse all available packages',
                ),
            ],
            [
                'pkg search <text>',
                t.t(
                    'cli.pkg.help.search_packages',
                    'Search the plugin marketplace',
                ),
            ],
            [
                'pkg info <package>',
                t.t(
                    'cli.pkg.help.show_package_info',
                    'Show details of a package',
                ),
            ],
            [
                'pkg add <package>[@version]',
                t.t('cli.pkg.help.install_package', 'Install a package'),
            ],
            [
                'pkg remove|rm <package>',
                t.t('cli.pkg.help.remove_package', 'Remove a package'),
            ],
            [
                'pkg versions <package>',
                t.t(
                    'cli.pkg.help.show_all_published_versions',
                    'Show all published versions',
                ),
            ],
            [
                'pkg check',
                t.t(
                    'cli.pkg.help.check_available_updates',
                    'Check for available updates',
                ),
            ],
            [
                'pkg update [package][@version]',
                t.t(
                    'cli.pkg.help.update_one_all_packages',
                    'Update one or all packages',
                ),
            ],
            [
                'pkg source [get|set <name>]',
                t.t(
                    'cli.pkg.help.get_set_package_source',
                    'Get or set package source',
                ),
            ],
            [
                'pkg publish <package>',
                t.t(
                    'cli.pkg.help.submit_package',
                    'Submit an npm package to the marketplace',
                ),
            ],
        ]);
        writer.writeln();
        const marketplace = this.installer.marketplaceClient();
        writer.writeln(
            `🌐 Browse packages: ${writer.wrapInColor(marketplace?.baseUrl ?? 'https://www.npmjs.com/org/qodalis', CliForegroundColor.Blue)}`,
        );
        writer.writeln();
        writeExamples(context, [
            [
                'pkg add guid',
                t.t(
                    'cli.pkg.help.install_qodalis_cli_guid',
                    'Install @qodalis/cli-guid',
                ),
            ],
            [
                'pkg add guid server-logs',
                t.t(
                    'cli.pkg.help.install_multiple_packages',
                    'Install multiple packages',
                ),
            ],
            [
                'pkg update',
                t.t('cli.pkg.help.update_all_packages', 'Update all packages'),
            ],
        ]);
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.installer.attach(
            context.services.getRequired<ICliCommandProcessorRegistry>(
                CliProcessorsRegistry_TOKEN,
            ),
            context.services.get<CliModuleRegistry>(CliModuleRegistry_TOKEN),
        );
        this.manager.setStore(
            context.services.getRequired<ICliKeyValueStore>(
                CliKeyValueStore_TOKEN,
            ),
        );

        // Expose the package manager so the completion provider can access it
        context.services.set([
            { provide: CliPackageManagerService_TOKEN, useValue: this.manager },
        ]);

        // Custom package sources from options
        const packageSources = context.options?.packageSources;
        for (const source of packageSources?.sources ?? []) {
            this.loader.addSource(
                source.name,
                source.url,
                source.kind || 'file',
            );
        }
        applyMarketplaceOptions(this.loader, packageSources);
        this.installer.marketplaceOnly = !!packageSources?.marketplaceOnly;
        // Primary source from options (persisted state overrides it below)
        if (packageSources?.primary) {
            this.loader.setCdnSource(packageSources.primary);
        }

        context.state
            .select<CdnSourceName>((s) => s['cdnSource'])
            .subscribe((cdnSource) => {
                if (cdnSource) this.loader.setCdnSource(cdnSource);
            });

        await this.installer.loadInstalled(context);
    }

    // ── Sub-commands ──

    private lsCommand(): ICliCommandProcessor {
        return {
            command: 'ls',
            aliases: ['list'],
            description: 'List all packages in the cli',
            author: DefaultLibraryAuthor,
            processCommand: async (_, context) => {
                const { writer } = context;
                // An installed copy of one of the app's modules is never
                // loaded, so it is listed once, with the app's modules
                const byName = (a: PackageListRow, b: PackageListRow) =>
                    a.name.localeCompare(b.name);
                const installed = (await this.manager.getPackages())
                    .filter((pkg) => !this.installer.bundledName(pkg.name))
                    .map((pkg) => ({
                        name: packageDisplayName(
                            pkg.name,
                            this.installer.prefix,
                        ),
                        version: pkg.version,
                    }))
                    .sort(byName);
                const bundled = this.installer
                    .bundledModules()
                    .map((module) => ({
                        name: packageDisplayName(
                            module.name,
                            this.installer.prefix,
                        ),
                        version: module.version,
                    }))
                    .sort(byName);
                if (installed.length === 0 && bundled.length === 0) {
                    writeNoPackages(context);
                    return;
                }

                if (installed.length > 0) {
                    writer.writeln(
                        writer.wrapInColor(
                            `📦 Installed with pkg (${installed.length}):`,
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writePackageList(context, installed);
                }
                if (bundled.length > 0) {
                    if (installed.length > 0) writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            `✅ Built in (${bundled.length}):`,
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writePackageList(context, bundled);
                }
            },
            writeDescription: (context) => {
                context.writer.writeln(
                    'List the installed and the built-in packages, with their versions',
                );
                context.writer.writeln();
                writeUsage(context, [['pkg ls', '']]);
            },
        };
    }

    private browseCommand(): ICliCommandProcessor {
        return {
            command: 'browse',
            description:
                'List all available packages from the marketplace (or all configured sources)',
            processCommand: async (_, context) => {
                context.notifier.info('Browsing packages');
                await this.listPackages(context);
            },
            writeDescription: (context) => {
                const { writer } = context;
                writer.writeln(
                    'Browse the plugins the marketplace lists, or, when it is off or unreachable, the packages of all configured sources',
                );
                writer.writeln();
                writeUsage(context, [['pkg browse', '']]);
                writer.writeln();
                writer.writeln(
                    'Shows each package with its newest version that fits this CLI, its category and install status (✓: verified publisher):',
                );
                writer.writeln(
                    `  ${writer.wrapInColor('✅ installed', CliForegroundColor.Green)}      Already installed and up to date`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('🔄 update', CliForegroundColor.Yellow)}         Installed but a newer version exists`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('✅ built in', CliForegroundColor.Green)}       Built into the app: installed, updates with the app`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('📥 not installed', CliForegroundColor.Magenta)}  Not yet installed`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('✖ needs CLI API 3', CliForegroundColor.Red)} Does not fit this CLI`,
                );
                writer.writeln();
                writer.writeln('🌐 Sources queried:');
                writer.writeln(
                    `  ${writer.wrapInColor('marketplace', CliForegroundColor.Cyan)}  Plugin catalog (plugins.qodalis.com by default)`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('registry', CliForegroundColor.Cyan)}     npm-compatible search API (e.g. npmjs.org, Verdaccio), when the marketplace does not answer`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('file', CliForegroundColor.Cyan)}         Static file servers, probed for known packages, likewise`,
                );
            },
        };
    }

    private searchCommand(): ICliCommandProcessor {
        return {
            command: 'search',
            description: 'Search the plugin marketplace',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (command, context) => {
                const text = joinShellWords(command.value ?? '').trim();
                context.notifier.info(`Searching for ${text}`);
                await this.listPackages(context, text);
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Search the plugin marketplace by name, description and tags (npm when the marketplace does not answer)',
                );
                context.writer.writeln();
                writeUsage(context, [['pkg search <text>', '']]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg search chart',
                        t.t('cli.pkg.search.help.one_word', 'One word'),
                    ],
                    [
                        'pkg search json tools',
                        t.t(
                            'cli.pkg.search.help.all_words',
                            'Plugins matching all words',
                        ),
                    ],
                ]);
            },
        };
    }

    private infoCommand(): ICliCommandProcessor {
        return {
            command: 'info',
            description: 'Show details of a package',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (command, context) => {
                const name = joinShellWords(command.value ?? '').trim();
                await withAbortSignal(context, (signal) =>
                    this.showInfo(name, context, signal),
                );
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Show a package: description, publisher, category, versions and which fit this CLI, links and paired server packages',
                );
                context.writer.writeln();
                writeUsage(context, [['pkg info <package>', '']]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg info guid',
                        t.t('cli.pkg.info.help.short_name', 'Short name'),
                    ],
                    [
                        'pkg info @acme/cli-weather',
                        t.t('cli.pkg.info.help.full_name', 'Full name'),
                    ],
                ]);
            },
        };
    }

    private publishCommand(): ICliCommandProcessor {
        return {
            command: 'publish',
            description: 'Submit an npm package to the plugin marketplace',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (command, context) => {
                const name = joinShellWords(command.value ?? '').trim();
                await withAbortSignal(context, (signal) =>
                    this.submit(name, context, signal),
                );
            },
            writeDescription: (context) => {
                const { writer } = context;
                writer.writeln(
                    'Ask the marketplace to index an npm package and queue it for review. It does not publish to npm: run npm publish first',
                );
                writer.writeln();
                writeUsage(context, [['pkg publish <npm package name>', '']]);
                writer.writeln();
                writer.writeln(
                    `📖 Guide: ${writer.wrapInColor(PUBLISHING_GUIDE_URL, CliForegroundColor.Blue)}`,
                );
            },
        };
    }

    private addCommand(): ICliCommandProcessor {
        return {
            command: 'add',
            aliases: ['install'],
            description: 'Add a package to the cli, e.g. pkg add guid.',
            valueRequired: true,
            processCommand: async (command, context) => {
                await withAbortSignal(context, async (signal) => {
                    const session = this.installer.marketplaceSession(context);
                    for (const spec of splitPackageArgs(command.value)) {
                        if (signal.aborted) break;
                        context.notifier.info(`Installing ${spec}`);
                        await this.installInBackground(
                            spec,
                            context,
                            signal,
                            session,
                        );
                    }
                });
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Install one or more packages from the Qodalis registry',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['pkg add <package>[@version] [package2...]', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg add guid',
                        t.t('cli.pkg.add.help.short_name', 'Short name'),
                    ],
                    [
                        'pkg add @qodalis/cli-guid',
                        t.t('cli.pkg.add.help.full_name', 'Full name'),
                    ],
                    [
                        'pkg add guid server-logs',
                        t.t(
                            'cli.pkg.add.help.multiple_packages',
                            'Multiple packages',
                        ),
                    ],
                    [
                        'pkg add guid@2.0.0-beta.17',
                        t.t(
                            'cli.pkg.add.help.specific_version',
                            'Specific version',
                        ),
                    ],
                ]);
                context.writer.writeln();
                context.writer.writeInfo(
                    '💡 Short names are looked up in the marketplace, then prefixed with @qodalis/cli-',
                );
                context.writer.writeInfo(
                    '🛡  Marketplace versions are checked: one that does not fit this CLI, or was flagged, is refused, and the bundle must match the hash the marketplace recorded',
                );
            },
        };
    }

    private removeCommand(): ICliCommandProcessor {
        return {
            command: 'remove',
            aliases: ['rm', 'uninstall'],
            description: 'Remove a package from the cli',
            valueRequired: true,
            processCommand: async (command, context) => {
                await withAbortSignal(context, async (signal) => {
                    for (const name of splitPackageArgs(command.value)) {
                        if (signal.aborted) break;
                        context.notifier.info(`Removing ${name}`);
                        await this.installer.remove(name, context);
                    }
                });
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln('Remove one or more installed packages');
                context.writer.writeln();
                writeUsage(context, [
                    ['pkg remove <package> [package2...]', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg remove guid',
                        t.t(
                            'cli.pkg.remove.help.remove_one_package',
                            'Remove one package',
                        ),
                    ],
                    [
                        'pkg remove guid server-logs',
                        t.t(
                            'cli.pkg.remove.help.remove_multiple',
                            'Remove multiple',
                        ),
                    ],
                    [
                        'pkg rm guid',
                        t.t('cli.pkg.remove.help.short_alias', 'Short alias'),
                    ],
                ]);
            },
        };
    }

    private versionsCommand(): ICliCommandProcessor {
        return {
            command: 'versions',
            description: 'Show all published versions of a package',
            valueRequired: true,
            acceptsRawInput: true,
            processCommand: async (command, context) => {
                const { progressBar, writer } = context;
                const name = joinShellWords(command.value ?? '');
                const fullName = toFullPackageName(name, this.installer.prefix);

                progressBar.show();
                progressBar.setText(`Fetching versions for ${name}`);
                context.notifier.info(`Fetching versions for ${name}`);

                await withAbortSignal(context, async (signal) => {
                    try {
                        const data = await fetchRegistryDocument(
                            this.loader,
                            fullName,
                            signal,
                        );
                        if (signal.aborted) return;
                        progressBar.complete();

                        if (!data?.versions) {
                            writer.writeError(`Package ${name} not found`);
                            return;
                        }

                        const versions = Object.keys(data.versions);
                        const time = data.time ?? {};
                        const latest = data['dist-tags']?.['latest'];
                        const installed = await this.manager.getPackage(name);

                        writer.writeln(
                            writer.wrapInColor(
                                `📦 ${fullName} — ${versions.length} version${versions.length !== 1 ? 's' : ''}:`,
                                CliForegroundColor.Yellow,
                            ),
                        );
                        writer.writeln();

                        for (const version of versions) {
                            const published = time[version]
                                ? new Date(time[version]).toLocaleDateString()
                                : '';
                            const tags: string[] = [];
                            if (version === latest)
                                tags.push(
                                    writer.wrapInColor(
                                        'latest',
                                        CliForegroundColor.Green,
                                    ),
                                );
                            if (installed?.version === version)
                                tags.push(
                                    writer.wrapInColor(
                                        'installed',
                                        CliForegroundColor.Cyan,
                                    ),
                                );

                            writer.writeln(
                                `  ${writer.wrapInColor(`v${version}`, CliForegroundColor.White)}  ${writer.wrapInColor(published, CliForegroundColor.Yellow)}${tags.length ? `  [${tags.join(', ')}]` : ''}`,
                            );
                        }
                        writer.writeln();
                    } catch (e: any) {
                        if (signal.aborted) return;
                        progressBar.complete();
                        // Browsers report a registry 404 as a network error, so
                        // "not found" and "unreachable" look the same here.
                        writer.writeError(
                            `Package ${name} not found, or the registry is unreachable`,
                        );
                    }
                });
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Show all published versions of a package from the registry',
                );
                context.writer.writeln();
                writeUsage(context, [['pkg versions <package>', '']]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg versions guid',
                        t.t('cli.pkg.versions.help.short_name', 'Short name'),
                    ],
                    [
                        'pkg versions @qodalis/cli-guid',
                        t.t('cli.pkg.versions.help.full_name', 'Full name'),
                    ],
                ]);
            },
        };
    }

    private checkCommand(): ICliCommandProcessor {
        return {
            command: 'check',
            description: 'Check installed packages for available updates',
            processCommand: async (_, context) => {
                const { progressBar, writer } = context;
                // An installed copy of a bundled module is never loaded: the
                // app's version is the one in use and updates with the app
                const packages = (await this.manager.getPackages()).filter(
                    (pkg) => !this.installer.bundledName(pkg.name),
                );
                if (packages.length === 0) {
                    writeNoPackages(context);
                    return;
                }

                progressBar.show();
                progressBar.setText(
                    `Checking ${packages.length} package${packages.length !== 1 ? 's' : ''}`,
                );

                const session = this.installer.marketplaceSession(context);
                const results = await withAbortSignal(
                    context,
                    async (signal) => {
                        const checked = await Promise.all(
                            packages.map((pkg) =>
                                this.installer.checkPackage(
                                    pkg,
                                    session,
                                    signal,
                                ),
                            ),
                        );
                        return signal.aborted ? undefined : checked;
                    },
                );
                if (!results) return;
                progressBar.complete();

                const updates = results.filter(
                    (r) => !r.failed && isNewerVersion(r.latest, r.pkg.version),
                );
                const failed = results.filter((r) => r.failed);
                const upToDate = results.filter(
                    (r) => !r.failed && !updates.includes(r),
                );

                if (updates.length > 0) {
                    writer.writeln(
                        writer.wrapInColor(
                            `🔄 Updates available (${updates.length}):`,
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();
                    writePackageList(
                        context,
                        updates.map(({ pkg, latest }) => ({
                            name: packageDisplayName(
                                pkg.name,
                                this.installer.prefix,
                            ),
                            status: `${writer.wrapInColor(pkg.version, CliForegroundColor.Red)} → ${writer.wrapInColor(latest!, CliForegroundColor.Green)}`,
                        })),
                    );
                    writer.writeln();
                    writer.writeInfo(
                        `💡 Run ${writer.wrapInColor('pkg update', CliForegroundColor.Cyan)} to update all packages`,
                    );
                }

                if (upToDate.length > 0) {
                    if (updates.length > 0) writer.writeln();
                    writer.writeln(
                        writer.wrapInColor(
                            `✅ Up to date (${upToDate.length}):`,
                            CliForegroundColor.Green,
                        ),
                    );
                    writer.writeln();
                    writePackageList(
                        context,
                        upToDate.map(({ pkg }) => ({
                            name: packageDisplayName(
                                pkg.name,
                                this.installer.prefix,
                            ),
                            version: pkg.version,
                        })),
                    );
                }

                const warnings = results.filter((r) => r.warning);
                if (warnings.length > 0) {
                    writer.writeln();
                    for (const { pkg, warning } of warnings) {
                        writer.writeWarning(
                            `⚠️  ${packageDisplayName(pkg.name, this.installer.prefix)}@${pkg.version} ${warning}`,
                        );
                    }
                }

                if (failed.length > 0) {
                    writer.writeln();
                    for (const { pkg } of failed) {
                        writer.writeWarning(
                            `⚠️  ${packageDisplayName(pkg.name, this.installer.prefix)}: Failed to check`,
                        );
                    }
                }

                if (
                    updates.length === 0 &&
                    failed.length === 0 &&
                    warnings.length === 0
                ) {
                    writer.writeln();
                    writer.writeSuccess('🎉 All packages are up to date!');
                }
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Check installed packages for newer versions available on the registry',
                );
                context.writer.writeln();
                writeUsage(context, [['pkg check', '']]);
                context.writer.writeln();
                writeHint(
                    context,
                    'pkg update',
                    t.t('cli.pkg.check.help.apply_updates', 'to apply updates'),
                );
            },
        };
    }

    private updateCommand(): ICliCommandProcessor {
        return {
            command: 'update',
            description:
                'Update a package in the cli to the latest version or update all packages',
            acceptsRawInput: true,
            valueRequired: false,
            processCommand: async (command, context) => {
                await withAbortSignal(context, async (signal) => {
                    const session = this.installer.marketplaceSession(context);
                    const spec = joinShellWords(command.value ?? '');
                    if (spec) {
                        const { name, version } = parsePackageSpec(spec);
                        await this.installer.update(
                            name,
                            context,
                            signal,
                            version,
                            session,
                        );
                        return;
                    }

                    const packages = (await this.manager.getPackages()).filter(
                        (pkg) => !this.installer.bundledName(pkg.name),
                    );
                    if (packages.length === 0) {
                        writeNoPackages(context);
                        return;
                    }

                    const counts: Record<UpdateResult, number> = {
                        updated: 0,
                        current: 0,
                        failed: 0,
                    };
                    for (const pkg of packages) {
                        if (signal.aborted) return;
                        counts[
                            await this.installer.update(
                                pkg.name,
                                context,
                                signal,
                                undefined,
                                session,
                            )
                        ]++;
                    }
                    if (signal.aborted) return;

                    context.writer.writeln();
                    const summary = `${counts.updated} updated, ${counts.current} up to date, ${counts.failed} failed`;
                    if (counts.failed > 0) {
                        context.writer.writeWarning(summary);
                    } else {
                        context.writer.writeSuccess(summary);
                    }
                });
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Update packages to their latest versions or to a specific version',
                );
                context.writer.writeln();
                writeUsage(context, [
                    [
                        'pkg update <package>',
                        t.t(
                            'cli.pkg.update.help.update_latest',
                            'Update to latest',
                        ),
                    ],
                    [
                        'pkg update <package>@<version>',
                        t.t(
                            'cli.pkg.update.help.update_specific_version',
                            'Update to specific version',
                        ),
                    ],
                    [
                        'pkg update',
                        t.t(
                            'cli.pkg.update.help.update_all_packages',
                            'Update all packages',
                        ),
                    ],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    [
                        'pkg update guid',
                        t.t(
                            'cli.pkg.update.help.update_latest',
                            'Update to latest',
                        ),
                    ],
                    [
                        'pkg update guid@1.0.2',
                        t.t(
                            'cli.pkg.update.help.install_specific_version',
                            'Install specific version',
                        ),
                    ],
                ]);
            },
        };
    }

    private sourceCommand(): ICliCommandProcessor {
        const showSource = async (
            _: CliProcessCommand,
            context: ICliExecutionContext,
        ) => {
            writeSourceSummary(context, this.loader);
        };

        return {
            command: 'source',
            description: 'Get or set the package source for downloads',
            acceptsRawInput: true,
            processors: [
                {
                    command: 'get',
                    description: 'Show the current CDN source',
                    processCommand: showSource,
                },
                {
                    command: 'set',
                    description:
                        'Set the preferred package source (interactive if no name given)',
                    acceptsRawInput: true,
                    processCommand: async (command, context) => {
                        // A marketplace serves metadata, not downloads
                        const sources = this.loader
                            .getSources()
                            .filter(
                                (name) =>
                                    this.loader.getSource(name)?.kind !==
                                    'marketplace',
                            );
                        let value = joinShellWords(
                            command.value ?? '',
                        ).toLowerCase();

                        if (!value) {
                            const current = this.loader.getCdnSource();
                            const selected = await context.reader.readSelect(
                                'Select package source:',
                                sources.map((name) => ({
                                    label: `${name}${name === current ? ' (active)' : ''}  ${this.loader.getSourceUrl(name) || ''}`,
                                    value: name,
                                })),
                            );
                            if (!selected) {
                                context.writer.writeInfo(
                                    'Source selection cancelled',
                                );
                                return;
                            }
                            value = selected;
                        }

                        if (
                            this.loader.getSource(value)?.kind === 'marketplace'
                        ) {
                            context.writer.writeError(
                                `${value} is the plugin marketplace: it lists plugins, downloads come from the other sources`,
                            );
                            return;
                        }
                        if (!sources.includes(value)) {
                            context.writer.writeError(
                                `Invalid source "${value}". Available sources: ${sources.join(', ')}`,
                            );
                            return;
                        }

                        this.loader.setCdnSource(value);
                        context.state.updateState({ cdnSource: value });
                        await context.state.persist();

                        context.writer.writeSuccess(
                            `Package source set to ${context.writer.wrapInColor(value, CliForegroundColor.Cyan)}`,
                        );
                        writeSourceSummary(context, this.loader, value);
                    },
                    writeDescription: (context) => {
                        context.writer.writeln(
                            'Set the preferred source for package downloads',
                        );
                        context.writer.writeln();
                        writeUsage(context, [['pkg source set <name>', '']]);
                        context.writer.writeln();
                        writeSourceList(context, this.loader);
                    },
                },
            ],
            processCommand: async (command, context) => {
                const t = context.translator;
                await showSource(command, context);
                context.writer.writeln();
                writeHint(
                    context,
                    'pkg source set <name>',
                    t.t('cli.pkg.source.help.change', 'to change'),
                );
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Manage the source used for downloading packages',
                );
                context.writer.writeln();
                writeUsage(context, [
                    [
                        'pkg source',
                        t.t(
                            'cli.pkg.source.help.show_current_source',
                            'Show current source',
                        ),
                    ],
                    [
                        'pkg source get',
                        t.t(
                            'cli.pkg.source.help.show_current_source',
                            'Show current source',
                        ),
                    ],
                    [
                        'pkg source set <name>',
                        t.t(
                            'cli.pkg.source.help.set_preferred_source',
                            'Set preferred source',
                        ),
                    ],
                ]);
                context.writer.writeln();
                writeSourceList(context, this.loader);
                context.writer.writeln();
                context.writer.writeInfo(
                    'The non-selected sources are used as fallbacks. The marketplace source lists plugins; it is not a download source.',
                );
            },
        };
    }

    // ── Helpers ──

    /**
     * `pkg browse` (no text) and `pkg search <text>`: the marketplace, or
     * when it is off or does not answer, today's npm search and CDN probes.
     */
    private async listPackages(
        context: ICliExecutionContext,
        text?: string,
    ): Promise<void> {
        const t = context.translator;
        const { progressBar, writer } = context;
        const session = this.installer.marketplaceSession(context);
        progressBar.show();

        await withAbortSignal(context, async (signal) => {
            const installed = new Map(
                (await this.manager.getPackages()).map((p) => [
                    p.name,
                    p.version,
                ]),
            );
            const isBundled = (name: string) =>
                !!this.installer.bundledName(name);

            if (session.client) {
                progressBar.setText(
                    text
                        ? `Searching the marketplace for ${text}`
                        : 'Reading the marketplace',
                );
            }
            const fromMarketplace = await session.run(
                (client) => readMarketplaceList(client, text, signal),
                'searching npm',
                signal,
            );
            if (signal.aborted) return;

            if (fromMarketplace) {
                progressBar.complete();
                const { plugins, total } = fromMarketplace;
                if (plugins.length === 0) {
                    writer.writeInfo(
                        text
                            ? `📦 No plugins match "${text}"`
                            : '📦 The marketplace lists no plugins',
                    );
                    return;
                }
                writer.writeln(
                    writer.wrapInColor(
                        text
                            ? `📦 Plugins matching "${text}" (${total}):`
                            : `📦 Marketplace plugins (${total}):`,
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();
                writePackageList(
                    context,
                    marketplaceRows(
                        context,
                        plugins,
                        this.installer.prefix,
                        installed,
                        isBundled,
                    ),
                );
                if (plugins.length < total) {
                    writer.writeln();
                    writer.writeInfo(
                        `Showing ${plugins.length} of ${total}: narrow it with pkg search <text>`,
                    );
                }
            } else {
                const available = await collectAvailablePackages(
                    this.loader,
                    this.installer.prefix,
                    signal,
                    (status) => progressBar.setText(status),
                );
                if (signal.aborted) return;
                progressBar.complete();
                const matching = text
                    ? filterPackages(available, text)
                    : available;
                if (matching.length === 0) {
                    writer.writeInfo(
                        text
                            ? `📦 No packages match "${text}"`
                            : '📦 No packages found across any source',
                    );
                    return;
                }
                writer.writeln(
                    writer.wrapInColor(
                        text
                            ? `📦 Packages matching "${text}" (${matching.length}):`
                            : `📦 Available packages (${matching.length}):`,
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();
                writePackageList(
                    context,
                    matching.map((pkg: AvailablePackage) => ({
                        name: pkg.shortName,
                        version: `v${pkg.version}`,
                        status: installStatus(
                            context,
                            pkg.version,
                            installed.get(pkg.name),
                            isBundled(pkg.name),
                        ),
                        detail: `[${pkg.source}]`,
                        description: pkg.description,
                    })),
                );
            }

            writer.writeln();
            writeHint(
                context,
                'pkg add <name>',
                t.t(
                    'cli.pkg.browse.help.install_package',
                    'to install a package',
                ),
            );
        });
    }

    /** `pkg info <name>`: the marketplace's record, or the npm registry document. */
    private async showInfo(
        name: string,
        context: ICliExecutionContext,
        signal: AbortSignal,
    ): Promise<void> {
        const { progressBar, writer } = context;
        const session = this.installer.marketplaceSession(context);
        progressBar.show();
        progressBar.setText(`Fetching ${name}`);

        try {
            let listed: boolean | undefined;
            const matches = await session.run(
                (client) => client.resolve(name, signal),
                'using npm',
                signal,
            );
            if (signal.aborted) return;
            if (matches) {
                listed = matches.length > 0;
                if (listed) {
                    const picked = pickResolvedPlugin(name, matches);
                    if (!picked) {
                        progressBar.complete();
                        writeCandidates(context, name, matches, 'pkg info');
                        return;
                    }
                    const plugin = await session.run(
                        (client) =>
                            client.plugin(picked.name, API_VERSION, signal),
                        'using npm',
                        signal,
                    );
                    if (signal.aborted) return;
                    if (plugin) {
                        progressBar.complete();
                        const installed = await this.manager.getPackage(
                            plugin.name,
                        );
                        writeMarketplaceInfo(
                            context,
                            plugin,
                            this.installer.prefix,
                            installed?.version,
                        );
                        return;
                    }
                }
            }

            // npm: the prefixed name, then the name as given
            const fullName = toFullPackageName(name, this.installer.prefix);
            let doc = await fetchRegistryDocument(
                this.loader,
                fullName,
                signal,
            ).catch(() => undefined);
            let docName = fullName;
            if (!doc && fullName !== name && !signal.aborted) {
                doc = await fetchRegistryDocument(
                    this.loader,
                    name,
                    signal,
                ).catch(() => undefined);
                docName = name;
            }
            if (signal.aborted) return;
            progressBar.complete();
            if (!doc) {
                writer.writeError(
                    `Package ${name} not found, or the registry is unreachable`,
                );
                return;
            }
            writeRegistryInfo(context, docName, doc);
            if (listed === false) {
                writer.writeln();
                writer.writeWarning(
                    'Not listed in the marketplace: not reviewed',
                );
            }
        } catch (e: any) {
            if (signal.aborted) return;
            progressBar.complete();
            writer.writeError(e?.message ?? String(e));
        }
    }

    /** `pkg publish <name>`: queue an npm package for indexing and review. */
    private async submit(
        name: string,
        context: ICliExecutionContext,
        signal: AbortSignal,
    ): Promise<void> {
        const { writer } = context;
        const client = this.installer.marketplaceClient();
        if (!client) {
            writer.writeError(
                'No marketplace is configured for this CLI (packageSources.marketplace is off)',
            );
            return;
        }

        try {
            const result = await client.submit(name, signal);
            if (signal.aborted) return;
            if (result.status === 'known' && result.plugin) {
                writer.writeInfo(
                    `${result.plugin.name} is already known to the marketplace (${result.plugin.status}); it is indexed again to pick up new versions`,
                );
            } else {
                writer.writeSuccess(`Submitted ${name} to ${client.baseUrl}`);
            }
            writer.writeln();
            writer.writeln('What happens next:');
            writer.writeln(
                '  1. The marketplace reads the package from npm: its browser bundle (unpkg, umd or main), the qodalis block and the bundle hash',
            );
            writer.writeln(
                '  2. A moderator reviews it; new versions of verified publishers are listed at once',
            );
            writer.writeln(
                `  3. Once listed: ${writer.wrapInColor(`pkg info ${name}`, CliForegroundColor.Cyan)}, ${writer.wrapInColor(`pkg add ${name}`, CliForegroundColor.Cyan)}`,
            );
            writer.writeln();
            writer.writeln(
                `📖 Guide: ${writer.wrapInColor(PUBLISHING_GUIDE_URL, CliForegroundColor.Blue)}`,
            );
        } catch (e: any) {
            if (signal.aborted) return;
            if (e instanceof MarketplaceRequestError) {
                writer.writeError(
                    e.status === 429
                        ? 'Too many submissions from this address, try again later'
                        : `The marketplace refused ${name}: ${e.message}`,
                );
            } else {
                writer.writeError(
                    `Marketplace unreachable (${client.baseUrl}): ${e?.message ?? e}. Try again later`,
                );
            }
        }
    }

    /** Install as a tracked background job (visible in `services`), or inline if that fails. */
    private async installInBackground(
        spec: string,
        context: ICliExecutionContext,
        signal: AbortSignal,
        session: MarketplaceSession,
    ): Promise<void> {
        const { name, version } = parsePackageSpec(spec);
        const bundled = this.installer.bundledName(name);
        if (bundled) {
            context.writer.writeError(
                `Package ${bundled} is built in and cannot be installed with pkg`,
            );
            return;
        }
        const installed = await this.manager.getPackage(name);
        if (installed) {
            context.writer.writeInfo(
                `Package ${installed.name}@${installed.version} is already installed. ` +
                    `Use ${context.writer.wrapInColor(`pkg update ${spec}`, CliForegroundColor.Cyan)} to change its version`,
            );
            return;
        }

        const jobName = `pkg-install:${name}`;
        try {
            context.backgroundServices.register({
                name: jobName,
                description: `Installing package '${name}'`,
                type: 'job',
                onStart: async (ctx) => {
                    ctx.log(`Installing ${spec}`);
                    await this.installer.install(
                        name,
                        context,
                        signal,
                        version,
                        session,
                    );
                    ctx.log(`Installation of ${spec} complete`);
                },
            });
            await context.backgroundServices.start(jobName);
        } catch {
            // Fallback: run directly if service registration fails
            await this.installer.install(
                name,
                context,
                signal,
                version,
                session,
            );
        }
    }
}

/** One page of a search, or every page of the catalog (bounded) for `pkg browse`. */
async function readMarketplaceList(
    client: MarketplaceClient,
    text: string | undefined,
    signal: AbortSignal,
): Promise<{ plugins: MarketplacePluginSummary[]; total: number }> {
    if (text) {
        const page = await client.search(
            { query: text, apiVersion: API_VERSION, pageSize: 50 },
            signal,
        );
        return { plugins: page.items, total: page.total };
    }
    const plugins: MarketplacePluginSummary[] = [];
    let total = 0;
    for (let page = 1; page <= BROWSE_MAX_PAGES; page++) {
        const result = await client.search(
            { apiVersion: API_VERSION, page, pageSize: 100, sort: 'name' },
            signal,
        );
        plugins.push(...result.items);
        total = result.total;
        if (plugins.length >= total || result.items.length === 0) break;
    }
    return { plugins, total };
}

/** `pkg info` from an npm registry document (the fallback). */
function writeRegistryInfo(
    context: ICliExecutionContext,
    name: string,
    doc: PackageRegistryDocument,
): void {
    const { writer } = context;
    const label = (text: string) =>
        writer.wrapInColor(text.padEnd(12), CliForegroundColor.Yellow);
    const latest = doc['dist-tags']?.['latest'];
    const repository =
        typeof doc.repository === 'string'
            ? doc.repository
            : doc.repository?.url?.replace(/^git\+/, '');

    writer.writeln(
        `📦 ${writer.wrapInColor(name, CliForegroundColor.Cyan)}${latest ? ` ${writer.wrapInColor(`v${latest}`, CliForegroundColor.Green)}` : ''}`,
    );
    if (doc.description) writer.writeln(`   ${doc.description}`);
    writer.writeln();
    writer.writeln(
        `  ${label('Versions')}${Object.keys(doc.versions ?? {}).length} (pkg versions ${name})`,
    );
    if (doc.license) writer.writeln(`  ${label('License')}${doc.license}`);
    for (const [title, url] of [
        ['Homepage', doc.homepage],
        ['Repository', repository],
        ['npm', `https://www.npmjs.com/package/${name}`],
    ] as [string, string | undefined][]) {
        if (url) {
            writer.writeln(
                `  ${label(title)}${writer.wrapInColor(url, CliForegroundColor.Blue)}`,
            );
        }
    }
}
