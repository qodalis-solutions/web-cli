import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliRandomCommandProcessor implements ICliCommandProcessor {
    command = 'random';

    aliases = ['rand'];

    description = 'Generate random values';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🎲',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'number',
                aliases: ['num'],
                description: 'Generate a random number',
                parameters: [
                    {
                        name: 'min',
                        description: 'Minimum value (default: 0)',
                        type: 'number',
                        required: false,
                    },
                    {
                        name: 'max',
                        description: 'Maximum value (default: 100)',
                        type: 'number',
                        required: false,
                    },
                    {
                        name: 'count',
                        aliases: ['n'],
                        description: 'How many numbers to generate (default: 1)',
                        type: 'number',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const min = parseInt(command.args['min']) || 0;
                    const max = parseInt(command.args['max']) || 100;
                    const count = Math.min(parseInt(command.args['count'] || command.args['n']) || 1, 100);

                    const results: number[] = [];
                    for (let i = 0; i < count; i++) {
                        results.push(
                            Math.floor(Math.random() * (max - min + 1)) + min,
                        );
                    }

                    const output = results.join(', ');
                    context.writer.writeln(output);
                    context.process.output(results.length === 1 ? results[0] : results);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate random numbers within a range');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('random number [--min=N] [--max=N] [--count=N]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  random number                    ${writer.wrapInColor('# 0-100', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  random number --min=1 --max=6    ${writer.wrapInColor('# Dice roll', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  random number --count=5          ${writer.wrapInColor('# 5 numbers', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'string',
                aliases: ['str'],
                description: 'Generate a random string',
                parameters: [
                    {
                        name: 'length',
                        aliases: ['l'],
                        description: 'String length (default: 16)',
                        type: 'number',
                        required: false,
                    },
                    {
                        name: 'charset',
                        description:
                            'Character set: alphanumeric, alpha, numeric, hex (default: alphanumeric)',
                        type: 'string',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const length = Math.min(
                        parseInt(command.args['length'] || command.args['l']) || 16,
                        1024,
                    );
                    const charset = command.args['charset'] || 'alphanumeric';

                    const charsets: Record<string, string> = {
                        alphanumeric:
                            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                        alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                        numeric: '0123456789',
                        hex: '0123456789abcdef',
                    };

                    const chars = charsets[charset];
                    if (!chars) {
                        context.writer.writeError(
                            `Unknown charset: ${charset}. Available: ${Object.keys(charsets).join(', ')}`,
                        );
                        context.process.exit(-1);
                        return;
                    }

                    const randomValues = new Uint32Array(length);
                    crypto.getRandomValues(randomValues);
                    const result = Array.from(randomValues)
                        .map((v) => chars[v % chars.length])
                        .join('');

                    context.writer.writeln(result);
                    context.process.output(result);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate a cryptographically random string');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('random string [--length=N] [--charset=TYPE]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(
                        `  Charsets: ${writer.wrapInColor('alphanumeric, alpha, numeric, hex', CliForegroundColor.Yellow)}`,
                    );
                },
            },
            {
                command: 'uuid',
                description: 'Generate a random UUID v4',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const uuid = crypto.randomUUID();
                    context.writer.writeln(uuid);
                    context.process.output(uuid);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Generate a cryptographically random UUID v4');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('random uuid', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'coin',
                aliases: ['flip'],
                description: 'Flip a coin',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
                    context.writer.writeln(`🪙 ${result}`);
                    context.process.output(result);
                },
            },
            {
                command: 'dice',
                aliases: ['roll'],
                description: 'Roll a dice',
                parameters: [
                    {
                        name: 'sides',
                        aliases: ['s'],
                        description: 'Number of sides (default: 6)',
                        type: 'number',
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const sides = parseInt(command.args['sides'] || command.args['s']) || 6;
                    const result =
                        Math.floor(Math.random() * sides) + 1;
                    context.writer.writeln(`🎲 ${result}`);
                    context.process.output(result);
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
        writer.writeln('Generate random numbers, strings, UUIDs, and more');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('random number', CliForegroundColor.Cyan)}              Random number (0-100)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('random string', CliForegroundColor.Cyan)}              Random string (16 chars)`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('random uuid', CliForegroundColor.Cyan)}                Random UUID v4`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('random coin', CliForegroundColor.Cyan)}                Flip a coin`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('random dice', CliForegroundColor.Cyan)}                Roll a dice`,
        );
    }
}
