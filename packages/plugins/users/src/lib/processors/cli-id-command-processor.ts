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

export class CliIdCommandProcessor implements ICliCommandProcessor {
    command = 'id';
    description = 'Display user identity information';
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
                context.writer.writeError(`id: '${targetName}': no such user`);
                return;
            }
            user = found;
        }

        if (!user) {
            context.writer.writeError('id: no user session');
            return;
        }

        const groups =
            user.groups.length > 0 ? user.groups.join(',') : '(none)';
        context.writer.writeln(
            `uid=${user.id} name=${user.name} groups=${groups}`,
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Display user identity information');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('id', CliForegroundColor.Cyan)}                    Show current user`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('id <username>', CliForegroundColor.Cyan)}          Show specific user`,
        );
    }
}
