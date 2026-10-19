import {
    ITerminalOptions,
    ITerminalInitOnlyOptions,
    Terminal,
} from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import {
    CliOptions,
    CliProvider,
    CliEngineSnapshot,
    ICliCommandProcessor,
    ICliModule,
    ICliServerAuthService_TOKEN,
    ICliEventBus_TOKEN,
} from '@qodalis/cli-core';
import { CliServerAuthService } from '../services/cli-server-auth.service';
import { CliCommandExecutor } from '../executor/cli-command-executor';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliExecutionContext } from '../context/cli-execution-context';
import {
    CliEnvironment,
    ICliEnvironment,
    ICliEnvironment_TOKEN,
} from '../services/cli-environment';
import { ICliStateStoreManager } from '../state/cli-state-store-manager';
import { CliBoot } from '../services/cli-boot';
import { CliBootLog } from '../services/cli-boot-log';
import { LIBRARY_VERSION } from '../version';
import { greetingModule, welcomeModule } from '../services/cli-welcome-message';
import {
    CliBackgroundServiceRegistry_TOKEN,
    CliModuleRegistry_TOKEN,
    CliBootLog_TOKEN,
    CliProcessorsRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
} from '../tokens';
import { CliBackgroundServiceRegistry } from '../services/background/cli-background-service-registry';
import { CliDragDropService } from '../services/cli-drag-drop.service';
import {
    CliServerManager,
    CliServerManager_TOKEN,
} from '../server/cli-server-manager';
import { createServerModule } from '../server/cli-server-module';
import { initWasmAccelerator } from '../wasm';
import {
    getTerminalOptions,
    initializeTerminal,
    waitForLayout,
} from './cli-terminal-setup';
import {
    initializeServices,
    InitializeServicesResult,
} from './cli-service-initializer';
import {
    bootSummary,
    createBootLog,
    createCompletionProviders,
} from './cli-engine-boot';

export interface CliEngineOptions extends CliOptions {
    terminalOptions?: Partial<ITerminalOptions & ITerminalInitOnlyOptions>;
    /** Optional snapshot to restore on start() */
    snapshot?: CliEngineSnapshot;
    /**
     * Explicit URL of `qodalis_cli_wasm_bg.wasm` (optional accelerator). When
     * omitted it is looked up next to the page (`document.baseURI`), then at
     * `/assets/wasm/` and `/wasm/`; the CLI works without it.
     */
    wasmUrl?: string;
}

/** What the start phases share once services exist. */
interface EngineCore {
    services: InitializeServicesResult['services'];
    stateStoreManager: InitializeServicesResult['stateStoreManager'];
    processRegistry: InitializeServicesResult['processRegistry'];
    executor: CliCommandExecutor;
}

export class CliEngine {
    private terminal!: Terminal;
    private fitAddon!: FitAddon;
    private serializeAddon!: SerializeAddon;
    private executionContext!: CliExecutionContext;
    private registry: CliCommandProcessorRegistry;
    private userModules: ICliModule[] = [];
    private pendingServices: CliProvider[] = [];
    private resizeObserver?: ResizeObserver;
    private resizeListener?: () => void;
    private wheelListener?: (e: WheelEvent) => void;
    private resizeVersion = 0;
    private resizeScheduled = false;
    private bootService?: CliBoot;
    private dragDropService?: CliDragDropService;
    private _startedAt?: number;
    private terminalOptions!: ReturnType<typeof getTerminalOptions>;
    private _isBooted = false;
    private resolveBooted!: () => void;
    private readonly bootedPromise = new Promise<void>((resolve) => {
        this.resolveBooted = resolve;
    });

    constructor(
        private readonly container: HTMLElement,
        private readonly options?: CliEngineOptions,
    ) {
        this.registry = new CliCommandProcessorRegistry();
    }

    /**
     * Register a CLI module to be loaded on start().
     */
    registerModule(module: ICliModule): void {
        this.userModules.push(module);
    }

    /**
     * Register multiple CLI modules to be loaded on start().
     */
    registerModules(modules: ICliModule[]): void {
        this.userModules.push(...modules);
    }

