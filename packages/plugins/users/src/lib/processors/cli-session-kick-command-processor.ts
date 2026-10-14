import { CliProcessCommand, ICliExecutionContext } from '@qodalis/cli-core';
import { CliUsersCommand, usersServices, words, USERS_METADATA } from './base';
import { CliProcessorMetadata } from '@qodalis/cli-core';

export class CliSessionKickCommandProcessor extends CliUsersCommand {
    override command = 'session-kick';
    override description = 'Terminate a session';
    override acceptsRawInput = true;
    override valueRequired = true;
    override metadata: CliProcessorMetadata = { ...USERS_METADATA, requireAuth: true };
    protected override usage: Array<[string, string]> = [
        ['session-kick <session-id>', 'Terminate a session (your own, or any with sessions:revoke)'],
    ];

    override async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const [id] = words(command);
        await usersServices(context).sessions.revoke(id, 'terminated by an administrator');
        context.writer.writeSuccess(`Session ${id} terminated`);
    }
}
