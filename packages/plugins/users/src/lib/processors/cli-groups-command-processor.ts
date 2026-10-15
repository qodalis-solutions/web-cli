import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliGroupsCommandProcessor extends CliUsersCommand {
    override command = 'groups';
    override description = 'Show group (role) membership, or list all groups';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    override parameters = [
        { name: 'all', aliases: ['a'], description: 'List every group with its permissions', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['groups', 'Groups of the signed-in user'],
        ['groups <user>', 'Groups of another user'],
        ['groups --all', 'All groups with permissions and member counts'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, groups } = usersServices(context);
        if (command.args['all'] || command.args['a']) {
            const all = await firstValueFrom(groups.getGroups());
            const everyone = await firstValueFrom(users.getUsers()).catch(() => undefined);
            context.writer.writeTable(
                ['GROUP', 'PERMISSIONS', 'MEMBERS', 'DESCRIPTION'],
                all.map((g) => [
                    g.name + (g.builtIn ? ' *' : ''),
                    (g.permissions ?? []).join(', ') || '-',
                    everyone
                        ? String(everyone.filter((u) => u.groups.some((n) => n.toLowerCase() === g.name.toLowerCase())).length)
                        : '?',
                    g.description ?? '',
                ]),
            );
            context.writer.writeln('* built-in');
            return;
        }
        const [target] = words(command);
        const user = target ? await firstValueFrom(users.getUser(target)) : context.userSession!.user;
        if (!user) {
            context.writer.writeError(`groups: '${target}': no such user`);
            context.process.exit(-1, { silent: true });
            return;
        }
        context.writer.writeln(user.groups.join(' ') || '(none)');
    }
}
