import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliAuthService,
    ICliAuthService_TOKEN,
    ICliUsersStoreService,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService,
    ICliUserSessionService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import {
    CliUsersModuleConfig,
    CliUsersModuleConfig_TOKEN,
} from '../models/users-module-config';

export class CliLoginCommandProcessor implements ICliCommandProcessor {
    command = 'login';
    description = 'Log in as a user';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = false;
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
    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;
    private moduleConfig!: CliUsersModuleConfig;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        this.sessionService = context.services.get<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
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
        let username = command.value as string;

        if (!username) {
            const input = await context.reader.readLine('Username: ');
            if (input === null) return;
            username = input;
        }

        if (!username) {
            context.writer.writeError('login: username required');
            return;
        }

        if (this.moduleConfig.requirePassword) {
            const password = await context.reader.readPassword('Password: ');
            if (password === null) return;

            try {
                const session = await this.authService.login(
                    username,
                    password,
                );
                context.writer.writeSuccess(
                    `Logged in as ${session.user.name}`,
                );
            } catch (e: any) {
                context.writer.writeError(
                    e.message || 'login: Authentication failure',
                );
            }
        } else {
            const user = await firstValueFrom(
                this.usersStore.getUser(username),
            );
            if (!user) {
                context.writer.writeError(`login: Unknown user: ${username}`);
                return;
            }
            if (user.disabled) {
                context.writer.writeError('login: Account is disabled');
                return;
            }
            await this.sessionService.setUserSession({
                user,
                loginTime: Date.now(),
                lastActivity: Date.now(),
            });
            context.writer.writeSuccess(`Logged in as ${user.name}`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Log in with username and password');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('login', CliForegroundColor.Cyan)}                 Prompts for username and password`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('login <username>', CliForegroundColor.Cyan)}       Prompts for password only`,
        );
    }
}
