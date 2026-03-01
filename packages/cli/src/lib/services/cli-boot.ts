import {
    CliIcon,
    delay,
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
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

        // Module lifecycle: onInit (before processors)
        if (module.onInit) {
            try {
                await module.onInit(context);
            } catch (e) {
                console.error(
                    `Error in onInit for module "${module.name}":`,
                    e,
                );
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
     * Topologically sort modules by their dependencies.
     * Modules with no dependencies (or only @qodalis/cli-core) come first.
     * Circular dependencies are logged as warnings and the involved modules are appended at the end.
     */
    private topologicalSort(
        modules: ICliModule[],
        context: CliExecutionContext,
    ): ICliModule[] {
        const moduleMap = new Map<string, ICliModule>();
        for (const m of modules) {
            moduleMap.set(m.name, m);
        }

        const sorted: ICliModule[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (mod: ICliModule): void => {
            if (visited.has(mod.name)) return;

            if (visiting.has(mod.name)) {
                context.logger.warn(
                    `Circular dependency detected involving module "${mod.name}". Loading order may be incorrect.`,
                );
                return;
            }

            visiting.add(mod.name);

            for (const dep of mod.dependencies ?? []) {
                if (dep === '@qodalis/cli-core') continue;

                const depModule = moduleMap.get(dep);
                if (depModule) {
                    visit(depModule);
                }
            }

            visiting.delete(mod.name);
            visited.add(mod.name);
            sorted.push(mod);
        };

        for (const mod of modules) {
            visit(mod);
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
        await this.initializeProcessorsInternal(
            context,
            this.registry.processors,
        );

        await delay(300);
    }

    private async initializeProcessorsInternal(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
        parent?: ICliCommandProcessor,
    ): Promise<void> {
        for (const p of processors) {
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

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                        p,
                    );
                }
            } catch (e) {
                console.error(
                    `Error initializing processor "${p.command}":`,
                    e,
                );
            }
        }
    }
}
