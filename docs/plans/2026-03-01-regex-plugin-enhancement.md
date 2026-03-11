# Regex Plugin Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring `@qodalis/cli-regex` to full feature parity with guid/string plugins — 6 sub-commands, proper parameters, aliases, structured output, utilities, and comprehensive tests.

**Architecture:** Add a `utilities/index.ts` for regex helpers (safe construction, flag parsing). Rewrite the processor with 6 sub-commands following the guid plugin's pattern: each with aliases, parameter definitions, `context.process.output()` for structured results, and `writeDescription()` for help. All sub-commands use `acceptsRawInput: true` and `valueRequired: true` with named parameters for pattern/text/replacement.

**Tech Stack:** TypeScript, `@qodalis/cli-core` (no external dependencies), native `RegExp` API.

---

### Task 1: Create utilities file

**Files:**
- Create: `packages/plugins/regex/src/lib/utilities/index.ts`

**Step 1: Create the utilities file**

Create `packages/plugins/regex/src/lib/utilities/index.ts`:

```typescript
/**
 * Valid regex flag characters.
 */
export const VALID_FLAGS = ['g', 'i', 'm', 's', 'u'] as const;

export type RegexFlag = (typeof VALID_FLAGS)[number];

/**
 * Merges --flags and --case-insensitive args into a single flags string.
 * Deduplicates and validates flags.
 */
export const parseFlags = (
    args: Record<string, any>,
    defaultFlags: string = '',
): string => {
    let flags = (args['flags'] || args['f'] || defaultFlags) as string;
    const caseInsensitive = args['case-insensitive'] || args['i'];

    if (caseInsensitive && !flags.includes('i')) {
        flags += 'i';
    }

    // Deduplicate
    const unique = [...new Set(flags.split(''))];
    return unique.filter((f) => VALID_FLAGS.includes(f as RegexFlag)).join('');
};

/**
 * Result of a regex match operation.
 */
export interface RegexMatchResult {
    match: string;
    index: number;
    length: number;
    groups: Record<string, string> | null;
    captureGroups: string[];
}

/**
 * Safely creates a RegExp from a pattern string and flags.
 * Returns the RegExp or an error message string.
 */
export const createRegex = (
    pattern: string,
    flags: string,
): RegExp | string => {
    try {
        return new RegExp(pattern, flags);
    } catch (e: any) {
        return `Invalid regex pattern: ${e.message || e}`;
    }
};

/**
 * Formats a RegExpExecArray into a structured match result.
 */
export const formatMatchResult = (
    match: RegExpExecArray,
): RegexMatchResult => {
    return {
        match: match[0],
        index: match.index,
        length: match[0].length,
        groups: match.groups ? { ...match.groups } : null,
        captureGroups: match.slice(1),
    };
};
```

**Step 2: Update lib index to export utilities**

Modify `packages/plugins/regex/src/lib/index.ts` to:

```typescript
export * from './processors/cli-regex-command-processor';
export * from './utilities';
```

**Step 3: Update public-api to export utilities**

In `packages/plugins/regex/src/public-api.ts`, add after line 5:

```typescript
export * from './lib/utilities';
```

**Step 4: Commit**

```bash
git add packages/plugins/regex/src/lib/utilities/index.ts
git add packages/plugins/regex/src/lib/index.ts
git add packages/plugins/regex/src/public-api.ts
git commit -m "feat(regex): add utilities for safe regex creation and flag parsing"
```

---

### Task 2: Rewrite the processor with all 6 sub-commands

**Files:**
- Modify: `packages/plugins/regex/src/lib/processors/cli-regex-command-processor.ts`

**Step 1: Rewrite the processor**

Replace the entire contents of `packages/plugins/regex/src/lib/processors/cli-regex-command-processor.ts` with:

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    highlightTextWithBg,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    createRegex,
    formatMatchResult,
    parseFlags,
    VALID_FLAGS,
    RegexMatchResult,
} from '../utilities';

const SHARED_PARAMETERS = [
    {
        name: 'flags',
        aliases: ['f'],
        description: `Regex flags: ${VALID_FLAGS.join(', ')}`,
        defaultValue: '',
        required: false,
        type: 'string' as const,
    },
    {
        name: 'case-insensitive',
        aliases: ['i'],
        description: 'Enable case-insensitive matching',
        required: false,
        type: 'boolean' as const,
    },
    {
        name: 'copy',
        aliases: ['c'],
        description: 'Copy result to clipboard',
        required: false,
        type: 'boolean' as const,
    },
];

