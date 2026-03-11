import type {
    ICliCommandProcessor,
    CliProcessCommand,
    ICliExecutionContext,
    CliProcessorMetadata,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor, CliForegroundColor } from '@qodalis/cli-core';

/**
 * Example custom command processor for the vanilla demo.
 *
 * Shows how to:
 *   - Define a command with parameters
 *   - Use the terminal writer for colored output
 *   - Use the input reader for interactive prompts
 */
export class GreetCommandProcessor implements ICliCommandProcessor {
    command = 'greet';
    description = 'Interactive greeting command — demonstrates custom processors';
    author = DefaultLibraryAuthor;
    metadata?: CliProcessorMetadata = {
        icon: '👋',
    };

    parameters = [
        {
            name: 'name',
            description: 'Name to greet',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'loud',
            description: 'Shout the greeting',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer, reader } = context;

        let name = command.args['name'] as string | undefined;

        if (!name) {
            const input = await reader.readLine('What is your name? ');
            if (input === null) {
                writer.writeWarning('Cancelled.');
                return;
            }
            name = input || 'World';
        }

        const loud = command.args['loud'] as boolean | undefined;
        let message = `Hello, ${name}! Welcome to Qodalis CLI (vanilla JS).`;

        if (loud) {
            message = message.toUpperCase();
        }

        writer.writeln();
        writer.writeln(
            writer.wrapInColor(message, CliForegroundColor.Cyan),
        );
        writer.writeln();

        context.process.output(message);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(
            'Greets you by name. Use --name=<name> or answer the prompt.',
        );
        context.writer.writeln('  greet              — interactive prompt');
        context.writer.writeln('  greet --name=Alice — direct greeting');
        context.writer.writeln('  greet --loud       — SHOUT the greeting');
    }
}
