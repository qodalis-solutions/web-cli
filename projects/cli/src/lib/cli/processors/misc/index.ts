import { DefaultLibraryAuthor } from '@qodalis/cli-core';
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

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.terminal.clear();
    }
}

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';

    description?: string | undefined = 'Prints the specified text';

    allowUnlistedCommands?: boolean | undefined = true;

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln(command.command.replace('echo ', '').trim());
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('echo <text>');
        context.writer.writeln('Prints the specified text');
    }
}
