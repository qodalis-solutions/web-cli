import { CliRegexCommandProcessor } from '../lib';
import {
    createRegex,
    formatMatchResult,
    parseFlags,
    VALID_FLAGS,
} from '../lib/utilities';

describe('Regex Utilities', () => {
    describe('parseFlags', () => {
        it('should return empty string when no flags specified', () => {
            expect(parseFlags({})).toBe('');
        });

        it('should return flags from --flags arg', () => {
            expect(parseFlags({ flags: 'gi' })).toBe('gi');
        });

        it('should return flags from -f alias', () => {
            expect(parseFlags({ f: 'gm' })).toBe('gm');
        });

        it('should add i flag when --case-insensitive is set', () => {
            const result = parseFlags({ 'case-insensitive': true });
            expect(result).toContain('i');
        });

        it('should not duplicate i flag', () => {
            const result = parseFlags({
                flags: 'gi',
                'case-insensitive': true,
            });
            const iCount = result.split('').filter((c: string) => c === 'i').length;
            expect(iCount).toBe(1);
        });

        it('should filter out invalid flags', () => {
            expect(parseFlags({ flags: 'gxiz' })).toBe('gi');
        });

        it('should use default flags when none specified', () => {
            expect(parseFlags({}, 'gm')).toBe('gm');
        });
    });

    describe('createRegex', () => {
        it('should create a valid RegExp', () => {
            const result = createRegex('\\d+', 'g');
            expect(result).toBeInstanceOf(RegExp);
        });

        it('should return error string for invalid pattern', () => {
            const result = createRegex('[invalid', '');
            expect(typeof result).toBe('string');
            expect(result as string).toContain('Invalid regex');
        });
    });

    describe('formatMatchResult', () => {
        it('should format a basic match', () => {
            const regex = /(\d+)/;
            const match = regex.exec('abc123')!;
            const result = formatMatchResult(match);

            expect(result.match).toBe('123');
            expect(result.index).toBe(3);
            expect(result.length).toBe(3);
            expect(result.captureGroups).toEqual(['123']);
        });

        it('should handle named groups', () => {
            const regex = /(?<year>\d{4})-(?<month>\d{2})/;
            const match = regex.exec('2024-01')!;
            const result = formatMatchResult(match);

            expect(result.groups).toBeDefined();
            expect(result.groups!['year']).toBe('2024');
            expect(result.groups!['month']).toBe('01');
        });

        it('should handle no capture groups', () => {
            const regex = /hello/;
            const match = regex.exec('hello world')!;
            const result = formatMatchResult(match);

            expect(result.captureGroups).toEqual([]);
            expect(result.groups).toBeNull();
        });
    });

    describe('VALID_FLAGS', () => {
        it('should contain g, i, m, s, u', () => {
            expect(VALID_FLAGS).toContain('g');
            expect(VALID_FLAGS).toContain('i');
            expect(VALID_FLAGS).toContain('m');
            expect(VALID_FLAGS).toContain('s');
            expect(VALID_FLAGS).toContain('u');
        });
    });
});

describe('CliRegexCommandProcessor', () => {
    let processor: CliRegexCommandProcessor;

    beforeEach(() => {
        processor = new CliRegexCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "regex"', () => {
            expect(processor.command).toBe('regex');
        });

        it('should have alias "re"', () => {
            expect(processor.aliases).toContain('re');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have metadata with icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBe('🔍');
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });
    });

    describe('sub-processors', () => {
        it('should have 6 sub-processors', () => {
            expect(processor.processors!.length).toBe(6);
        });

        const expectedCommands = [
            {
                command: 'test',
                aliases: ['check', 'is-match'],
            },
            {
                command: 'match',
                aliases: ['find'],
            },
            {
                command: 'match-all',
                aliases: ['matches', 'find-all'],
            },
            {
                command: 'replace',
                aliases: ['sub', 'substitute'],
            },
            {
                command: 'split',
                aliases: undefined,
            },
            {
                command: 'extract',
                aliases: ['groups', 'capture'],
            },
        ];

        for (const expected of expectedCommands) {
            describe(`"${expected.command}" sub-processor`, () => {
                it('should exist', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(sub).toBeDefined();
                });

                it('should have a description', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(sub!.description).toBeDefined();
                    expect(sub!.description!.length).toBeGreaterThan(0);
                });

                it('should have acceptsRawInput = true', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(sub!.acceptsRawInput).toBe(true);
                });

                it('should have valueRequired = true', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(sub!.valueRequired).toBe(true);
                });

                it('should have processCommand as a function', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(typeof sub!.processCommand).toBe('function');
                });

                it('should have writeDescription as a function', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    expect(typeof sub!.writeDescription).toBe('function');
                });

                if (expected.aliases) {
                    it(`should have aliases: ${expected.aliases.join(', ')}`, () => {
                        const sub = processor.processors!.find(
                            (p) => p.command === expected.command,
                        );
                        for (const alias of expected.aliases!) {
                            expect(sub!.aliases).toContain(alias);
                        }
                    });
                }

                it('should have --pattern parameter', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    const patternParam = sub!.parameters?.find(
                        (p: any) => p.name === 'pattern',
                    );
                    expect(patternParam).toBeDefined();
                    expect(patternParam!.required).toBe(true);
                });

                it('should have shared parameters (flags, case-insensitive, copy)', () => {
                    const sub = processor.processors!.find(
                        (p) => p.command === expected.command,
                    );
                    const flagsParam = sub!.parameters?.find(
                        (p: any) => p.name === 'flags',
                    );
                    const ciParam = sub!.parameters?.find(
                        (p: any) => p.name === 'case-insensitive',
                    );
                    const copyParam = sub!.parameters?.find(
                        (p: any) => p.name === 'copy',
                    );
                    expect(flagsParam).toBeDefined();
                    expect(ciParam).toBeDefined();
                    expect(copyParam).toBeDefined();
                });
            });
        }

        describe('"replace" sub-processor extras', () => {
            it('should have --with parameter', () => {
                const sub = processor.processors!.find(
                    (p) => p.command === 'replace',
                );
                const withParam = sub!.parameters?.find(
                    (p: any) => p.name === 'with',
                );
                expect(withParam).toBeDefined();
                expect(withParam!.required).toBe(true);
            });
        });

        describe('"split" sub-processor extras', () => {
            it('should have --limit parameter', () => {
                const sub = processor.processors!.find(
                    (p) => p.command === 'split',
                );
                const limitParam = sub!.parameters?.find(
                    (p: any) => p.name === 'limit',
                );
                expect(limitParam).toBeDefined();
                expect(limitParam!.type).toBe('number');
            });
        });
    });

    describe('processCommand', () => {
        it('should be defined as a function', () => {
            expect(typeof processor.processCommand).toBe('function');
        });
    });

    describe('writeDescription', () => {
        it('should be defined as a function', () => {
            expect(typeof processor.writeDescription).toBe('function');
        });
    });
});
