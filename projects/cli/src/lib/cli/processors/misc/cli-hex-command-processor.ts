import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliHexCommandProcessor implements ICliCommandProcessor {
    command = 'hex';

    description = 'Hex encode/decode and number base conversions';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '0️⃣',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc'],
                description: 'Encode text to hexadecimal',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const hex = Array.from(new TextEncoder().encode(text))
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('');
                    context.writer.writeln(hex);
                    context.process.output(hex);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to hexadecimal representation');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('hex encode <text>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec'],
                description: 'Decode hexadecimal to text',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const hexStr = (command.value || command.data || '') as string;
                    try {
                        const bytes = new Uint8Array(
                            (hexStr.match(/.{1,2}/g) || []).map((byte) =>
                                parseInt(byte, 16),
                            ),
                        );
                        const text = new TextDecoder().decode(bytes);
                        context.writer.writeln(text);
                        context.process.output(text);
                    } catch {
                        context.writer.writeError('Invalid hex string');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode hexadecimal back to text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('hex decode <hex>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'convert',
                aliases: ['conv'],
                description: 'Convert a number between bases',
                allowUnlistedCommands: true,
                valueRequired: true,
                parameters: [
                    {
                        name: 'from',
                        description: 'Source base (default: 10)',
                        type: 'number' as const,
                        required: false,
                    },
                    {
                        name: 'to',
                        description: 'Target base (default: 16)',
                        type: 'number' as const,
                        required: false,
                    },
                ],
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const { writer } = context;
                    const input = (command.value || '') as string;
                    const fromBase = parseInt(command.args['from']) || 10;
                    const toBase = parseInt(command.args['to']) || 16;

                    if (fromBase < 2 || fromBase > 36 || toBase < 2 || toBase > 36) {
                        writer.writeError('Base must be between 2 and 36');
                        context.process.exit(-1);
                        return;
                    }

                    try {
                        const num = parseInt(input, fromBase);
                        if (isNaN(num)) {
                            writer.writeError(`Invalid number for base ${fromBase}`);
                            context.process.exit(-1);
                            return;
                        }
                        const result = num.toString(toBase);

                        writer.writeln(
                            `  ${writer.wrapInColor(`Base ${fromBase}:`, CliForegroundColor.Cyan)}  ${input}`,
                        );
                        writer.writeln(
                            `  ${writer.wrapInColor(`Base ${toBase}:`, CliForegroundColor.Cyan)}  ${result}`,
                        );

                        if (fromBase !== 10 && toBase !== 10) {
                            writer.writeln(
                                `  ${writer.wrapInColor('Base 10:', CliForegroundColor.Cyan)}  ${num}`,
                            );
                        }

                        context.process.output(result);
                    } catch {
                        writer.writeError('Conversion failed');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Convert a number between different bases (2-36)');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('hex convert <number> [--from=N] [--to=N]', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  hex convert 255                  ${writer.wrapInColor('# Decimal → Hex (ff)', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  hex convert ff --from=16 --to=2  ${writer.wrapInColor('# Hex → Binary (11111111)', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  hex convert 1010 --from=2        ${writer.wrapInColor('# Binary → Hex (a)', CliForegroundColor.Green)}`,
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
        writer.writeln('Hex encode/decode text and convert numbers between bases');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('hex encode <text>', CliForegroundColor.Cyan)}                     Text to hex`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hex decode <hex>', CliForegroundColor.Cyan)}                      Hex to text`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hex convert <num> [--from --to]', CliForegroundColor.Cyan)}       Base conversion`,
        );
    }
}
