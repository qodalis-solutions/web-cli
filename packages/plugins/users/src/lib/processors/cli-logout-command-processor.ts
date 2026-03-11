import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliAuthService,
    ICliAuthService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';

export class CliLogoutCommandProcessor implements ICliCommandProcessor {
    command = 'logout';
    aliases = ['exit-session'];
    description = 'End the current user session';
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

    private authService!: ICliAuthService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const currentUser = context.userSession?.user?.name;

        if (!currentUser || currentUser === 'root') {
            context.writer.writeError(
                'logout: cannot logout from root session',
            );
            return;
        }

        await this.authService.logout();
        context.writer.writeln(
            `Logged out ${currentUser}. Session restored to root.`,
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('End the current user session');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('logout', CliForegroundColor.Cyan)}`,
        );
    }
}
