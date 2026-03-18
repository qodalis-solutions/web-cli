import {
    ICliCommandProcessor,
    CliProcessCommand,
    ICliExecutionContext,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';

export class CliInputDemoCommandProcessor implements ICliCommandProcessor {
    command = 'input-demo';
    description = 'Demonstrates all interactive input reader capabilities';
    author = DefaultLibraryAuthor;
    metadata?: CliProcessorMetadata = {
        icon: '📝',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer, reader } = context;

        // 1. readLine — with placeholder and default
        const name = await reader.readLine('Enter your name: ', {
            placeholder: 'John Doe',
            default: 'World',
        });
        if (name === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Hello, ${name}!`);
        writer.writeln();

        // 2. readLine — with validation
        const email = await reader.readLine('Enter your email: ', {
            placeholder: 'user@example.com',
            validate: (value) => {
                if (!value.includes('@')) return 'Must be a valid email address';
                return null;
            },
        });
        if (email === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Email: ${email}`);
        writer.writeln();

        // 3. readPassword
        const password = await reader.readPassword('Enter a secret: ');
        if (password === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Secret received (${password.length} characters)`);
        writer.writeln();

        // 4. readConfirm — with default
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

        // 5. readNumber — with min/max and default
        const count = await reader.readNumber('How many items?', {
            min: 1,
            max: 100,
            default: 10,
        });
        if (count === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Count: ${count}`);
        writer.writeln();

        // 6. readSelect — with descriptions, groups, and disabled option
        const framework = await reader.readSelect(
            'Pick a framework:',
            [
                { label: 'Angular', value: 'angular', description: 'Full-featured framework', group: 'Frontend' },
                { label: 'React', value: 'react', description: 'Component-based UI library', group: 'Frontend' },
                { label: 'Vue', value: 'vue', description: 'Progressive framework', group: 'Frontend' },
                { label: 'Express', value: 'express', description: 'Node.js web framework', group: 'Backend' },
                { label: 'FastAPI', value: 'fastapi', description: 'Python async framework', group: 'Backend' },
                { label: 'Legacy', value: 'legacy', description: 'Deprecated — do not use', disabled: true },
            ],
            { searchable: true, default: 'react' },
        );
        if (framework === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Framework: ${framework}`);
        writer.writeln();

        // 7. readSelectInline — horizontal picker
        const size = await reader.readSelectInline('Size:', [
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
            { label: 'Extra Large', value: 'xl' },
            { label: 'XXL', value: 'xxl' },
        ]);
        if (size === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Size: ${size}`);
        writer.writeln();

        // 8. readMultiSelect — with pre-checked and select-all
        const toppings = await reader.readMultiSelect(
            'Select toppings:',
            [
                { label: 'Cheese', value: 'cheese', checked: true },
                { label: 'Pepperoni', value: 'pepperoni' },
                { label: 'Mushrooms', value: 'mushrooms', checked: true },
                { label: 'Olives', value: 'olives' },
                { label: 'Pineapple', value: 'pineapple', description: 'Controversial!' },
            ],
            { searchable: true },
        );
        if (toppings === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Toppings: ${toppings.join(', ')}`);
        writer.writeln();

        // 9. readDate — with format validation
        const startDate = await reader.readDate('Start date:', {
            format: 'YYYY-MM-DD',
            min: '2024-01-01',
            max: '2030-12-31',
        });
        if (startDate === null) {
            writer.writeWarning('Input cancelled.');
            return;
        }
        writer.writeSuccess(`Start date: ${startDate}`);
        writer.writeln();

        // 10. readFile — file picker
        const files = await reader.readFile('Select a file:', {
            accept: '.json,.txt,.yaml',
            multiple: true,
        });
        if (files === null) {
            writer.writeInfo('No file selected (skipped).');
        } else {
            for (const file of files) {
                writer.writeSuccess(`File: ${file.name} (${file.size} bytes)`);
            }
        }
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
            'Interactive demo showcasing all input types: readLine (with validation, defaults, placeholder), readPassword, readConfirm, readNumber, readSelect (with descriptions, groups, search), readSelectInline, readMultiSelect (with select-all, search), readDate, and readFile.',
        );
    }
}
