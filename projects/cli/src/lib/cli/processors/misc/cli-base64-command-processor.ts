import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliBase64CommandProcessor implements ICliCommandProcessor {
    command = 'base64';

    aliases = ['b64'];

    description = 'Encode or decode Base64 strings';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🔣',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc', 'e'],
                description: 'Encode text to Base64',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = command.value || command.data || '';
                    const encoded = btoa(
                        new TextEncoder()
                            .encode(text as string)
                            .reduce(
                                (data, byte) =>
                                    data + String.fromCharCode(byte),
                                '',
                            ),
                    );
                    context.writer.writeln(encoded);
                    context.process.output(encoded);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Encode text to Base64 format');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('base64 encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  base64 encode Hello World        ${writer.wrapInColor('# → SGVsbG8gV29ybGQ=', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec', 'd'],
                description: 'Decode a Base64 string',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const encoded = command.value || command.data || '';
                    try {
                        const bytes = Uint8Array.from(
                            atob(encoded as string),
                            (c) => c.charCodeAt(0),
                        );
                        const decoded = new TextDecoder().decode(bytes);
                        context.writer.writeln(decoded);
                        context.process.output(decoded);
                    } catch {
                        context.writer.writeError(
                            'Invalid Base64 string',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Decode a Base64 string back to text');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('base64 decode <base64>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  base64 decode SGVsbG8gV29ybGQ=   ${writer.wrapInColor('# → Hello World', CliForegroundColor.Green)}`,
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
        writer.writeln('Encode and decode Base64 strings');
        writer.writeln('Supports UTF-8 text encoding');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('base64 encode <text>', CliForegroundColor.Cyan)}       Encode text to Base64`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('base64 decode <base64>', CliForegroundColor.Cyan)}     Decode Base64 to text`,
        );
    }
}
