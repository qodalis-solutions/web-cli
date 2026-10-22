import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words } from './base';
import { promptRequiredPasswordChange } from '../module/password-change';

export class CliSwitchUserCommandProcessor extends CliUsersCommand {
    override command = 'su';
    override description = 'Switch to another user';
    override acceptsRawInput = true;
    override valueRequired = true;
    override parameters = [
        { name: 'command', aliases: ['c'], description: 'Run one command as the user, then switch back', type: 'string' as const, required: false },
        { name: 'login', aliases: ['l'], description: "Start in the user's home directory (always the case)", type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['su <user>', 'Switch user (asks for the target password unless passwordless)'],
        ['su - <user>', 'Same (the home directory always follows the user)'],
        ['su -c "<command>" <user>', 'Run one command as <user>, then switch back'],
        ['exit', 'Leave the su session and return to the previous user'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { auth } = usersServices(context);
        // `-` is the traditional spelling of `--login`
        const [username] = words(command).filter((w) => w !== '-');
        if (!username) {
            context.writer.writeError('su: user name required');
            context.process.exit(-1, { silent: true });
            return;
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
        const depth = auth.depth ?? 0;
        const session = auth.switchUser
            ? await auth.switchUser(username, password)
            : await auth.login(username, password);

        const run = command.args['command'] ?? command.args['c'];
        if (typeof run !== 'string' || !run.trim()) {
            context.writer.writeSuccess(`Switched to ${session.user.name}. Use 'exit' to return.`);
        }
        if (session.user.mustChangePassword) {
            await promptRequiredPasswordChange(context, auth, session.user.id, password);
        }
        if (typeof run === 'string' && run.trim()) {
            let status = 0;
            try {
                await context.executor.executeCommand(run, context);
                status = (context.executor as { exitStatus?: number }).exitStatus ?? 0;
            } finally {
                // Back to the caller, unless the command already left the session
                if ((auth.depth ?? 0) > depth) await auth.logout();
            }
            // Like `su -c`: exit with the command's status
            if (status !== 0) context.process.exit(status, { silent: true });
        }
    }
}