export class CliRegexCommandProcessor implements ICliCommandProcessor {
    command = 'regex';

    aliases = ['re'];

    description = 'Utilities for working with regular expressions';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    version = LIBRARY_VERSION;

    metadata?: CliProcessorMetadata = {
        icon: '🔍',
        module: 'regex',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    constructor() {
        this.processors = [
            // --- test ---
            {
                command: 'test',
                aliases: ['check', 'is-match'],
                description: 'Test if a pattern matches text',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern',
                        type: 'string' as const,
                        required: true,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    const flags = parseFlags(command.args);
                    const regex = createRegex(pattern, flags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const matches = regex.test(text);

                    if (matches) {
                        context.writer.writeSuccess(`Pattern matches`);
                    } else {
                        context.writer.writeInfo('No match');
                    }

                    context.process.output({ matches, pattern, flags });
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Test whether a regular expression matches the given text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex test <text> --pattern=<regex>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex test "abc123" --pattern="\\d+"              ${writer.wrapInColor('# → Pattern matches', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  regex test "hello" --pattern="^\\d+$"            ${writer.wrapInColor('# → No match', CliForegroundColor.Green)}`,
                    );
                },
            },

            // --- match ---
            {
                command: 'match',
                aliases: ['find'],
                description: 'Find the first match in text',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern',
                        type: 'string' as const,
                        required: true,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    const flags = parseFlags(command.args);
                    // Remove 'g' flag for first-match-only behavior
                    const singleFlags = flags.replace('g', '');
                    const regex = createRegex(pattern, singleFlags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const match = regex.exec(text);

                    if (match) {
                        const result = formatMatchResult(match);
                        const displayRegex = createRegex(pattern, flags.includes('g') ? flags : flags + 'g');
                        const highlighted = typeof displayRegex !== 'string'
                            ? highlightTextWithBg(text, displayRegex)
                            : text;

                        context.writer.writeln(
                            `${context.writer.wrapInColor('Match:', CliForegroundColor.Yellow)} ${result.match}`,
                        );
                        context.writer.writeln(
                            `${context.writer.wrapInColor('Index:', CliForegroundColor.Yellow)} ${result.index}`,
                        );
                        context.writer.writeln(
                            `${context.writer.wrapInColor('Text:', CliForegroundColor.Yellow)}  ${highlighted}`,
                        );

                        if (result.captureGroups.length > 0) {
                            context.writer.writeln(
                                `${context.writer.wrapInColor('Groups:', CliForegroundColor.Yellow)} ${result.captureGroups.join(', ')}`,
                            );
                        }

                        if (result.groups) {
                            const entries = Object.entries(result.groups);
                            for (const [name, value] of entries) {
                                context.writer.writeln(
                                    `  ${context.writer.wrapInColor(name + ':', CliForegroundColor.Cyan)} ${value}`,
                                );
                            }
                        }

                        if (command.args['copy'] || command.args['c']) {
                            await context.clipboard.write(result.match);
                            context.writer.writeInfo('Copied to clipboard');
                        }

                        context.process.output(result);
                    } else {
                        context.writer.writeInfo('No match');
                        context.process.output(null);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Find the first regex match in text, with position and groups');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex match <text> --pattern=<regex>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex match "abc123def" --pattern="\\d+"`,
                    );
                    writer.writeln(
                        `  regex match "2024-01-15" --pattern="(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})"`,
                    );
                },
            },

            // --- match-all ---
            {
                command: 'match-all',
                aliases: ['matches', 'find-all'],
                description: 'Find all matches in text',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern',
                        type: 'string' as const,
                        required: true,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    let flags = parseFlags(command.args, 'g');
                    if (!flags.includes('g')) {
                        flags += 'g';
                    }

                    const regex = createRegex(pattern, flags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const results: RegexMatchResult[] = [];
                    let m: RegExpExecArray | null;

                    while ((m = regex.exec(text)) !== null) {
                        results.push(formatMatchResult(m));
                    }

                    if (results.length === 0) {
                        context.writer.writeInfo('No matches');
                        context.process.output([]);
                        return;
                    }

                    const displayRegex = createRegex(pattern, flags);
                    const highlighted = typeof displayRegex !== 'string'
                        ? highlightTextWithBg(text, displayRegex)
                        : text;

                    context.writer.writeln(
                        `${context.writer.wrapInColor(`${results.length} match${results.length > 1 ? 'es' : ''}:`, CliForegroundColor.Yellow)}`,
                    );
                    context.writer.writeln(`  ${highlighted}`);
                    context.writer.writeln();

                    for (let i = 0; i < results.length; i++) {
                        const r = results[i];
                        context.writer.writeln(
                            `  ${context.writer.wrapInColor(`[${i}]`, CliForegroundColor.Cyan)} "${r.match}" at index ${r.index}`,
                        );
                    }

                    if (command.args['copy'] || command.args['c']) {
                        await context.clipboard.write(
                            results.map((r) => r.match).join('\n'),
                        );
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(results);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Find all regex matches in text with positions');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex match-all <text> --pattern=<regex>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex match-all "abc 123 def 456" --pattern="\\d+"`,
                    );
                    writer.writeln(
                        `  regex match-all "foo@bar.com baz@qux.org" --pattern="\\w+@\\w+\\.\\w+"`,
                    );
                },
            },

            // --- replace ---
            {
                command: 'replace',
                aliases: ['sub', 'substitute'],
                description: 'Replace regex matches in text',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern',
                        type: 'string' as const,
                        required: true,
                    },
                    {
                        name: 'with',
                        aliases: ['w'],
                        description: 'Replacement string (supports $1, $2, $<name>)',
                        type: 'string' as const,
                        required: true,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';
                    const replacement = command.args['with'] ?? command.args['w'] ?? '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    if (replacement === undefined || replacement === null) {
                        context.writer.writeError('--with is required');
                        context.process.exit(-1);
                        return;
                    }

                    const flags = parseFlags(command.args, 'g');
                    const regex = createRegex(pattern, flags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const result = text.replace(regex, replacement);

                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result:', CliForegroundColor.Yellow)} ${result}`,
                    );

                    if (command.args['copy'] || command.args['c']) {
                        await context.clipboard.write(result);
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Replace regex matches in text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex replace <text> --pattern=<regex> --with=<replacement>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex replace "hello world" --pattern="world" --with="there"`,
                    );
                    writer.writeln(
                        `  regex replace "2024-01-15" --pattern="(\\d{4})-(\\d{2})-(\\d{2})" --with="$2/$3/$1"`,
                    );
                },
            },

            // --- split ---
            {
                command: 'split',
                description: 'Split text by a regex pattern',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern to split on',
                        type: 'string' as const,
                        required: true,
                    },
                    {
                        name: 'limit',
                        aliases: ['n'],
                        description: 'Maximum number of splits',
                        type: 'number' as const,
                        required: false,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    const flags = parseFlags(command.args);
                    const regex = createRegex(pattern, flags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const limitStr = command.args['limit'] || command.args['n'];
                    const limit = limitStr ? parseInt(limitStr) : undefined;
                    const parts = text.split(regex, limit);

                    context.writer.writeln(
                        `${context.writer.wrapInColor(`${parts.length} part${parts.length !== 1 ? 's' : ''}:`, CliForegroundColor.Yellow)}`,
                    );

                    for (let i = 0; i < parts.length; i++) {
                        context.writer.writeln(
                            `  ${context.writer.wrapInColor(`[${i}]`, CliForegroundColor.Cyan)} "${parts[i]}"`,
                        );
                    }

                    if (command.args['copy'] || command.args['c']) {
                        await context.clipboard.write(parts.join('\n'));
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(parts);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Split text by a regex pattern into parts');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex split <text> --pattern=<regex>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex split "one,two,,three" --pattern=","`,
                    );
                    writer.writeln(
                        `  regex split "a1b2c3" --pattern="\\d" --limit=2`,
                    );
                },
            },

            // --- extract ---
            {
                command: 'extract',
                aliases: ['groups', 'capture'],
                description: 'Extract capture groups from text',
                acceptsRawInput: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'pattern',
                        aliases: ['p'],
                        description: 'Regular expression pattern with capture groups',
                        type: 'string' as const,
                        required: true,
                    },
                    ...SHARED_PARAMETERS,
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || '') as string;
                    const pattern = command.args['pattern'] || command.args['p'] || '';

                    if (!pattern) {
                        context.writer.writeError('--pattern is required');
                        context.process.exit(-1);
                        return;
                    }

                    let flags = parseFlags(command.args, 'g');
                    if (!flags.includes('g')) {
                        flags += 'g';
                    }

                    const regex = createRegex(pattern, flags);

                    if (typeof regex === 'string') {
                        context.writer.writeError(regex);
                        context.process.exit(-1);
                        return;
                    }

                    const allResults: RegexMatchResult[] = [];
                    let m: RegExpExecArray | null;

                    while ((m = regex.exec(text)) !== null) {
                        allResults.push(formatMatchResult(m));
                    }

                    if (allResults.length === 0) {
                        context.writer.writeInfo('No matches');
                        context.process.output([]);
                        return;
                    }

                    for (let i = 0; i < allResults.length; i++) {
                        const r = allResults[i];
                        context.writer.writeln(
                            `${context.writer.wrapInColor(`Match ${i + 1}:`, CliForegroundColor.Yellow)} "${r.match}"`,
                        );

                        if (r.captureGroups.length > 0) {
                            for (let g = 0; g < r.captureGroups.length; g++) {
                                context.writer.writeln(
                                    `  ${context.writer.wrapInColor(`$${g + 1}:`, CliForegroundColor.Cyan)} ${r.captureGroups[g]}`,
                                );
                            }
                        }

                        if (r.groups) {
                            for (const [name, value] of Object.entries(r.groups)) {
                                context.writer.writeln(
                                    `  ${context.writer.wrapInColor(name + ':', CliForegroundColor.Cyan)} ${value}`,
                                );
                            }
                        }
                    }

                    if (command.args['copy'] || command.args['c']) {
                        const copyText = allResults
                            .map((r) => r.captureGroups.join(', '))
                            .join('\n');
                        await context.clipboard.write(copyText);
                        context.writer.writeInfo('Copied to clipboard');
                    }

                    context.process.output(allResults);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Extract capture groups (numbered and named) from text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('regex extract <text> --pattern=<regex-with-groups>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  regex extract "2024-01-15" --pattern="(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})"`,
                    );
                    writer.writeln(
                        `  regex extract "john@example.com" --pattern="(\\w+)@(\\w+\\.\\w+)"`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('📋 Commands:');
        writer.writeln(
            `  ${writer.wrapInColor('regex test <text> --pattern=<regex>', CliForegroundColor.Cyan)}              Test if pattern matches`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('regex match <text> --pattern=<regex>', CliForegroundColor.Cyan)}             First match with details`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('regex match-all <text> --pattern=<regex>', CliForegroundColor.Cyan)}         All matches`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('regex replace <text> --pattern=<regex> --with=<str>', CliForegroundColor.Cyan)}  Replace matches`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('regex split <text> --pattern=<regex>', CliForegroundColor.Cyan)}             Split text`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('regex extract <text> --pattern=<regex>', CliForegroundColor.Cyan)}           Extract groups`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  regex test "abc123" --pattern="\\d+"`,
        );
        writer.writeln(
            `  regex match "hello world" --pattern="(\\w+)\\s(\\w+)"`,
        );
        writer.writeln(
            `  regex replace "2024-01-15" --pattern="(\\d{4})-(\\d{2})-(\\d{2})" --with="$2/$3/$1"`,
        );
        writer.writeln();
        writer.writeln(
            `💡 Use ${writer.wrapInColor('--flags', CliForegroundColor.Yellow)} or ${writer.wrapInColor('-i', CliForegroundColor.Yellow)} for case-insensitive, ${writer.wrapInColor('--copy', CliForegroundColor.Yellow)} to copy results`,
        );
    }
}
```

**Step 2: Commit**

```bash
git add packages/plugins/regex/src/lib/processors/cli-regex-command-processor.ts
git commit -m "feat(regex): rewrite processor with 6 sub-commands (test, match, match-all, replace, split, extract)"
```

---

### Task 3: Write comprehensive tests

**Files:**
- Modify: `packages/plugins/regex/src/tests/index.spec.ts`

**Step 1: Rewrite the test file**

Replace the entire contents of `packages/plugins/regex/src/tests/index.spec.ts` with:

```typescript
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
```

**Step 2: Run tests**

```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test regex
```

Expected: All tests pass. Kill any lingering Chrome/Karma processes afterward.

**Step 3: Commit**

```bash
git add packages/plugins/regex/src/tests/index.spec.ts
git commit -m "test(regex): add comprehensive tests for utilities and all 6 sub-commands"
```

---

### Task 4: Build and verify

**Step 1: Build the regex plugin**

```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx build regex
```

Expected: Clean build with no errors.

**Step 2: Check output artifacts exist**

```bash
ls dist/regex/public-api.js dist/regex/public-api.mjs dist/regex/public-api.d.ts dist/regex/umd/index.js
```

Expected: All 4 files present.

**Step 3: Run full build to verify no downstream breakage**

```bash
cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build
```

Expected: All 23 projects build successfully.

**Step 4: Final process cleanup**

```bash
ps aux | grep "nx.js\|karma\|ChromeHeadless" | grep -v grep
```

Kill anything leftover.
