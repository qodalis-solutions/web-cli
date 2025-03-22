import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../../../version';

export class CliTimeCommandProcessor implements ICliCommandProcessor {
    command = 'time';

    description = 'Display the current local and UTC time';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'misc',
        icon: CliIcon.Timer,
    };

    constructor() {
        this.processors = [
            {
                command: 'now',
                description: 'Display the current time',
                processCommand: async (_command, context) => {
                    const now = new Date();

                    const localTime = now.toLocaleString();
                    const utcTime = now.toUTCString();

                    context.writer.writeSuccess(
                        `🕒 Local Time: ${context.writer.wrapInColor(localTime, CliForegroundColor.White)}`,
                    );
                    context.writer.writeSuccess(
                        `🌐 UTC Time: ${context.writer.wrapInColor(utcTime, CliForegroundColor.White)}`,
                    );

                    context.process.output(now);
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }
}
