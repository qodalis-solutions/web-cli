import { CliProcessCommand, cliHasPermission, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, usersServices, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliWhoCommandProcessor extends CliUsersCommand {
    override command = 'w';
    override aliases = ['who'];
    override description = 'Show who is signed in';
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    protected override usage: Array<[string, string]> = [
        ['w', 'Signed-in sessions (all with sessions:read, otherwise yours)'],
    ];

    override async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const me = context.userSession!;
        if (!cliHasPermission(me.permissions, 'sessions:read')) {
            context.writer.writeTable(
                ['USER', 'LOGIN', 'IDLE SINCE'],
                [[me.user.name, formatTime(me.loginTime), formatTime(me.lastActivity)]],
            );
            return;
        }
        const sessions = await usersServices(context).sessions.list();
        context.writer.writeTable(
            ['USER', 'LOGIN', 'IDLE SINCE', ''],
            sessions.map((s) => [s.userName, formatTime(s.createdAt), formatTime(s.lastActivity), s.current ? '(you)' : '']),
        );
    }
}
