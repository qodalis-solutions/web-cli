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
} from './packages/package-installer';
import {
    collectAvailablePackages,
    fetchRegistryDocument,
} from './packages/package-search';
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
            this.addCommand(),
            this.removeCommand(),
            this.versionsCommand(),
            this.checkCommand(),
            this.updateCommand(),
            this.sourceCommand(),
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
            ['pkg ls', t.t('cli.pkg.help.list_installed_packages', 'List installed packages')],
            ['pkg browse', t.t('cli.pkg.help.browse_all_available_packages', 'Browse all available packages')],
            ['pkg add <package>[@version]', t.t('cli.pkg.help.install_package', 'Install a package')],
            ['pkg remove|rm <package>', t.t('cli.pkg.help.remove_package', 'Remove a package')],
            ['pkg versions <package>', t.t('cli.pkg.help.show_all_published_versions', 'Show all published versions')],
            ['pkg check', t.t('cli.pkg.help.check_available_updates', 'Check for available updates')],
            ['pkg update [package][@version]', t.t('cli.pkg.help.update_one_all_packages', 'Update one or all packages')],
            ['pkg source [get|set <name>]', t.t('cli.pkg.help.get_set_package_source', 'Get or set package source')],
        ]);
        writer.writeln();
        writer.writeln(
            `🌐 Browse packages: ${writer.wrapInColor('https://www.npmjs.com/org/qodalis', CliForegroundColor.Blue)}`,
        );
        writer.writeln();
        writeExamples(context, [
            ['pkg add guid', t.t('cli.pkg.help.install_qodalis_cli_guid', 'Install @qodalis/cli-guid')],
            ['pkg add guid server-logs', t.t('cli.pkg.help.install_multiple_packages', 'Install multiple packages')],
            ['pkg update', t.t('cli.pkg.help.update_all_packages', 'Update all packages')],
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
                const packages = await this.manager.getPackages();
                if (packages.length === 0) {
                    writeNoPackages(context);
                    return;
                }

                writer.writeln(
                    writer.wrapInColor(
                        `📦 Installed packages (${packages.length}):`,
                        CliForegroundColor.Yellow,
                    ),
                );
                for (const pkg of packages) {
                    writer.writeln(
                        `  ${writer.wrapInColor(pkg.name, CliForegroundColor.Cyan)}@${writer.wrapInColor(pkg.version, CliForegroundColor.Green)}`,
                    );
                }
            },
            writeDescription: (context) => {
                context.writer.writeln(
                    'List all installed packages and their versions',
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
                'List all available packages from all configured sources',
            processCommand: async (_, context) => {
                const t = context.translator;
                const { progressBar, writer } = context;
                progressBar.show();
                context.notifier.info('Browsing packages');

                const available = await withAbortSignal(context, (signal) =>
                    collectAvailablePackages(
                        this.loader,
                        this.installer.prefix,
                        signal,
                        (text) => progressBar.setText(text),
                    ).then((list) => (signal.aborted ? undefined : list)),
                );
                if (!available) return;
                progressBar.complete();

                if (available.length === 0) {
                    writer.writeInfo('📦 No packages found across any source');
                    return;
                }

                const installed = new Map(
                    (await this.manager.getPackages()).map((p) => [
                        p.name,
                        p.version,
                    ]),
                );

                writer.writeln(
                    writer.wrapInColor(
                        `📦 Available packages (${available.length}):`,
                        CliForegroundColor.Yellow,
                    ),
                );
                writer.writeln();

                for (const pkg of available) {
                    const installedVersion = installed.get(pkg.name);
                    const status = !installedVersion
                        ? writer.wrapInColor(
                              '📥 not installed',
                              CliForegroundColor.Magenta,
                          )
                        : isNewerVersion(pkg.version, installedVersion)
                          ? writer.wrapInColor(
                                `🔄 ${installedVersion} → ${pkg.version}`,
                                CliForegroundColor.Yellow,
                            )
                          : writer.wrapInColor(
                                '✅ installed',
                                CliForegroundColor.Green,
                            );

                    writer.writeln(
                        `  ${writer.wrapInColor(pkg.shortName, CliForegroundColor.Cyan)}  ${writer.wrapInColor(`v${pkg.version}`, CliForegroundColor.Green)}  ${status}  ${writer.wrapInColor(`[${pkg.source}]`, CliForegroundColor.Blue)}`,
                    );
                    if (pkg.description) {
                        writer.writeln(`    ${pkg.description}`);
                    }
                }

                writer.writeln();
                writeHint(context, 'pkg add <name>', t.t('cli.pkg.browse.help.install_package', 'to install a package'));
            },
            writeDescription: (context) => {
                const { writer } = context;
                writer.writeln(
                    'Browse all available packages across all configured sources',
                );
                writer.writeln();
                writeUsage(context, [['pkg browse', '']]);
                writer.writeln();
                writer.writeln(
                    'Shows each package with its latest version, install status, and source:',
                );
                writer.writeln(
                    `  ${writer.wrapInColor('✅ installed', CliForegroundColor.Green)}      Already installed and up to date`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('🔄 update', CliForegroundColor.Yellow)}         Installed but a newer version exists`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('📥 not installed', CliForegroundColor.Magenta)}  Not yet installed`,
                );
                writer.writeln();
                writer.writeln('🌐 Sources queried:');
                writer.writeln(
                    `  ${writer.wrapInColor('registry', CliForegroundColor.Cyan)}  npm-compatible search API (e.g. npmjs.org, Verdaccio)`,
                );
                writer.writeln(
                    `  ${writer.wrapInColor('file', CliForegroundColor.Cyan)}      Static file servers, probed for known packages`,
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
                    for (const spec of splitPackageArgs(command.value)) {
                        if (signal.aborted) break;
                        context.notifier.info(`Installing ${spec}`);
                        await this.installInBackground(spec, context, signal);
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
                    ['pkg add guid', t.t('cli.pkg.add.help.short_name', 'Short name')],
                    ['pkg add @qodalis/cli-guid', t.t('cli.pkg.add.help.full_name', 'Full name')],
                    ['pkg add guid server-logs', t.t('cli.pkg.add.help.multiple_packages', 'Multiple packages')],
                    ['pkg add guid@2.0.0-beta.17', t.t('cli.pkg.add.help.specific_version', 'Specific version')],
                ]);
                context.writer.writeln();
                context.writer.writeInfo(
                    '💡 Short names are automatically prefixed with @qodalis/cli-',
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
                    ['pkg remove guid', t.t('cli.pkg.remove.help.remove_one_package', 'Remove one package')],
                    ['pkg remove guid server-logs', t.t('cli.pkg.remove.help.remove_multiple', 'Remove multiple')],
                    ['pkg rm guid', t.t('cli.pkg.remove.help.short_alias', 'Short alias')],
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
                    ['pkg versions guid', t.t('cli.pkg.versions.help.short_name', 'Short name')],
                    ['pkg versions @qodalis/cli-guid', t.t('cli.pkg.versions.help.full_name', 'Full name')],
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
                const packages = await this.manager.getPackages();
                if (packages.length === 0) {
                    writeNoPackages(context);
                    return;
                }

                progressBar.show();
                progressBar.setText(
                    `Checking ${packages.length} package${packages.length !== 1 ? 's' : ''}`,
                );

                const results = await withAbortSignal(
                    context,
                    async (signal) => {
                        const checked = await Promise.all(
                            packages.map((pkg) =>
                                this.installer
                                    .fetchInfo(pkg.name, signal)
                                    .then((info) => ({
                                        pkg,
                                        latest: info.version,
                                        failed: false,
                                    }))
                                    .catch(() => ({
                                        pkg,
                                        latest: undefined,
                                        failed: true,
                                    })),
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
                    for (const { pkg, latest } of updates) {
                        writer.writeln(
                            `  ${writer.wrapInColor(pkg.name, CliForegroundColor.Cyan)}  ${writer.wrapInColor(pkg.version, CliForegroundColor.Red)} → ${writer.wrapInColor(latest!, CliForegroundColor.Green)}`,
                        );
                    }
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
                    for (const { pkg } of upToDate) {
                        writer.writeln(
                            `  ${writer.wrapInColor(pkg.name, CliForegroundColor.Cyan)}`,
                        );
                    }
                }

                if (failed.length > 0) {
                    writer.writeln();
                    for (const { pkg } of failed) {
                        writer.writeWarning(`⚠️  ${pkg.name}: Failed to check`);
                    }
                }

                if (updates.length === 0 && failed.length === 0) {
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
                writeHint(context, 'pkg update', t.t('cli.pkg.check.help.apply_updates', 'to apply updates'));
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
                    const spec = joinShellWords(command.value ?? '');
                    if (spec) {
                        const { name, version } = parsePackageSpec(spec);
                        await this.installer.update(
                            name,
                            context,
                            signal,
                            version,
                        );
                        return;
                    }

                    const packages = [...(await this.manager.getPackages())];
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
                    ['pkg update <package>', t.t('cli.pkg.update.help.update_latest', 'Update to latest')],
                    [
                        'pkg update <package>@<version>',
                        t.t('cli.pkg.update.help.update_specific_version', 'Update to specific version'),
                    ],
                    ['pkg update', t.t('cli.pkg.update.help.update_all_packages', 'Update all packages')],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['pkg update guid', t.t('cli.pkg.update.help.update_latest', 'Update to latest')],
                    ['pkg update guid@1.0.2', t.t('cli.pkg.update.help.install_specific_version', 'Install specific version')],
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
                        const sources = this.loader.getSources();
                        let value = joinShellWords(command.value ?? '').toLowerCase();

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
                writeHint(context, 'pkg source set <name>', t.t('cli.pkg.source.help.change', 'to change'));
            },
            writeDescription: (context) => {
                const t = context.translator;
                context.writer.writeln(
                    'Manage the source used for downloading packages',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['pkg source', t.t('cli.pkg.source.help.show_current_source', 'Show current source')],
                    ['pkg source get', t.t('cli.pkg.source.help.show_current_source', 'Show current source')],
                    ['pkg source set <name>', t.t('cli.pkg.source.help.set_preferred_source', 'Set preferred source')],
                ]);
                context.writer.writeln();
                writeSourceList(context, this.loader);
                context.writer.writeln();
                context.writer.writeInfo(
                    'The non-selected sources are used as fallbacks.',
                );
            },
        };
    }

    // ── Helpers ──

    /** Install as a tracked background job (visible in `services`), or inline if that fails. */
    private async installInBackground(
        spec: string,
        context: ICliExecutionContext,
        signal: AbortSignal,
    ): Promise<void> {
        const { name, version } = parsePackageSpec(spec);
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
                    );
                    ctx.log(`Installation of ${spec} complete`);
                },
            });
            await context.backgroundServices.start(jobName);
        } catch {
            // Fallback: run directly if service registration fails
            await this.installer.install(name, context, signal, version);
        }
    }
}