    /**
     * Register a command processor to be loaded on start().
     * @deprecated Use registerModule() instead.
     */
    registerProcessor(processor: ICliCommandProcessor): void {
        this.userModules.push({
            apiVersion: 2,
            name: `__inline_${processor.command}`,
            processors: [processor],
        });
    }

    /**
     * Register multiple command processors to be loaded on start().
     * @deprecated Use registerModule() instead.
     */
    registerProcessors(processors: ICliCommandProcessor[]): void {
        this.userModules.push({
            apiVersion: 2,
            name: '__inline_processors',
            processors,
        });
    }

    /**
     * Register a service to be available in the service container.
     * Must be called before start().
     * @deprecated Use registerModule() with services instead.
     */
    registerService(token: string, value: any): void {
        this.pendingServices.push({ provide: token, useValue: value });
    }

    /**
     * Start the CLI: set up the terminal and services, boot the modules
     * (reporting progress in the terminal), then hand over to the prompt.
     *
     * Phases, in order:
     *  1. terminal         xterm.js in the container
     *  2. services         service container, executor, execution context
     *  3. boot report      hold typed keys, show the boot log
     *  4. runtime          environment, background services, servers
     *  5. modules          core + welcome + server + user modules
     *  6. completion       tab-completion providers
     *  7. ready            clear the report, replay typed keys, `isBooted`
     *  8. after boot       `onAfterBoot` hooks (welcome message), snapshot
     */
    async start(): Promise<void> {
        // Optional accelerator, fire-and-forget (JS fallback when unavailable)
        initWasmAccelerator(this.options?.wasmUrl).catch(() => {});
        const startedAt = Date.now();

        await this.setupTerminal();
        const core = await this.setupServices();
        const bootLog = await this.beginBootReport(core, startedAt);

        let modules: ICliModule[] = [];
        try {
            const serverManager = this.registerRuntimeServices(core);
            await this.connectServers(serverManager, bootLog);
            modules = this.modulesToBoot();
            await this.bootService!.boot(
                this.executionContext,
                modules,
                bootLog,
            );
            // Plugins loaded from scripts (`pkg`) boot asynchronously, setup
            // prompts included: boot is complete only when they are done.
            await this.bootService!.getModuleRegistry().whenIdle();
            this.executionContext.completionEngine.setProviders(
                createCompletionProviders({
                    ...core,
                    registry: this.registry,
                    serverManager,
                    backgroundServices:
                        this.executionContext.backgroundServices,
                }),
            );
        } catch (e) {
            await this.failBoot(bootLog, e);
            throw e;
        }

        await this.completeBoot(bootLog);
        await this.runAfterBootHooks(modules);

        if (this.options?.snapshot) {
            await this.restoreSnapshot(this.options.snapshot);
        }
        this._startedAt = Date.now();

        // No prompt was drawn (e.g. restored snapshot): hand over typed keys now
        this.executionContext.releaseInput(true);

        // Final refit: fonts are loaded and boot output is written by now,
        // so cell metrics are stable.
        this.safeFit();
    }

    // ── Start phases ──

    /** 1. Wait for the container to have a size, then create xterm.js. */
    private async setupTerminal(): Promise<void> {
        await waitForLayout(this.container);
        this.terminalOptions = getTerminalOptions(
            this.options?.terminalOptions,
        );
        const setup = initializeTerminal(this.container, this.terminalOptions);
        this.terminal = setup.terminal;
        this.fitAddon = setup.fitAddon;
        this.serializeAddon = setup.serializeAddon;
        this.dragDropService = setup.dragDropService;
        this.wheelListener = setup.wheelListener;
        this.handleResize();
    }

    /** 2. Service container, boot service, executor and execution context. */
    private async setupServices(): Promise<EngineCore> {
        const {
            services,
            logger,
            commandHistory,
            stateStoreManager,
            processRegistry,
            translator,
        } = await initializeServices({
            registry: this.registry,
            pendingServices: this.pendingServices,
            dragDropService: this.dragDropService,
        });

        this.bootService = new CliBoot(this.registry, services);
        // Debug/introspection commands and `pkg` use the module registry
        services.set([
            {
                provide: CliModuleRegistry_TOKEN,
                useValue: this.bootService.getModuleRegistry(),
            },
        ]);

        const executor = new CliCommandExecutor(this.registry);
        this.executionContext = new CliExecutionContext(
            { services, logger, commandHistory, stateStoreManager, translator },
            this.terminal,
            executor,
            { ...(this.options ?? {}), terminalOptions: this.terminalOptions },
        );
        this.executionContext.initializeTerminalListeners();

        return { services, stateStoreManager, processRegistry, executor };
    }

