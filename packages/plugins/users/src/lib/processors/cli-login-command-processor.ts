import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words } from './base';
import { promptRequiredPasswordChange } from '../module/password-change';

export class CliLoginCommandProcessor extends CliUsersCommand {
    override command = 'login';
    override description = 'Sign in';
    override acceptsRawInput = true;
    protected override usage: Array<[string, string]> = [
        ['login', 'Prompt for username and password'],
        ['login <user>', 'Sign in as <user> (by name or email)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { auth } = usersServices(context);
        if (auth.hostManaged) {
            // The host application owns sign-in: pick up its current session
            const session = await auth.login('');
            context.writer.writeSuccess(`Logged in as ${session.user.name}`);
            return;
        }
        let [username] = words(command);
        if (!username) {
            const entered = await context.reader.readLine('Username: ');
            if (!entered?.trim()) {
                context.writer.writeError('login: username required');
                context.process.exit(-1, { silent: true });
                return;
            }
            username = entered.trim();
        }
        let password: string | undefined;
        if (!auth.passwordless) {
            const entered = await context.reader.readPassword('Password: ');
            if (entered === null) {
                context.writer.writeError('Aborted');
                return;
            }
            password = entered;
        }
        const session = await auth.login(username, password);
        context.writer.writeSuccess(`Logged in as ${session.user.name}`);
        if (session.user.mustChangePassword) {
            await promptRequiredPasswordChange(context, auth, session.user.id, password);
        }
    }
}
