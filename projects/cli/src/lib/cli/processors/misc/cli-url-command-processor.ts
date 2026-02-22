import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliUrlCommandProcessor implements ICliCommandProcessor {
    command = 'url';

    description = 'Encode or decode URLs';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🔗',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'encode',
                aliases: ['enc'],
                description: 'URL-encode a string',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    const encoded = encodeURIComponent(text);
                    context.writer.writeln(encoded);
                    context.process.output(encoded);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('URL-encode a string');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('url encode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  url encode hello world           ${writer.wrapInColor('# → hello%20world', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'decode',
                aliases: ['dec'],
                description: 'URL-decode a string',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    try {
                        const decoded = decodeURIComponent(text);
                        context.writer.writeln(decoded);
                        context.process.output(decoded);
                    } catch {
                        context.writer.writeError('Invalid URL-encoded string');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('URL-decode a string');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('url decode <text>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  url decode hello%20world         ${writer.wrapInColor('# → hello world', CliForegroundColor.Green)}`,
                    );
                },
            },
            {
                command: 'parse',
                description: 'Parse a URL into its components',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const url = new URL(input);
                        const parts: Record<string, string> = {
                            protocol: url.protocol,
                            hostname: url.hostname,
                            port: url.port || '(default)',
                            pathname: url.pathname,
                            search: url.search || '(none)',
                            hash: url.hash || '(none)',
                            origin: url.origin,
                        };
                        const { writer } = context;
                        Object.entries(parts).forEach(([key, value]) => {
                            writer.writeln(
                                `  ${writer.wrapInColor(key.padEnd(12), CliForegroundColor.Cyan)} ${value}`,
                            );
                        });
                        context.process.output(parts);
                    } catch {
                        context.writer.writeError('Invalid URL');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Parse a URL and display its components');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('url parse <url>', CliForegroundColor.Cyan)}`,
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
        writer.writeln('Encode, decode, and parse URLs');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('url encode <text>', CliForegroundColor.Cyan)}        URL-encode a string`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('url decode <text>', CliForegroundColor.Cyan)}        URL-decode a string`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('url parse <url>', CliForegroundColor.Cyan)}          Parse URL components`,
        );
    }
}
