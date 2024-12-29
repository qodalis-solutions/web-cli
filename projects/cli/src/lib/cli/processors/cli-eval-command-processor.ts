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
            const output = eval(command.value ?? '');

            if (Array.isArray(output)) {
                context.writer.writeln('Output:');
                context.writer.writeJson(output);
                return;
            }

            if (typeof output === 'object') {
                context.writer.writeln('Output:');
                context.writer.writeJson(output);
                return;
            }

            context.writer.writeln('Output: ' + output?.toString());
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
