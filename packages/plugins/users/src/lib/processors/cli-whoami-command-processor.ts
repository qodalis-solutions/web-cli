import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, formatTime } from './base';

export class CliWhoamiCommandProcessor extends CliUsersCommand {
    override command = 'whoami';
    override aliases = ['me'];
    override description = 'Display the signed-in user';
    override parameters = [
        { name: 'info', aliases: ['i'], description: 'Show details, groups and permissions', type: 'boolean' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['whoami', 'Show the signed-in user'],
        ['whoami --info', 'Show details, groups (roles) and effective permissions'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const session = context.userSession;
        if (!session) {
            context.writer.writeln('Not logged in');
            return;
        }
        const user = session.user;
        if (!(command.args['info'] || command.args['i'])) {
            context.writer.writeln(`${user.name} (${user.email})`);
            return;
        }
        context.writer.writeKeyValue({
            Name: user.name,
            Email: user.email,
            Groups: user.groups.join(', ') || '(none)',
            Permissions: (session.permissions ?? []).join(', ') || '(none)',
            Home: user.homeDir || '(not set)',
            Created: formatTime(user.createdAt),
            'Signed in': formatTime(session.loginTime),
            'Last login': formatTime(user.lastLoginAt),
        });
    }
}
