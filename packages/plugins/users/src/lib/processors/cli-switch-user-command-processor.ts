import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words } from './base';
import { promptRequiredPasswordChange } from '../module/password-change';

export class CliSwitchUserCommandProcessor extends CliUsersCommand {
    override command = 'su';
    override description = 'Switch to another user';
    override acceptsRawInput = true;
    override valueRequired = true;
    protected override usage: Array<[string, string]> = [['su <user>', 'Switch user (asks for the target password unless passwordless)']];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { auth } = usersServices(context);
        const [username] = words(command);
        let password: string | undefined;
        if (!auth.passwordless) {
            const entered = await context.reader.readPassword('Password: ');
            if (entered === null) {
                context.writer.writeError('Aborted');
                return;
            }
            password = entered;
        }
        const session = auth.switchUser
            ? await auth.switchUser(username, password)
            : await auth.login(username, password);
        context.writer.writeSuccess(`Switched to ${session.user.name}`);
        if (session.user.mustChangePassword) {
            await promptRequiredPasswordChange(context, auth, session.user.id, password);
        }
    }
}
