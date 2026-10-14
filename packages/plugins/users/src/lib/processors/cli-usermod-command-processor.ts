import { CliProcessCommand, ICliExecutionContext, CliUpdateUser } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, listArg, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliUsermodCommandProcessor extends CliUsersCommand {
    override command = 'usermod';
    override description = 'Modify a user';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['users:update'] };
    override parameters = [
        { name: 'name', description: 'Rename the user', type: 'string' as const, required: false },
        { name: 'email', description: 'New email', type: 'string' as const, required: false },
        { name: 'groups', description: 'Replace groups (comma separated)', type: 'string' as const, required: false },
        { name: 'add-groups', aliases: ['a'], description: 'Add to groups', type: 'string' as const, required: false },
        { name: 'remove-groups', aliases: ['r'], description: 'Remove from groups', type: 'string' as const, required: false },
        { name: 'home', description: 'New home directory', type: 'string' as const, required: false },
        { name: 'disable', description: 'Disable the account (ends its sessions)', type: 'boolean' as const, required: false },
        { name: 'enable', description: 'Enable the account', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['usermod <user> --name=<new>', 'Rename'],
        ['usermod <user> --email=<email>', 'Change email'],
        ['usermod <user> --groups=a,b', 'Replace groups'],
        ['usermod <user> --add-groups=a | --remove-groups=a', 'Add / remove groups'],
        ['usermod <user> --home=<dir>', 'Change home directory'],
        ['usermod <user> --disable | --enable', 'Disable (ends sessions) / enable'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users } = usersServices(context);
        const [name] = words(command);
        const user = await firstValueFrom(users.getUser(name));
        if (!user) {
            context.writer.writeError(`usermod: user '${name}' does not exist`);
            context.process.exit(-1, { silent: true });
            return;
        }
        const a = command.args;
        const updates: CliUpdateUser = {};
        if (a['name']) updates.name = String(a['name']);
        if (a['email']) updates.email = String(a['email']);
        if (a['home']) updates.homeDir = String(a['home']);
        if (a['disable']) updates.disabled = true;
        if (a['enable']) updates.disabled = false;

        let groups = listArg(a['groups']) ?? [...user.groups];
        const add = listArg(a['add-groups'] ?? a['a']) ?? [];
        const remove = (listArg(a['remove-groups'] ?? a['r']) ?? []).map((g) => g.toLowerCase());
        groups = [...groups, ...add.filter((g) => !groups.some((x) => x.toLowerCase() === g.toLowerCase()))];
        groups = groups.filter((g) => !remove.includes(g.toLowerCase()));
        if (a['groups'] !== undefined || add.length || remove.length) updates.groups = groups;

        if (Object.keys(updates).length === 0) {
            context.writer.writeError('usermod: no changes specified (see help usermod)');
            context.process.exit(-1, { silent: true });
            return;
        }
        const updated = await users.updateUser(user.id, updates);
        context.writer.writeSuccess(`User '${updated.name}' updated`);
    }
}
