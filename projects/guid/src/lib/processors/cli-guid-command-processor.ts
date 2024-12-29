import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

/**
 * A command processor for generating and validating GUIDs.
 */
export class CliGuidCommandProcessor implements ICliCommandProcessor {
    command = 'guid';
    description = 'Generate and validate GUIDs';
    author = {
        name: 'Nicolae Lupei',
        email: 'nicolae.lupei@qodalis.com',
    };

    processors?: ICliCommandProcessor[] | undefined = [];

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
                ],
                processCommand: async (command, context) => {
                    const copyToClipboard =
                        command.args['copy'] || command.args['c'];
                    const guid = CliGuidCommandProcessor.generateGUID();
                    context.writer.writeln(guid);

                    if (copyToClipboard) {
                        await context.clipboard.write(guid);
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

                    const isValid = CliGuidCommandProcessor.validateGUID(
                        command.value,
                    );

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

    public static generateGUID(): string {
        // Generate a GUID in the format of xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
            /[xy]/g,
            (char) => {
                const random = (Math.random() * 16) | 0; // Random integer between 0 and 15
                const value = char === 'x' ? random : (random & 0x3) | 0x8; // Ensure 'y' starts with 8, 9, A, or B
                return value.toString(16); // Convert to hexadecimal
            },
        );
    }

    public static validateGUID(guid: string): boolean {
        // Regular expression to match a valid GUID format
        const guidRegex =
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        return guidRegex.test(guid);
    }
}
