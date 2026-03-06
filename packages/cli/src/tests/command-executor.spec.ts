import { Subject } from 'rxjs';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
    ICliStateStore,
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    CliProvider,
    ICliProcessorHook,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { CliCommandExecutor } from '../lib/executor';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliExecutionProcess } from '../lib/context/cli-execution-process';
import { CliStateStoreManager_TOKEN } from '../lib/tokens';
import { ProcessExitedError } from '../lib/errors';

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

function createStubStateStore(): ICliStateStore {
    const state: Record<string, any> = {};
    return {
        getState: () => state as any,
        updateState: (partial: any) => Object.assign(state, partial),
        select: () => new Subject<any>().asObservable(),
        subscribe: () => ({ unsubscribe() {} }) as any,
        reset: () => {},
        persist: async () => {},
        initialize: async () => {},
    } as ICliStateStore;
}

class MockServiceProvider implements ICliServiceProvider {
    private services = new Map<any, any>();

    constructor() {
        this.services.set(CliStateStoreManager_TOKEN, {
            getProcessorStateStore: () => createStubStateStore(),
            getStateStore: () => createStubStateStore(),
            getStoreEntries: () => [],
        });
    }

    get<T>(token: any): T {
        return this.services.get(token) as T;
    }

    set(_def: CliProvider | CliProvider[]): void {}
}

