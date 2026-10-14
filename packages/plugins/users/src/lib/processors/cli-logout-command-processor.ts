import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliLogoutCommandProcessor extends CliUsersCommand {
    override command = 'logout';
    override description = 'Sign out';
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    protected override usage: Array<[string, string]> = [['logout', 'End the current session']];

    override async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const name = context.userSession!.user.name;
        await usersServices(context).auth.logout();
        context.writer.writeInfo(`Logged out ${name}. Use 'login' to sign in again.`);
    }
}
