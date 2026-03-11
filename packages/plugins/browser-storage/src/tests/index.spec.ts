import {
    CliCookiesCommandProcessor,
    CliLocalStorageCommandProcessor,
} from '../lib';

describe('CliCookiesCommandProcessor', () => {
    let processor: CliCookiesCommandProcessor;

    beforeEach(() => {
        processor = new CliCookiesCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "cookies"', () => {
            expect(processor.command).toBe('cookies');
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

    describe('sub-processors', () => {
        it('should have processors array defined', () => {
            expect(processor.processors).toBeDefined();
            expect(Array.isArray(processor.processors)).toBe(true);
        });

        it('should have 4 sub-processors', () => {
            expect(processor.processors!.length).toBe(4);
        });

        it('should contain all expected sub-processor names', () => {
            const names = processor.processors!.map((p) => p.command);
            expect(names).toContain('list');
            expect(names).toContain('get');
            expect(names).toContain('set');
            expect(names).toContain('remove');
        });

        it('"list" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'list');
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"get" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'get');
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"set" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'set');
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"remove" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'remove',
            );
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('all sub-processors should have descriptions', () => {
            for (const sub of processor.processors!) {
                expect(sub.description).toBeDefined();
                expect(sub.description!.length).toBeGreaterThan(0);
            }
        });
    });

    describe('processCommand', () => {
        it('should have processCommand defined as a function', () => {
            expect(typeof processor.processCommand).toBe('function');
        });
    });
});

describe('CliLocalStorageCommandProcessor', () => {
    let processor: CliLocalStorageCommandProcessor;

    beforeEach(() => {
        processor = new CliLocalStorageCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "local-storage"', () => {
            expect(processor.command).toBe('local-storage');
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

    describe('sub-processors', () => {
        it('should have processors array defined', () => {
            expect(processor.processors).toBeDefined();
            expect(Array.isArray(processor.processors)).toBe(true);
        });

        it('should have 3 sub-processors', () => {
            expect(processor.processors!.length).toBe(3);
        });

        it('should contain all expected sub-processor names', () => {
            const names = processor.processors!.map((p) => p.command);
            expect(names).toContain('get');
            expect(names).toContain('set');
            expect(names).toContain('remove');
        });

        it('"get" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'get');
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"set" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find((p) => p.command === 'set');
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('"remove" sub-processor should have processCommand as a function', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'remove',
            );
            expect(sub).toBeDefined();
            expect(typeof sub!.processCommand).toBe('function');
        });

        it('all sub-processors should have descriptions', () => {
            for (const sub of processor.processors!) {
                expect(sub.description).toBeDefined();
                expect(sub.description!.length).toBeGreaterThan(0);
            }
        });
    });

    describe('processCommand', () => {
        it('should have processCommand defined as a function', () => {
            expect(typeof processor.processCommand).toBe('function');
        });
    });
});
