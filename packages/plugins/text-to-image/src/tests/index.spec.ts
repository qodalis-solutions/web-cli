import { CliTextToImageCommandProcessor } from '../lib/processors/cli-text-to-image-command-processor';

describe('CliTextToImageCommandProcessor', () => {
    let processor: CliTextToImageCommandProcessor;

    beforeEach(() => {
        processor = new CliTextToImageCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "text-to-image"', () => {
            expect(processor.command).toBe('text-to-image');
        });

        it('should have a description defined', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have valueRequired set to true', () => {
            expect(processor.valueRequired).toBe(true);
        });

        it('should have acceptsRawInput set to true', () => {
            expect(processor.acceptsRawInput).toBe(true);
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });

        it('should have metadata with an icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBeDefined();
        });

        it('should have metadata with module name', () => {
            expect(processor.metadata!.module).toBe('text-to-image');
        });
    });

    describe('parameters', () => {
        it('should have 8 parameters', () => {
            expect(processor.parameters).toBeDefined();
            expect(processor.parameters!.length).toBe(8);
        });

        it('should have parameter named "fileName"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'fileName',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should have parameter named "width"', () => {
            const param = processor.parameters!.find((p) => p.name === 'width');
            expect(param).toBeDefined();
            expect(param!.type).toBe('integer');
        });

        it('should have parameter named "height"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'height',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('integer');
        });

        it('should have parameter named "bgColor"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'bgColor',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should have parameter named "textColor"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'textColor',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should have parameter named "font"', () => {
            const param = processor.parameters!.find((p) => p.name === 'font');
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should have parameter named "padding"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'padding',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('integer');
        });

        it('should have parameter named "textAlign"', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'textAlign',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should contain all expected parameter names', () => {
            const names = processor.parameters!.map((p) => p.name);
            expect(names).toContain('fileName');
            expect(names).toContain('width');
            expect(names).toContain('height');
            expect(names).toContain('bgColor');
            expect(names).toContain('textColor');
            expect(names).toContain('font');
            expect(names).toContain('padding');
            expect(names).toContain('textAlign');
        });

        it('should have all parameters marked as optional', () => {
            for (const param of processor.parameters!) {
                expect(param.required).toBe(false);
            }
        });
    });

    describe('sub-processors', () => {
        it('should not have sub-processors', () => {
            expect(
                !(processor as any).processors ||
                    (processor as any).processors.length === 0,
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
