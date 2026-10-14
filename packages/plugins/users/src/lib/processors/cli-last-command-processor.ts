import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliLastCommandProcessor extends CliUsersCommand {
    override command = 'last';
    override description = 'Show recent sign-ins';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['audit:read'] };
    override parameters = [
        { name: 'limit', aliases: ['n'], description: 'Number of entries (default 20)', type: 'number' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['last [user] [-n 20]', 'Recent logins, logouts and failures'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const [user] = words(command);
        const limit = Number(command.args['limit'] ?? command.args['n'] ?? 20);
        const entries = (await usersServices(context).audit.getEntries({ username: user }))
            .filter((e) => ['login', 'logout', 'login_failed'].includes(e.event))
            .slice(0, limit);
        if (!entries.length) {
            context.writer.writeInfo('No login history');
            return;
        }
        context.writer.writeTable(
            ['USER', 'EVENT', 'TIME', 'DETAILS'],
            entries.map((e) => [e.username, e.event, formatTime(e.timestamp), e.details ?? '']),
        );
    }
}
