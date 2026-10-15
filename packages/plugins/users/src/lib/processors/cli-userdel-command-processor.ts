import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliUserdelCommandProcessor extends CliUsersCommand {
    override command = 'userdel';
    override aliases = ['deluser'];
    override description = 'Delete a user';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['users:delete'] };
    override parameters = [
        { name: 'force', aliases: ['f'], description: 'Do not ask for confirmation', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['userdel <user> [--force]', 'Delete a user, their password and sessions'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users } = usersServices(context);
        const [name] = words(command);
        if (!(command.args['force'] || command.args['f'])) {
            const ok = await context.reader.readConfirm(`Delete user '${name}'?`, false);
            if (!ok) {
                context.writer.writeInfo('Cancelled');
                return;
            }
        }
        await users.deleteUser(name);
        context.writer.writeSuccess(`User '${name}' deleted`);
    }
}
