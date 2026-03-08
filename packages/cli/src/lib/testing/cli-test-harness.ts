import { Subject } from 'rxjs';
import {
    CliBackgroundColor,
    CliForegroundColor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliExecutionProcess,
    ICliServiceProvider,
    ICliSpinner,
    ICliPercentageProgressBar,
    ICliTerminalWriter,
    ICliClipboard,
    ICliLogger,
    ICliStateStore,
    ICliInputReader,
    ICliTextAnimator,
    ICliManagedInterval,
    ICliManagedTimer,
    ICliBackgroundServiceRegistry,
    ICliUserSession,
    ICliKeyValueStore,
    ICliTranslationService,
} from '@qodalis/cli-core';

import { CliCommandExecutor, ICliExecutionHost } from '../executor/cli-command-executor';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliExecutionProcess } from '../context/cli-execution-process';
import { CliServiceContainer } from '../services/cli-service-container';
import { CliStateStoreManager } from '../state/cli-state-store-manager';
import { CliStateStoreManager_TOKEN, CliProcessorsRegistry_TOKEN } from '../tokens';
import { CliProcessRegistry, CliProcessRegistry_TOKEN } from '../services/cli-process-registry';
import { CliTranslationService } from '../services/cli-translation-service';
import { CliEnvironment, ICliEnvironment_TOKEN } from '../services/cli-environment';

/**
 * Result of executing a command through the test harness.
 */
export interface CliTestResult {
    /** All stdout-equivalent lines (write, writeln, writeJson, etc.) */
    stdout: string[];
    /** All stderr-equivalent lines (writeError, writeWarning) */
    stderr: string[];
    /** The full stdout joined with newlines */
    output: string;
    /** The exit code of the last command (0 = success) */
    exitCode: number | undefined;
    /** Pipeline data produced by process.output() or auto-captured */
    data: any;
    /** Captured table outputs from writeTable() calls */
    tables: { headers: string[]; rows: string[][] }[];
    /** Captured list outputs from writeList() calls */
    lists: string[][];
}

/**
 * A headless CLI test harness that enables integration testing of the full
 * command execution pipeline without xterm.js or DOM dependencies.
 *
 * Usage:
 * ```typescript
 * const harness = new CliTestHarness();
 * harness.registerProcessor(new MyProcessor());
 * const result = await harness.execute('mycommand --flag value');
 * expect(result.output).toContain('expected text');
 * ```
 *
 * For pipes:
 * ```typescript
 * const result = await harness.execute('echo hello world | grep hello');
 * expect(result.output).toContain('hello world');
 * ```
 */
export class CliTestHarness {
    readonly registry: CliCommandProcessorRegistry;
    readonly executor: CliCommandExecutor;
    readonly services: CliServiceContainer;

    private readonly stateStoreManager: CliStateStoreManager;
    private readonly processRegistry: CliProcessRegistry;

    /** Current user session — set via setUserSession() */
    userSession?: ICliUserSession;

    /** Reader responses — set via setReaderResponses() for interactive commands */
    private readerResponses: any[] = [];

    constructor() {
        this.registry = new CliCommandProcessorRegistry();
        this.executor = new CliCommandExecutor(this.registry);
        this.services = new CliServiceContainer();
        this.processRegistry = new CliProcessRegistry();

        // Register an in-memory KV store
        this.services.set({
            provide: 'cli-key-value-store',
            useValue: createInMemoryKvStore(),
        });

        // Register core services
        this.services.set({
            provide: CliProcessRegistry_TOKEN,
            useValue: this.processRegistry,
        });

        this.services.set({
            provide: CliProcessorsRegistry_TOKEN,
            useValue: this.registry,
        });

        this.stateStoreManager = new CliStateStoreManager(
            this.services,
            this.registry,
        );

        this.services.set({
            provide: CliStateStoreManager_TOKEN,
            useValue: this.stateStoreManager,
        });

        // Register environment variable store
        this.services.set({
            provide: ICliEnvironment_TOKEN,
            useValue: new CliEnvironment(),
        });
    }

    /**
     * Register a service in the test container.
     */
    registerService(token: any, value: any): void {
        this.services.set({ provide: token, useValue: value });
    }

    /**
     * Register a command processor. If the processor has an `initialize()`
     * method, it will be called with a context wired to the harness services.
     */
    registerProcessor(processor: ICliCommandProcessor): void {
        this.registry.registerProcessor(processor);
    }

    /**
     * Register multiple command processors.
     */
    registerProcessors(processors: ICliCommandProcessor[]): void {
        for (const p of processors) {
            this.registry.registerProcessor(p);
        }
    }

    /**
     * Initialize all registered processors that have an `initialize()` method.
     * Call this after registering all services and processors.
     */
    async initializeProcessors(): Promise<void> {
        const ctx = this.createContext(createTestWriter());
        for (const p of this.registry.processors) {
            if (p.initialize) {
                await p.initialize(ctx);
            }
        }
    }

    /**
     * Set the active user session. Commands that check `context.userSession`
     * will see this session.
     */
    setUserSession(session: ICliUserSession): void {
        this.userSession = session;
    }

    /**
     * Queue reader responses for interactive prompts (readLine, readPassword, etc.).
     * Responses are consumed in order.
     */
    setReaderResponses(...responses: any[]): void {
        this.readerResponses = [...responses];
    }

    /**
     * Execute a command string through the full parsing → execution → piping pipeline.
     * Returns captured stdout, stderr, exit code, and pipeline data.
     */
    async execute(command: string): Promise<CliTestResult> {
        const writer = createTestWriter();
        const context = this.createContext(writer);

        await this.executor.executeCommand(command, context);

        return {
            stdout: writer.stdout,
            stderr: writer.stderr,
            output: writer.stdout.join('\n'),
            exitCode: context.process.exitCode,
            data: context.process.data,
            tables: writer.tables,
            lists: writer.lists,
        };
    }

