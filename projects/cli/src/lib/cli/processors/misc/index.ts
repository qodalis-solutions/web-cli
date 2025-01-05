import { CliProcessorMetadata, DefaultLibraryAuthor } from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliClearCommandProcessor implements ICliCommandProcessor {
    command = 'clear';

    description?: string | undefined = 'Clears the terminal';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🧹',
    };

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.terminal.clear();
    }
}

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';

    description = 'Prints the specified text';

    allowUnlistedCommands = true;

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '📢',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const text = command.value ?? '';
        context.process.output(text);
        context.writer.writeln(text);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('echo <text>');
        context.writer.writeln('Prints the specified text');
    }
}
