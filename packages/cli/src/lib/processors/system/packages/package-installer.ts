import {
    CliForegroundColor,
    CliModuleRegistry,
    ICliCommandProcessorRegistry,
    ICliExecutionContext,
    ICliUmdModule,
    Package,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../../services/script-loader';
import { CliPackageManagerService } from '../../../services/cli-package-manager';
import { isNewerVersion, toFullPackageName } from './package-utils';

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

const DEPENDENCY_GLOBAL_TIMEOUT_MS = 3000;

/**
 * Downloads, injects, saves and unloads `pkg` packages. Shared by the
 * `add`, `update` and `remove` sub-commands and by startup loading.
 */
export class CliPackageInstaller {
    private readonly loadedDependencies = new Set<string>();
    private registry?: ICliCommandProcessorRegistry;
    private moduleRegistry?: CliModuleRegistry;

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
        for (const pkg of await this.manager.getPackages()) {
            await this.loadDependencies(pkg, context);
            await this.injectFromUrl(pkg.url);
        }
    }

    /** Install `name` (short or full), optionally at `version`. */
    async install(
        name: string,
        context: ICliExecutionContext,
        signal?: AbortSignal,
        version?: string,
    ): Promise<void> {
        const { progressBar, writer } = context;
        const versionSuffix = version ? `@${version}` : '';

        progressBar.show();
        progressBar.setText(`Fetching package ${name}`);

        try {
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
            if (signal?.aborted) return;

            if (!info) {
                progressBar.setText('Package not found');
                throw new Error(`Package ${name}${versionSuffix} not found`);
            }

            const pkg = await this.downloadAndInject(
                info,
                versionSuffix,
                context,
                signal,
            );
            if (!pkg) return;

            progressBar.setText('Saving package');
            await this.manager.addPackage(pkg);

            progressBar.complete();
            writer.writeSuccess(
                `Package ${pkg.name}@${pkg.version} added successfully`,
            );
        } catch (e: any) {
            if (signal?.aborted) return;
            progressBar.complete();
            writer.writeError(e?.toString() || 'Unknown error');
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
    ): Promise<UpdateResult> {
        const { progressBar, writer } = context;

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

            const updated = await this.downloadAndInject(
                info,
                versionSuffix,
                context,
                signal,
                () =>
                    // Unload the old version so the new bundle boots and replaces its commands
                    this.unload(current.name),
            );
            if (!updated) return 'failed';

            progressBar.setText(`Saving package ${current.name}`);
            await this.manager.updatePackage(updated);

            progressBar.complete();
            writer.writeSuccess(
                `Package ${current.name} updated to version ${updated.version} from ${current.version}`,
            );
            return 'updated';
        } catch (e: any) {
            if (signal?.aborted) return 'failed';
            progressBar.complete();
            writer.writeError(e?.toString() || 'Unknown error');
            return 'failed';
        }
    }

    /** Remove an installed package and its commands. */
    async remove(name: string, context: ICliExecutionContext): Promise<void> {
        const { progressBar, writer } = context;

        if (!(await this.manager.hasPackage(name))) {
            writer.writeError(`Package ${name} is not installed`);
            return;
        }

        progressBar.show();

        try {
            const pkg = await this.manager.removePackage(name);
            const stillLoaded = this.unload(pkg.name);
            progressBar.complete();
            writer.writeSuccess(
                `Package ${pkg.name}@${pkg.version} removed successfully`,
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
        const legacy = (window as any)[packageName] as
            ICliUmdModule | undefined;
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
    ): Promise<Package | undefined> {
        const { progressBar } = context;

        progressBar.setText(
            `Downloading package ${info.name}@${info.version ?? 'latest'}`,
        );
        const response = await this.loader.getScriptWithFallback(
            resolveBundlePath(info, versionSuffix),
            { signal },
        );
        if (signal?.aborted) return undefined;

        const pkg: Package = {
            name: info.name,
            version: info.version || 'latest',
            url: response.xhr.responseURL,
            dependencies: info.cliDependencies || [],
        };

        progressBar.setText('Registering dependencies');
        await this.loadDependencies(pkg, context);

        progressBar.setText(`Injecting package ${pkg.name}`);
        beforeInject?.();
        if (response.content) {
            this.loader.injectBodyScript(response.content);
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
    private async injectFromUrl(url: string): Promise<void> {
        let packagePath = url;
        for (const name of this.loader.getSources()) {
            const baseUrl = this.loader.getSourceUrl(name);
            if (baseUrl && packagePath.startsWith(baseUrl)) {
                packagePath = packagePath.slice(baseUrl.length);
                break;
            }
        }
        await this.loader.injectScriptWithFallback(packagePath);
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