    private createContext(
        writer: TestWriter,
    ): ICliExecutionHost {
        const process = new CliExecutionProcess(null as any);
        const reader = createQueuedReader(this.readerResponses);

        const context: ICliExecutionHost = {
            writer,
            services: this.services,
            translator: new CliTranslationService(),
            spinner: createNoopSpinner(),
            progressBar: createNoopProgressBar(),
            textAnimator: createNoopTextAnimator(),
            onAbort: new Subject<void>(),
            terminal: {} as any,
            reader,
            executor: this.executor,
            clipboard: createNoopClipboard(),
            options: undefined,
            logger: createNoopLogger(),
            process,
            userSession: this.userSession,
            state: this.stateStoreManager.getStateStore('shared'),
            backgroundServices: createNoopBackgroundServices(),
            promptLength: 0,
            currentLine: '',
            cursorPosition: 0,
            showPrompt: () => {},
            setContextProcessor: () => {},
            setCurrentLine: () => {},
            clearLine: () => {},
            clearCurrentLine: () => {},
            refreshCurrentLine: () => {},
            enterFullScreenMode: () => {},
            exitFullScreenMode: () => {},
            createInterval: (cb: () => void, ms: number): ICliManagedInterval => {
                const id = setInterval(cb, ms);
                return {
                    clear: () => clearInterval(id),
                    setDelay: (newMs: number) => {
                        clearInterval(id);
                        setInterval(cb, newMs);
                    },
                };
            },
            createTimeout: (cb: () => void, ms: number): ICliManagedTimer => {
                const id = setTimeout(cb, ms);
                return { clear: () => clearTimeout(id) };
            },
        };

        // Wire process back to context
        (process as any).context = context;

        return context;
    }
}

// ---------------------------------------------------------------------------
// Test writer — captures stdout and stderr
// ---------------------------------------------------------------------------

interface TestWriter extends ICliTerminalWriter {
    stdout: string[];
    stderr: string[];
    tables: { headers: string[]; rows: string[][] }[];
    lists: string[][];
}

function createTestWriter(): TestWriter {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const tables: { headers: string[]; rows: string[][] }[] = [];
    const lists: string[][] = [];

    return {
        stdout,
        stderr,
        tables,
        lists,
        write(text: string) { stdout.push(text); },
        writeln(text?: string) { stdout.push(text ?? ''); },
        writeSuccess(msg: string) { stdout.push(`[success] ${msg}`); },
        writeInfo(msg: string) { stdout.push(`[info] ${msg}`); },
        writeWarning(msg: string) { stderr.push(`[warn] ${msg}`); },
        writeError(msg: string) { stderr.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { stdout.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { stdout.push(JSON.stringify(objects)); },
        writeTable(headers: string[], rows: string[][]) {
            tables.push({ headers, rows });
            // Also push to stdout so output assertions can find table data
            stdout.push(headers.join('\t'));
            for (const row of rows) {
                stdout.push(row.join('\t'));
            }
        },
        writeDivider() {},
        writeList(items: string[], _options?: any) {
            lists.push(items);
            for (const item of items) {
                stdout.push(item);
            }
        },
        writeKeyValue(entries: any, _options?: any) {
            if (typeof entries === 'object' && !Array.isArray(entries)) {
                for (const [k, v] of Object.entries(entries)) {
                    stdout.push(`${k}: ${v}`);
                }
            }
        },
        writeColumns(items: string[], _options?: any) {
            for (const item of items) {
                stdout.push(item);
            }
        },
    };
}

// ---------------------------------------------------------------------------
// Noop stubs for context dependencies
// ---------------------------------------------------------------------------

function createNoopSpinner(): ICliSpinner {
    return {
        show() {},
        hide() {},
        setText() {},
        isRunning: false,
    };
}

function createNoopProgressBar(): ICliPercentageProgressBar {
    return {
        show() {},
        update() {},
        hide() {},
        complete() {},
        setText() {},
        isRunning: false,
    };
}

function createNoopTextAnimator(): ICliTextAnimator {
    return {
        show() {},
        hide() {},
        showText: async () => {},
        isRunning: false,
    };
}

function createNoopLogger(): ICliLogger {
    return {
        log() {},
        info() {},
        warn() {},
        error() {},
        debug() {},
        setCliLogLevel() {},
    };
}

function createNoopClipboard(): ICliClipboard {
    return {
        write: async () => {},
        read: async () => '',
    };
}

function createQueuedReader(queue: any[]): ICliInputReader {
    let index = 0;
    const next = () => queue[index++];
    return {
        readLine: async () => next() ?? '',
        readPassword: async () => next() ?? '',
        readConfirm: async () => next() ?? false,
        readSelect: async () => next() ?? '',
        readSelectInline: async () => next() ?? '',
        readMultiSelect: async () => next() ?? [],
        readNumber: async () => next() ?? 0,
    };
}

function createNoopBackgroundServices(): ICliBackgroundServiceRegistry {
    return {
        register: () => {},
        unregister: () => {},
        get: () => undefined as any,
        getAll: () => [],
        destroyAll: async () => {},
    } as any;
}

function createInMemoryKvStore(): ICliKeyValueStore {
    const store = new Map<string, any>();
    return {
        get: async <T = any>(key: string) => store.get(key) as T | undefined,
        set: async (key: string, value: any) => { store.set(key, value); },
        remove: async (key: string) => { store.delete(key); },
        clear: async () => { store.clear(); },
    };
}
