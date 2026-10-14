import {
    ICliCommandProcessor,
    ICliCommandAuthor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';

export class CliSessionsCommandProcessor implements ICliCommandProcessor {
    command = 'sessions';

    description = 'List active user sessions (server mode)';

    author?: ICliCommandAuthor = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    constructor(
        private readonly baseUrl: string,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        try {
            const sessions = await context.http.get<any[]>(
                `${this.baseUrl}/sessions`,
                { headers: this.getHeaders() },
            );

            if (sessions.length === 0) {
                context.writer.writeInfo('No active sessions');
                return;
            }

            const rows = sessions.map((s) => ({
                ID: s.id || '-',
                USER: s.user?.name || s.userId || '-',
                'LOGIN TIME': new Date(s.loginTime).toLocaleString(),
                'LAST ACTIVITY': new Date(s.lastActivity).toLocaleString(),
            }));

            context.writer.writeObjectsAsTable(rows);
        } catch (e: any) {
            context.writer.writeError(e.message || 'Failed to list sessions');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('List all active user sessions on the server.');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('sessions', CliForegroundColor.Cyan)}    List all active sessions`,
        );
    }
}
