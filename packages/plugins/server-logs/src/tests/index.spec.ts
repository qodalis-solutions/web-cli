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
        it('should have command name "server-logs"', () => {
            expect(processor.command).toBe('server-logs');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
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

    describe('parameters', () => {
        it('should have parameters array defined', () => {
            expect(processor.parameters).toBeDefined();
            expect(Array.isArray(processor.parameters)).toBe(true);
        });

        it('should have exactly 4 parameters', () => {
            expect(processor.parameters!.length).toBe(4);
        });

        it('should include "pattern" parameter', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'pattern',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should include "level" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'level');
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should include "server" parameter', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'server',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should include "file" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'file');
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
        });
    });

    describe('parameter validators', () => {
        it('"level" parameter should have a validator', () => {
            const param = processor.parameters!.find((p) => p.name === 'level');
            expect(param!.validator).toBeDefined();
            expect(typeof param!.validator).toBe('function');
        });

        it('"level" validator should accept valid log levels', () => {
            const param = processor.parameters!.find((p) => p.name === 'level');
            const validLevels = [
                'verbose',
                'debug',
                'information',
                'warning',
                'error',
                'fatal',
            ];
            for (const level of validLevels) {
                const result = param!.validator!(level);
                expect(result.valid)
                    .withContext(`Level "${level}" should be valid`)
                    .toBe(true);
            }
        });

        it('"level" validator should reject invalid log levels', () => {
            const param = processor.parameters!.find((p) => p.name === 'level');
            const result = param!.validator!('invalid-level');
            expect(result.valid).toBe(false);
            expect(result.message).toBeDefined();
        });

        it('"pattern" parameter should have a validator', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'pattern',
            );
            expect(param!.validator).toBeDefined();
            expect(typeof param!.validator).toBe('function');
        });

        it('"pattern" validator should accept valid regex patterns', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'pattern',
            );
            const result = param!.validator!('\\d+');
            expect(result.valid).toBe(true);
        });

        it('"pattern" validator should reject invalid regex patterns', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'pattern',
            );
            const result = param!.validator!('[invalid');
            expect(result.valid).toBe(false);
            expect(result.message).toBeDefined();
        });

        it('"server" parameter should not have a validator', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'server',
            );
            expect(param!.validator).toBeUndefined();
        });

    });

    describe('sub-processors', () => {
        it('should have processors array defined', () => {
            expect(processor.processors).toBeDefined();
            expect(Array.isArray(processor.processors)).toBe(true);
        });

        it('should include "live" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'live');
            expect(sub).toBeDefined();
        });

        it('"live" sub-processor should have a description', () => {
            const sub = processor.processors!.find((p) => p.command === 'live');
            expect(sub!.description).toBeDefined();
        });

        it('"live" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'live');
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"live" sub-processor should have writeDescription as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'live');
            expect(typeof sub!.writeDescription).toBe('function');
        });

        it('"live" sub-processor should share the same parameters as the parent', () => {
            const sub = processor.processors!.find((p) => p.command === 'live');
            expect(sub!.parameters).toBe(processor.parameters);
        });
    });

    describe('processCommand', () => {
        it('should have processCommand defined as a function', () => {
            expect(typeof processor.processCommand).toBe('function');
        });
    });

    describe('writeDescription', () => {
        it('should have writeDescription defined as a function', () => {
            expect(typeof processor.writeDescription).toBe('function');
        });
    });
});