function createMockContext(writer: ICliTerminalWriter): ICliExecutionContext {
    const services = new MockServiceProvider();
    const ctx: any = {
        writer,
        process: null as any,
        services,
        spinner: { show: () => {}, hide: () => {} },
        progressBar: { show: () => {}, update: () => {}, hide: () => {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {} as any,
        executor: {} as any,
        clipboard: {} as any,
        options: undefined,
        promptLength: 0,
        currentLine: '',
        cursorPosition: 0,
        logger: {
            log() {},
            info() {},
            warn() {},
            error() {},
            debug() {},
            setCliLogLevel() {},
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

function createTestProcessor(
    command: string,
    handler: (
        cmd: CliProcessCommand,
        ctx: ICliExecutionContext,
    ) => Promise<void>,
    options?: Partial<ICliCommandProcessor>,
): ICliCommandProcessor {
    return {
        command,
        description: `Test ${command}`,
        processCommand: handler,
        ...options,
    } as ICliCommandProcessor;
}

// ---------------------------------------------------------------------------
// CliCommandExecutor Integration Tests
// ---------------------------------------------------------------------------
describe('CliCommandExecutor', () => {
    let registry: CliCommandProcessorRegistry;
    let executor: CliCommandExecutor;
    let writer: ICliTerminalWriter & { written: string[] };
    let context: ICliExecutionContext;

    beforeEach(() => {
        registry = new CliCommandProcessorRegistry();
        executor = new CliCommandExecutor(registry);
        writer = createStubWriter();
        context = createMockContext(writer);
        (context as any).executor = executor;
    });

    // -----------------------------------------------------------------------
    // 1. Single command execution
    // -----------------------------------------------------------------------
    describe('Single command execution', () => {
        it('should resolve processor and call processCommand', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            registry.registerProcessor(createTestProcessor('echo', spy));

            await executor.executeCommand('echo', context);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('should pass parsed args to processCommand', async () => {
            let receivedCmd: CliProcessCommand | undefined;
            registry.registerProcessor(
                createTestProcessor('echo', async (cmd) => {
                    receivedCmd = cmd;
                }),
            );

            await executor.executeCommand(
                'echo --name=world --verbose',
                context,
            );

            expect(receivedCmd).toBeDefined();
            expect(receivedCmd!.args['name']).toBe('world');
            expect(receivedCmd!.args['verbose']).toBe(true);
        });

        it('should set process.exitCode to 0 on success', async () => {
            registry.registerProcessor(
                createTestProcessor('echo', async () => {}),
            );

            await executor.executeCommand('echo', context);

            expect(context.process.exitCode).toBe(0);
        });

        it('should write error for unknown command and set exit code -1', async () => {
            await executor.executeCommand('nonexistent', context);

            expect(
                writer.written.some((w) => w.includes('Command not found')),
            ).toBeTrue();
            expect(context.process.exitCode).toBe(-1);
        });

        it('should pass piped data when provided via pipeline', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.process.output('hello from producer');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer | consumer', context);

            expect(receivedData).toBe('hello from producer');
        });
    });

    // -----------------------------------------------------------------------
    // 2. Operator && — AND chaining
    // -----------------------------------------------------------------------
    describe('Operator && — AND chaining', () => {
        it('should run second command when first succeeds', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('first', async () => {
                    calls.push('first');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('second', async () => {
                    calls.push('second');
                }),
            );

            await executor.executeCommand('first && second', context);

            expect(calls).toEqual(['first', 'second']);
        });

        it('should skip second command when first fails', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async (_cmd, ctx) => {
                    calls.push('fail');
                    ctx.process.exit(-1);
                }),
            );
            registry.registerProcessor(
                createTestProcessor('second', async () => {
                    calls.push('second');
                }),
            );

            await executor.executeCommand('fail && second', context);

            expect(calls).toEqual(['fail']);
        });

        it('should run all three commands when all succeed', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('a', async () => {
                    calls.push('a');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('b', async () => {
                    calls.push('b');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('c', async () => {
                    calls.push('c');
                }),
            );

            await executor.executeCommand('a && b && c', context);

            expect(calls).toEqual(['a', 'b', 'c']);
        });

        it('should stop chain at first failure', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async (_cmd, ctx) => {
                    calls.push('fail');
                    ctx.process.exit(1);
                }),
            );
            registry.registerProcessor(
                createTestProcessor('skip1', async () => {
                    calls.push('skip1');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('skip2', async () => {
                    calls.push('skip2');
                }),
            );

            await executor.executeCommand('fail && skip1 && skip2', context);

            expect(calls).toEqual(['fail']);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Operator || — OR chaining
    // -----------------------------------------------------------------------
    describe('Operator || — OR chaining', () => {
        it('should run second command when first fails', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async (_cmd, ctx) => {
                    calls.push('fail');
                    ctx.process.exit(-1);
                }),
            );
            registry.registerProcessor(
                createTestProcessor('fallback', async () => {
                    calls.push('fallback');
                }),
            );

            await executor.executeCommand('fail || fallback', context);

            expect(calls).toEqual(['fail', 'fallback']);
        });

        it('should skip second command when first succeeds', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('ok', async () => {
                    calls.push('ok');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('skip', async () => {
                    calls.push('skip');
                }),
            );

            await executor.executeCommand('ok || skip', context);

            expect(calls).toEqual(['ok']);
        });

        it('should stop at first success in three-command chain', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async (_cmd, ctx) => {
                    calls.push('fail');
                    ctx.process.exit(-1);
                }),
            );
            registry.registerProcessor(
                createTestProcessor('ok', async () => {
                    calls.push('ok');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('skip', async () => {
                    calls.push('skip');
                }),
            );

            await executor.executeCommand('fail || ok || skip', context);

            expect(calls).toEqual(['fail', 'ok']);
        });
    });

    // -----------------------------------------------------------------------
    // 4. Operator | — pipe
    // -----------------------------------------------------------------------
    describe('Operator | — pipe', () => {
        it('should pass explicit output of first command as data to second', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.process.output({ key: 'value' });
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer | consumer', context);

            expect(receivedData).toEqual({ key: 'value' });
        });

        it('should auto-capture writeln output as pipeline data', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.writer.writeln('auto captured text');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer | consumer', context);

            expect(receivedData).toBe('auto captured text');
        });

        it('should auto-capture writeJson output as structured data', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.writer.writeJson({ items: [1, 2, 3] });
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer | consumer', context);

            expect(receivedData).toEqual({ items: [1, 2, 3] });
        });

        it('should prefer explicit process.output() over auto-capture', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.writer.writeln('should be ignored');
                    ctx.process.output('explicit data');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer | consumer', context);

            expect(receivedData).toBe('explicit data');
        });
    });

    // -----------------------------------------------------------------------
    // 5. Hooks
    // -----------------------------------------------------------------------
    describe('Hooks', () => {
        it('should run before hooks before processCommand', async () => {
            const order: string[] = [];
            const beforeHook: ICliProcessorHook = {
                when: 'before',
                execute: async () => {
                    order.push('before');
                },
            };
            registry.registerProcessor(
                createTestProcessor(
                    'cmd',
                    async () => {
                        order.push('command');
                    },
                    { hooks: [beforeHook] },
                ),
            );

            await executor.executeCommand('cmd', context);

            expect(order).toEqual(['before', 'command']);
        });

        it('should run after hooks after processCommand', async () => {
            const order: string[] = [];
            const afterHook: ICliProcessorHook = {
                when: 'after',
                execute: async () => {
                    order.push('after');
                },
            };
            registry.registerProcessor(
                createTestProcessor(
                    'cmd',
                    async () => {
                        order.push('command');
                    },
                    { hooks: [afterHook] },
                ),
            );

            await executor.executeCommand('cmd', context);

            expect(order).toEqual(['command', 'after']);
        });

        it('should NOT run after hooks when command throws ProcessExitedError', async () => {
            const order: string[] = [];
            const afterHook: ICliProcessorHook = {
                when: 'after',
                execute: async () => {
                    order.push('after');
                },
            };
            registry.registerProcessor(
                createTestProcessor(
                    'cmd',
                    async (_cmd, ctx) => {
                        order.push('command');
                        ctx.process.exit(1); // throws ProcessExitedError
                    },
                    { hooks: [afterHook] },
                ),
            );

            await executor.executeCommand('cmd', context);

            expect(order).toEqual(['command']);
        });

        it('should execute multiple hooks in order', async () => {
            const order: string[] = [];
            const hooks: ICliProcessorHook[] = [
                {
                    when: 'before',
                    execute: async () => {
                        order.push('before-1');
                    },
                },
                {
                    when: 'before',
                    execute: async () => {
                        order.push('before-2');
                    },
                },
                {
                    when: 'after',
                    execute: async () => {
                        order.push('after-1');
                    },
                },
                {
                    when: 'after',
                    execute: async () => {
                        order.push('after-2');
                    },
                },
            ];
            registry.registerProcessor(
                createTestProcessor(
                    'cmd',
                    async () => {
                        order.push('command');
                    },
                    { hooks },
                ),
            );

            await executor.executeCommand('cmd', context);

            expect(order).toEqual([
                'before-1',
                'before-2',
                'command',
                'after-1',
                'after-2',
            ]);
        });
    });

    // -----------------------------------------------------------------------
    // 6. Validation and special flags
    // -----------------------------------------------------------------------
    describe('Validation and special flags', () => {
        it('should write version and not execute when --version is passed', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            registry.registerProcessor(
                createTestProcessor('cmd', spy, { version: '2.5.0' }),
            );

            await executor.executeCommand('cmd --version', context);

            expect(spy).not.toHaveBeenCalled();
            expect(writer.written.some((w) => w.includes('2.5.0'))).toBeTrue();
        });

        it('should trigger help and not execute processCommand when --help is passed', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            registry.registerProcessor(createTestProcessor('cmd', spy));

            await executor.executeCommand('cmd --help', context);

            expect(spy).not.toHaveBeenCalled();
        });

        it('should write error for missing required parameter', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            const params: ICliCommandParameterDescriptor[] = [
                {
                    name: 'output',
                    description: 'Output file',
                    required: true,
                    type: 'string',
                },
            ];
            registry.registerProcessor(
                createTestProcessor('cmd', spy, { parameters: params }),
            );

            await executor.executeCommand('cmd', context);

            expect(spy).not.toHaveBeenCalled();
            expect(
                writer.written.some((w) =>
                    w.includes('Missing required parameters'),
                ),
            ).toBeTrue();
        });

        it('should write error when parameter validator fails', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            const params: ICliCommandParameterDescriptor[] = [
                {
                    name: 'count',
                    description: 'A count',
                    required: false,
                    type: 'number',
                    validator: (value: any) => {
                        const n = Number(value);
                        return isNaN(n)
                            ? { valid: false, message: 'Must be a number' }
                            : { valid: true };
                    },
                },
            ];
            registry.registerProcessor(
                createTestProcessor('cmd', spy, { parameters: params }),
            );

            await executor.executeCommand('cmd --count=abc', context);

            expect(spy).not.toHaveBeenCalled();
            expect(
                writer.written.some((w) => w.includes('Invalid parameters')),
            ).toBeTrue();
        });

        it('should write error when valueRequired but no value provided', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            registry.registerProcessor(
                createTestProcessor('cmd', spy, { valueRequired: true }),
            );

            await executor.executeCommand('cmd', context);

            expect(spy).not.toHaveBeenCalled();
            expect(
                writer.written.some((w) => w.includes('Value required')),
            ).toBeTrue();
        });

        it('should satisfy valueRequired when named args are provided', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            const params: ICliCommandParameterDescriptor[] = [
                {
                    name: 'server',
                    description: 'Server name',
                    required: true,
                    type: 'string',
                },
            ];
            registry.registerProcessor(
                createTestProcessor('cmd', spy, {
                    valueRequired: true,
                    parameters: params,
                }),
            );

            await executor.executeCommand('cmd --server=node', context);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('should skip required parameter check when positional input is present', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            const params: ICliCommandParameterDescriptor[] = [
                {
                    name: 'server',
                    description: 'Server name',
                    required: true,
                    type: 'string',
                },
                {
                    name: 'path',
                    description: 'Path',
                    required: true,
                    type: 'string',
                },
            ];
            registry.registerProcessor(
                createTestProcessor('cmd', spy, {
                    valueRequired: true,
                    parameters: params,
                }),
            );

            // Positional input "node /app" — processor will parse it,
            // engine should NOT reject for missing --server / --path.
            await executor.executeCommand('cmd node /app', context);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('should enforce required parameters in named-arg mode when positional input is absent', async () => {
            const spy = jasmine
                .createSpy('processCommand')
                .and.returnValue(Promise.resolve());
            const params: ICliCommandParameterDescriptor[] = [
                {
                    name: 'server',
                    description: 'Server name',
                    required: true,
                    type: 'string',
                },
                {
                    name: 'path',
                    description: 'Path',
                    required: true,
                    type: 'string',
                },
            ];
            registry.registerProcessor(
                createTestProcessor('cmd', spy, {
                    valueRequired: true,
                    parameters: params,
                }),
            );

            // Only --server provided, --path is missing, no positional input
            await executor.executeCommand('cmd --server=node', context);

            expect(spy).not.toHaveBeenCalled();
            expect(
                writer.written.some((w) =>
                    w.includes('Missing required parameters'),
                ),
            ).toBeTrue();
        });
    });

    // -----------------------------------------------------------------------
    // 7. Error handling
    // -----------------------------------------------------------------------
    describe('Error handling', () => {
        it('should write info message for ProcessExitedError with code 0', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.process.exit(0); // throws ProcessExitedError with code 0
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(
                writer.written.some((w) =>
                    w.includes('Process exited successfully'),
                ),
            ).toBeTrue();
        });

        it('should write error message for ProcessExitedError with non-zero code', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.process.exit(1); // throws ProcessExitedError with code 1
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(
                writer.written.some((w) =>
                    w.includes('Process exited with code 1'),
                ),
            ).toBeTrue();
        });

        it('should write error and set exit code -1 for generic error', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async () => {
                    throw new Error('something broke');
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(
                writer.written.some((w) =>
                    w.includes('Error executing command'),
                ),
            ).toBeTrue();
            expect(context.process.exitCode).toBe(-1);
        });

        it('should set lastExitSuccess to false for failed command in && chain', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async () => {
                    calls.push('fail');
                    throw new Error('boom');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('after', async () => {
                    calls.push('after');
                }),
            );

            await executor.executeCommand('fail && after', context);

            expect(calls).toEqual(['fail']);
        });
    });

    // -----------------------------------------------------------------------
    // 8. Auto-capture
    // -----------------------------------------------------------------------
    describe('Auto-capture', () => {
        it('should capture writeln output when process.output() not called', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.writer.writeln('captured line');
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.data).toBe('captured line');
        });

        it('should capture writeJson output as structured data', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.writer.writeJson({ a: 1 });
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.data).toEqual({ a: 1 });
        });

        it('should not capture when process.output() was called explicitly', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.writer.writeln('should not be captured');
                    ctx.process.output('explicit');
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.data).toBe('explicit');
        });

        it('should not capture writeError or writeInfo (stderr-equivalent)', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.writer.writeError('error msg');
                    ctx.writer.writeInfo('info msg');
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.data).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Operator ; — sequential execution
    // -----------------------------------------------------------------------
    describe('Operator ; — sequential execution', () => {
        it('should run both commands regardless of first success', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('first', async () => {
                    calls.push('first');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('second', async () => {
                    calls.push('second');
                }),
            );

            await executor.executeCommand('first ; second', context);

            expect(calls).toEqual(['first', 'second']);
        });

        it('should run second command even when first fails', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail', async (_cmd, ctx) => {
                    calls.push('fail');
                    ctx.process.exit(-1);
                }),
            );
            registry.registerProcessor(
                createTestProcessor('second', async () => {
                    calls.push('second');
                }),
            );

            await executor.executeCommand('fail ; second', context);

            expect(calls).toEqual(['fail', 'second']);
        });

        it('should NOT pass pipeline data across ; boundary', async () => {
            let receivedData: any;
            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.process.output('some data');
                }),
            );
            registry.registerProcessor(
                createTestProcessor('consumer', async (cmd) => {
                    receivedData = cmd.data;
                }),
            );

            await executor.executeCommand('producer ; consumer', context);

            expect(receivedData).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // Operator > — overwrite redirect
    // -----------------------------------------------------------------------
    describe('Operator > — overwrite redirect', () => {
        it('should write output to file via > redirect', async () => {
            let writtenPath: string | undefined;
            let writtenContent: string | undefined;
            const mockFs = {
                resolvePath: (p: string) => p.trim(),
                exists: () => false,
                createFile: (path: string, content: string) => {
                    writtenPath = path;
                    writtenContent = content;
                },
                writeFile: (path: string, content: string) => {
                    writtenPath = path;
                    writtenContent = content;
                },
                persist: async () => {},
            };
            (context.services as any).get = (token: any) => {
                if (token === 'cli-file-system-service') return mockFs;
                return (context.services as any).services?.get(token);
            };

            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.process.output('hello world');
                }),
            );

            await executor.executeCommand('producer > output.txt', context);

            expect(writtenPath).toBe('output.txt');
            expect(writtenContent).toBe('hello world');
        });

        it('should overwrite existing file with > redirect', async () => {
            let writtenContent: string | undefined;
            let appendMode: boolean | undefined;
            const mockFs = {
                resolvePath: (p: string) => p.trim(),
                exists: () => true,
                writeFile: (path: string, content: string, append?: boolean) => {
                    writtenContent = content;
                    appendMode = append;
                },
                persist: async () => {},
            };
            (context.services as any).get = (token: any) => {
                if (token === 'cli-file-system-service') return mockFs;
                return (context.services as any).services?.get(token);
            };

            registry.registerProcessor(
                createTestProcessor('producer', async (_cmd, ctx) => {
                    ctx.process.output('new content');
                }),
            );

            await executor.executeCommand('producer > output.txt', context);

            expect(writtenContent).toBe('new content');
            expect(appendMode).toBeFalsy();
        });
    });

    // -----------------------------------------------------------------------
    // process.exit() improvements
    // -----------------------------------------------------------------------
    describe('process.exit() improvements', () => {
        it('should stop pipeline on silent exit with non-zero code', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail-silent', async (_cmd, ctx) => {
                    calls.push('fail-silent');
                    ctx.process.exit(-1, { silent: true });
                }),
            );
            registry.registerProcessor(
                createTestProcessor('after', async () => {
                    calls.push('after');
                }),
            );

            await executor.executeCommand('fail-silent && after', context);

            // Silent exit with code -1 should stop the && chain
            expect(calls).toEqual(['fail-silent']);
        });

        it('should set exitCode on silent exit', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.process.exit(42, { silent: true });
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.exitCode).toBe(42);
        });

        it('should preserve exitCode=0 on silent exit with code 0', async () => {
            registry.registerProcessor(
                createTestProcessor('cmd', async (_cmd, ctx) => {
                    ctx.process.exit(0, { silent: true });
                }),
            );

            await executor.executeCommand('cmd', context);

            expect(context.process.exitCode).toBe(0);
        });

        it('should allow || chain after silent exit failure', async () => {
            const calls: string[] = [];
            registry.registerProcessor(
                createTestProcessor('fail-silent', async (_cmd, ctx) => {
                    calls.push('fail-silent');
                    ctx.process.exit(-1, { silent: true });
                }),
            );
            registry.registerProcessor(
                createTestProcessor('fallback', async () => {
                    calls.push('fallback');
                }),
            );

            await executor.executeCommand('fail-silent || fallback', context);

            // || should run fallback after failure
            expect(calls).toEqual(['fail-silent', 'fallback']);
        });
    });
});
