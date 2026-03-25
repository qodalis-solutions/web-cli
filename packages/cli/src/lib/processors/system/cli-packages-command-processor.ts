import {
    CliForegroundColor,
    CliProcessorMetadata,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    ICliCommandProcessorRegistry,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUmdModule,
    Package,
} from '@qodalis/cli-core';
import {
    CliPackageManagerService_TOKEN,
    CliProcessorsRegistry_TOKEN,
} from '../../tokens';
import {
    CdnSourceName,
    ScriptLoaderService,
    SourceKind,
} from '../../services/script-loader';
import { CliPackageManagerService } from '../../services/cli-package-manager';

export class CliPackagesCommandProcessor implements ICliCommandProcessor {
    readonly command = 'pkg';

    readonly aliases = ['packages'];

    description = 'Manage packages in the cli';

    author = DefaultLibraryAuthor;

    readonly version = '1.0.3';

    readonly processors?: ICliCommandProcessor[] | undefined = [];

    readonly metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '📦',
        module: 'system',
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {
            cdnSource: 'unpkg',
        },
    };

    private registeredDependencies: string[] = [];
    private scriptsLoader!: ScriptLoaderService;
    private packagesManager!: CliPackageManagerService;
    private registry!: ICliCommandProcessorRegistry;

    private createAbortSignal(context: ICliExecutionContext): {
        signal: AbortSignal;
        cleanup: () => void;
    } {
        const controller = new AbortController();
        const subscription = context.onAbort.subscribe(() => {
            controller.abort();
        });

        return {
            signal: controller.signal,
            cleanup: () => subscription.unsubscribe(),
        };
    }

    constructor() {
        this.scriptsLoader = new ScriptLoaderService();
        this.packagesManager = new CliPackageManagerService();

        const scope = this;
        const scriptsLoader = this.scriptsLoader;
        const packagesManager = this.packagesManager;

        this.processors = [
            {
                command: 'ls',
                description: 'List all packages in the cli',
                author: DefaultLibraryAuthor,
                async processCommand(_, context) {
                    const packages = await packagesManager.getPackages();

                    if (packages.length === 0) {
                        context.writer.writeInfo('📦 No packages installed');
                        context.writer.writeln();
                        context.writer.writeInfo(
                            `💡 Use ${context.writer.wrapInColor('pkg add <name>', CliForegroundColor.Cyan)} to install a package`,
                        );
                        return;
                    }

                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `📦 Installed packages (${packages.length}):`,
                            CliForegroundColor.Yellow,
                        ),
                    );

                    packages.forEach((pkg) => {
                        context.writer.writeln(
                            `  ${context.writer.wrapInColor(pkg.name, CliForegroundColor.Cyan)}@${context.writer.wrapInColor(pkg.version, CliForegroundColor.Green)}`,
                        );
                    });
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'List all installed packages and their versions',
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg ls', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'browse',
                description:
                    'List all available packages from all configured sources',
                async processCommand(_, context) {
                    const { progressBar, writer } = context;
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    progressBar.show();
                    context.setStatusText('Browsing packages');

                    const prefix = packagesManager.QODALIS_COMMAND_PREFIX;

                    const knownShortNames = [
                        'browser-storage',
                        'curl',
                        'guid',
                        'password-generator',
                        'qr',
                        'regex',
                        'server-logs',
                        'speed-test',
                        'string',
                        'text-to-image',
                        'todo',
                        'yesno',
                    ];

                    // Merged results: keyed by package name
                    const packagesMap = new Map<
                        string,
                        {
                            name: string;
                            shortName: string;
                            version: string;
                            description: string;
                            source: string;
                        }
                    >();

                    // 1. Query registry sources (npm-compatible search API)
                    const registrySources =
                        scriptsLoader.getSourcesByKind('registry');
                    for (const regSource of registrySources) {
                        if (signal.aborted) break;

                        progressBar.setText(
                            `Searching ${regSource.name} registry`,
                        );

                        try {
                            const searchUrl = `${regSource.url}-/v1/search?text=${encodeURIComponent(prefix)}&size=250`;
                            const response = await scriptsLoader.getScript(
                                searchUrl,
                                { signal },
                            );

                            const data = JSON.parse(response.content || '{}');

                            for (const obj of data.objects || []) {
                                const pkg = obj.package;
                                if (
                                    !pkg.name.startsWith(prefix) ||
                                    pkg.name === `${prefix}core`
                                ) {
                                    continue;
                                }

                                if (!packagesMap.has(pkg.name)) {
                                    packagesMap.set(pkg.name, {
                                        name: pkg.name,
                                        shortName: pkg.name.replace(prefix, ''),
                                        version: pkg.version,
                                        description: pkg.description || '',
                                        source: regSource.name,
                                    });
                                }
                            }
                        } catch (e: any) {
                            if (signal.aborted) break;
                            // Registry unavailable, continue with other sources
                        }
                    }

                    // 2. Probe file sources for known packages
                    const fileSources = scriptsLoader.getSourcesByKind('file');
                    for (const fileSource of fileSources) {
                        if (signal.aborted) break;

                        progressBar.setText(`Scanning ${fileSource.name}`);

                        for (const shortName of knownShortNames) {
                            if (signal.aborted) break;

                            const fullName = `${prefix}${shortName}`;
                            progressBar.setText(
                                `Scanning ${fileSource.name}: ${shortName}`,
                            );

                            try {
                                const pkgUrl = `${fileSource.url}${fullName}/package.json`;
                                const response = await scriptsLoader.getScript(
                                    pkgUrl,
                                    { signal },
                                );

                                const packageInfo = JSON.parse(
                                    response.content || '{}',
                                );

                                const existing = packagesMap.get(fullName);
                                if (existing) {
                                    // Append source name if different version or same
                                    if (
                                        !existing.source.includes(
                                            fileSource.name,
                                        )
                                    ) {
                                        existing.source += `, ${fileSource.name}`;
                                    }
                                    // If file source has a newer version, update
                                    if (
                                        packageInfo.version &&
                                        packageInfo.version !== existing.version
                                    ) {
                                        existing.version = packageInfo.version;
                                        existing.source = fileSource.name;
                                    }
                                } else {
                                    packagesMap.set(fullName, {
                                        name: fullName,
                                        shortName,
                                        version:
                                            packageInfo.version || 'latest',
                                        description:
                                            packageInfo.description || '',
                                        source: fileSource.name,
                                    });
                                }
                            } catch {
                                // Not available on this source, skip
                            }
                        }
                    }

                    cleanup();

                    if (signal.aborted) return;

                    progressBar.complete();

                    const allPackages = Array.from(packagesMap.values()).sort(
                        (a, b) => a.name.localeCompare(b.name),
                    );

                    if (allPackages.length === 0) {
                        writer.writeInfo(
                            '📦 No packages found across any source',
                        );
                        return;
                    }

                    const installed = await packagesManager.getPackages();
                    const installedMap = new Map(
                        installed.map((p) => [p.name, p.version]),
                    );

                    writer.writeln(
                        writer.wrapInColor(
                            `📦 Available packages (${allPackages.length}):`,
                            CliForegroundColor.Yellow,
                        ),
                    );
                    writer.writeln();

                    for (const pkg of allPackages) {
                        const installedVersion = installedMap.get(pkg.name);

                        let status: string;
                        if (installedVersion) {
                            if (installedVersion === pkg.version) {
                                status = writer.wrapInColor(
                                    '✅ installed',
                                    CliForegroundColor.Green,
                                );
                            } else {
                                status = writer.wrapInColor(
                                    `🔄 ${installedVersion} → ${pkg.version}`,
                                    CliForegroundColor.Yellow,
                                );
                            }
                        } else {
                            status = writer.wrapInColor(
                                '📥 not installed',
                                CliForegroundColor.Magenta,
                            );
                        }

                        const sourceTag = writer.wrapInColor(
                            `[${pkg.source}]`,
                            CliForegroundColor.Blue,
                        );

                        writer.writeln(
                            `  ${writer.wrapInColor(pkg.shortName, CliForegroundColor.Cyan)}  ${writer.wrapInColor(`v${pkg.version}`, CliForegroundColor.Green)}  ${status}  ${sourceTag}`,
                        );

                        if (pkg.description) {
                            writer.writeln(`    ${pkg.description}`);
                        }
                    }

                    writer.writeln();
                    writer.writeInfo(
                        `💡 Use ${writer.wrapInColor('pkg add <name>', CliForegroundColor.Cyan)} to install a package`,
                    );
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'Browse all available packages across all configured sources',
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg browse', CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln();
                    context.writer.writeln(
                        'Shows each package with its latest version, install status, and source:',
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('✅ installed', CliForegroundColor.Green)}     Already installed and up to date`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('🔄 update', CliForegroundColor.Yellow)}        Installed but a newer version exists`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('📥 not installed', CliForegroundColor.Magenta)}  Not yet installed`,
                    );
                    context.writer.writeln();
                    context.writer.writeln('🌐 Sources queried:');
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('registry', CliForegroundColor.Cyan)}  npm-compatible search API (e.g. npmjs.org, Verdaccio)`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('file', CliForegroundColor.Cyan)}      Static file servers, probed for known packages`,
                    );
                },
            },
            {
                command: 'add',
                description: 'Add a package to the cli, e.g. pkg add guid.',
                valueRequired: true,
                async processCommand(command, context) {
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    const packages = command.value!.split(' ');
                    for (const pkg of packages) {
                        if (signal.aborted) break;
                        context.setStatusText(`Installing ${pkg}`);
                        await scope.addPackage(pkg, context, signal);
                    }

                    cleanup();
                },
                writeDescription(context) {
                    const { writer } = context;
                    writer.writeln(
                        'Install one or more packages from the Qodalis registry',
                    );
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('pkg add <package> [package2...]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  pkg add guid                        ${writer.wrapInColor('# Short name', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  pkg add @qodalis/cli-guid           ${writer.wrapInColor('# Full name', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  pkg add guid server-logs            ${writer.wrapInColor('# Multiple packages', CliForegroundColor.Green)}`,
                    );
                    writer.writeln();
                    writer.writeInfo(
                        '💡 Short names are automatically prefixed with @qodalis/cli-',
                    );
                },
            },
            {
                command: 'remove',
                description: 'Remove a package from the cli',
                valueRequired: true,
                async processCommand(command, context) {
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    const packages = command.value!.split(' ');
                    for (const pkg of packages) {
                        if (signal.aborted) break;
                        context.setStatusText(`Removing ${pkg}`);
                        await scope.removePackage(pkg, context);
                    }

                    cleanup();
                },
                writeDescription(context) {
                    const { writer } = context;
                    writer.writeln('Remove one or more installed packages');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('pkg remove <package> [package2...]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  pkg remove guid                     ${writer.wrapInColor('# Remove one package', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  pkg remove guid server-logs         ${writer.wrapInColor('# Remove multiple', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'versions',
                description: 'Show all published versions of a package',
                valueRequired: true,
                acceptsRawInput: true,
                async processCommand(command, context) {
                    const { progressBar, writer } = context;
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    const name = command.value!.trim();
                    const prefix = packagesManager.QODALIS_COMMAND_PREFIX;
                    const fullName = name.startsWith(prefix)
                        ? name
                        : `${prefix}${name}`;

                    progressBar.show();
                    progressBar.setText(`Fetching versions for ${name}`);
                    context.setStatusText(`Fetching versions for ${name}`);

                    try {
                        const response = await scriptsLoader.getScript(
                            `https://registry.npmjs.org/${encodeURIComponent(fullName)}`,
                            { signal },
                        );

                        if (signal.aborted) {
                            cleanup();
                            return;
                        }

                        const data = JSON.parse(response.content || '{}');

                        if (!data.versions) {
                            progressBar.complete();
                            writer.writeError(`Package ${name} not found`);
                            cleanup();
                            return;
                        }

                        const versions = Object.keys(data.versions);
                        const time: Record<string, string> = data.time || {};
                        const latest = data['dist-tags']?.latest || '';

                        const installed =
                            await packagesManager.getPackage(name);

                        progressBar.complete();

                        writer.writeln(
                            writer.wrapInColor(
                                `📦 ${fullName} — ${versions.length} version${versions.length !== 1 ? 's' : ''}:`,
                                CliForegroundColor.Yellow,
                            ),
                        );
                        writer.writeln();

                        for (const version of versions) {
                            const publishDate = time[version]
                                ? new Date(time[version]).toLocaleDateString()
                                : '';

                            const tags: string[] = [];

                            if (version === latest) {
                                tags.push(
                                    writer.wrapInColor(
                                        'latest',
                                        CliForegroundColor.Green,
                                    ),
                                );
                            }

                            if (installed && installed.version === version) {
                                tags.push(
                                    writer.wrapInColor(
                                        'installed',
                                        CliForegroundColor.Cyan,
                                    ),
                                );
                            }

                            const tagStr =
                                tags.length > 0 ? `  [${tags.join(', ')}]` : '';

                            writer.writeln(
                                `  ${writer.wrapInColor(`v${version}`, CliForegroundColor.White)}  ${writer.wrapInColor(publishDate, CliForegroundColor.Yellow)}${tagStr}`,
                            );
                        }

                        writer.writeln();
                    } catch (e: any) {
                        if (signal.aborted) {
                            cleanup();
                            return;
                        }
                        progressBar.complete();
                        writer.writeError(
                            e?.toString() || 'Failed to fetch versions',
                        );
                    }

                    cleanup();
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'Show all published versions of a package from the npm registry',
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg versions <package>', CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    context.writer.writeln(
                        `  pkg versions guid                   ${context.writer.wrapInColor('# Short name', CliForegroundColor.Green)}`,
                    );
                    context.writer.writeln(
                        `  pkg versions @qodalis/cli-guid      ${context.writer.wrapInColor('# Full name', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'check',
                description: 'Check installed packages for available updates',
                async processCommand(_, context) {
                    const packages = await packagesManager.getPackages();

                    if (packages.length === 0) {
                        context.writer.writeInfo('📦 No packages installed');
                        context.writer.writeln();
                        context.writer.writeInfo(
                            `💡 Use ${context.writer.wrapInColor('pkg add <name>', CliForegroundColor.Cyan)} to install a package`,
                        );
                        return;
                    }

                    const { progressBar, writer } = context;
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    progressBar.show();

                    const updates: {
                        name: string;
                        current: string;
                        latest: string;
                    }[] = [];
                    const upToDate: string[] = [];
                    const errors: { name: string; error: string }[] = [];

                    for (const pkg of packages) {
                        if (signal.aborted) break;

                        progressBar.setText(`Checking ${pkg.name}`);

                        try {
                            const packageInfo = await scriptsLoader
                                .getScriptWithFallback(
                                    `${pkg.name}/package.json`,
                                    { signal },
                                )
                                .then((response) =>
                                    JSON.parse(response.content || '{}'),
                                );

                            if (
                                packageInfo.version &&
                                packageInfo.version !== pkg.version
                            ) {
                                updates.push({
                                    name: pkg.name,
                                    current: pkg.version,
                                    latest: packageInfo.version,
                                });
                            } else {
                                upToDate.push(pkg.name);
                            }
                        } catch {
                            if (signal.aborted) break;
                            errors.push({
                                name: pkg.name,
                                error: 'Failed to check',
                            });
                        }
                    }

                    cleanup();

                    if (signal.aborted) return;

                    progressBar.complete();

                    if (updates.length > 0) {
                        writer.writeln(
                            writer.wrapInColor(
                                `🔄 Updates available (${updates.length}):`,
                                CliForegroundColor.Yellow,
                            ),
                        );
                        writer.writeln();

                        for (const u of updates) {
                            writer.writeln(
                                `  ${writer.wrapInColor(u.name, CliForegroundColor.Cyan)}  ${writer.wrapInColor(u.current, CliForegroundColor.Red)} → ${writer.wrapInColor(u.latest, CliForegroundColor.Green)}`,
                            );
                        }

                        writer.writeln();
                        writer.writeInfo(
                            `💡 Run ${writer.wrapInColor('pkg update', CliForegroundColor.Cyan)} to update all packages`,
                        );
                    }

                    if (upToDate.length > 0) {
                        if (updates.length > 0) {
                            writer.writeln();
                        }
                        writer.writeln(
                            writer.wrapInColor(
                                `✅ Up to date (${upToDate.length}):`,
                                CliForegroundColor.Green,
                            ),
                        );
                        writer.writeln();

                        for (const name of upToDate) {
                            writer.writeln(
                                `  ${writer.wrapInColor(name, CliForegroundColor.Cyan)}`,
                            );
                        }
                    }

                    if (errors.length > 0) {
                        writer.writeln();
                        for (const e of errors) {
                            writer.writeWarning(`⚠️  ${e.name}: ${e.error}`);
                        }
                    }

                    if (updates.length === 0 && errors.length === 0) {
                        writer.writeln();
                        writer.writeSuccess('🎉 All packages are up to date!');
                    }
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'Check installed packages for newer versions available on the registry',
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg check', CliForegroundColor.Cyan)}`,
                    );
                    context.writer.writeln();
                    context.writer.writeInfo(
                        `💡 Use ${context.writer.wrapInColor('pkg update', CliForegroundColor.Cyan)} to apply updates`,
                    );
                },
            },
            {
                command: 'update',
                description:
                    'Update a package in the cli to the latest version or update all packages',
                acceptsRawInput: true,
                valueRequired: false,
                async processCommand(command, context) {
                    const { signal, cleanup } =
                        scope.createAbortSignal(context);

                    if (command.value) {
                        const raw = command.value!.trim();
                        const atIndex = raw.lastIndexOf('@');
                        let name: string;
                        let version: string | undefined;

                        if (
                            atIndex > 0 &&
                            !raw.slice(0, atIndex).endsWith('/')
                        ) {
                            name = raw.slice(0, atIndex);
                            version = raw.slice(atIndex + 1);
                        } else {
                            name = raw;
                        }

                        await scope.updatePackage(
                            name,
                            context,
                            signal,
                            version,
                        );
                    } else {
                        const packages = await packagesManager.getPackages();
                        for (const pkg of packages) {
                            if (signal.aborted) break;
                            await scope.updatePackage(
                                pkg.name,
                                context,
                                signal,
                            );
                        }

                        if (!signal.aborted) {
                            context.writer.writeSuccess('All packages updated');
                        }
                    }

                    cleanup();
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'Update packages to their latest versions or to a specific version',
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg update <package>', CliForegroundColor.Cyan)}            Update to latest`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg update <package>@<version>', CliForegroundColor.Cyan)}  Update to specific version`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg update', CliForegroundColor.Cyan)}                      Update all packages`,
                    );
                    context.writer.writeln();
                    context.writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    context.writer.writeln(
                        `  pkg update guid             ${context.writer.wrapInColor('# Update to latest', CliForegroundColor.Green)}`,
                    );
                    context.writer.writeln(
                        `  pkg update guid@1.0.2       ${context.writer.wrapInColor('# Install specific version', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'source',
                description: 'Get or set the package source for downloads',
                acceptsRawInput: true,
                processors: [
                    {
                        command: 'get',
                        description: 'Show the current CDN source',
                        async processCommand(_, context) {
                            const current = scriptsLoader.getCdnSource();
                            const allSources = scriptsLoader.getSources();
                            const fallbacks = allSources.filter(
                                (s) => s !== current,
                            );

                            context.writer.writeln(
                                `🌐 Current source: ${context.writer.wrapInColor(current, CliForegroundColor.Cyan)}`,
                            );

                            if (fallbacks.length > 0) {
                                context.writer.writeln(
                                    `   Fallbacks: ${fallbacks.map((s) => context.writer.wrapInColor(s, CliForegroundColor.Yellow)).join(', ')}`,
                                );
                            }
                        },
                    },
                    {
                        command: 'set',
                        description:
                            'Set the preferred package source (interactive if no name given)',
                        acceptsRawInput: true,
                        async processCommand(command, context) {
                            let value = (command.value || '')
                                .trim()
                                .toLowerCase();
                            const allSources = scriptsLoader.getSources();

                            if (!value) {
                                // Interactive selection
                                const current = scriptsLoader.getCdnSource();
                                const options = allSources.map((name) => {
                                    const entry = scriptsLoader.getSource(name);
                                    const active =
                                        name === current ? ' (active)' : '';
                                    return {
                                        label: `${name}${active}  ${entry?.url || ''}`,
                                        value: name,
                                    };
                                });

                                const selected =
                                    await context.reader.readSelect(
                                        'Select package source:',
                                        options,
                                    );

                                if (!selected) {
                                    context.writer.writeInfo(
                                        'Source selection cancelled',
                                    );
                                    return;
                                }
                                value = selected;
                            }

                            if (!allSources.includes(value)) {
                                context.writer.writeError(
                                    `Invalid source "${value}". Available sources: ${allSources.join(', ')}`,
                                );
                                return;
                            }

                            scriptsLoader.setCdnSource(value);
                            context.state.updateState({ cdnSource: value });
                            await context.state.persist();

                            context.writer.writeSuccess(
                                `Package source set to ${context.writer.wrapInColor(value, CliForegroundColor.Cyan)}`,
                            );

                            const fallbacks = allSources.filter(
                                (s) => s !== value,
                            );
                            if (fallbacks.length > 0) {
                                context.writer.writeln(
                                    `   Fallbacks: ${fallbacks.map((s) => context.writer.wrapInColor(s, CliForegroundColor.Yellow)).join(', ')}`,
                                );
                            }
                        },
                        writeDescription(context) {
                            const allSources = scriptsLoader.getSources();
                            context.writer.writeln(
                                'Set the preferred source for package downloads',
                            );
                            context.writer.writeln();
                            context.writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                            context.writer.writeln(
                                `  ${context.writer.wrapInColor('pkg source set <name>', CliForegroundColor.Cyan)}`,
                            );
                            context.writer.writeln();
                            context.writer.writeln('🌐 Available sources:');
                            for (const name of allSources) {
                                const entry = scriptsLoader.getSource(name);
                                const kindTag = entry ? `[${entry.kind}]` : '';
                                context.writer.writeln(
                                    `  ${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}  ${context.writer.wrapInColor(kindTag, CliForegroundColor.Yellow)}  ${entry?.url || ''}`,
                                );
                            }
                        },
                    },
                ],
                async processCommand(_, context) {
                    const current = scriptsLoader.getCdnSource();
                    const allSources = scriptsLoader.getSources();
                    const fallbacks = allSources.filter((s) => s !== current);

                    context.writer.writeln(
                        `🌐 Current source: ${context.writer.wrapInColor(current, CliForegroundColor.Cyan)}`,
                    );

                    if (fallbacks.length > 0) {
                        context.writer.writeln(
                            `   Fallbacks: ${fallbacks.map((s) => context.writer.wrapInColor(s, CliForegroundColor.Yellow)).join(', ')}`,
                        );
                    }

                    context.writer.writeln();
                    context.writer.writeInfo(
                        `💡 Use ${context.writer.wrapInColor('pkg source set <name>', CliForegroundColor.Cyan)} to change`,
                    );
                },
                writeDescription(context) {
                    const allSources = scriptsLoader.getSources();

                    context.writer.writeln(
                        'Manage the source used for downloading packages',
                    );
                    context.writer.writeln();
                    context.writer.writeln('📋 Commands:');
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg source', CliForegroundColor.Cyan)}                  Show current source`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg source get', CliForegroundColor.Cyan)}              Show current source`,
                    );
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor('pkg source set <name>', CliForegroundColor.Cyan)}       Set preferred source`,
                    );
                    context.writer.writeln();
                    context.writer.writeln('🌐 Available sources:');
                    for (const name of allSources) {
                        const url = scriptsLoader.getSourceUrl(name) || '';
                        context.writer.writeln(
                            `  ${context.writer.wrapInColor(name, CliForegroundColor.Cyan)}       ${url}`,
                        );
                    }
                    context.writer.writeln();
                    context.writer.writeInfo(
                        'The non-selected source is used as a fallback.',
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription?(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('pkg ls', CliForegroundColor.Cyan)}                        List installed packages`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg browse', CliForegroundColor.Cyan)}                      Browse all available packages`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg add <package>', CliForegroundColor.Cyan)}                    Install a package`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg remove <package>', CliForegroundColor.Cyan)}                 Remove a package`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg versions <package>', CliForegroundColor.Cyan)}         Show all published versions`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg check', CliForegroundColor.Cyan)}                        Check for available updates`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg update [package]', CliForegroundColor.Cyan)}                 Update one or all packages`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('pkg source [get|set <name>]', CliForegroundColor.Cyan)}          Get or set package source`,
        );
        writer.writeln();
        writer.writeln(
            `🌐 Browse packages: ${writer.wrapInColor('https://www.npmjs.com/org/qodalis', CliForegroundColor.Blue)}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  pkg add guid                ${writer.wrapInColor('# Install @qodalis/cli-guid', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  pkg add guid server-logs    ${writer.wrapInColor('# Install multiple packages', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  pkg update                  ${writer.wrapInColor('# Update all packages', CliForegroundColor.Green)}`,
        );
    }

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.registry = context.services.get<ICliCommandProcessorRegistry>(
            CliProcessorsRegistry_TOKEN,
        );

        const store = context.services.get<ICliKeyValueStore>(
            'cli-key-value-store',
        );
        this.packagesManager.setStore(store);

        // Expose the package manager so the completion provider can access it
        context.services.set([{
            provide: CliPackageManagerService_TOKEN,
            useValue: this.packagesManager,
        }]);

        // Register custom package sources from options
        const packageSources = context.options?.packageSources;
        if (packageSources?.sources) {
            for (const source of packageSources.sources) {
                this.scriptsLoader.addSource(
                    source.name,
                    source.url,
                    source.kind || 'file',
                );
            }
        }

        // Set primary source from options (if specified and not overridden by persisted state)
        if (packageSources?.primary) {
            this.scriptsLoader.setCdnSource(packageSources.primary);
        }

        context.state
            .select<CdnSourceName>((s) => s['cdnSource'])
            .subscribe((cdnSource) => {
                if (cdnSource) {
                    this.scriptsLoader.setCdnSource(cdnSource);
                }
            });

        const packages = await this.packagesManager.getPackages();

        for (const pkg of packages) {
            await this.registerPackageDependencies(pkg, context);

            await this.injectScriptWithCdnFallback(pkg.url);
        }
    }

    private async removePackage(name: string, context: ICliExecutionContext) {
        context.progressBar.show();

        try {
            const pkg = await this.packagesManager.removePackage(name);

            if (pkg) {
                const module = (window as any)[pkg.name] as ICliUmdModule;
                if (module) {
                    module.processors?.forEach((processor) => {
                        this.registry.unregisterProcessor(processor);
                    });
                }
            }

            context.progressBar.complete();
            context.writer.writeSuccess(
                `Package ${pkg.name}@${pkg.version} removed successfully`,
            );
        } catch (e) {
            context.progressBar.complete();
            context.writer.writeError(e?.toString() || 'Unknown error');
        }
    }

    private async addPackage(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
    ) {
        const hasPackage = await this.packagesManager.hasPackage(name);
        if (hasPackage) {
            context.writer.writeInfo(`Package ${name} already installed`);
            return;
        }

        const jobName = `pkg-install:${name}`;

        try {
            context.backgroundServices.register({
                name: jobName,
                description: `Installing package '${name}'`,
                type: 'job',
                onStart: async (ctx) => {
                    ctx.log(`Installing ${name}`);
                    await this.doAddPackage(name, context, signal);
                    ctx.log(`Installation of ${name} complete`);
                },
            });

            await context.backgroundServices.start(jobName);
        } catch {
            // Fallback: run directly if service registration fails
            await this.doAddPackage(name, context, signal);
        }
    }

    private async doAddPackage(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
    ): Promise<void> {
        const { progressBar } = context;

        progressBar.show();
        progressBar.setText(`Fetching package ${name}`);

        try {
            const primaryName = name.startsWith(
                this.packagesManager.QODALIS_COMMAND_PREFIX,
            )
                ? name
                : `${this.packagesManager.QODALIS_COMMAND_PREFIX}${name}`;

            let packageInfo: any = await this.scriptsLoader
                .getScriptWithFallback(`${primaryName}/package.json`, {
                    signal,
                })
                .then((response) => JSON.parse(response.content || '{}'))
                .catch(() => null);

            if (signal?.aborted) return;

            if (!packageInfo && primaryName !== name) {
                progressBar.setText(`Trying ${name}`);
                packageInfo = await this.scriptsLoader
                    .getScriptWithFallback(`${name}/package.json`, {
                        signal,
                    })
                    .then((response) => JSON.parse(response.content || '{}'))
                    .catch(() => null);
            }

            if (signal?.aborted) return;

            if (!packageInfo) {
                progressBar.setText('Package not found');
                throw new Error(`Package ${name} not found`);
            }

            progressBar.setText('Downloading package');

            const cdnPath = this.resolvePackageCdnPath(packageInfo);
            const response = await this.scriptsLoader.getScriptWithFallback(
                cdnPath,
                { signal },
            );

            if (signal?.aborted) return;

            progressBar.setText('Registering dependencies');

            const pkg: Package = {
                name: packageInfo.name,
                version: packageInfo.version || 'latest',
                url: response.xhr.responseURL,
                dependencies: packageInfo.cliDependencies || [],
            };

            await this.registerPackageDependencies(pkg, context);

            progressBar.setText('Injecting package');

            if (response.content) {
                await this.scriptsLoader.injectBodyScript(response.content);
            }

            progressBar.setText('Saving package');

            await this.packagesManager.addPackage(pkg);

            context.progressBar.complete();

            context.writer.writeSuccess(
                `Package ${packageInfo.name}@${packageInfo.version} added successfully`,
            );
        } catch (e: any) {
            if (signal?.aborted) return;
            context.progressBar.complete();
            context.writer.writeError(e?.toString() || 'Unknown error');
        }
    }

    private async updatePackage(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
        targetVersion?: string,
    ): Promise<void> {
        const { progressBar, writer } = context;

        progressBar.show();

        try {
            progressBar.setText(`Updating package ${name}`);
            const currentPackage = await this.packagesManager.getPackage(name);

            if (!currentPackage) {
                progressBar.complete();
                writer.writeError(`Package ${name} not found`);
                return;
            }

            const versionSuffix = targetVersion ? `@${targetVersion}` : '';
            const packagePath = `${currentPackage.name}${versionSuffix}`;

            progressBar.setText(
                targetVersion
                    ? `Fetching ${currentPackage.name}@${targetVersion}`
                    : `Checking for updates for package ${currentPackage.name}`,
            );

            const newPackage = await this.scriptsLoader
                .getScriptWithFallback(packagePath + '/package.json', {
                    signal,
                })
                .then((response) => {
                    return JSON.parse(response.content || '{}');
                });

            if (signal?.aborted) return;

            if (newPackage.version === currentPackage.version) {
                progressBar.complete();
                writer.writeInfo(
                    `Package ${currentPackage.name} is already at version ${currentPackage.version}`,
                );
                return;
            }

            progressBar.setText(
                `Downloading package ${currentPackage.name}@${newPackage.version}`,
            );

            const cdnPath = this.resolvePackageCdnPath(
                newPackage,
                versionSuffix,
            );
            const response = await this.scriptsLoader.getScriptWithFallback(
                cdnPath,
                { signal },
            );

            if (signal?.aborted) return;

            progressBar.setText('Registering dependencies');

            const updatedPkg: Package = {
                name: newPackage.name,
                version: newPackage.version || 'latest',
                url: response.xhr.responseURL,
                dependencies: newPackage.cliDependencies || [],
            };

            await this.registerPackageDependencies(updatedPkg, context);

            progressBar.setText(`Injecting package ${currentPackage.name}`);

            if (response.content) {
                await this.scriptsLoader.injectBodyScript(response.content);
            }

            progressBar.setText(`Saving package ${currentPackage.name}`);

            await this.packagesManager.updatePackage(updatedPkg);

            progressBar.complete();

            writer.writeSuccess(
                `Package ${currentPackage.name} updated to version ${newPackage.version} from ${currentPackage.version}`,
            );
        } catch (e: any) {
            if (signal?.aborted) return;
            progressBar.complete();
            writer.writeError(e?.toString() || 'Unknown error');
        }
    }

    private async injectScriptWithCdnFallback(url: string): Promise<void> {
        let packagePath = url;

        // Strip any known source base URL to get the package path
        for (const name of this.scriptsLoader.getSources()) {
            const baseUrl = this.scriptsLoader.getSourceUrl(name);
            if (baseUrl && packagePath.startsWith(baseUrl)) {
                packagePath = packagePath.slice(baseUrl.length);
                break;
            }
        }

        await this.scriptsLoader.injectScriptWithFallback(packagePath);
    }

    private async registerPackageDependencies(
        pkg: Package,
        { logger }: ICliExecutionContext,
    ): Promise<void> {
        if (pkg.dependencies && pkg.dependencies.length > 0) {
            logger.info(`Injecting package ${pkg.name} dependencies`);

            for (const dependency of pkg.dependencies) {
                if (this.registeredDependencies.includes(dependency.name!)) {
                    logger.info(
                        `Dependency ${dependency.globalName} already registered`,
                    );
                    continue;
                }

                await this.injectScriptWithCdnFallback(dependency.url);

                if (dependency.globalName) {
                    const isAvailable = await this.waitForGlobal(
                        dependency.globalName,
                        3000,
                    );

                    if (!isAvailable) {
                        logger.error(
                            `Dependency ${dependency.globalName} not found in global scope within timeout`,
                        );

                        return;
                    } else {
                        logger.info(
                            `Dependency ${dependency.globalName} is available in global scope`,
                        );
                    }
                }

                this.registeredDependencies.push(dependency.name);
            }
        } else {
            logger.info(`Package ${pkg.name} has no dependencies`);
        }
    }

    private resolvePackageCdnPath(
        packageInfo: any,
        versionSuffix = '',
    ): string {
        const entryPoint =
            packageInfo.unpkg || packageInfo.umd || packageInfo.main;
        const basePath = `${packageInfo.name}${versionSuffix}`;

        if (entryPoint) {
            const cleanEntry = entryPoint.replace(/^\.\//, '');
            return `${basePath}/${cleanEntry}`;
        }

        return basePath;
    }

    private waitForGlobal(
        globalName: string,
        timeout: number,
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const interval = 50;
            let elapsed = 0;

            const check = () => {
                if ((window as any)[globalName]) {
                    resolve(true);
                } else if (elapsed >= timeout) {
                    resolve(false);
                } else {
                    elapsed += interval;
                    setTimeout(check, interval);
                }
            };

            check();
        });
    }
}
