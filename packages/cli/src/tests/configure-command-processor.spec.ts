import { Subject } from 'rxjs';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
    ICliStateStore,
    ICliCommandProcessorRegistry,
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    CliProvider,
    ICliConfigurationOption,
} from '@qodalis/cli-core';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliExecutionProcess } from '../lib/context/cli-execution-process';
import {
    CliProcessorsRegistry_TOKEN,
    CliStateStoreManager_TOKEN,
} from '../lib/tokens';
import { CliConfigureCommandProcessor } from '../lib/processors/configure/cli-configure-command-processor';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) {
            written.push(text);
        },
        writeln(text?: string) {
            written.push(text ?? '');
        },
        writeSuccess(msg: string) {
            written.push(`[success] ${msg}`);
        },
        writeInfo(msg: string) {
            written.push(`[info] ${msg}`);
        },
        writeWarning(msg: string) {
            written.push(`[warn] ${msg}`);
        },
        writeError(msg: string) {
            written.push(`[error] ${msg}`);
        },
        wrapInColor(text: string, _color: CliForegroundColor) {
            return text;
        },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) {
            return text;
        },
        writeJson(json: any) {
            written.push(JSON.stringify(json));
        },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) {
            written.push(JSON.stringify(objects));
        },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

function createStubStateStore(
    initialState?: Record<string, any>,
): ICliStateStore {
    const state: Record<string, any> = initialState ?? {
        system: { logLevel: 'ERROR', welcomeMessage: 'always' },
        plugins: {},
    };
    return {
        getState: () => state as any,
        updateState: (partial: any) => Object.assign(state, partial),
        select: () => new Subject<any>().asObservable(),
        subscribe: () => ({ unsubscribe() {} }) as any,
        reset: () => {
            // Reset to initial defaults
            Object.keys(state).forEach((k) => delete state[k]);
            Object.assign(state, {
                system: { logLevel: 'ERROR', welcomeMessage: 'always' },
                plugins: {},
            });
        },
        persist: async () => {},
        initialize: async () => {},
    } as ICliStateStore;
}

