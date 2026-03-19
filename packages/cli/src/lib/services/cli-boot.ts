import {
    CliIcon,
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliKeyValueStore,
    ICliModule,
    ICliServiceProvider,
    CliModuleRegistry,
    initializeBrowserEnvironment,
    LIBRARY_VERSION as CORE_VERSION,
    satisfiesVersionRange,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION, API_VERSION } from '../version';
import { CliExecutionContext } from '../context/cli-execution-context';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { builtinProcessors } from '../processors';

export class CliBoot {
    private initialized = false;
    private initializing = false;
    private readonly moduleRegistry: CliModuleRegistry;
    private readonly bootedModules = new Set<string>();
    private readonly initializedProcessors = new Set<ICliCommandProcessor>();

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly services: ICliServiceProvider,
    ) {
        this.moduleRegistry = new CliModuleRegistry();
    }

    /**
     * Get the module registry for external access.
     */
    getModuleRegistry(): CliModuleRegistry {
        return this.moduleRegistry;
    }

    public async boot(
        context: CliExecutionContext,
        modules: ICliModule[],
    ): Promise<void> {
        context.spinner?.show(CliIcon.Rocket + '  Booting...');

        if (this.initialized || this.initializing) {
            await this.bootShared(context);
            context.spinner?.hide();
            return;
        }

        this.initializing = true;

        // Wire module registry warnings through the context logger
        this.moduleRegistry.onWarn = (msg) => context.logger.warn(msg);

        // 1. Set up browser environment for dynamic UMD loading
        initializeBrowserEnvironment({
            context,
            registry: this.moduleRegistry,
        });

        // 2. Wire handler so dynamically loaded UMD modules go through the same pipeline
        this.moduleRegistry.onModuleBoot(async (module: ICliModule) => {
            await this.bootModule(module, context);
        });

        // 3. Boot core module first (implicit dependency for all others)
        const coreModule = this.buildCoreModule();
        await this.bootModule(coreModule, context);

        // 4. Filter out modules that do not meet the required API version
        const compatible = modules.filter((module) => {
            const modApiVersion = module.apiVersion;
            if (typeof modApiVersion !== 'number' || modApiVersion < API_VERSION) {
                context.writer.writeWarning(
                    `Plugin "${module.name}" targets API version ${modApiVersion ?? 'unknown'}, ` +
                    `but this runtime requires API version ${API_VERSION}. Skipping. ` +
                    `See https://qodalis.com/docs/upgrade-v2`,
                );
                return false;
            }
            return true;
        });

        // 5. Topologically sort remaining modules by dependencies
        const sorted = this.topologicalSort(compatible, context);

        // 6. Boot each module in order
        for (const module of sorted) {
            await this.bootModule(module, context);
        }

        await this.bootShared(context);

        context.spinner?.hide();

        this.initialized = true;
    }

    private async bootModule(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<void> {
        // Skip if already booted
        if (this.bootedModules.has(module.name)) {
            return;
        }

        // Check dependencies are satisfied
        for (const dep of module.dependencies ?? []) {
            if (!this.bootedModules.has(dep)) {
                context.writer.writeWarning(
                    `Module "${module.name}" requires "${dep}" which is not loaded. Skipping.`,
                );
                return;
            }
        }

        context.logger.info(`Booting module: ${module.name}`);

        // Register services into the shared container
        if (module.services && module.services.length > 0) {
            this.services.set(module.services);
        }

        // Auto-register module translations (before onInit so modules can override)
        if (module.translations) {
            for (const [locale, translations] of Object.entries(module.translations)) {
                context.translator.addTranslations(locale, translations);
            }
        }

        // Module lifecycle: onInit (before processors)
        if (module.onInit) {
            try {
                await module.onInit(context);
            } catch (e) {
                context.logger.error(
                    `Error in onInit for module "${module.name}":`,
                    e,
                );
            }
        }

        // Module lifecycle: onSetup (first-run setup flow)
        if (module.onSetup) {
            const kvStore = context.services.get<ICliKeyValueStore>(
                'cli-key-value-store',
            );
            const setupKey = `cli-module-setup:${module.name}`;
            const setupState = await kvStore.get<{
                installed: boolean;
                installedAt: number;
            }>(setupKey);

            if (!setupState?.installed) {
                try {
                    context.spinner?.hide();
                    const success = await module.onSetup(context);
                    if (success) {
                        await kvStore.set(setupKey, {
                            installed: true,
                            installedAt: Date.now(),
                        });
                    }
                } catch (e) {
                    context.logger.error(
                        `Setup failed for module "${module.name}":`,
                        e,
                    );
                } finally {
                    context.spinner?.show();
                }
            }
        }

        // Register and initialize processors
        if (module.processors && module.processors.length > 0) {
            const filtered = this.filterByVersion(module.processors, context);
            for (const processor of filtered) {
                this.registry.registerProcessor(processor);
            }
            await this.initializeProcessorsInternal(context, filtered);
        }

        this.bootedModules.add(module.name);

        // Track in module registry for introspection (without triggering boot handlers)
        if (!this.moduleRegistry.has(module.name)) {
            this.moduleRegistry.track(module);
        }
    }

    private buildCoreModule(): ICliModule {
        return {
            apiVersion: API_VERSION,
            name: '@qodalis/cli-core',
            version: CORE_VERSION,
            description: 'Core CLI services and utilities',
            processors: [...builtinProcessors],
        };
    }

    /**
     * Topologically sort modules by their dependencies using DFS.
     * Modules with no dependencies come first.
     * Circular dependencies are detected and reported. Missing dependencies
     * cause the dependent module to be skipped.
     */
    private topologicalSort(
        modules: ICliModule[],
        context: CliExecutionContext,
    ): ICliModule[] {
        const moduleMap = new Map(modules.map((m) => [m.name, m]));
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const sorted: ICliModule[] = [];

        const visit = (name: string): void => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                context.writer.writeError(
                    `Circular dependency detected involving module "${name}". Aborting module loading.`,
                );
                return;
            }

            const mod = moduleMap.get(name);
            if (!mod) return;

            visiting.add(name);
            for (const dep of mod.dependencies ?? []) {
                if (!moduleMap.has(dep) && !this.bootedModules.has(dep)) {
                    context.writer.writeWarning(
                        `Module "${name}" depends on "${dep}" which is not loaded. Skipping "${name}".`,
                    );
                    visiting.delete(name);
                    return;
                }
                visit(dep);
            }
            visiting.delete(name);
            visited.add(name);
            sorted.push(mod);
        };

        for (const mod of modules) {
            visit(mod.name);
        }

        return sorted;
    }

    private filterByVersion(
        processors: ICliCommandProcessor[],
        context: CliExecutionContext,
    ): ICliCommandProcessor[] {
        return processors.filter((p) => {
            const meta = p.metadata;
            if (
                meta?.requiredCoreVersion &&
                !satisfiesVersionRange(CORE_VERSION, meta.requiredCoreVersion)
            ) {
                context.writer.writeWarning(
                    `Plugin "${p.command}" requires cli-core ${meta.requiredCoreVersion} but ${CORE_VERSION} is installed. Skipping.`,
                );
                return false;
            }
            if (
                meta?.requiredCliVersion &&
                !satisfiesVersionRange(CLI_VERSION, meta.requiredCliVersion)
            ) {
                context.writer.writeWarning(
                    `Plugin "${p.command}" requires cli ${meta.requiredCliVersion} but ${CLI_VERSION} is installed. Skipping.`,
                );
                return false;
            }
            return true;
        });
    }

    private async bootShared(context: CliExecutionContext): Promise<void> {
        // Only initialize processors that haven't been initialized yet
        // (e.g. processors registered after the initial boot)
        const uninitialized = this.registry.processors.filter(
            (p) => !this.initializedProcessors.has(p),
        );

        if (uninitialized.length > 0) {
            await this.initializeProcessorsInternal(context, uninitialized);
        }
    }

    private async initializeProcessorsInternal(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
        parent?: ICliCommandProcessor,
    ): Promise<void> {
        for (const p of processors) {
            if (this.initializedProcessors.has(p)) continue;

            try {
                (p as ICliCommandChildProcessor).parent = parent;

                if (p.initialize) {
                    const processorContext = new CliCommandExecutionContext(
                        context,
                        p,
                    );

                    await processorContext.state.initialize();

                    await p.initialize(processorContext);
                }

                this.initializedProcessors.add(p);

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                        p,
                    );
                }
            } catch (e) {
                context.logger.error(
                    `Error initializing processor "${p.command}":`,
                    e,
                );
            }
        }
    }
}
