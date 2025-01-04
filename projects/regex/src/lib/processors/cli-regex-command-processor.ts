import { DefaultLibraryAuthor, highlightTextWithBg } from '@qodalis/cli-core';
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
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeError("Use 'regex' command with a subcommand");
    }
}
