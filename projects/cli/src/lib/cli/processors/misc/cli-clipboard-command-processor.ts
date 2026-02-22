import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliClipboardCommandProcessor implements ICliCommandProcessor {
    command = 'clipboard';

    aliases = ['cb', 'pbcopy'];

    description = 'Copy to or paste from the clipboard';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📎',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'copy',
                aliases: ['cp'],
                description: 'Copy text to clipboard',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const text = (command.value || command.data || '') as string;
                    try {
                        await navigator.clipboard.writeText(text);
                        context.writer.writeSuccess('Copied to clipboard');
                    } catch {
                        context.writer.writeError(
                            'Failed to copy. Clipboard access may be denied by the browser.',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Copy text to the system clipboard');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('clipboard copy <text>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'paste',
                aliases: ['p'],
                description: 'Paste text from clipboard',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (text) {
                            context.writer.writeln(text);
                            context.process.output(text);
                        } else {
                            context.writer.writeInfo('Clipboard is empty');
                        }
                    } catch {
                        context.writer.writeError(
                            'Failed to paste. Clipboard access may be denied by the browser.',
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Read text from the system clipboard');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('clipboard paste', CliForegroundColor.Cyan)}`,
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
        writer.writeln('Copy text to or paste text from the system clipboard');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('clipboard copy <text>', CliForegroundColor.Cyan)}     Copy text to clipboard`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('clipboard paste', CliForegroundColor.Cyan)}            Paste from clipboard`,
        );
    }
}
