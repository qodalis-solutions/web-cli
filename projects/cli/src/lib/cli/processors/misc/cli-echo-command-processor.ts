import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';

    description = 'Prints the specified text';

    allowUnlistedCommands = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '📢',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = command.value || command.data || '';

        if (typeof text === 'object') {
            context.writer.writeJson(text);
        } else {
            context.writer.writeln(text);
        }

        context.process.output(text);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('echo <text>');
        context.writer.writeln('Prints the specified text');
    }
}
