import {
    CliForegroundColor,
    CliModuleRegistry,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
    ICliModule,
    Package,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../../services/script-loader';
import { CliBootLog } from '../../../services/cli-boot-log';
import { CliBootLog_TOKEN } from '../../../tokens';
import { CliPackageManagerService } from '../../../services/cli-package-manager';
import { isNewerVersion, toFullPackageName } from './package-utils';
import {
    chooseMarketplaceVersion,
    CLI_RUNTIME,
    MarketplaceClient,
    MarketplacePlugin,
    MarketplacePluginSummary,
    MarketplaceSession,
    MarketplaceVersion,
    newestWorkingVersion,
    otherKindInstallHint,
    pickResolvedPlugin,
    sha384Integrity,
} from './marketplace';

/** The `package.json` fields the installer reads. */
export interface PackageInfo {
    name: string;
    version?: string;
    description?: string;
    unpkg?: string;
    umd?: string;
    main?: string;
    cliDependencies?: Package[];
}

export type UpdateResult = 'updated' | 'current' | 'failed';

/** What `pkg check` learned about one installed package. */
export interface PackageCheck {
    pkg: Package;
    /** Newest version to offer (fits this CLI when it comes from the marketplace). */
    latest?: string;
    failed: boolean;
    /** Flagged or no longer listed in the marketplace. */
    warning?: string;
}

/** The bundle the marketplace recorded for a version. */
interface ExpectedBundle {
    bundle: string;
    integrity: string;
}

/** Where `pkg add` gets a package from after asking the marketplace. */
type InstallTarget =
    | {
          listed: true;
          plugin: MarketplacePlugin;
          version: MarketplaceVersion;
      }
    /** Today's CDN lookup; `warn`: the marketplace answered and does not list it. */
    | { listed: false; warn: boolean };

const DEPENDENCY_GLOBAL_TIMEOUT_MS = 3000;

/**
 * Downloads, injects, saves and unloads `pkg` packages. Shared by the
 * `add`, `update` and `remove` sub-commands and by startup loading.
 */
export class CliPackageInstaller {
    private readonly loadedDependencies = new Set<string>();
    private registry?: ICliCommandProcessorRegistry;
    private moduleRegistry?: CliModuleRegistry;

    /** Refuse packages the marketplace does not list (`packageSources.marketplaceOnly`). */
    marketplaceOnly = false;

    constructor(
        readonly loader: ScriptLoaderService,
        readonly manager: CliPackageManagerService,
    ) {}

    get prefix(): string {
        return this.manager.QODALIS_COMMAND_PREFIX;
    }

    attach(
        registry: ICliCommandProcessorRegistry,
        moduleRegistry?: CliModuleRegistry,
    ): void {
        this.registry = registry;
        this.moduleRegistry = moduleRegistry;
    }

    /**
     * Full name of a module the host provides (bundled with the app) for a
     * short or full package name, or `undefined` when it is not bundled.
     */
    bundledName(name: string): string | undefined {
        const fullName = toFullPackageName(name, this.prefix);
        if (this.moduleRegistry?.isBundled(fullName)) return fullName;
        if (this.moduleRegistry?.isBundled(name)) return name;
        return undefined;
    }

    /** Modules the host provides (bundled with the app), with their versions. */
    bundledModules(): ICliModule[] {
        const registry = this.moduleRegistry;
        if (!registry) return [];
        return registry
            .getBundledNames()
            .map(
                (name) => registry.getModule(name) ?? ({ name } as ICliModule),
            );
    }

    /** Client of the first marketplace source, or `undefined` when there is none. */
    marketplaceClient(): MarketplaceClient | undefined {
        const [source] = this.loader.getSourcesByKind('marketplace');
        return source ? new MarketplaceClient(source.url) : undefined;
    }

    /** The marketplace for one command: reports the first failure once, then skips it. */
    marketplaceSession(context: ICliExecutionContext): MarketplaceSession {
        return new MarketplaceSession(
            this.marketplaceClient(),
            this.marketplaceOnly,
            context,
        );
    }

    /** Read `<packagePath>/package.json` from the first source that has it. */
    async fetchInfo(
        packagePath: string,
        signal?: AbortSignal,
    ): Promise<PackageInfo> {
        const response = await this.loader.getScriptWithFallback(
            `${packagePath}/package.json`,
            {
                signal,
            },
        );
        return JSON.parse(response.content || '{}');
    }

    /** Inject every saved package (startup). */
    async loadInstalled(context: ICliExecutionContext): Promise<void> {
        const packages = await this.manager.getPackages();
        const bootLog = context.services.get<CliBootLog>(CliBootLog_TOKEN);
        bootLog?.addSteps(packages.length);

        for (const pkg of packages) {
            if (this.bundledName(pkg.name)) {
                // Installed before the app bundled it: the app's copy wins
                context.logger.info(
                    `Package ${pkg.name} is built in, not loading the installed copy`,
                );
                bootLog?.completeStep();
                continue;
            }
            bootLog?.setCurrent(`Loading ${pkg.name}@${pkg.version}`);
            const startedAt = Date.now();
            try {
                await this.loadDependencies(pkg, context);
                await this.injectFromUrl(pkg.url, pkg.integrity);
                bootLog?.ok(
                    `Loaded package ${pkg.name}@${pkg.version}`,
                    Date.now() - startedAt,
                );
            } catch (e: any) {
                // One broken package must not stop the others from loading
                const message = `Could not load package ${pkg.name}@${pkg.version}: ${e?.message ?? e}`;
                if (bootLog?.enabled) {
                    bootLog.error(message);
                } else {
                    context.logger.error(message);
                }
            } finally {
                bootLog?.completeStep();
            }
        }
    }

    /** Install `name` (short or full), optionally at `version`. */
    async install(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
        version?: string,
        session?: MarketplaceSession,
    ): Promise<void> {
        const { progressBar, writer } = context;
        const versionSuffix = version ? `@${version}` : '';

        const bundled = this.bundledName(name);
        if (bundled) {
            writer.writeError(
                `Package ${bundled} is built in and cannot be installed with pkg`,
            );
            return;
        }

        progressBar.show();
        progressBar.setText(`Fetching package ${name}`);

        try {
            const target = await this.resolveInstallTarget(
                name,
                version,
                context,
                session ?? this.marketplaceSession(context),
                signal,
            );
            if (!target || signal?.aborted) {
                progressBar.complete();
                return;
            }

            let pkg: Package | undefined;
            if (target.listed) {
                const exact = target.version.version;
                const info = await this.fetchInfo(
                    `${target.plugin.name}@${exact}`,
                    signal,
                ).catch((): PackageInfo => ({
                    name: target.plugin.name,
                    version: exact,
                }));
                if (signal?.aborted) return;
                pkg = await this.downloadAndInject(
                    { ...info, name: target.plugin.name, version: exact },
                    `@${exact}`,
                    context,
                    signal,
                    undefined,
                    target.version,
                );
            } else {
                const info = await this.lookupInfo(
                    name,
                    versionSuffix,
                    context,
                    signal,
                );
                if (!info) return;
                if (target.warn) {
                    writer.writeWarning(
                        `${info.name} is not listed in the marketplace and has not been reviewed`,
                    );
                }
                pkg = await this.downloadAndInject(
                    info,
                    versionSuffix,
                    context,
                    signal,
                );
            }
            if (!pkg) return;

            progressBar.setText('Saving package');
            await this.manager.addPackage(pkg);

            progressBar.complete();
            writer.writeSuccess(
                `Package ${pkg.name}@${pkg.version} added successfully`,
            );
            context.events?.emit(
                'package:installed',
                { name: pkg.name, version: pkg.version },
                { source: 'pkg' },
            );
        } catch (e: any) {
            if (signal?.aborted) return;
            progressBar.complete();
            writer.writeError(e?.message || e?.toString() || 'Unknown error');
        }
    }

    /**
     * Today's lookup on the CDNs: the prefixed name (`@qodalis/cli-<name>`),
     * then the name as given. Throws when neither exists.
     */
    private async lookupInfo(
        name: string,
        versionSuffix: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
    ): Promise<PackageInfo | undefined> {
        const { progressBar } = context;
        const fullName = toFullPackageName(name, this.prefix);
        let info = await this.fetchInfo(
            `${fullName}${versionSuffix}`,
            signal,
        ).catch(() => null);

        if (!info && fullName !== name && !signal?.aborted) {
            progressBar.setText(`Trying ${name}`);
            info = await this.fetchInfo(
                `${name}${versionSuffix}`,
                signal,
            ).catch(() => null);
        }
        if (signal?.aborted) return undefined;

        if (!info) {
            progressBar.setText('Package not found');
            throw new Error(`Package ${name}${versionSuffix} not found`);
        }
        return info;
    }

    /**
     * Ask the marketplace which package and version `name` means. Returns
     * `undefined` when the install must stop (refused, ambiguous, aborted;
     * the reason is written), a listed version, or "use today's lookup".
     */
    private async resolveInstallTarget(
        name: string,
        version: string | undefined,
        context: ICliExecutionContext,
        session: MarketplaceSession,
        signal?: AbortSignal,
    ): Promise<InstallTarget | undefined> {
        const { writer, progressBar } = context;
        if (!session.client) return { listed: false, warn: false };

        progressBar.setText(`Looking up ${name} in the marketplace`);
        const matches = await session.run(
            (client) => client.resolve(name, signal),
            'using npm',
            signal,
        );
        if (signal?.aborted) return undefined;

        let plugin: MarketplacePlugin | null | undefined;
        if (matches && matches.length > 0) {
            const picked = pickResolvedPlugin(name, matches);
            if (!picked) {
                progressBar.complete();
                writeCandidates(context, name, matches);
                return undefined;
            }
            plugin = await session.run(
                (client) => client.plugin(picked.name, CLI_RUNTIME, signal),
                'using npm',
                signal,
            );
            if (signal?.aborted) return undefined;
        } else if (matches) {
            // Not a CLI plugin: a dashboard or server plugin of that name installs elsewhere, say where
            // (a marketplace refusing `kind=all` changes nothing: today's warning follows)
            const others = await session
                .run((client) => client.resolve(name, signal, 'all'), 'using npm', signal)
                .catch(() => undefined);
            if (signal?.aborted) return undefined;
            const hint = others?.map(otherKindInstallHint).find((h) => !!h);
            if (hint) {
                progressBar.complete();
                writer.writeError(hint);
                return undefined;
            }
            plugin = null;
        }

        if (!plugin) {
            if (session.marketplaceOnly) {
                progressBar.complete();
                writer.writeError(
                    plugin === null
                        ? `Package ${name} is not listed in the marketplace, and this CLI installs listed packages only`
                        : `Cannot install ${name}: the marketplace is unreachable, and this CLI installs listed packages only`,
                );
                return undefined;
            }
            // Not listed (D5): installable by name with a warning;
            // marketplace unreachable: today's behaviour
            return { listed: false, warn: plugin === null };
        }

        const choice = chooseMarketplaceVersion(plugin, version);
        if (!choice.ok) {
            progressBar.complete();
            writeRefusal(
                context,
                `${plugin.name}${version ? `@${version}` : ''}`,
                choice.reason,
                choice.suggestion &&
                    `pkg add ${packageArg(plugin, this.prefix)}@${choice.suggestion.version}`,
                choice.suggestion?.version,
            );
            return undefined;
        }
        return { listed: true, plugin, version: choice.version };
    }

    /**
     * What `pkg check` reports for one installed package: the marketplace's
     * newest fitting version when it lists the package (with a warning when
     * the installed version was flagged or unlisted), else the CDN's latest.
     */
    async checkPackage(
        pkg: Package,
        session: MarketplaceSession,
        signal?: AbortSignal,
    ): Promise<PackageCheck> {
        const plugin = await session.run(
            (client) => client.plugin(pkg.name, CLI_RUNTIME, signal),
            'using npm',
            signal,
        );
        if (plugin) {
            return {
                pkg,
                latest: newestWorkingVersion(plugin)?.version,
                failed: false,
                warning: installedVersionWarning(plugin, pkg),
            };
        }
        try {
            const info = await this.fetchInfo(pkg.name, signal);
            return { pkg, latest: info.version, failed: false };
        } catch {
            return { pkg, failed: true };
        }
    }

    /**
     * Update an installed package to the latest version, or to `targetVersion`
     * (which may also downgrade).
     */
    async update(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
        targetVersion?: string,
        session?: MarketplaceSession,
    ): Promise<UpdateResult> {
        const { progressBar, writer } = context;

        const bundled = this.bundledName(name);
        if (bundled) {
            writer.writeInfo(
                `Package ${bundled} is built in and updates with the app`,
            );
            return 'current';
        }

        progressBar.show();

        try {
            progressBar.setText(`Updating package ${name}`);
            const current = await this.manager.getPackage(name);

            if (!current) {
                progressBar.complete();
                writer.writeError(
                    `Package ${name} is not installed. Use ${writer.wrapInColor(`pkg add ${name}`, CliForegroundColor.Cyan)} to install it`,
                );
                return 'failed';
            }

            const marketplace = session ?? this.marketplaceSession(context);
            const plugin = await marketplace.run(
                (client) => client.plugin(current.name, CLI_RUNTIME, signal),
                'using npm',
                signal,
            );
            if (signal?.aborted) return 'failed';

            if (!plugin && marketplace.marketplaceOnly) {
                progressBar.complete();
                writer.writeError(
                    plugin === null
                        ? `Package ${current.name} is not listed in the marketplace, and this CLI installs listed packages only`
                        : `Cannot update ${current.name}: the marketplace is unreachable, and this CLI installs listed packages only`,
                );
                return 'failed';
            }

            let updated: Package | undefined;
            if (plugin) {
                const warning = installedVersionWarning(plugin, current);
                if (warning) {
                    writer.writeWarning(
                        `${current.name}@${current.version} ${warning}`,
                    );
                }

                let target: MarketplaceVersion | undefined;
                if (targetVersion) {
                    const choice = chooseMarketplaceVersion(
                        plugin,
                        targetVersion,
                    );
                    if (!choice.ok) {
                        progressBar.complete();
                        writeRefusal(
                            context,
                            `${current.name}@${targetVersion}`,
                            choice.reason,
                            choice.suggestion &&
                                `pkg update ${packageArg(plugin, this.prefix)}@${choice.suggestion.version}`,
                            choice.suggestion?.version,
                        );
                        return 'failed';
                    }
                    target = choice.version;
                } else {
                    target = newestWorkingVersion(plugin);
                }

                const upToDate = !target
                    ? true
                    : targetVersion
                      ? target.version === current.version
                      : !isNewerVersion(target.version, current.version);
                if (upToDate) {
                    progressBar.complete();
                    writer.writeInfo(
                        `Package ${current.name} is already at version ${current.version}`,
                    );
                    return 'current';
                }

                const exact = target!.version;
                progressBar.setText(`Fetching ${current.name}@${exact}`);
                const info = await this.fetchInfo(
                    `${current.name}@${exact}`,
                    signal,
                ).catch((): PackageInfo => ({
                    name: current.name,
                    version: exact,
                }));
                if (signal?.aborted) return 'failed';
                updated = await this.downloadAndInject(
                    { ...info, name: current.name, version: exact },
                    `@${exact}`,
                    context,
                    signal,
                    () => this.unload(current.name),
                    target,
                );
            } else {
                const versionSuffix = targetVersion ? `@${targetVersion}` : '';
                progressBar.setText(
                    targetVersion
                        ? `Fetching ${current.name}@${targetVersion}`
                        : `Checking for updates for package ${current.name}`,
                );

                const info = await this.fetchInfo(
                    `${current.name}${versionSuffix}`,
                    signal,
                );
                if (signal?.aborted) return 'failed';

                const upToDate = targetVersion
                    ? info.version === current.version
                    : !isNewerVersion(info.version, current.version);
                if (upToDate) {
                    progressBar.complete();
                    writer.writeInfo(
                        `Package ${current.name} is already at version ${current.version}`,
                    );
                    return 'current';
                }

                updated = await this.downloadAndInject(
                    info,
                    versionSuffix,
                    context,
                    signal,
                    () =>
                        // Unload the old version so the new bundle boots and replaces its commands
                        this.unload(current.name),
                );
            }
            if (!updated) return 'failed';

            progressBar.setText(`Saving package ${current.name}`);
            await this.manager.updatePackage(updated);

            progressBar.complete();
            writer.writeSuccess(
                `Package ${current.name} updated to version ${updated.version} from ${current.version}`,
            );
            context.events?.emit(
                'package:updated',
                {
                    name: current.name,
                    version: updated.version,
                    previousVersion: current.version,
                },
                { source: 'pkg' },
            );
            return 'updated';
        } catch (e: any) {
            if (signal?.aborted) return 'failed';
            progressBar.complete();
            writer.writeError(e?.message || e?.toString() || 'Unknown error');
            return 'failed';
        }
    }

    /** Remove an installed package and its commands. */
    async remove(name: string, context: ICliExecutionContext): Promise<void> {
        const { progressBar, writer } = context;

        const bundled = this.bundledName(name);
        if (!(await this.manager.hasPackage(name))) {
            writer.writeError(
                bundled
                    ? `Package ${bundled} is built in and cannot be removed`
                    : `Package ${name} is not installed`,
            );
            return;
        }

        progressBar.show();

        try {
            const pkg = await this.manager.removePackage(name);
            // An installed copy of a bundled module was never loaded (see
            // `loadInstalled`): unloading would remove the app's commands
            const stillLoaded = bundled ? [] : this.unload(pkg.name);
            progressBar.complete();
            writer.writeSuccess(
                `Package ${pkg.name}@${pkg.version} removed successfully`,
            );
            context.events?.emit(
                'package:removed',
                { name: pkg.name, version: pkg.version },
                { source: 'pkg' },
            );
            if (stillLoaded.length > 0) {
                // Sealed commands (e.g. the users plugin's login/whoami) cannot be
                // unregistered at runtime; they are gone after a reload.
                writer.writeInfo(
                    stillLoaded.length === 1
                        ? `Reload the page to finish removing it: ${stillLoaded[0]} is protected and stays until then`
                        : `Reload the page to finish removing it: ${stillLoaded.length} of its commands are protected and stay until then`,
                );
            }
        } catch (e) {
            progressBar.complete();
            writer.writeError(e?.toString() || 'Unknown error');
        }
    }

    /**
     * Remove a loaded package's commands. Bundles register through the module
     * registry; the window global is a fallback for legacy UMD bundles.
     * Returns the commands that could not be removed (sealed processors).
     */
    unload(packageName: string): string[] {
        const module = this.moduleRegistry?.getModule(packageName);
        const legacy = (window as any)[packageName] as ICliModule | undefined;
        const processors = module?.processors ?? legacy?.processors ?? [];

        if (module) {
            this.moduleRegistry!.unregister(packageName);
        } else {
            processors.forEach((processor) =>
                this.registry?.unregisterProcessor(processor),
            );
        }

        const registered = this.registry?.processors ?? [];
        return processors
            .filter((p) => registered.includes(p))
            .map((p) => p.command);
    }

    /**
     * Download the bundle described by `info`, load its dependencies and run it.
     * Returns the record to save, or `undefined` when aborted.
     */
    private async downloadAndInject(
        info: PackageInfo,
        versionSuffix: string,
        context: ICliExecutionContext,
        signal: AbortSignal | undefined,
        beforeInject?: () => void,
        expected?: ExpectedBundle,
    ): Promise<Package | undefined> {
        const { progressBar } = context;

        progressBar.setText(
            `Downloading package ${info.name}@${info.version ?? 'latest'}`,
        );
        const bundlePath = expected
            ? `${info.name}${versionSuffix}/${expected.bundle.replace(/^\.?\//, '')}`
            : resolveBundlePath(info, versionSuffix);
        const response = await this.loader.getScriptWithFallback(bundlePath, {
            signal,
        });
        if (signal?.aborted) return undefined;

        if (expected) {
            progressBar.setText('Checking integrity');
            const actual = await sha384Integrity(response.content ?? '');
            if (actual !== expected.integrity) {
                throw new Error(
                    `Integrity check failed for ${info.name}@${info.version}: the downloaded bundle differs from the one the marketplace recorded. Nothing was installed`,
                );
            }
        }

        const pkg: Package = {
            name: info.name,
            version: info.version || 'latest',
            url: response.xhr.responseURL,
            dependencies: info.cliDependencies || [],
            ...(expected ? { integrity: expected.integrity } : {}),
        };

        progressBar.setText('Registering dependencies');
        await this.loadDependencies(pkg, context);

        progressBar.setText(`Injecting package ${pkg.name}`);
        beforeInject?.();
        if (response.content) {
            await this.loader.injectBodyScript(response.content);
        }

        return pkg;
    }

    private async loadDependencies(
        pkg: Package,
        { logger }: ICliExecutionContext,
    ): Promise<void> {
        if (!pkg.dependencies?.length) {
            logger.info(`Package ${pkg.name} has no dependencies`);
            return;
        }

        logger.info(`Injecting package ${pkg.name} dependencies`);
        for (const dependency of pkg.dependencies) {
            if (this.loadedDependencies.has(dependency.name)) {
                logger.info(
                    `Dependency ${dependency.globalName} already registered`,
                );
                continue;
            }

            await this.injectFromUrl(dependency.url);

            if (dependency.globalName) {
                if (
                    !(await waitForGlobal(
                        dependency.globalName,
                        DEPENDENCY_GLOBAL_TIMEOUT_MS,
                    ))
                ) {
                    logger.error(
                        `Dependency ${dependency.globalName} not found in global scope within timeout`,
                    );
                    return;
                }
                logger.info(
                    `Dependency ${dependency.globalName} is available in global scope`,
                );
            }

            this.loadedDependencies.add(dependency.name);
        }
    }

    /** Inject a saved URL, re-resolving it against the current sources so fallbacks apply. */
    private async injectFromUrl(
        url: string,
        integrity?: string,
    ): Promise<void> {
        let packagePath = url;
        for (const name of this.loader.getSources()) {
            const baseUrl = this.loader.getSourceUrl(name);
            if (baseUrl && packagePath.startsWith(baseUrl)) {
                packagePath = packagePath.slice(baseUrl.length);
                break;
            }
        }
        await this.loader.injectScriptWithFallback(packagePath, integrity);
    }
}

/** The name to type for a plugin: its short name when that resolves to it, else the full name. */
export function packageArg(
    plugin: Pick<MarketplacePluginSummary, 'name' | 'shortName' | 'official'>,
    prefix: string,
): string {
    return plugin.name.startsWith(prefix) ? plugin.shortName : plugin.name;
}

/** A warning about the installed version (flagged, no longer listed), or `undefined`. */
export function installedVersionWarning(
    plugin: MarketplacePlugin,
    pkg: Package,
): string | undefined {
    const entry = plugin.versions.find((v) => v.version === pkg.version);
    if (entry?.status === 'flagged') {
        return `has been flagged in the marketplace${entry.note ? `: ${entry.note}` : ''}`;
    }
    // Only packages installed from the marketplace carry a hash; others may
    // predate it and are not judged
    if (!entry && pkg.integrity) {
        return 'is no longer listed in the marketplace';
    }
    return undefined;
}

/** Several plugins answer to `name`: list them so the user picks a full name. */
export function writeCandidates(
    context: ICliExecutionContext,
    name: string,
    matches: MarketplacePluginSummary[],
    command = 'pkg add',
): void {
    const { writer } = context;
    writer.writeWarning(
        `Several plugins are called ${name}; use the full name:`,
    );
    for (const match of matches) {
        writer.writeln(
            `  ${writer.wrapInColor(match.name, CliForegroundColor.Cyan)}${match.publisher.verified ? ' ✓' : ''}  ${match.description}`,
        );
    }
    writer.writeln();
    writer.writeInfo(
        `💡 e.g. ${writer.wrapInColor(`${command} ${matches[0].name}`, CliForegroundColor.Cyan)}`,
    );
}

/** A version the marketplace refuses, with the newest one that works. */
function writeRefusal(
    context: ICliExecutionContext,
    what: string,
    reason: string,
    command: string | undefined,
    suggestion: string | undefined,
): void {
    const { writer } = context;
    writer.writeError(`Cannot install ${what}: ${reason}`);
    if (suggestion && command) {
        writer.writeInfo(
            `💡 Newest version that works with this CLI: ${suggestion} (${writer.wrapInColor(command, CliForegroundColor.Cyan)})`,
        );
    } else if (!suggestion) {
        writer.writeInfo('No listed version works with this CLI');
    }
}

/** Path of a package's browser bundle (`unpkg`, then `umd`, then `main`). */
export function resolveBundlePath(
    info: PackageInfo,
    versionSuffix = '',
): string {
    const basePath = `${info.name}${versionSuffix}`;
    const entryPoint = info.unpkg || info.umd || info.main;
    return entryPoint
        ? `${basePath}/${entryPoint.replace(/^\.\//, '')}`
        : basePath;
}

function waitForGlobal(globalName: string, timeout: number): Promise<boolean> {
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
