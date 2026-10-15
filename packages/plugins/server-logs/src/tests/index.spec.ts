import { CliLogsCommandProcessor } from '../lib/processors/cli-logs-command-processor';

describe('CliLogsCommandProcessor', () => {
    let processor: CliLogsCommandProcessor;

    beforeEach(() => {
        processor = new CliLogsCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "server"', () => {
            expect(processor.command).toBe('server');
        });

        it('should have extendsProcessor = true', () => {
            expect(processor.extendsProcessor).toBe(true);
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });
    });

    describe('metadata', () => {
        it('should have metadata defined', () => {
            expect(processor.metadata).toBeDefined();
        });

        it('should have requireServer = true in metadata', () => {
            expect(processor.metadata!.requireServer).toBe(true);
        });

        it('should have an icon in metadata', () => {
            expect(processor.metadata!.icon).toBeDefined();
        });
    });

    describe('sub-processors', () => {
        it('should have processors array defined', () => {
            expect(processor.processors).toBeDefined();
            expect(Array.isArray(processor.processors)).toBe(true);
        });

        it('should include "logs" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'logs',
            );
            expect(sub).toBeDefined();
        });

        describe('logs sub-processor', () => {
            let logsProcessor: any;

            beforeEach(() => {
                logsProcessor = processor.processors!.find(
                    (p) => p.command === 'logs',
                );
            });

            it('should have a description', () => {
                expect(logsProcessor.description).toBeDefined();
            });

            it('should have processCommand as a function', () => {
                expect(typeof logsProcessor.processCommand).toBe('function');
            });

            it('should have writeDescription as a function', () => {
                expect(typeof logsProcessor.writeDescription).toBe('function');
            });

            describe('parameters', () => {
                it('should have parameters array defined', () => {
                    expect(logsProcessor.parameters).toBeDefined();
                    expect(Array.isArray(logsProcessor.parameters)).toBe(true);
                });

                it('should have exactly 4 parameters', () => {
                    expect(logsProcessor.parameters.length).toBe(4);
                });

                it('should include "pattern" parameter', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'pattern',
                    );
                    expect(param).toBeDefined();
                    expect(param.type).toBe('string');
                });

                it('should include "level" parameter', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'level',
                    );
                    expect(param).toBeDefined();
                    expect(param.type).toBe('string');
                });

                it('should include "server" parameter', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'server',
                    );
                    expect(param).toBeDefined();
                    expect(param.type).toBe('string');
                });

                it('should include "file" parameter', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'file',
                    );
                    expect(param).toBeDefined();
                    expect(param.type).toBe('boolean');
                });
            });

            describe('parameter validators', () => {
                it('"level" parameter should have a validator', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'level',
                    );
                    expect(param.validator).toBeDefined();
                    expect(typeof param.validator).toBe('function');
                });

                it('"level" validator should accept valid log levels', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'level',
                    );
                    const validLevels = [
                        'verbose',
                        'debug',
                        'information',
                        'warning',
                        'error',
                        'fatal',
                    ];
                    for (const level of validLevels) {
                        const result = param.validator(level);
                        expect(result.valid)
                            .withContext(`Level "${level}" should be valid`)
                            .toBe(true);
                    }
                });

                it('"level" validator should reject invalid log levels', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'level',
                    );
                    const result = param.validator('invalid-level');
                    expect(result.valid).toBe(false);
                    expect(result.message).toBeDefined();
                });

                it('"pattern" parameter should have a validator', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'pattern',
                    );
                    expect(param.validator).toBeDefined();
                    expect(typeof param.validator).toBe('function');
                });

                it('"pattern" validator should accept valid regex patterns', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'pattern',
                    );
                    const result = param.validator('\\d+');
                    expect(result.valid).toBe(true);
                });

                it('"pattern" validator should reject invalid regex patterns', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'pattern',
                    );
                    const result = param.validator('[invalid');
                    expect(result.valid).toBe(false);
                    expect(result.message).toBeDefined();
                });

                it('"server" parameter should not have a validator', () => {
                    const param = logsProcessor.parameters.find(
                        (p: any) => p.name === 'server',
                    );
                    expect(param.validator).toBeUndefined();
                });
            });

            describe('"live" sub-processor', () => {
                it('should include "live" sub-processor', () => {
                    const sub = logsProcessor.processors.find(
                        (p: any) => p.command === 'live',
                    );
                    expect(sub).toBeDefined();
                });

                it('"live" sub-processor should have processCommand', () => {
                    const sub = logsProcessor.processors.find(
                        (p: any) => p.command === 'live',
                    );
                    expect(typeof sub.processCommand).toBe('function');
                });

                it('"live" sub-processor should share the same parameters', () => {
                    const sub = logsProcessor.processors.find(
                        (p: any) => p.command === 'live',
                    );
                    expect(sub.parameters).toBe(logsProcessor.parameters);
                });
            });
        });
    });

    describe('server selection', () => {
        let urls: string[];
        let originalWebSocket: typeof WebSocket;
        let errors: string[];

        class FakeWebSocket {
            onopen: any; onmessage: any; onerror: any; onclose: any;
            constructor(url: string) { urls.push(url); }
            close() {}
        }

        const context = (): any => ({
            options: { servers: [{ name: 'Node', url: 'http://node.test' }] },
            services: {
                // An auth service that would hand out a ticket for any server name
                get: (token: string) => token === 'cli-server-auth-service'
                    ? { getHeaders: () => ({}), getWebSocketParams: async () => ({ ticket: 'secret' }) }
                    : undefined,
            },
            writer: { writeError: (m: string) => errors.push(m), writeSuccess() {}, writeln() {}, writeInfo() {} },
            notifier: { info() {} },
            signal: new AbortController().signal,
            process: { exit() {} },
        });

        const run = async (args: Record<string, string>) => {
            void processor.processors![0].processCommand({ command: 'server', args, chainCommands: [], rawCommand: '' } as any, context());
            await new Promise((r) => setTimeout(r, 0));
        };

        beforeEach(() => {
            urls = [];
            errors = [];
            originalWebSocket = (window as any).WebSocket;
            (window as any).WebSocket = FakeWebSocket;
        });

        afterEach(() => {
            (window as any).WebSocket = originalWebSocket;
        });

        it('does not send credentials to an ad-hoc URL', async () => {
            await run({ server: 'http://elsewhere.test' });
            expect(urls).toEqual(['ws://elsewhere.test/ws/v1/qcli/logs']);
        });

        it('matches configured server names case-insensitively', async () => {
            await run({ server: 'node' });
            expect(urls).toEqual(['ws://node.test/ws/v1/qcli/logs?ticket=secret']);
        });
    });
});
