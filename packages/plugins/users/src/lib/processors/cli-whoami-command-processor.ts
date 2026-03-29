import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliCommandAuthor,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { ICliUserSessionService_TOKEN } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

export class CliWhoamiCommandProcessor implements ICliCommandProcessor {
    command = 'whoami';

    aliases = ['me'];

    description?: string | undefined = 'Display current user information';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    stateConfiguration?: CliStateConfiguration | undefined = {
        initialState: {},
        storeName: 'users',
    };

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'info',
            description: 'Display detailed user information',
            type: 'boolean',
            required: false,
            aliases: ['i'],
        },
    ];

    private userSessionService!: ICliUserSessionService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.userSessionService = context.services.getRequired<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session = context.userSession;

        if (!session) {
            context.writer.writeln('No user session found');
            return;
        }

        if (command.args['info'] || command.args['i']) {
            const fullSession = await firstValueFrom(
                this.userSessionService.getUserSession(),
            );

            if (!fullSession) {
                context.writer.writeln('No user session found');
                return;
            }

            const user = fullSession.user;

            context.writer.writeln('User information:');
            context.writer.writeln(`  Name:      ${user.name}`);
            context.writer.writeln(`  Email:     ${user.email}`);
            context.writer.writeln(
                `  Groups:    ${user.groups.join(', ') || '(none)'}`,
            );
            context.writer.writeln(
                `  Home:      ${user.homeDir || '(not set)'}`,
            );
            context.writer.writeln(
                `  Created:   ${new Date(user.createdAt).toLocaleString()}`,
            );
            context.writer.writeln(
                `  Login:     ${new Date(fullSession.loginTime).toLocaleString()}`,
            );
        } else {
            context.writer.writeln(`${session.user.name} (${session.user.email})`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Display the current logged-in user information');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('whoami', CliForegroundColor.Cyan)}                 Show current user email`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('whoami --info', CliForegroundColor.Cyan)}           Show detailed user information`,
        );
    }
}
