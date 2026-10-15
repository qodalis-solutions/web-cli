import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, usersServices, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliSessionsCommandProcessor extends CliUsersCommand {
    override command = 'sessions';
    override description = 'List active sessions';
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['sessions:read'] };
    protected override usage: Array<[string, string]> = [['sessions', 'List active sessions (use the ID with session-kick)']];

    override async processCommand(_command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const sessions = await usersServices(context).sessions.list();
        if (!sessions.length) {
            context.writer.writeInfo('No active sessions');
            return;
        }
        context.writer.writeTable(
            ['ID', 'USER', 'LOGIN TIME', 'LAST ACTIVITY', 'EXPIRES', ''],
            sessions.map((s) => [
                s.id,
                s.userName,
                formatTime(s.createdAt),
                formatTime(s.lastActivity),
                formatTime(s.expiresAt),
                s.current ? '(current)' : '',
            ]),
        );
    }
}
