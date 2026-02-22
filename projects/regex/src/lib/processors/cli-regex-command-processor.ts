import {
    CliForegroundColor,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    highlightTextWithBg,
} from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliRegexCommandProcessor implements ICliCommandProcessor {
    command = 'regex';

    description = 'Provide utilities for working with regular expressions';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    version = LIBRARY_VERSION;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔍',
    };

    constructor() {
        this.processors = [
            {
                command: 'match',
                description: 'Match a regular expression against a string',
                allowUnlistedCommands: true,
                async processCommand(command, context) {
                    const [pattern, text] = command.command.split(' ').slice(2);

                    const regex = new RegExp(pattern, 'gm');
                    const match = regex.exec(text);

                    if (match) {
                        let displayText = highlightTextWithBg(text, regex);

                        context.writer.writeln('Match: ' + displayText);
                    } else {
                        context.writer.writeInfo('No match');
                    }
                },
                writeDescription(context) {
                    context.writer.writeln(
                        'Usage: regex match <pattern> <text>',
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        await context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description);
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('regex match <pattern> <text>', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  regex match "\\d+" "abc123def"        ${writer.wrapInColor('# Match numbers', CliForegroundColor.Green)}`);
        writer.writeln(`  regex match "hello" "hello world"    ${writer.wrapInColor('# Match text', CliForegroundColor.Green)}`);
        writer.writeln();
        writer.writeln('💡 Matches are highlighted in the output');
    }
}
