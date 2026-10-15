import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliPermsCommandProcessor extends CliUsersCommand {
    override command = 'perms';
    override aliases = ['permissions'];
    override description = 'Show effective permissions, or every permission modules declare';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    override parameters = [
        { name: 'list', aliases: ['l'], description: 'List permissions declared by modules', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['perms', 'Your effective permissions and where they come from'],
        ['perms <user>', "Another user's permissions (requires users:read)"],
        ['perms --list', 'All permissions declared by loaded modules'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, groups, registry } = usersServices(context);
        if (command.args['list'] || command.args['l']) {
            const defs = registry?.list() ?? [];
            if (!defs.length) {
                context.writer.writeInfo('No permissions declared');
                return;
            }
            context.writer.writeTable(
                ['PERMISSION', 'MODULE', 'DESCRIPTION'],
                defs.map((d) => [d.name, d.module ?? '-', d.description ?? '']),
            );
            return;
        }
        const [target] = words(command);
        const user = target ? await firstValueFrom(users.getUser(target)) : context.userSession!.user;
        if (!user) {
            context.writer.writeError(`perms: '${target}': no such user`);
            context.process.exit(-1, { silent: true });
            return;
        }
        const all = await firstValueFrom(groups.getGroups());
        const rows = user.groups.map((name) => {
            const g = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
            return [name, (g?.permissions ?? []).join(', ') || '-'];
        });
        context.writer.writeTable(['GROUP', 'GRANTS'], rows);
        const effective = target
            ? (await users.getPermissions?.(user.id))?.permissions ?? []
            : context.userSession!.permissions ?? [];
        context.writer.writeln(`Effective: ${effective.join(', ') || '(none)'}`);
    }
}
