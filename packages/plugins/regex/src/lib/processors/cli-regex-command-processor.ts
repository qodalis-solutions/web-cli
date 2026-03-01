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
                        context.writer.writeSuccess('Pattern matches');
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
                        if (m[0].length === 0) {
                            regex.lastIndex++;
                        }
                    }

                    if (results.length === 0) {
                        context.writer.writeInfo('No matches');
                        context.process.output([]);
                        return;
                    }

                    regex.lastIndex = 0;
                    const highlighted = highlightTextWithBg(text, regex);

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
                    const replacement = command.args['with'] ?? command.args['w'];

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
                    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
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
                        if (m[0].length === 0) {
                            regex.lastIndex++;
                        }
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
