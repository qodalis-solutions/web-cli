import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, listArg, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliGroupaddCommandProcessor extends CliUsersCommand {
    override command = 'groupadd';
    override description = 'Create a group (role)';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['groups:create'] };
    override parameters = [
        { name: 'description', aliases: ['d'], description: 'Description', type: 'string' as const, required: false },
        { name: 'permissions', aliases: ['p'], description: 'Permissions, comma separated (e.g. users:read,files:*)', type: 'string' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['groupadd <name>', 'Create a group'],
        ['groupadd ops --permissions=sessions:*,audit:read', 'Create a role with permissions'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { groups } = usersServices(context);
        const [name] = words(command);
        const description = command.args['description'] ?? command.args['d'];
        const permissions = listArg(command.args['permissions'] ?? command.args['p']);
        const group = await groups.createGroup(name, description, permissions);
        context.writer.writeSuccess(
            `Group '${group.name}' created${group.permissions?.length ? ` (permissions: ${group.permissions.join(', ')})` : ''}`,
        );
    }
}
