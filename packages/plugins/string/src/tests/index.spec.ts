import { CliStringCommandProcessor } from '../lib/processors/cli-string-command-processor';

describe('CliStringCommandProcessor', () => {
    let processor: CliStringCommandProcessor;

    beforeEach(() => {
        processor = new CliStringCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "string"', () => {
            expect(processor.command).toBe('string');
        });

        it('should have "str" as an alias', () => {
            expect(processor.aliases).toBeDefined();
            expect(processor.aliases).toContain('str');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have metadata with an icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBeDefined();
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

        it('should have more than 15 sub-processors', () => {
            expect(processor.processors!.length).toBeGreaterThan(15);
        });

        it('should include "upper" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'upper',
            );
            expect(sub).toBeDefined();
        });

        it('should include "lower" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'lower',
            );
            expect(sub).toBeDefined();
        });

        it('should include "reverse" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'reverse',
            );
            expect(sub).toBeDefined();
        });

        it('should include "length" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'length',
            );
            expect(sub).toBeDefined();
        });

        it('should include "trim" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'trim');
            expect(sub).toBeDefined();
        });

        it('should include "slug" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'slug');
            expect(sub).toBeDefined();
        });

        it('should include "capitalize" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'capitalize',
            );
            expect(sub).toBeDefined();
        });

        it('should include "camelCase" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'camelCase',
            );
            expect(sub).toBeDefined();
        });

        it('should include "kebabCase" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'kebabCase',
            );
            expect(sub).toBeDefined();
        });

        it('should include "snakeCase" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'snakeCase',
            );
            expect(sub).toBeDefined();
        });

        it('should include "wc" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'wc');
            expect(sub).toBeDefined();
        });

        it('should include "includes" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'includes',
            );
            expect(sub).toBeDefined();
        });

        it('should include "startsWith" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'startsWith',
            );
            expect(sub).toBeDefined();
        });

        it('should include "endsWith" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'endsWith',
            );
            expect(sub).toBeDefined();
        });

        it('should include "repeat" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'repeat',
            );
            expect(sub).toBeDefined();
        });

        it('should include "replace" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'replace',
            );
            expect(sub).toBeDefined();
        });

        it('should include "split" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'split',
            );
            expect(sub).toBeDefined();
        });

        it('should include "words" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'words',
            );
            expect(sub).toBeDefined();
        });

        it('should include "pad" sub-processor', () => {
            const sub = processor.processors!.find((p) => p.command === 'pad');
            expect(sub).toBeDefined();
        });

        it('should include "truncate" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'truncate',
            );
            expect(sub).toBeDefined();
        });

        it('should include "escape" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'escape',
            );
            expect(sub).toBeDefined();
        });

        it('should include "unescape" sub-processor', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'unescape',
            );
            expect(sub).toBeDefined();
        });

        it('should have all sub-processors with acceptsRawInput = true', () => {
            for (const sub of processor.processors!) {
                expect(sub.acceptsRawInput)
                    .withContext(
                        `Sub-processor "${sub.command}" should have acceptsRawInput = true`,
                    )
                    .toBe(true);
            }
        });

        it('should have all sub-processors with valueRequired = true', () => {
            for (const sub of processor.processors!) {
                expect(sub.valueRequired)
                    .withContext(
                        `Sub-processor "${sub.command}" should have valueRequired = true`,
                    )
                    .toBe(true);
            }
        });

        it('should have all sub-processors with processCommand as a function', () => {
            for (const sub of processor.processors!) {
                expect(typeof sub.processCommand)
                    .withContext(
                        `Sub-processor "${sub.command}" should have processCommand as a function`,
                    )
                    .toBe('function');
            }
        });

        it('should have unique command names across all sub-processors', () => {
            const names = processor.processors!.map((p) => p.command);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });
    });

    describe('sub-processor aliases', () => {
        it('"upper" should have aliases including "uppercase" and "toUpper"', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'upper',
            );
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('uppercase');
            expect(sub!.aliases).toContain('toUpper');
        });

        it('"lower" should have aliases including "lowercase" and "toLower"', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'lower',
            );
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('lowercase');
            expect(sub!.aliases).toContain('toLower');
        });

        it('"length" should have alias "len"', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'length',
            );
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('len');
        });

        it('"reverse" should have alias "rev"', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'reverse',
            );
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('rev');
        });

        it('"slug" should have alias "slugify"', () => {
            const sub = processor.processors!.find((p) => p.command === 'slug');
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('slugify');
        });

        it('"truncate" should have alias "trunc"', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'truncate',
            );
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('trunc');
        });

        it('"wc" should have aliases including "wordcount" and "count"', () => {
            const sub = processor.processors!.find((p) => p.command === 'wc');
            expect(sub!.aliases).toBeDefined();
            expect(sub!.aliases).toContain('wordcount');
            expect(sub!.aliases).toContain('count');
        });
    });

    describe('sub-processor parameters', () => {
        it('"repeat" should have "count" and "separator" parameters', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'repeat',
            );
            expect(sub!.parameters).toBeDefined();
            const paramNames = sub!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('count');
            expect(paramNames).toContain('separator');
        });

        it('"replace" should have "find" and "with" parameters', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'replace',
            );
            expect(sub!.parameters).toBeDefined();
            const paramNames = sub!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('find');
            expect(paramNames).toContain('with');
        });

        it('"pad" should have "length", "char", and "side" parameters', () => {
            const sub = processor.processors!.find((p) => p.command === 'pad');
            expect(sub!.parameters).toBeDefined();
            const paramNames = sub!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('length');
            expect(paramNames).toContain('char');
            expect(paramNames).toContain('side');
        });

        it('"split" should have a "by" parameter', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'split',
            );
            expect(sub!.parameters).toBeDefined();
            const paramNames = sub!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('by');
        });

        it('"includes" should have a "find" parameter', () => {
            const sub = processor.processors!.find(
                (p) => p.command === 'includes',
            );
            expect(sub!.parameters).toBeDefined();
            const paramNames = sub!.parameters!.map((p) => p.name);
            expect(paramNames).toContain('find');
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
