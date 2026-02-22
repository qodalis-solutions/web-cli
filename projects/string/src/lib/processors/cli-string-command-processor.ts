import { Injectable } from '@angular/core';
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import * as _ from 'lodash';
import { LIBRARY_VERSION } from '../version';

const lodash = (_ as any).default || _;

/**
 * Helper to create a simple string transform subcommand
 */
function stringTransform(
    command: string,
    description: string,
    transform: (text: string) => string,
    options?: {
        aliases?: string[];
        example?: { input: string; output: string };
    },
): ICliCommandProcessor {
    return {
        command,
        aliases: options?.aliases,
        description,
        allowUnlistedCommands: true,
        valueRequired: true,
        processCommand: async (
            cmd: CliProcessCommand,
            context: ICliExecutionContext,
        ) => {
            const text = (cmd.value || cmd.data || '') as string;
            const result = transform(text);
            context.writer.writeln(
                `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
            );
            context.process.output(result);
        },
        writeDescription: (context: ICliExecutionContext) => {
            const { writer } = context;
            writer.writeln(description);
            writer.writeln();
            writer.writeln('📋 Usage:');
            writer.writeln(
                `  ${writer.wrapInColor(`string ${command} <text>`, CliForegroundColor.Cyan)}`,
            );
            if (options?.example) {
                writer.writeln();
                writer.writeln('📝 Examples:');
                writer.writeln(
                    `  string ${command} ${options.example.input.padEnd(20)} ${writer.wrapInColor(`# → ${options.example.output}`, CliForegroundColor.Green)}`,
                );
            }
        },
    };
}

@Injectable()
export class CliStringCommandProcessor implements ICliCommandProcessor {
    command = 'string';

    aliases = ['str'];

    description = 'String manipulation commands';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🔤',
    };

    constructor() {
        this.processors = [
            // -- Case conversions --
            stringTransform('upper', 'Convert to UPPERCASE', (t) => t.toUpperCase(), {
                aliases: ['uppercase', 'toUpper'],
                example: { input: 'hello world', output: 'HELLO WORLD' },
            }),
            stringTransform('lower', 'Convert to lowercase', (t) => t.toLowerCase(), {
                aliases: ['lowercase', 'toLower'],
                example: { input: 'HELLO WORLD', output: 'hello world' },
            }),
            stringTransform('capitalize', 'Capitalize the first letter', (t) => lodash.capitalize(t), {
                aliases: ['cap'],
                example: { input: 'hello world', output: 'Hello world' },
            }),
            stringTransform('camelCase', 'Convert to camelCase', (t) => lodash.camelCase(t), {
                aliases: ['camel'],
                example: { input: 'hello world', output: 'helloWorld' },
            }),
            stringTransform('kebabCase', 'Convert to kebab-case', (t) => lodash.kebabCase(t), {
                aliases: ['kebab'],
                example: { input: 'Hello World', output: 'hello-world' },
            }),
            stringTransform('snakeCase', 'Convert to snake_case', (t) => lodash.snakeCase(t), {
                aliases: ['snake'],
                example: { input: 'Hello World', output: 'hello_world' },
            }),
            stringTransform('startCase', 'Convert to Start Case', (t) => lodash.startCase(t), {
                aliases: ['title', 'titleCase'],
                example: { input: 'hello-world', output: 'Hello World' },
            }),

            // -- Trimming --
            stringTransform('trim', 'Remove whitespace from both ends', (t) => t.trim(), {
                example: { input: '"  hello  "', output: 'hello' },
            }),
            stringTransform('trimStart', 'Remove whitespace from the start', (t) => t.trimStart(), {
                aliases: ['ltrim'],
                example: { input: '"  hello"', output: 'hello' },
            }),
            stringTransform('trimEnd', 'Remove whitespace from the end', (t) => t.trimEnd(), {
                aliases: ['rtrim'],
                example: { input: '"hello  "', output: 'hello' },
            }),

            // -- Transform --
            stringTransform('reverse', 'Reverse a string', (t) => [...t].reverse().join(''), {
                aliases: ['rev'],
                example: { input: 'Hello', output: 'olleH' },
            }),
            stringTransform('slug', 'Convert to URL-friendly slug', (t) =>
                t.toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, ''),
                {
                    aliases: ['slugify'],
                    example: { input: '"Hello World!"', output: 'hello-world' },
                },
            ),
            stringTransform('escape', 'Escape HTML entities', (t) => lodash.escape(t), {
                aliases: ['escapeHtml'],
                example: { input: '"<b>hi</b>"', output: '&lt;b&gt;hi&lt;/b&gt;' },
            }),
            stringTransform('unescape', 'Unescape HTML entities', (t) => lodash.unescape(t), {
                aliases: ['unescapeHtml'],
                example: { input: '"&lt;b&gt;"', output: '<b>' },
            }),

            // -- Repeat --
            {
                command: 'repeat',
                description: 'Repeat a string N times',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'Number of repetitions (default: 2)',
                        type: 'number',
                        required: false,
                    },
                    {
                        name: 'separator',
                        aliases: ['sep'],
                        description: 'Separator between repetitions (default: none)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const count = Math.min(parseInt(command.args['count'] || command.args['n']) || 2, 1000);
                    const sep = command.args['separator'] || command.args['sep'] || '';
                    const result = Array(count).fill(text).join(sep);
                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Repeat a string multiple times');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string repeat <text> [--count=N] [--sep=S]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  string repeat ha --count=3        ${writer.wrapInColor('# → hahaha', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  string repeat ab --n=3 --sep=-    ${writer.wrapInColor('# → ab-ab-ab', CliForegroundColor.Green)}`,
                    );
                },
            },

            // -- Replace --
            {
                command: 'replace',
                description: 'Replace occurrences in a string',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'find',
                        aliases: ['f'],
                        description: 'Text to find',
                        type: 'string',
                        required: true,
                    },
                    {
                        name: 'with',
                        aliases: ['w'],
                        description: 'Replacement text',
                        type: 'string',
                        required: true,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const find = command.args['find'] || command.args['f'] || '';
                    const replacement = command.args['with'] || command.args['w'] || '';

                    if (!find) {
                        context.writer.writeError('--find is required');
                        context.process.exit(-1);
                        return;
                    }

                    const result = text.split(find).join(replacement);
                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Replace all occurrences of a substring');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string replace <text> --find=<search> --with=<replacement>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  string replace "hello world" --find=world --with=there`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('# → hello there', CliForegroundColor.Green)}`,
                    );
                },
            },

            // -- Truncate --
            {
                command: 'truncate',
                aliases: ['trunc'],
                description: 'Truncate a string to a max length',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'length',
                        aliases: ['l'],
                        description: 'Maximum length (default: 30)',
                        type: 'number',
                        required: false,
                    },
                    {
                        name: 'suffix',
                        description: 'Omission suffix (default: ...)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const length = parseInt(command.args['length'] || command.args['l']) || 30;
                    const suffix = command.args['suffix'] ?? '...';
                    const result = text.length > length
                        ? text.substring(0, length - suffix.length) + suffix
                        : text;
                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Truncate a string to a maximum length with an ellipsis');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string truncate <text> [--length=N] [--suffix=S]', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // -- Pad --
            {
                command: 'pad',
                description: 'Pad a string to a target length',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'length',
                        aliases: ['l'],
                        description: 'Target length',
                        type: 'number',
                        required: true,
                    },
                    {
                        name: 'char',
                        aliases: ['c'],
                        description: 'Padding character (default: space)',
                        type: 'string',
                        required: false,
                    },
                    {
                        name: 'side',
                        description: 'Pad side: left, right, both (default: both)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const length = parseInt(command.args['length'] || command.args['l']);
                    const char = command.args['char'] || command.args['c'] || ' ';
                    const side = command.args['side'] || 'both';

                    if (isNaN(length)) {
                        context.writer.writeError('--length is required');
                        context.process.exit(-1);
                        return;
                    }

                    let result: string;
                    switch (side) {
                        case 'left':
                        case 'start':
                            result = text.padStart(length, char);
                            break;
                        case 'right':
                        case 'end':
                            result = text.padEnd(length, char);
                            break;
                        default:
                            result = lodash.pad(text, length, char);
                            break;
                    }

                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}"${result}"`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Pad a string to a target length');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string pad <text> --length=N [--char=C] [--side=left|right|both]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  string pad hello --length=10 --char=. --side=right`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('# → "hello....."', CliForegroundColor.Green)}`,
                    );
                },
            },

            // -- Split --
            {
                command: 'split',
                description: 'Split a string by a delimiter',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'by',
                        aliases: ['d', 'delimiter'],
                        description: 'Delimiter to split by (default: space)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const delimiter = command.args['by'] || command.args['d'] || command.args['delimiter'] || ' ';
                    const parts = text.split(delimiter);
                    const { writer } = context;

                    parts.forEach((part, i) => {
                        writer.writeln(
                            `  ${writer.wrapInColor(String(i).padStart(3), CliForegroundColor.Yellow)}  ${part}`,
                        );
                    });
                    context.process.output(parts);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Split a string into parts by a delimiter');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string split <text> [--by=<delimiter>]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  string split "a,b,c" --by=,      ${writer.wrapInColor('# → a  b  c', CliForegroundColor.Green)}`,
                    );
                },
            },

            // -- Words --
            {
                command: 'words',
                description: 'Split a string into words',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const words: string[] = lodash.words(text);
                    const { writer } = context;

                    writer.writeln(
                        `${writer.wrapInColor(`${words.length} words:`, CliForegroundColor.Yellow)} ${words.join(', ')}`,
                    );
                    context.process.output(words);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Split a string into its component words');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string words <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  string words "helloWorld"         ${writer.wrapInColor('# → hello, World', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  string words "foo-bar_baz"        ${writer.wrapInColor('# → foo, bar, baz', CliForegroundColor.Green)}`,
                    );
                },
            },

            // -- Analysis --
            {
                command: 'length',
                aliases: ['len'],
                description: 'Get the length of a string',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    context.writer.writeln(
                        `${context.writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${text.length}`,
                    );
                    context.process.output(text.length);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Get the character count of a string');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string length <text>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'wc',
                aliases: ['wordcount', 'count'],
                description: 'Count lines, words, characters, and bytes',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const { writer } = context;

                    const lines = text.split(/\r?\n/).length;
                    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
                    const chars = text.length;
                    const bytes = new TextEncoder().encode(text).length;

                    writer.writeln(
                        `  ${writer.wrapInColor('Lines:', CliForegroundColor.Cyan)}       ${lines}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Words:', CliForegroundColor.Cyan)}       ${wordCount}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Characters:', CliForegroundColor.Cyan)}  ${chars}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Bytes:', CliForegroundColor.Cyan)}       ${bytes}`,
                    );

                    context.process.output({ lines, words: wordCount, chars, bytes });
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Count lines, words, characters, and bytes in text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string wc <text>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'includes',
                aliases: ['contains', 'has'],
                description: 'Check if a string contains a substring',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'find',
                        aliases: ['f'],
                        description: 'Substring to search for',
                        type: 'string',
                        required: true,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const find = command.args['find'] || command.args['f'] || '';
                    const result = text.includes(find);
                    const { writer } = context;

                    if (result) {
                        writer.writeSuccess(`"${find}" found in string`);
                    } else {
                        writer.writeError(`"${find}" not found in string`);
                    }
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Check if a string contains a given substring');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string includes <text> --find=<substring>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'startsWith',
                description: 'Check if a string starts with a prefix',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'find',
                        aliases: ['f'],
                        description: 'Prefix to check',
                        type: 'string',
                        required: true,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const find = command.args['find'] || command.args['f'] || '';
                    const result = text.startsWith(find);
                    const { writer } = context;

                    writer.writeln(
                        `${writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Check if a string starts with a given prefix');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string startsWith <text> --find=<prefix>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'endsWith',
                description: 'Check if a string ends with a suffix',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'find',
                        aliases: ['f'],
                        description: 'Suffix to check',
                        type: 'string',
                        required: true,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const find = command.args['find'] || command.args['f'] || '';
                    const result = text.endsWith(find);
                    const { writer } = context;

                    writer.writeln(
                        `${writer.wrapInColor('Result: ', CliForegroundColor.Yellow)}${result}`,
                    );
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Check if a string ends with a given suffix');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('string endsWith <text> --find=<suffix>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('String manipulation and analysis commands');
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('🔠 Case Conversions:', CliForegroundColor.Yellow),
        );
        writer.writeln(`  ${writer.wrapInColor('string upper', CliForegroundColor.Cyan)} / ${writer.wrapInColor('lower', CliForegroundColor.Cyan)} / ${writer.wrapInColor('capitalize', CliForegroundColor.Cyan)}`);
        writer.writeln(`  ${writer.wrapInColor('string camelCase', CliForegroundColor.Cyan)} / ${writer.wrapInColor('kebabCase', CliForegroundColor.Cyan)} / ${writer.wrapInColor('snakeCase', CliForegroundColor.Cyan)} / ${writer.wrapInColor('startCase', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('🔧 Transform:', CliForegroundColor.Yellow),
        );
        writer.writeln(`  ${writer.wrapInColor('string reverse', CliForegroundColor.Cyan)} / ${writer.wrapInColor('trim', CliForegroundColor.Cyan)} / ${writer.wrapInColor('slug', CliForegroundColor.Cyan)} / ${writer.wrapInColor('repeat', CliForegroundColor.Cyan)} / ${writer.wrapInColor('replace', CliForegroundColor.Cyan)} / ${writer.wrapInColor('truncate', CliForegroundColor.Cyan)}`);
        writer.writeln(`  ${writer.wrapInColor('string pad', CliForegroundColor.Cyan)} / ${writer.wrapInColor('escape', CliForegroundColor.Cyan)} / ${writer.wrapInColor('unescape', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('🔍 Analysis:', CliForegroundColor.Yellow),
        );
        writer.writeln(`  ${writer.wrapInColor('string length', CliForegroundColor.Cyan)} / ${writer.wrapInColor('wc', CliForegroundColor.Cyan)} / ${writer.wrapInColor('includes', CliForegroundColor.Cyan)} / ${writer.wrapInColor('startsWith', CliForegroundColor.Cyan)} / ${writer.wrapInColor('endsWith', CliForegroundColor.Cyan)}`);
        writer.writeln(`  ${writer.wrapInColor('string split', CliForegroundColor.Cyan)} / ${writer.wrapInColor('words', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  string camelCase "hello world"       ${writer.wrapInColor('# → helloWorld', CliForegroundColor.Green)}`);
        writer.writeln(`  string reverse Hello                 ${writer.wrapInColor('# → olleH', CliForegroundColor.Green)}`);
        writer.writeln(`  string slug "Hello World!"           ${writer.wrapInColor('# → hello-world', CliForegroundColor.Green)}`);
        writer.writeln(`  string wc "some text here"           ${writer.wrapInColor('# word/char counts', CliForegroundColor.Green)}`);
    }
}
