import {
    type ICliCommandProcessor,
    type CliProcessCommand,
    type ICliExecutionContext,
    type CliProcessorMetadata,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';

export class CliInputDemoCommandProcessor implements ICliCommandProcessor {
    command = 'input-demo';
    description = 'Demonstrates interactive input reader capabilities';
    author = DefaultLibraryAuthor;
    metadata?: CliProcessorMetadata = {
        icon: '📝',
    };

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer, reader } = context;

        // 1. readLine demo
        const name = await reader.readLine('Enter your name: ');
        if (name === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Hello, ${name || 'anonymous'}!`);
        writer.writeln();

        // 2. readPassword demo
        const password = await reader.readPassword('Enter a secret: ');
        if (password === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Secret received (${password.length} characters)`);
        writer.writeln();

        // 3. readConfirm demo
        const confirmed = await reader.readConfirm(
            'Do you want to continue?',
            true,
        );
        if (confirmed === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeInfo(`You chose: ${confirmed ? 'Yes' : 'No'}`);
        writer.writeln();

        // 4. readSelect demo
        const choice = await reader.readSelect('Pick your favorite color:', [
            { label: 'Red', value: 'red' },
            { label: 'Green', value: 'green' },
            { label: 'Blue', value: 'blue' },
            { label: 'Yellow', value: 'yellow' },
        ]);
        if (choice === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`You picked: ${choice}`);
        writer.writeln();

        writer.writeln(
            writer.wrapInColor(
                'All input methods working correctly!',
                CliForegroundColor.Green,
            ),
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(
            'Interactive demo showcasing readLine, readPassword, readConfirm, and readSelect',
        );
    }
}
