import { CliSpeedTestCommandProcessor } from '../lib/processors/cli-speed-test-command-processor';

describe('CliSpeedTestCommandProcessor', () => {
    let processor: CliSpeedTestCommandProcessor;

    beforeEach(() => {
        processor = new CliSpeedTestCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "speed-test"', () => {
            expect(processor.command).toBe('speed-test');
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

        it('should have metadata defined', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBeDefined();
        });
    });

    describe('sub-processors', () => {
        it('should have processors array defined', () => {
            expect(processor.processors).toBeDefined();
            expect(Array.isArray(processor.processors)).toBe(true);
        });

        it('should have at least 1 sub-processor', () => {
            expect(processor.processors!.length).toBeGreaterThanOrEqual(1);
        });

        it('should include "run" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'run');
            expect(sub).toBeDefined();
        });

        it('"run" sub-processor should have a description', () => {
            const sub = processor.processors!.find((p) => p.command === 'run');
            expect(sub!.description).toBeDefined();
            expect(sub!.description!.length).toBeGreaterThan(0);
        });

        it('parent processor should have parameters defined', () => {
            expect(processor.parameters).toBeDefined();
            expect(processor.parameters!.length).toBeGreaterThanOrEqual(2);
        });

        it('parent should have a "download-url" parameter of type string', () => {
            const param = processor.parameters!.find(
                (p) => p.name === 'download-url',
            );
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('parent should have an "upload-url" parameter of type string', () => {
            const param = processor.parameters!.find((p) => p.name === 'upload-url');
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('"run" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'run');
            expect(typeof sub!.processCommand).toBe('function');
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
