import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { requireAdmin } from '../utils/permissions';

export class CliUserdelCommandProcessor implements ICliCommandProcessor {
    command = 'userdel';
    aliases = ['deluser'];
    description = 'Delete a user from the system';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = true;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };
    stateConfiguration: CliStateConfiguration = {
        initialState: {},
        storeName: 'users',
    };
    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'force',
            aliases: ['f'],
            description: 'Skip confirmation prompt',
            type: 'boolean',
            required: false,
        },
    ];

    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        this.sessionService = context.services.get<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!requireAdmin(context)) return;

        const target = command.value as string;
        const user = await firstValueFrom(this.usersStore.getUser(target));

        if (!user) {
            context.writer.writeError(
                `userdel: user '${target}' does not exist`,
            );
            return;
        }

        const session = await firstValueFrom(
            this.sessionService.getUserSession(),
        );
        if (session && session.user.id === user.id) {
            context.writer.writeError(
                'userdel: cannot delete the currently logged-in user',
            );
            return;
        }

        if (!command.args['force'] && !command.args['f']) {
            const confirmed = await context.reader.readConfirm(
                `Delete user '${user.name}'?`,
            );
            if (!confirmed) {
                context.writer.writeln('Cancelled.');
                return;
            }
        }

        await this.usersStore.deleteUser(user.id);
        context.writer.writeSuccess(`userdel: user '${user.name}' deleted`);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Delete a user from the system');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('userdel <username>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('userdel <username> --force', CliForegroundColor.Cyan)}    Skip confirmation`,
        );
    }
}
