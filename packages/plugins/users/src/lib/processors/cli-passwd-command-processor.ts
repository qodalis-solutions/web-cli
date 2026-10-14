import { CliProcessCommand, cliHasPermission, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, readNewPassword, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliPasswdCommandProcessor extends CliUsersCommand {
    override command = 'passwd';
    override description = 'Change a password';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    protected override usage: Array<[string, string]> = [
        ['passwd', 'Change your own password (asks for the current one)'],
        ['passwd <user>', "Reset another user's password (requires users:update)"],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users, auth } = usersServices(context);
        const me = context.userSession!;
        const [target] = words(command);
        const user = target ? await firstValueFrom(users.getUser(target)) : me.user;
        if (!user) {
            context.writer.writeError(`passwd: user '${target}' does not exist`);
            context.process.exit(-1, { silent: true });
            return;
        }
        const isSelf = user.id === me.user.id;
        let currentPassword: string | undefined;
        if (isSelf && (me.user.mustChangePassword || !cliHasPermission(me.permissions, 'users:update'))) {
            const entered = await context.reader.readPassword('Current password: ');
            if (entered === null) {
                context.writer.writeError('Aborted');
                return;
            }
            currentPassword = entered;
        }
        const password = await readNewPassword(context, auth);
        if (password === null) return;
        await auth.setPassword(user.id, password, currentPassword);
        context.writer.writeSuccess(`passwd: password updated for ${user.name}`);
    }
}
