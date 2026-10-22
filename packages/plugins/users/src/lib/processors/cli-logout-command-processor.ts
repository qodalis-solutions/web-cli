import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliLogoutCommandProcessor extends CliUsersCommand {
    override command = 'logout';
    // Like a shell: `exit` leaves an `su` session, or the login session
    override aliases = ['exit'];
    override description = 'Sign out';
    // No login guard: `exit` while signed out answers like a shell would, not with 'login required'
    override metadata: CliProcessorMetadata = { ...USERS_METADATA };
    protected override usage: Array<[string, string]> = [
        ['logout', 'End the current session'],
        ['exit', 'Same; after su, returns to the previous user'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { auth } = usersServices(context);
        const name = (auth.current ?? context.userSession)?.user.name;
        if (!name) {
            context.writer.writeError(`${command.command}: not logged in`);
            context.process.exit(1, { silent: true });
            return;
        }
        await auth.logout();
        const resumed = auth.current?.user.name;
        if (resumed) {
            context.writer.writeInfo(`Logged out ${name}. Back to ${resumed}.`);
        } else {
            context.writer.writeInfo(`Logged out ${name}. Use 'login' to sign in again.`);
        }
    }
}
