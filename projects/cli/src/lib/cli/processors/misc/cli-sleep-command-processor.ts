import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    delay,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliSleepCommandProcessor implements ICliCommandProcessor {
    command = 'sleep';

    aliases = ['wait'];

    description?: string | undefined = 'Sleep for a specified amount of time';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'misc',
        icon: CliIcon.Timer,
    };

    valueRequired?: boolean | undefined = true;

    constructor() {}

    async processCommand(
        command: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ) {
        const time = parseInt(command.value!);

        if (isNaN(time) || time < 0) {
            writer.writeError(
                `Invalid time value: "${command.value}". Please provide a positive number in milliseconds.`,
            );
            return;
        }

        await delay(time);

        writer.writeInfo(`Slept for ${time}ms`);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Pauses execution for the specified duration (in milliseconds)');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('sleep <milliseconds>', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  sleep 1000                   ${writer.wrapInColor('# Sleep for 1 second', CliForegroundColor.Green)}`);
        writer.writeln(`  sleep 5000                   ${writer.wrapInColor('# Sleep for 5 seconds', CliForegroundColor.Green)}`);
    }
}
