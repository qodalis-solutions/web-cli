import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { CliUsersCommand, formatTime, usersServices, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliListUsersCommandProcessor extends CliUsersCommand {
    override command = 'listusers';
    override aliases = ['users'];
    override description = 'List users';
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['users:read'] };
    override parameters = [
        { name: 'query', aliases: ['q'], description: 'Filter by name or email', type: 'string' as const, required: false },
        { name: 'skip', description: 'Skip N users', type: 'number' as const, required: false },
        { name: 'take', description: 'Show at most N users', type: 'number' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['listusers', 'All users'],
        ['listusers --query=jo --skip=0 --take=10', 'Filter and page'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { users } = usersServices(context);
        const a = command.args;
        const list = await firstValueFrom(
            users.getUsers({
                query: a['query'] ?? a['q'],
                skip: a['skip'] !== undefined ? Number(a['skip']) : undefined,
                take: a['take'] !== undefined ? Number(a['take']) : undefined,
            }),
        );
        if (!list.length) {
            context.writer.writeInfo('No users found');
            return;
        }
        context.writer.writeTable(
            ['NAME', 'EMAIL', 'GROUPS', 'STATUS', 'LAST LOGIN'],
            list.map((u) => [u.name, u.email, u.groups.join(',') || '-', u.disabled ? 'disabled' : 'active', formatTime(u.lastLoginAt)]),
        );
    }
}
