import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliGroupdelCommandProcessor extends CliUsersCommand {
    override command = 'groupdel';
    override description = 'Delete a group (members are removed from it)';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['groups:delete'] };
    protected override usage: Array<[string, string]> = [['groupdel <name>', 'Delete a group; built-in groups cannot be deleted']];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const [name] = words(command);
        await usersServices(context).groups.deleteGroup(name);
        context.writer.writeSuccess(`Group '${name}' deleted`);
    }
}
