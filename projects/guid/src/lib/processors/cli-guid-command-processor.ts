import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { generateGUID, validateGUID } from '../utilities';
import { LIBRARY_VERSION } from '../version';

/**
 * A command processor for generating and validating GUIDs.
 */
export class CliGuidCommandProcessor implements ICliCommandProcessor {
    command = 'guid';
    description = 'Generate and validate GUIDs';
    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🆔',
    };

    constructor() {
        this.processors = [
            {
                command: 'new',
                description: 'Generate a new GUID',
                parameters: [
                    {
                        name: 'copy',
                        aliases: ['c'],
                        description: 'Copy the GUID to the clipboard',
                        required: false,
                        type: 'boolean',
                    },
                    {
                        name: 'count',
                        description:
                            'Number of GUIDs to generate, default is 1',
                        defaultValue: '1',
                        required: false,
                        type: 'number',
                    },
                ],
                processCommand: async (command, context) => {
                    const count = command.args['count']
                        ? parseInt(command.args['count'])
                        : 1;

                    const copyToClipboard =
                        command.args['copy'] || command.args['c'];

                    const items = [];

                    for (let i = 0; i < count; i++) {
                        const guid = generateGUID();
                        context.writer.writeln(guid);

                        items.push(guid);
                    }

                    if (copyToClipboard) {
                        await context.clipboard.write(items.join('\n'));
                        context.writer.writeInfo(
                            'The GUID has been copied to the clipboard',
                        );
                    }
                },
            },
            {
                command: 'validate',
                allowUnlistedCommands: true,
                description: 'Validate a GUID',
                processCommand: async (command, context) => {
                    if (!command.value) {
                        context.writer.writeError(
                            'Please specify a GUID to validate',
                        );
                        return;
                    }

                    const isValid = validateGUID(command.value);

                    if (isValid) {
                        context.writer.writeSuccess('Yes, that is GUID!');
                    } else {
                        context.writer.writeError(
                            `The GUID <${command.value}> is not valid`,
                        );
                    }
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln('Please specify a subcommand');
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description);
        //examples
        context.writer.writeln('Examples:');
        context.writer.writeln('  guid new');
        context.writer.writeln('  guid new --copy');
        context.writer.writeln(
            '  guid validate 123e4567-e89b-12d3-a456-426614174000',
        );
    }
}
