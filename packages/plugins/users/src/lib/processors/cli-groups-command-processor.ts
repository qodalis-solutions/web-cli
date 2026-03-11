import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliUsersStoreService,
    ICliUsersStoreService_TOKEN,
    DefaultLibraryAuthor,
    CliStateConfiguration,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

export class CliGroupsCommandProcessor implements ICliCommandProcessor {
    command = 'groups';
    description = 'Show group memberships for a user';
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

    private usersStore!: ICliUsersStoreService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        let user = context.userSession?.user;

        const targetName = command.value as string;
        if (targetName) {
            const found = await firstValueFrom(
                this.usersStore.getUser(targetName),
            );
            if (!found) {
                context.writer.writeError(
                    `groups: '${targetName}': no such user`,
                );
                return;
            }
            user = found;
        }

        if (!user) {
            context.writer.writeError('groups: no user session');
            return;
        }

        const groups =
            user.groups.length > 0 ? user.groups.join(' ') : '(none)';
        context.writer.writeln(`${user.name} : ${groups}`);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Show group memberships for a user');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('groups', CliForegroundColor.Cyan)}                Show current user groups`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('groups <username>', CliForegroundColor.Cyan)}      Show specific user groups`,
        );
    }
}
