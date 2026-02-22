import {
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
        context.writer.writeln('Sleep for a specified amount of time');
        context.writer.writeln('Usage: sleep <time>');
        context.writer.writeln('Usage: sleep 5000 # Sleep for 5 seconds');
    }
}
