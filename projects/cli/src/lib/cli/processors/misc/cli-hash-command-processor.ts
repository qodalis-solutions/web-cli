import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliHashCommandProcessor implements ICliCommandProcessor {
    command = 'hash';

    description = 'Generate hash digests of text';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '#️⃣',
        module: 'misc',
    };

    constructor() {
        const algorithms: { command: string; algo: string; aliases?: string[] }[] = [
            { command: 'sha256', algo: 'SHA-256', aliases: ['sha-256'] },
            { command: 'sha1', algo: 'SHA-1', aliases: ['sha-1'] },
            { command: 'sha384', algo: 'SHA-384', aliases: ['sha-384'] },
            { command: 'sha512', algo: 'SHA-512', aliases: ['sha-512'] },
        ];

        this.processors = algorithms.map(({ command, algo, aliases }) => ({
            command,
            aliases,
            description: `Generate ${algo} hash`,
            allowUnlistedCommands: true,
            valueRequired: true,
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                const text = (cmd.value || cmd.data || '') as string;
                try {
                    const encoded = new TextEncoder().encode(text);
                    const hashBuffer = await crypto.subtle.digest(algo, encoded);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    const hex = hashArray
                        .map((b) => b.toString(16).padStart(2, '0'))
                        .join('');
                    context.writer.writeln(hex);
                    context.process.output(hex);
                } catch {
                    context.writer.writeError(`Failed to compute ${algo} hash`);
                    context.process.exit(-1);
                }
            },
            writeDescription: (context: ICliExecutionContext) => {
                const { writer } = context;
                writer.writeln(`Generate a ${algo} hash digest of the input text`);
                writer.writeln();
                writer.writeln('📋 Usage:');
                writer.writeln(
                    `  ${writer.wrapInColor(`hash ${command} <text>`, CliForegroundColor.Cyan)}`,
                );
            },
        }));
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Generate cryptographic hash digests using the Web Crypto API');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('hash sha256 <text>', CliForegroundColor.Cyan)}        SHA-256 hash`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hash sha1 <text>', CliForegroundColor.Cyan)}          SHA-1 hash`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hash sha384 <text>', CliForegroundColor.Cyan)}        SHA-384 hash`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('hash sha512 <text>', CliForegroundColor.Cyan)}        SHA-512 hash`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  hash sha256 hello                ${writer.wrapInColor('# → 2cf24dba5fb0a30e...', CliForegroundColor.Green)}`,
        );
    }
}
