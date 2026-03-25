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
    ICliCompletionProvider,
    ICliCompletionProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliCommandExecutor } from '../executor/cli-command-executor';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliExecutionContext } from '../context/cli-execution-context';
import {
    ICliStateStoreManager,
} from '../state/cli-state-store-manager';
import { CliBoot } from '../services/cli-boot';
import { welcomeModule } from '../services/cli-welcome-message';
import {
    CliBackgroundServiceRegistry_TOKEN,
    CliModuleRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
} from '../tokens';
import { CliBackgroundServiceRegistry } from '../services/background/cli-background-service-registry';
import { CliDragDropService } from '../services/cli-drag-drop.service';
import { CliCommandCompletionProvider } from '../completion/cli-command-completion-provider';
import { CliParameterCompletionProvider } from '../completion/cli-parameter-completion-provider';
import { CliServiceNameCompletionProvider } from '../completion/cli-service-name-completion-provider';
import { CliPackageNameCompletionProvider } from '../completion/cli-package-name-completion-provider';
import { CliThemeNameCompletionProvider } from '../completion/cli-theme-name-completion-provider';
import { CliAliasNameCompletionProvider } from '../completion/cli-alias-name-completion-provider';
import { CliServerNameCompletionProvider } from '../completion/cli-server-name-completion-provider';
import { CliConfigKeyCompletionProvider } from '../completion/cli-config-key-completion-provider';
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
import { initializeServices } from './cli-service-initializer';

export interface CliEngineOptions extends CliOptions {
    terminalOptions?: Partial<ITerminalOptions & ITerminalInitOnlyOptions>;
    /** Optional snapshot to restore on start() */
    snapshot?: CliEngineSnapshot;
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
     * Initialize the terminal, wire up services, boot modules, and show welcome message.
     */
    async start(): Promise<void> {
        // 0. Eagerly load WASM accelerator (fire-and-forget — JS fallback if unavailable)
        initWasmAccelerator().catch(() => {});

        // 1. Wait for container to have layout, then initialize xterm.js
        await waitForLayout(this.container);
        const terminalOpts = getTerminalOptions(this.options?.terminalOptions);
        const setupResult = initializeTerminal(this.container, terminalOpts);
        this.terminal = setupResult.terminal;
        this.fitAddon = setupResult.fitAddon;
        this.serializeAddon = setupResult.serializeAddon;
        this.dragDropService = setupResult.dragDropService;
        this.wheelListener = setupResult.wheelListener;
        this.handleResize();

        // 2. Build service container
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

        // 3. Create boot service with registry and services
        this.bootService = new CliBoot(this.registry, services);

        // Register the module registry so debug/introspection commands can access it
        services.set([
            {
                provide: CliModuleRegistry_TOKEN,
                useValue: this.bootService.getModuleRegistry(),
            },
        ]);

        // 4. Create executor and execution context
        const executor = new CliCommandExecutor(this.registry);

        this.executionContext = new CliExecutionContext(
            { services, logger, commandHistory, stateStoreManager, translator },
            this.terminal,
            executor,
            { ...(this.options ?? {}), terminalOptions: terminalOpts },
        );

        this.executionContext.initializeTerminalListeners();

        // 4.5. Register background services registry in the service container
        // and wire it to the process registry so bg services get PIDs
        (this.executionContext.backgroundServices as CliBackgroundServiceRegistry)
            .setProcessRegistry(processRegistry);
        services.set([{
            provide: CliBackgroundServiceRegistry_TOKEN,
            useValue: this.executionContext.backgroundServices,
        }]);

        // 5. Connect to configured servers (if any)
        const serverManager = new CliServerManager(this.registry);
        services.set([
            { provide: CliServerManager_TOKEN, useValue: serverManager },
        ]);

        if (this.options?.servers && this.options.servers.length > 0) {
            await serverManager.connectAll(this.options.servers, {
                warn: (msg) => this.executionContext.logger.warn(msg),
                info: (msg) => this.executionContext.logger.info(msg),
            }, this.executionContext.backgroundServices, this.executionContext.logger);
        }

        // 5.5. Prepend welcome module and server module
        const serverModule = createServerModule();
        const allModules = this.options?.snapshot
            ? [serverModule, ...this.userModules]
            : [welcomeModule, serverModule, ...this.userModules];

        // 6. Boot all modules (core + welcome + user modules)
        await this.bootService.boot(this.executionContext, allModules);

        // 7. Set up tab-completion providers
        const defaultProviders: ICliCompletionProvider[] = [
            new CliServiceNameCompletionProvider(this.executionContext.backgroundServices),
            new CliPackageNameCompletionProvider(services),
            new CliThemeNameCompletionProvider(),
            new CliAliasNameCompletionProvider(stateStoreManager),
            new CliServerNameCompletionProvider(serverManager),
            new CliConfigKeyCompletionProvider(this.registry),
            new CliCommandCompletionProvider(this.registry),
            new CliParameterCompletionProvider(this.registry, executor),
        ];

        // Collect plugin-registered providers (multi-service)
        let pluginProviders: ICliCompletionProvider[] = [];
        try {
            pluginProviders =
                services.get<ICliCompletionProvider[]>(
                    ICliCompletionProvider_TOKEN,
                ) ?? [];
        } catch {
            // No plugin providers registered — that's fine
        }

        this.executionContext.completionEngine.setProviders([
            ...pluginProviders,
            ...defaultProviders,
        ]);

        // 8. Run onAfterBoot hooks sorted by priority (lower first)
        const sorted = [...allModules].sort(
            (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
        );
        for (const module of sorted) {
            if (module.onAfterBoot) {
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

        // 9. Restore from snapshot if provided
        if (this.options?.snapshot) {
            await this.restoreSnapshot(this.options.snapshot);
        }

        this._startedAt = Date.now();

        // 10. Final refit — by this point fonts are loaded and all boot
        //     content has been written, so cell metrics are stable.
        this.safeFit();
    }

    /**
     * Clean up terminal and event listeners.
     */
    destroy(): void {
        // 1. Dispose execution context (stops background services, cleans up managed timers)
        this.executionContext?.dispose();

        // 2. Call onDestroy on all registered modules
        if (this.bootService && this.executionContext) {
            const modules = this.bootService.getModuleRegistry().getAll();
            for (const module of modules) {
                if (module.onDestroy) {
                    try {
                        module.onDestroy(this.executionContext);
                    } catch (e) {
                        this.executionContext.logger.error(`Error in onDestroy for module "${module.name}":`, e);
                    }
                }
            }
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

        const stateStoreManager = this.executionContext.services.get<ICliStateStoreManager>(
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
        // Restore terminal buffer (await the write to ensure buffer is fully applied)
        if (snap.terminal.serializedBuffer) {
            await new Promise<void>((resolve) => {
                this.terminal.write(snap.terminal.serializedBuffer, resolve);
            });
        }

        // Restore command history
        await this.executionContext.commandHistory.setHistory(snap.commandHistory);

        // Restore state stores
        const stateStoreManager = this.executionContext.services.get<ICliStateStoreManager>(
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
        if (
            this.container.offsetWidth > 0 &&
            this.container.offsetHeight > 0
        ) {
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
