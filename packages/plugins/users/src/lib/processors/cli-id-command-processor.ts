import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliIdCommandProcessor extends CliUsersCommand {
    override command = 'id';
    override description = 'Print user identity, groups and permissions';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    protected override usage: Array<[string, string]> = [
        ['id', 'Identity of the signed-in user'],
        ['id <user>', 'Identity of another user (requires users:read)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users } = usersServices(context);
        const [target] = words(command);
        let user = context.userSession!.user;
        let permissions = context.userSession!.permissions ?? [];
        if (target) {
            const found = await firstValueFrom(users.getUser(target));
            if (!found) {
                context.writer.writeError(`id: '${target}': no such user`);
                context.process.exit(-1, { silent: true });
                return;
            }
            user = found;
            permissions = (await users.getPermissions?.(found.id))?.permissions ?? [];
        }
        context.writer.writeln(
            `uid=${user.name} gid=${user.groups[0] ?? '-'} groups=${user.groups.join(',') || '-'} permissions=${permissions.join(',') || '-'}`,
        );
    }
}
