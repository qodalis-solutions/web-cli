import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, formatTime, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliAuditCommandProcessor extends CliUsersCommand {
    override command = 'audit';
    override description = 'Show or clear the security audit log';
    override acceptsRawInput = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requiredPermissions: ['audit:read'] };
    override parameters = [
        { name: 'user', aliases: ['u'], description: 'Only entries for this user', type: 'string' as const, required: false },
        { name: 'event', aliases: ['e'], description: 'Only this event (e.g. user_deleted)', type: 'string' as const, required: false },
        { name: 'limit', aliases: ['n'], description: 'Number of entries (default 50)', type: 'number' as const, required: false },
    ];
    protected override usage: Array<[string, string]> = [
        ['audit [--user=x] [--event=y] [-n 50]', 'Newest entries first'],
        ['audit clear', 'Clear the log (requires audit:clear)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { audit } = usersServices(context);
        const [sub] = words(command);
        if (sub === 'clear') {
            const ok = await context.reader.readConfirm('Clear the audit log?', false);
            if (!ok) return;
            await audit.clear();
            context.writer.writeSuccess('Audit log cleared');
            return;
        }
        const a = command.args;
        const entries = await audit.getEntries({
            username: a['user'] ?? a['u'],
            event: a['event'] ?? a['e'],
            limit: Number(a['limit'] ?? a['n'] ?? 50),
        });
        if (!entries.length) {
            context.writer.writeInfo('No audit entries');
            return;
        }
        context.writer.writeTable(
            ['TIME', 'EVENT', 'USER', 'BY', 'DETAILS'],
            entries.map((e) => [formatTime(e.timestamp), e.event, e.username, e.actor ?? '', e.details ?? '']),
        );
    }
}
