import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliTimestampCommandProcessor implements ICliCommandProcessor {
    command = 'timestamp';

    aliases = ['ts', 'epoch'];

    description = 'Convert between Unix timestamps and dates';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '🕐',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'now',
                description: 'Show current Unix timestamp',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const { writer } = context;
                    const now = Date.now();
                    const seconds = Math.floor(now / 1000);

                    writer.writeln(
                        `  ${writer.wrapInColor('Seconds:', CliForegroundColor.Cyan)}        ${seconds}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Milliseconds:', CliForegroundColor.Cyan)}   ${now}`,
                    );

                    context.process.output(seconds);
                },
            },
            {
                command: 'to-date',
                aliases: ['todate', 'parse'],
                description: 'Convert a Unix timestamp to a date',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const { writer } = context;
                    let ts = parseInt((command.value || '') as string);

                    if (isNaN(ts)) {
                        writer.writeError('Invalid timestamp');
                        context.process.exit(-1);
                        return;
                    }

                    // Auto-detect seconds vs milliseconds
                    if (ts < 1e12) {
                        ts *= 1000;
                    }

                    const date = new Date(ts);
                    writer.writeln(
                        `  ${writer.wrapInColor('Local:', CliForegroundColor.Cyan)}  ${date.toLocaleString()}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('UTC:', CliForegroundColor.Cyan)}    ${date.toUTCString()}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('ISO:', CliForegroundColor.Cyan)}    ${date.toISOString()}`,
                    );

                    context.process.output(date.toISOString());
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Convert a Unix timestamp to a human-readable date');
                    writer.writeln('Auto-detects seconds vs milliseconds');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('timestamp to-date <timestamp>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'from-date',
                aliases: ['fromdate'],
                description: 'Convert a date string to a Unix timestamp',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const { writer } = context;
                    const input = (command.value || '') as string;
                    const date = new Date(input);

                    if (isNaN(date.getTime())) {
                        writer.writeError(`Invalid date: ${input}`);
                        context.process.exit(-1);
                        return;
                    }

                    const seconds = Math.floor(date.getTime() / 1000);
                    writer.writeln(
                        `  ${writer.wrapInColor('Seconds:', CliForegroundColor.Cyan)}        ${seconds}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('Milliseconds:', CliForegroundColor.Cyan)}   ${date.getTime()}`,
                    );

                    context.process.output(seconds);
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Convert a date string to a Unix timestamp');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('timestamp from-date <date>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln();
                    writer.writeln('📝 Examples:');
                    writer.writeln(
                        `  timestamp from-date 2024-01-01               ${writer.wrapInColor('# ISO date', CliForegroundColor.Green)}`,
                    );
                    writer.writeln(
                        `  timestamp from-date "Jan 1, 2024 12:00"      ${writer.wrapInColor('# Human-readable', CliForegroundColor.Green)}`,
                    );
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
        const { writer } = context;
        writer.writeln('Convert between Unix timestamps and human-readable dates');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('timestamp now', CliForegroundColor.Cyan)}                     Current Unix timestamp`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('timestamp to-date <ts>', CliForegroundColor.Cyan)}             Timestamp to date`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('timestamp from-date <date>', CliForegroundColor.Cyan)}         Date to timestamp`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  timestamp to-date 1704067200       ${writer.wrapInColor('# → Jan 1, 2024', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  timestamp from-date 2024-01-01     ${writer.wrapInColor('# → 1704067200', CliForegroundColor.Green)}`,
        );
    }
}
