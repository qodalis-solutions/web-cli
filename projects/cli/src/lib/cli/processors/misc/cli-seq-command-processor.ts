import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliSeqCommandProcessor implements ICliCommandProcessor {
    command = 'seq';

    aliases = ['sequence'];

    description = 'Print a sequence of numbers';

    author = DefaultLibraryAuthor;

    allowUnlistedCommands = true;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '🔢',
        module: 'misc',
    };

    parameters = [
        {
            name: 'step',
            aliases: ['s'],
            description: 'Step increment (default: 1)',
            type: 'number' as const,
            required: false,
        },
        {
            name: 'separator',
            aliases: ['sep'],
            description: 'Separator between numbers (default: newline)',
            type: 'string' as const,
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;
        const parts = (command.value || '').split(/\s+/).map(Number);

        let start: number, end: number;
        const step = parseFloat(command.args['step'] || command.args['s']) || 1;
        const separator = command.args['separator'] || command.args['sep'] || '\n';

        if (parts.length === 1) {
            start = 1;
            end = parts[0];
        } else if (parts.length >= 2) {
            start = parts[0];
            end = parts[1];
        } else {
            writer.writeError('Usage: seq <end> or seq <start> <end>');
            context.process.exit(-1);
            return;
        }

        if (isNaN(start) || isNaN(end)) {
            writer.writeError('Invalid numbers');
            context.process.exit(-1);
            return;
        }

        const maxCount = 10000;
        const numbers: number[] = [];

        if (step > 0) {
            for (let i = start; i <= end && numbers.length < maxCount; i += step) {
                numbers.push(i);
            }
        } else if (step < 0) {
            for (let i = start; i >= end && numbers.length < maxCount; i += step) {
                numbers.push(i);
            }
        } else {
            writer.writeError('Step cannot be 0');
            context.process.exit(-1);
            return;
        }

        writer.writeln(numbers.join(separator));
        context.process.output(numbers);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Print a sequence of numbers');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('seq <end>', CliForegroundColor.Cyan)}                       Numbers from 1 to end`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('seq <start> <end>', CliForegroundColor.Cyan)}               Numbers from start to end`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('seq <start> <end> --step=N', CliForegroundColor.Cyan)}      With custom step`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  seq 5                            ${writer.wrapInColor('# 1, 2, 3, 4, 5', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  seq 2 10 --step=2                ${writer.wrapInColor('# 2, 4, 6, 8, 10', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  seq 1 5 --sep=", "               ${writer.wrapInColor('# 1, 2, 3, 4, 5', CliForegroundColor.Green)}`,
        );
    }
}
