import {
    CliIcon,
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliKeyValueStore,
    ICliModule,
    ICliCommandGuard_TOKEN,
    ICliPermissionRegistry,
    ICliPermissionRegistry_TOKEN,
    ICliServiceProvider,
    CliModuleRegistry,
    initializeBrowserEnvironment,
    LIBRARY_VERSION as CORE_VERSION,
    satisfiesVersionRange,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION, API_VERSION } from '../version';
import { CliKeyValueStore_TOKEN } from '../tokens';
import { CliExecutionContext } from '../context/cli-execution-context';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { CliBootLog } from './cli-boot-log';
import { builtinProcessors } from '../processors';

export class CliBoot {
    private initialized = false;
    private initializing = false;
    private readonly moduleRegistry: CliModuleRegistry;
    private readonly bootedModules = new Set<string>();
    private readonly initializedProcessors = new Set<ICliCommandProcessor>();
    /** Boot report of the startup boot. */
    private bootLogRef?: CliBootLog;

    /** The boot report while startup is still in progress, else `undefined`. */
    private get bootLog(): CliBootLog | undefined {
        return this.bootLogRef && !this.bootLogRef.isFinished
            ? this.bootLogRef
            : undefined;
    }

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
        bootLog?: CliBootLog,
    ): Promise<void> {
        // The boot log replaces the spinner when it is enabled
        if (!bootLog?.enabled) {
            context.spinner?.show(CliIcon.Rocket + '  Booting...');
        }

        if (this.initialized || this.initializing) {
            await this.bootShared(context);
            context.spinner?.hide();
            return;
        }

        this.initializing = true;
        // Kept until the report finishes: plugins loaded from scripts boot
        // after this pass returns (the engine waits for them).
        this.bootLogRef = bootLog;
        await this.bootAll(context, modules);
    }

    private async bootAll(
        context: CliExecutionContext,
        modules: ICliModule[],
    ): Promise<void> {
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

        // Unloading a module (e.g. `pkg remove`) removes its commands and lets a
        // later registration of the same name (e.g. `pkg update`) boot again.
        this.moduleRegistry.onModuleUnregister((module: ICliModule) => {
            this.unloadModule(module);
        });

        // 3. Boot core module first (implicit dependency for all others)
        const coreModule = this.buildCoreModule();
        this.bootLog?.addSteps(1);
        this.bootLog?.setCurrent(`Setting up ${coreModule.name}`);
        await this.bootModule(coreModule, context);
        this.bootLog?.completeStep();

        // 4. Filter out modules that do not meet the required API version
        const compatible = modules.filter((module) => {
            const modApiVersion = module.apiVersion;
            if (
                typeof modApiVersion !== 'number' ||
                modApiVersion < API_VERSION
            ) {
                this.warn(
                    context,
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
        this.bootLog?.addSteps(sorted.length);
        for (const module of sorted) {
            this.bootLog?.setCurrent(`Setting up ${module.name}`);
            await this.bootModule(module, context);
            this.bootLog?.completeStep();
        }

        await this.bootShared(context);

        context.spinner?.hide();

        this.initialized = true;
    }

    /**
     * Boot one module: declarations (services, guards, permissions,
     * translations), lifecycle (`onInit`, first-run `onSetup`), then its
     * commands. Modules already booted or with missing dependencies are skipped.
     */
    private async bootModule(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<void> {
        if (this.bootedModules.has(module.name)) {
            return;
        }
        if (!this.dependenciesLoaded(module, context)) {
            return;
        }

        context.logger.info(`Booting module: ${module.name}`);
        const startedAt = Date.now();

        this.registerDeclarations(module, context);
        await this.runOnInit(module, context);
        await this.runFirstSetup(module, context);
        const commandCount = await this.registerCommands(module, context);

        this.bootedModules.add(module.name);
        this.reportModule(module, commandCount, Date.now() - startedAt);

        // Track in module registry for introspection (without triggering boot handlers)
        if (!this.moduleRegistry.has(module.name)) {
            this.moduleRegistry.track(module);
        }
    }

    // ── Module boot phases ──

    private dependenciesLoaded(
        module: ICliModule,
        context: CliExecutionContext,
    ): boolean {
        for (const dep of module.dependencies ?? []) {
            if (!this.bootedModules.has(dep)) {
                this.warn(
                    context,
                    `Module "${module.name}" requires "${dep}" which is not loaded. Skipping.`,
                );
                return false;
            }
        }
        return true;
    }

    /** Services, guards, permissions and translations the module declares. */
    private registerDeclarations(
        module: ICliModule,
        context: CliExecutionContext,
    ): void {
        if (module.services && module.services.length > 0) {
            this.services.set(module.services);
        }

        // Guards are multi-providers: the executor runs them before every command
        if (module.guards && module.guards.length > 0) {
            this.services.set(
                module.guards.map((guard) => ({
                    provide: ICliCommandGuard_TOKEN,
                    useValue: guard,
                    multi: true,
                })),
            );
        }

        if (module.permissions && module.permissions.length > 0) {
            this.services
                .get<ICliPermissionRegistry>(ICliPermissionRegistry_TOKEN)
                ?.register(module.permissions, module.name);
        }

        // Before onInit so modules can override them
        if (module.translations) {
            for (const [locale, translations] of Object.entries(
                module.translations,
            )) {
                context.translator.addTranslations(locale, translations);
            }
        }
    }

    /** `onInit` runs before the module's commands are registered. */
    private async runOnInit(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<void> {
        if (!module.onInit) return;
        try {
            await module.onInit(context);
        } catch (e) {
            context.logger.error(
                `Error in onInit for module "${module.name}":`,
                e,
            );
        }
    }

    /** `onSetup` runs once per browser (first-run flow), until it succeeds. */
    private async runFirstSetup(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<void> {
        if (!module.onSetup) return;

        const kvStore = context.services.getRequired<ICliKeyValueStore>(
            CliKeyValueStore_TOKEN,
        );
        const setupKey = `cli-module-setup:${module.name}`;
        const setupState = await kvStore.get<{
            installed: boolean;
            installedAt: number;
        }>(setupKey);
        if (setupState?.installed) return;

        // Hide the boot spinner while the setup prompts run, and bring it
        // back only if it was showing (a module installed later with
        // `pkg add` boots without one; showing it would block input).
        const spinnerWasRunning = !!context.spinner?.isRunning;
        this.bootLog?.suspend();
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
            if (spinnerWasRunning) {
                context.spinner?.show();
            }
            this.bootLog?.resume();
        }
    }

    /** Register and initialize the module's commands; returns how many. */
    private async registerCommands(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<number> {
        if (!module.processors || module.processors.length === 0) return 0;

        const filtered = this.filterByVersion(module.processors, context);
        for (const processor of filtered) {
            this.registry.registerProcessor(processor);
        }
        await this.initializeProcessorsInternal(context, filtered);
        this.adoptMergedSubProcessors(filtered);
        return filtered.length;
    }

    /** One boot-log line per module that does something at boot. */
    private reportModule(
        module: ICliModule,
        commandCount: number,
        durationMs: number,
    ): void {
        if (
            commandCount === 0 &&
            !module.onInit &&
            !module.onSetup &&
            !module.translations
        ) {
            return;
        }
        const detail =
            commandCount > 0
                ? ` · ${commandCount} command${commandCount === 1 ? '' : 's'}`
                : module.translations
                  ? ' · translations'
                  : '';
        this.bootLog?.ok(`Set up ${module.name}${detail}`, durationMs);
    }

    private unloadModule(module: ICliModule): void {
        for (const processor of module.processors ?? []) {
            this.registry.unregisterProcessor(processor);
            this.initializedProcessors.delete(processor);
        }
        this.bootedModules.delete(module.name);
    }

    /** Boot warning: into the boot log when it is shown, else the terminal. */
    private warn(context: CliExecutionContext, message: string): void {
        if (this.bootLog?.enabled) {
            this.bootLog.warn(message);
        } else {
            context.writer.writeWarning(message);
        }
    }

    /** Boot error: into the boot log when it is shown, else the terminal. */
    private fail(context: CliExecutionContext, message: string): void {
        if (this.bootLog?.enabled) {
            this.bootLog.error(message);
        } else {
            context.writer.writeError(message);
        }
    }

    /**
     * Sub-processors of an `extendsProcessor` processor are merged into the
     * processor it extends, so they belong to that one: re-parent them so they
     * inherit its access rules (`requiredPermissions` etc.) and help/root
     * lookups resolve to the registered processor.
     */
    private adoptMergedSubProcessors(processors: ICliCommandProcessor[]): void {
        for (const processor of processors) {
            if (!processor.extendsProcessor) continue;
            const name = processor.command.toLowerCase();
            const host = this.registry.processors.find(
                (p) => p.command.toLowerCase() === name,
            );
            if (!host || host === processor) continue;
            for (const sub of processor.processors ?? []) {
                if (host.processors?.includes(sub)) {
                    (sub as ICliCommandChildProcessor).parent = host;
                }
            }
        }
    }

    private buildCoreModule(): ICliModule {
        return {
            apiVersion: API_VERSION,
            name: '@qodalis/cli-core',
            version: CORE_VERSION,
            description: 'Core CLI services and utilities',
            processors: [...builtinProcessors],
            permissions: [
                {
                    name: 'system:packages',
                    description: 'Install, update and remove packages (pkg)',
                },
                {
                    name: 'system:services',
                    description: 'Start and stop background services',
                },
                {
                    name: 'system:eval',
                    description:
                        'Evaluate JavaScript (eval, also requires allowEval)',
                },
                {
                    name: 'shell:execute',
                    description: 'Open a remote shell on a server (ssh)',
                },
            ],
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
                this.fail(
                    context,
                    `Circular dependency detected involving module "${name}". Aborting module loading.`,
                );
                return;
            }

            const mod = moduleMap.get(name);
            if (!mod) return;

            visiting.add(name);
            for (const dep of mod.dependencies ?? []) {
                if (!moduleMap.has(dep) && !this.bootedModules.has(dep)) {
                    this.warn(
                        context,
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
                this.warn(
                    context,
                    `Plugin "${p.command}" requires cli-core ${meta.requiredCoreVersion} but ${CORE_VERSION} is installed. Skipping.`,
                );
                return false;
            }
            if (
                meta?.requiredCliVersion &&
                !satisfiesVersionRange(CLI_VERSION, meta.requiredCliVersion)
            ) {
                this.warn(
                    context,
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
