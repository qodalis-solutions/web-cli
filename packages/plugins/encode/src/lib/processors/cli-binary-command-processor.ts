import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliBinaryCommandProcessor implements ICliCommandProcessor {
    command = 'binary';

    aliases = ['bin'];

    description = 'Encode or decode binary strings';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '💻',
        module: '@qodalis/cli-encode',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc', 'e'],
                description: 'Encode text to binary',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const binary = Array.from(new TextEncoder().encode(text))
                        .map((b) => b.toString(2).padStart(8, '0'))
                        .join(' ');
                    context.writer.writeln(binary);
                    context.process.output(binary);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to binary representation');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('binary encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  binary encode Hi   ${writer.wrapInColor('# → 01001000 01101001', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec', 'd'],
                description: 'Decode binary to text',
                acceptsRawInput: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const cleaned = input.replace(/[^01]/g, '');
                        if (cleaned.length === 0 || cleaned.length % 8 !== 0) {
                            throw new Error('Invalid binary');
                        }
                        const bytes = new Uint8Array(
                            (cleaned.match(/.{8}/g) || []).map((b) =>
                                parseInt(b, 2),
                            ),
                        );
                        const text = new TextDecoder().decode(bytes);
                        context.writer.writeln(text);
                        context.process.output(text);
                    } catch {
                        context.writer.writeError(
                            'Invalid binary string (expected groups of 8 bits)',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode binary string back to text');
                    writer.writeln();
                    writer.writeln(`📋 ${context.translator.t('cli.common.usage', 'Usage:')}`);
                    writer.writeln(
                        `  ${writer.wrapInColor('binary decode <binary>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln(`📝 ${context.translator.t('cli.common.examples', 'Examples:')}`);
                    writer.writeln(
                        `  binary decode 01001000 01101001   ${writer.wrapInColor('# → Hi', CliForegroundColor.Green)}`,
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
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.binary.long_description', 'Encode and decode binary strings'));
        writer.writeln(t.t('cli.binary.utf8_note', 'Supports UTF-8 text encoding'));
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('binary encode <text>', CliForegroundColor.Cyan)}       ${t.t('cli.binary.encode_desc', 'Text to binary')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('binary decode <binary>', CliForegroundColor.Cyan)}     ${t.t('cli.binary.decode_desc', 'Binary to text')}`,
        );
    }
}
