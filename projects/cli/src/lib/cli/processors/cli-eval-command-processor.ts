import { DefaultLibraryAuthor } from '../../constants';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '../models';

export class CliEvalCommandProcessor implements ICliCommandProcessor {
    command = 'eval';
    description = 'Evaluate a JavaScript expression';
    author = DefaultLibraryAuthor;
    allowUnlistedCommands = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        try {
            const ev = eval(command.value ?? '');
            context.writer.writeln('Output: ' + ev?.toString());
        } catch (e) {
            context.writer.writeError(e!.toString());
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description);
        context.writer.writeln('Examples:');
        context.writer.writeln('  eval 1 + 1');
        context.writer.writeln('  eval "Hello, " + "World!"');
    }
}