function createMockContext(
    writer: ICliTerminalWriter & { written: string[] },
    registry: CliCommandProcessorRegistry,
    stateStore?: ICliStateStore,
): ICliExecutionContext {
    const state = stateStore ?? createStubStateStore();

    const services: ICliServiceProvider = {
        get<T>(token: any): T {
            if (token === CliProcessorsRegistry_TOKEN) {
                return registry as unknown as T;
            }
            if (token === CliStateStoreManager_TOKEN) {
                return {
                    getProcessorStateStore: () => state,
                    getStateStore: () => state,
                    getStoreEntries: () => [],
                } as unknown as T;
            }
            return undefined as unknown as T;
        },
        set(_def: CliProvider | CliProvider[]): void {},
    };

    const ctx: any = {
        writer,
        process: null as any,
        services,
        state,
        spinner: { show: () => {}, hide: () => {} },
        progressBar: { show: () => {}, update: () => {}, hide: () => {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        translator: {
            t: (_key: string, defaultValue: string, params?: Record<string, string>) => {
                if (!params) return defaultValue;
                let result = defaultValue;
                for (const [k, v] of Object.entries(params)) {
                    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
                }
                return result;
            },
            setLocale() {},
            getLocale: () => 'en',
            getAvailableLocales: () => ['en'],
            registerLocale() {},
        },
        reader: {
            readLine: jasmine
                .createSpy('readLine')
                .and.returnValue(Promise.resolve(null)),
            readConfirm: jasmine
                .createSpy('readConfirm')
                .and.returnValue(Promise.resolve(null)),
            readSelect: jasmine
                .createSpy('readSelect')
                .and.returnValue(Promise.resolve(null)),
            readNumber: jasmine
                .createSpy('readNumber')
                .and.returnValue(Promise.resolve(null)),
        },
        executor: {
            showHelp: jasmine.createSpy('showHelp'),
        },
        clipboard: {} as any,
        options: {} as any,
        promptLength: 0,
        currentLine: '',
        cursorPosition: 0,
        logger: {
            log() {},
            info() {},
            warn() {},
            error() {},
            debug() {},
            setCliLogLevel: jasmine.createSpy('setCliLogLevel'),
        },
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        showPrompt: jasmine.createSpy('showPrompt'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    };
    ctx.process = new CliExecutionProcess(ctx as ICliExecutionContext);
    return ctx as ICliExecutionContext;
}

// ---------------------------------------------------------------------------
// CliConfigureCommandProcessor Tests
// ---------------------------------------------------------------------------
describe('CliConfigureCommandProcessor', () => {
    let processor: CliConfigureCommandProcessor;
    let registry: CliCommandProcessorRegistry;
    let writer: ICliTerminalWriter & { written: string[] };
    let context: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliConfigureCommandProcessor();
        registry = new CliCommandProcessorRegistry();
        writer = createStubWriter();
        context = createMockContext(writer, registry);
    });

    // -----------------------------------------------------------------------
    // 1. list subcommand
    // -----------------------------------------------------------------------
    describe('list subcommand', () => {
        let listProcessor: ICliCommandProcessor;

        beforeEach(() => {
            listProcessor = processor.processors!.find(
                (p) => p.command === 'list',
            )!;
        });

        it('should list system configuration options', async () => {
            const cmd: CliProcessCommand = {
                command: 'list',
                chainCommands: [],
                rawCommand: 'configure list',
                args: {},
            };

            await listProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('logLevel');
            expect(output).toContain('welcomeMessage');
        });

        it('should include plugin configuration when available', async () => {
            // Register a mock processor with configurationOptions on the registry
            const mockPluginProcessor: ICliCommandProcessor = {
                command: 'my-plugin',
                description: 'A test plugin',
                configurationOptions: [
                    {
                        key: 'maxRetries',
                        label: 'Max Retries',
                        description: 'Maximum number of retries',
                        type: 'number',
                        defaultValue: 3,
                    },
                ],
                processCommand: async () => {},
            };
            registry.registerProcessor(mockPluginProcessor);

            const cmd: CliProcessCommand = {
                command: 'list',
                chainCommands: [],
                rawCommand: 'configure list',
                args: {},
            };

            await listProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('maxRetries');
        });
    });

    // -----------------------------------------------------------------------
    // 2. get subcommand
    // -----------------------------------------------------------------------
    describe('get subcommand', () => {
        let getProcessor: ICliCommandProcessor;

        beforeEach(() => {
            getProcessor = processor.processors!.find(
                (p) => p.command === 'get',
            )!;
        });

        it('should return a system config value', async () => {
            const cmd: CliProcessCommand = {
                command: 'get',
                chainCommands: [],
                rawCommand: 'configure get system.logLevel',
                value: 'system.logLevel',
                args: {},
            };

            await getProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('ERROR');
        });

        it('should error on unknown key', async () => {
            const cmd: CliProcessCommand = {
                command: 'get',
                chainCommands: [],
                rawCommand: 'configure get system.nonexistent',
                value: 'system.nonexistent',
                args: {},
            };

            await getProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('Unknown configuration key');
        });

        it('should error on missing dot notation', async () => {
            const cmd: CliProcessCommand = {
                command: 'get',
                chainCommands: [],
                rawCommand: 'configure get logLevel',
                value: 'logLevel',
                args: {},
            };

            await getProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('Invalid format');
        });
    });

    // -----------------------------------------------------------------------
    // 3. set subcommand
    // -----------------------------------------------------------------------
    describe('set subcommand', () => {
        let setProcessor: ICliCommandProcessor;

        beforeEach(() => {
            setProcessor = processor.processors!.find(
                (p) => p.command === 'set',
            )!;
        });

        it('should set a system config value', async () => {
            const cmd: CliProcessCommand = {
                command: 'set',
                chainCommands: [],
                rawCommand: 'configure set system.logLevel Warn',
                value: 'system.logLevel Warn',
                args: {},
            };

            await setProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('[success]');
        });

        it('should reject invalid select value', async () => {
            const cmd: CliProcessCommand = {
                command: 'set',
                chainCommands: [],
                rawCommand: 'configure set system.logLevel INVALID',
                value: 'system.logLevel INVALID',
                args: {},
            };

            await setProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('Invalid value');
        });

        it('should error on insufficient args', async () => {
            const cmd: CliProcessCommand = {
                command: 'set',
                chainCommands: [],
                rawCommand: 'configure set system.logLevel',
                value: 'system.logLevel',
                args: {},
            };

            await setProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('Invalid format');
        });

        it('should coerce boolean values correctly', async () => {
            // Register a plugin with a boolean config option
            const boolPlugin: ICliCommandProcessor = {
                command: 'test-bool',
                description: 'A test plugin with boolean config',
                configurationOptions: [
                    {
                        key: 'enabled',
                        label: 'Enabled',
                        description: 'Enable the plugin',
                        type: 'boolean',
                        defaultValue: false,
                    },
                ],
                processCommand: async () => {},
            };
            registry.registerProcessor(boolPlugin);

            const cmd: CliProcessCommand = {
                command: 'set',
                chainCommands: [],
                rawCommand: 'configure set test-bool.enabled true',
                value: 'test-bool.enabled true',
                args: {},
            };

            await setProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('[success]');

            // Verify the value was stored as boolean true, not string
            const state = context.state.getState<any>();
            expect(state.plugins['test-bool'].enabled).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // 4. reset subcommand
    // -----------------------------------------------------------------------
    describe('reset subcommand', () => {
        let resetProcessor: ICliCommandProcessor;

        beforeEach(() => {
            resetProcessor = processor.processors!.find(
                (p) => p.command === 'reset',
            )!;
        });

        it('should reset a specific category', async () => {
            // First modify state to have logLevel='DEBUG'
            const state = context.state.getState<any>();
            state.system.logLevel = 'Debug';
            context.state.updateState({ system: state.system });

            const cmd: CliProcessCommand = {
                command: 'reset',
                chainCommands: [],
                rawCommand: 'configure reset system',
                value: 'system',
                args: {},
            };

            await resetProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('[success]');
            expect(output).toContain('reset to defaults');
        });

        it('should error on unknown category', async () => {
            const cmd: CliProcessCommand = {
                command: 'reset',
                chainCommands: [],
                rawCommand: 'configure reset nonexistent',
                value: 'nonexistent',
                args: {},
            };

            await resetProcessor.processCommand!(cmd, context);

            const output = writer.written.join('\n');
            expect(output).toContain('Unknown category');
        });

        it('should prompt for confirmation when resetting all', async () => {
            (context.reader.readConfirm as jasmine.Spy).and.returnValue(
                Promise.resolve(false),
            );

            const cmd: CliProcessCommand = {
                command: 'reset',
                chainCommands: [],
                rawCommand: 'configure reset',
                args: {},
            };

            await resetProcessor.processCommand!(cmd, context);

            expect(context.reader.readConfirm).toHaveBeenCalled();
            const output = writer.written.join('\n');
            expect(output).toContain('cancelled');
        });

        it('should reset all configuration when confirmation is accepted', async () => {
            // First change a system config value
            const state = context.state.getState<any>();
            state.system.logLevel = 'Debug';
            context.state.updateState({ system: state.system });

            // Mock readConfirm to return true
            (context.reader.readConfirm as jasmine.Spy).and.returnValue(
                Promise.resolve(true),
            );

            const cmd: CliProcessCommand = {
                command: 'reset',
                chainCommands: [],
                rawCommand: 'configure reset',
                args: {},
            };

            await resetProcessor.processCommand!(cmd, context);

            expect(context.reader.readConfirm).toHaveBeenCalled();
            const output = writer.written.join('\n');
            expect(output).toContain('[success]');
            expect(output).toContain('All configuration reset to defaults');

            // Verify state was reset to defaults
            const resetState = context.state.getState<any>();
            expect(resetState.system.logLevel).toBe('ERROR');
            expect(resetState.system.welcomeMessage).toBe('always');
        });
    });

    // -----------------------------------------------------------------------
    // 5. initialize
    // -----------------------------------------------------------------------
    describe('initialize', () => {
        it('should apply persisted system settings on boot', async () => {
            const stateStore = createStubStateStore({
                system: { logLevel: 'Warn', welcomeMessage: 'always' },
                plugins: {},
            });
            const ctx = createMockContext(writer, registry, stateStore);

            await processor.initialize!(ctx);

            expect(ctx.logger.setCliLogLevel).toHaveBeenCalled();
        });
    });
});
