import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliAuthService,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    CliStateConfiguration,
    ICliAuthService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';

import { firstValueFrom } from 'rxjs';
import {
    CliUsersModuleConfig,
    CliUsersModuleConfig_TOKEN,
} from '../models/users-module-config';

export class CliSwitchUserCommandProcessor implements ICliCommandProcessor {
    command = 'su';

    aliases = ['switch-user'];

    description?: string | undefined = 'Switch user';

    acceptsRawInput?: boolean | undefined = true;

    parameters?: ICliCommandParameterDescriptor[] | undefined = [];

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {},
        storeName: 'users',
    };

    valueRequired = true;

    private userSessionService!: ICliUserSessionService;
    private usersStore!: ICliUsersStoreService;
    private authService!: ICliAuthService;
    private moduleConfig!: CliUsersModuleConfig;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.userSessionService = context.services.get<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        this.authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
        this.moduleConfig =
            context.services.get<CliUsersModuleConfig>(
                CliUsersModuleConfig_TOKEN,
            ) || {};
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fromUser = context.userSession?.user;
        const toUser = command.value;

        if (!fromUser) {
            context.writer.writeError('Missing user to switch from');
            return;
        }

        if (!toUser) {
            context.writer.writeError('Missing user to switch to');
            return;
        }

        const user = await firstValueFrom(this.usersStore.getUser(toUser));

        if (!user) {
            context.writer.writeError(`su: Unknown id: ${toUser}`);
            return;
        }

        if (user.id === fromUser.id) {
            context.writer.writeError('Already on the user');
            return;
        }

        if (user.disabled) {
            context.writer.writeError('su: Account is disabled');
            return;
        }

        // Prompt for password when requirePassword is enabled
        if (this.moduleConfig.requirePassword) {
            const password = await context.reader.readPassword('Password: ');

            if (password === null) {
                context.writer.writeError('Aborted');
                return;
            }

            const valid = await this.authService.verifyPassword(
                user.id,
                password,
            );

            if (!valid) {
                context.writer.writeError('su: Authentication failure');
                return;
            }
        }

        await this.userSessionService.setUserSession({
            user,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        context.writer.writeSuccess(
            `Switched to ${context.writer.wrapInColor(user.name, CliForegroundColor.Cyan)}`,
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Switch to a different user session');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('su <user name or email>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln('Examples:');
        writer.writeln(
            `  su admin@example.com             ${writer.wrapInColor('# Switch to admin', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  su root                          ${writer.wrapInColor('# Switch to root by name', CliForegroundColor.Green)}`,
        );
    }
}
