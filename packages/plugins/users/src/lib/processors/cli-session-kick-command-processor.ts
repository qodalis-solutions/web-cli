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

export class CliSessionKickCommandProcessor implements ICliCommandProcessor {
    command = 'session-kick';

    description = 'Force-logout a session by ID (server mode)';

    valueRequired = true;

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
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const sessionId = command.value?.trim();

        if (!sessionId) {
            context.writer.writeError('Usage: session-kick <session-id>');
            return;
        }

        try {
            await context.http.delete(
                `${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`,
                { headers: this.getHeaders() },
            );
            context.writer.writeSuccess(`Session ${sessionId} terminated`);
        } catch (e: any) {
            context.writer.writeError(
                e.message || `Failed to terminate session ${sessionId}`,
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Force-logout a session by its ID.');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('session-kick <session-id>', CliForegroundColor.Cyan)}    Terminate a session`,
        );
    }
}