    /**
     * 3. Keep what the user types until the terminal is ready (replayed at
     * the first prompt) and start the boot report (configurable).
     */
    private async beginBootReport(
        core: EngineCore,
        startedAt: number,
    ): Promise<CliBootLog> {
        this.executionContext.holdInput();

        const bootLog = await createBootLog(
            this.terminal,
            core.stateStoreManager,
            {
                boot: this.options?.boot,
                restoringSnapshot: !!this.options?.snapshot,
                startedAt,
            },
        );
        core.services.set([{ provide: CliBootLog_TOKEN, useValue: bootLog }]);

        // Terminal/services + one per server; the boot service adds the modules
        const serverCount = (this.options?.servers ?? []).filter(
            (s) => s.enabled !== false,
        ).length;
        bootLog.addSteps(1 + serverCount);
        bootLog.info(`Starting Web CLI ${LIBRARY_VERSION}`);
        bootLog.ok(
            `Terminal and services ready · ${this.terminal.cols}×${this.terminal.rows}`,
            bootLog.elapsedMs,
        );
        bootLog.completeStep();

        return bootLog;
    }

    /** 4. Environment variables, background services, server auth and manager. */
    private registerRuntimeServices(core: EngineCore): CliServerManager {
        const { services, processRegistry } = core;
        const ctx = this.executionContext;

        // USER, HOME and PWD follow the signed-in user and the current directory
        const environment = services.get<ICliEnvironment>(
            ICliEnvironment_TOKEN,
        );
        if (environment instanceof CliEnvironment) {
            environment.bind('USER', () => ctx.userSession?.user.name);
            environment.bind('HOME', () => ctx.userSession?.user.homeDir);
            environment.bind('PWD', () => ctx.promptPathProvider?.());
            // Each user keeps their own exported variables
            environment.setProfileResolver(() => ctx.userSession?.user.name);
        }

        // Background services get PIDs from the process registry
        (
            ctx.backgroundServices as CliBackgroundServiceRegistry
        ).setProcessRegistry(processRegistry);
        services.set([
            {
                provide: CliBackgroundServiceRegistry_TOKEN,
                useValue: ctx.backgroundServices,
            },
        ]);

        services.set([
            {
                provide: ICliServerAuthService_TOKEN,
                useValue: new CliServerAuthService(services),
                sealed: true,
            },
        ]);
        services.set([
            {
                provide: CliServerManager_TOKEN,
                useClass: CliServerManager,
                deps: [
                    CliProcessorsRegistry_TOKEN,
                    ICliServerAuthService_TOKEN,
                    ICliEventBus_TOKEN,
                ],
            },
        ]);
        return services.getRequired<CliServerManager>(CliServerManager_TOKEN);
    }

    /** 4. Connect to the configured servers, one boot step each. */
    private async connectServers(
        serverManager: CliServerManager,
        bootLog: CliBootLog,
    ): Promise<void> {
        const servers = this.options?.servers;
        if (!servers || servers.length === 0) return;

        const ctx = this.executionContext;
        bootLog.setCurrent('Connecting to servers');
        // The same logger reports reconnects later; the boot log ignores
        // entries once boot is finished.
        await serverManager.connectAll(
            servers,
            {
                warn: (msg) => {
                    ctx.logger.warn(msg);
                    bootLog.warn(msg);
                    bootLog.completeStep();
                },
                info: (msg) => {
                    ctx.logger.info(msg);
                    bootLog.ok(msg);
                    bootLog.completeStep();
                },
            },
            ctx.backgroundServices,
            ctx.logger,
        );
    }

    /**
     * 5. Built-in welcome and server modules, the app's modules, and the
     * greeting, which runs after every other `onAfterBoot` hook.
     */
    private modulesToBoot(): ICliModule[] {
        const serverModule = createServerModule();
        // A restored snapshot already contains the welcome screen
        return this.options?.snapshot
            ? [serverModule, ...this.userModules]
            : [
                  welcomeModule,
                  serverModule,
                  ...this.userModules,
                  greetingModule,
              ];
    }

