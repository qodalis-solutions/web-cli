import { CliPasswordGeneratorCommandProcessor } from '../lib/processors/cli-password-generator-command-processor';

describe('CliPasswordGeneratorCommandProcessor', () => {
    let processor: CliPasswordGeneratorCommandProcessor;

    beforeEach(() => {
        processor = new CliPasswordGeneratorCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "generate-password"', () => {
            expect(processor.command).toBe('generate-password');
        });

        it('should have a description defined', () => {
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

    describe('parameters', () => {
        it('should have 4 parameters', () => {
            expect(processor.parameters).toBeDefined();
            expect(processor.parameters!.length).toBe(4);
        });

        it('should have "length" parameter with type "number" and defaultValue 16', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'length',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('number');
            expect(param!.defaultValue).toBe(16);
        });

        it('should have "symbols" parameter with type "boolean" and defaultValue false', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'symbols',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
            expect(param!.defaultValue).toBe(false);
        });

        it('should have "uppercase" parameter with type "boolean" and defaultValue true', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'uppercase',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
            expect(param!.defaultValue).toBe(true);
        });

        it('should have "numbers" parameter with type "boolean" and defaultValue true', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'numbers',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
            expect(param!.defaultValue).toBe(true);
        });

        it('should contain all expected parameter names', () => {
            const names = processor.parameters!.map((p) => p.name);
            expect(names).toContain('length');
            expect(names).toContain('symbols');
            expect(names).toContain('uppercase');
            expect(names).toContain('numbers');
        });
    });

    describe('sub-processors', () => {
        it('should not have sub-processors', () => {
            expect(
                !processor.processors || processor.processors.length === 0,
            ).toBe(true);
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
