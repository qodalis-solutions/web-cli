import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';

export class CliWhoCommandProcessor implements ICliCommandProcessor {
    command = 'w';
    aliases = ['who'];
    description = 'Show who is logged in and session info';
    author = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };
    stateConfiguration: CliStateConfiguration = {
        initialState: {},
        storeName: 'users',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session = context.userSession;

        if (!session) {
            context.writer.writeln('No active session.');
            return;
        }

        const loginTime = new Date(session.loginTime).toLocaleString();
        const lastActivity = new Date(session.lastActivity).toLocaleString();
        const idle = this.formatDuration(Date.now() - session.lastActivity);

        context.writer.writeObjectsAsTable([
            {
                USER: session.user.name,
                TTY: 'web',
                'LOGIN@': loginTime,
                IDLE: idle,
            },
        ]);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Show who is logged in and session info');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('w', CliForegroundColor.Cyan)}     Show current session`,
        );
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h${minutes % 60}m`;
    }
}