    /** 7. Replace the boot report with the terminal and mark the CLI booted. */
    private async completeBoot(bootLog: CliBootLog): Promise<void> {
        await bootLog.finish(
            bootSummary(
                bootLog,
                this.bootService!.getModuleRegistry().getAll().length,
                this.registry.processors.length,
            ),
            this.options?.boot?.keepLogs,
        );
        this.executionContext.releaseInput();
        this.executionContext.markBooted();
        this._isBooted = true;
        this.resolveBooted();
        this.executionContext.events?.emit('boot:completed', {
            durationMs: bootLog.elapsedMs,
            modules: this.bootService!.getModuleRegistry().getAll().length,
            commands: this.registry.processors.length,
        });
    }

    /**
     * Boot threw: never leave the terminal unusable. Keep the report with the
     * error on screen, show the cursor and hand over typed keys.
     */
    private async failBoot(bootLog: CliBootLog, error: unknown): Promise<void> {
        bootLog.error(
            `Boot failed: ${error instanceof Error ? error.message : error}`,
        );
        await bootLog.finish('Boot failed', true);
        this.executionContext.releaseInput(true);
    }

    /** 8. `onAfterBoot` hooks by priority (lower first); one failing hook does not stop the rest. */
    private async runAfterBootHooks(modules: ICliModule[]): Promise<void> {
        const sorted = [...modules].sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        );
        for (const module of sorted) {
            if (!module.onAfterBoot) continue;
            try {
                await module.onAfterBoot(this.executionContext);
            } catch (e) {
                this.executionContext.logger.error(
                    `Error in onAfterBoot for module "${module.name}":`,
                    e,
                );
            }
        }
    }

    /**
     * Clean up terminal and event listeners.
     */
    destroy(): void {
        // 1. Dispose execution context (stops background services, cleans up managed timers)
        this.executionContext?.dispose();
        (
            this.executionContext?.events as
                { dispose?: () => void } | undefined
        )?.dispose?.();

        // 2. Call onDestroy on all registered modules, then dispose the
        //    services the container created (once those hooks are done)
        if (this.bootService && this.executionContext) {
            const context = this.executionContext;
            const modules = this.bootService.getModuleRegistry().getAll();
            const destroyed: Promise<unknown>[] = [];
            for (const module of modules) {
                if (!module.onDestroy) continue;
                const report = (e: unknown) =>
                    context.logger.error(
                        `Error in onDestroy for module "${module.name}":`,
                        e,
                    );
                try {
                    destroyed.push(
                        Promise.resolve(module.onDestroy(context)).catch(report),
                    );
                } catch (e) {
                    report(e);
                }
            }
            const services = context.services as { dispose?: () => void };
            void Promise.all(destroyed).then(() => services.dispose?.());
        }

        if (this.resizeListener) {
            window.removeEventListener('resize', this.resizeListener);
        }
        if (this.wheelListener) {
            this.container.removeEventListener('wheel', this.wheelListener);
        }
        this.resizeVersion = -1;
        this.resizeScheduled = false;
        this.resizeObserver?.disconnect();
        this.dragDropService?.destroy();
        this.terminal?.dispose();
    }

    /**
     * Focus the terminal and fit to container.
     */
    focus(): void {
        requestAnimationFrame(() => {
            this.safeFit();
            this.terminal?.focus();
        });
    }

    /**
     * Get the underlying xterm.js Terminal instance.
     */
    getTerminal(): Terminal {
        return this.terminal;
    }

    /**
     * Get the execution context.
     */
    getContext(): CliExecutionContext {
        return this.executionContext;
    }

    /**
     * Get the command processor registry.
     */
    getRegistry(): CliCommandProcessorRegistry {
        return this.registry;
    }

    /**
     * `true` once boot has completed: modules are set up and the terminal
     * accepts input. `onAfterBoot` hooks (welcome message) run right after.
     */
    get isBooted(): boolean {
        return this._isBooted;
    }

    /**
     * Resolves when boot has completed (see `isBooted`). Never rejects; if
     * `start()` fails it stays pending.
     */
    get booted(): Promise<void> {
        return this.bootedPromise;
    }

    /**
     * Timestamp (ms since epoch) when the engine finished starting.
     */
    get startedAt(): number | undefined {
        return this._startedAt;
    }

    /**
     * Execute a command programmatically, behaving the same as if the user
     * typed it and pressed Enter: echoes the command, adds it to history,
     * executes it, and shows a new prompt afterwards.
     */
    async execute(command: string): Promise<void> {
        if (!this.executionContext) return;

        const ctx = this.executionContext;

        // Echo the command as if the user typed it and pressed Enter
        ctx.showPrompt({ reset: true });
        this.terminal.write(command + '\r\n');

        await ctx.submitCommand(command);
    }

    /**
     * Capture a snapshot of the current engine state.
     * Can only be called after start().
     */
    snapshot(): CliEngineSnapshot {
        if (!this.executionContext) {
            throw new Error('Cannot snapshot before engine has started');
        }

        const stateStoreManager =
            this.executionContext.services.getRequired<ICliStateStoreManager>(
                CliStateStoreManager_TOKEN,
            );

        return {
            version: 1,
            timestamp: Date.now(),
            terminal: {
                serializedBuffer: this.serializeAddon.serialize(),
                cols: this.terminal.cols,
                rows: this.terminal.rows,
            },
            commandHistory: this.executionContext.commandHistory.getHistory(),
            stateStores: stateStoreManager.getStoreEntries(),
        };
    }

    /**
     * Restore engine state from a snapshot.
     * Note: If the target terminal has different dimensions than the snapshot
     * source, the restored content may reflow differently.
     */
    private async restoreSnapshot(snap: CliEngineSnapshot): Promise<void> {
        // Restore terminal buffer (await the write to ensure buffer is fully applied).
        // Clear first: this engine's own boot may have written output (plugin
        // warnings) that the snapshot already contains.
        if (snap.terminal.serializedBuffer) {
            await new Promise<void>((resolve) => {
                this.terminal.write(
                    '\x1b[2J\x1b[3J\x1b[H' + snap.terminal.serializedBuffer,
                    resolve,
                );
            });
        }

        // Restore command history
        await this.executionContext.commandHistory.setHistory(
            snap.commandHistory,
        );

        // Restore state stores
        const stateStoreManager =
            this.executionContext.services.getRequired<ICliStateStoreManager>(
                CliStateStoreManager_TOKEN,
            );
        for (const entry of snap.stateStores) {
            const store = stateStoreManager.getStateStore(entry.name);
            store.updateState(entry.state);
        }

        // No showPrompt() here — the serialized buffer already contains
        // the prompt visually. The execution context's CommandLineMode
        // (set up by initializeTerminalListeners) handles new input.
    }

    private handleResize(): void {
        this.resizeListener = () => this.safeFit();
        window.addEventListener('resize', this.resizeListener);

        this.resizeObserver = new ResizeObserver(() => this.safeFit());
        this.resizeObserver.observe(this.container);
    }

    /**
     * Call fitAddon.fit() only when the container has non-zero dimensions.
     * Prevents xterm from reflowing to minimal columns when the container
     * is hidden (e.g., via [hidden] or display:none on an ancestor).
     */
    private safeFit(): void {
        if (this.container.offsetWidth > 0 && this.container.offsetHeight > 0) {
            const oldCols = this.terminal.cols;
            this.fitAddon.fit();
            if (this.executionContext && oldCols !== this.terminal.cols) {
                this.resizeVersion++;
                if (!this.resizeScheduled) {
                    this.resizeScheduled = true;
                    this.deferResizeFix();
                }
            }
        }
    }

    /**
     * Chain write callbacks until the resize version stabilises.
     * Only the very last callback (version match) applies the fix,
     * so intermediate resize events cannot leave stale artefacts.
     */
    private deferResizeFix(): void {
        if (this.resizeVersion < 0) return; // destroyed
        const version = this.resizeVersion;
        this.terminal.write('', () => {
            if (this.resizeVersion < 0) return; // destroyed during wait
            if (this.resizeVersion !== version) {
                // Another resize happened — keep deferring
                this.deferResizeFix();
                return;
            }
            this.resizeScheduled = false;
            this.executionContext?.handleTerminalResize();
        });
    }
}
