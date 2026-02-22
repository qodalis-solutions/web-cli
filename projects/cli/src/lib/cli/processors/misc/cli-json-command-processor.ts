import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliJsonCommandProcessor implements ICliCommandProcessor {
    command = 'json';

    description = 'Format, minify, or validate JSON';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        icon: '📋',
        module: 'misc',
    };

    constructor() {
        this.processors = [
            {
                command: 'format',
                aliases: ['fmt', 'pretty'],
                description: 'Pretty-print JSON with indentation',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const parsed = typeof input === 'object' ? input : JSON.parse(input);
                        const formatted = JSON.stringify(parsed, null, 2);
                        context.writer.writeln(formatted);
                        context.process.output(formatted);
                    } catch {
                        context.writer.writeError('Invalid JSON input');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Pretty-print JSON with 2-space indentation');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('json format <json>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'minify',
                aliases: ['min'],
                description: 'Minify JSON by removing whitespace',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        const parsed = typeof input === 'object' ? input : JSON.parse(input);
                        const minified = JSON.stringify(parsed);
                        context.writer.writeln(minified);
                        context.process.output(minified);
                    } catch {
                        context.writer.writeError('Invalid JSON input');
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Minify JSON by removing all unnecessary whitespace');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('json minify <json>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
            {
                command: 'validate',
                aliases: ['check'],
                description: 'Validate whether a string is valid JSON',
                allowUnlistedCommands: true,
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const input = (command.value || command.data || '') as string;
                    try {
                        JSON.parse(input);
                        context.writer.writeSuccess('Valid JSON');
                    } catch (e: any) {
                        context.writer.writeError(`Invalid JSON: ${e.message}`);
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Check whether a string is valid JSON');
                    writer.writeln();
                    writer.writeln('📋 Usage:');
                    writer.writeln(
                        `  ${writer.wrapInColor('json validate <json>', CliForegroundColor.Cyan)}`,
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
        writer.writeln('Format, minify, or validate JSON strings');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('json format <json>', CliForegroundColor.Cyan)}       Pretty-print JSON`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('json minify <json>', CliForegroundColor.Cyan)}       Remove whitespace`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('json validate <json>', CliForegroundColor.Cyan)}     Check if valid JSON`,
        );
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(
            `  json format {"a":1,"b":2}        ${writer.wrapInColor('# Pretty-print', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  json validate {"valid":true}      ${writer.wrapInColor('# Check validity', CliForegroundColor.Green)}`,
        );
    }
}
