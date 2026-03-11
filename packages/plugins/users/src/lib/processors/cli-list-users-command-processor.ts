import {
    CliForegroundColor,
    CliIcon,
    CliProcessCommand,
    CliProcessorMetadata,
    CliStateConfiguration,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUsersStoreService,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { ICliUsersStoreService_TOKEN } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

export class CliListUsersCommandProcessor implements ICliCommandProcessor {
    command = 'listusers';

    aliases = ['users'];

    description?: string | undefined = 'List all users';

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

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'query',
            description: 'The query to filter the users',
            type: 'string',
            required: false,
        },
        {
            name: 'skip',
            description: 'The number of users to skip',
            type: 'number',
            required: false,
        },
        {
            name: 'take',
            description: 'The maximum number of users to return',
            type: 'number',
            required: false,
        },
    ];

    private usersStore!: ICliUsersStoreService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
    }

    async processCommand(
        command: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ): Promise<void> {
        const users = await firstValueFrom(
            this.usersStore.getUsers({
                query: command.args['query'],
                skip: command.args['skip'],
                take: command.args['take'],
            }),
        );

        if (users.length === 0) {
            writer.writeln('No users found');
            return;
        }

        const displayUsers = users.map((u) => ({
            name: u.name,
            email: u.email,
            groups: u.groups.join(', ') || '(none)',
            disabled: u.disabled ? 'yes' : 'no',
        }));

        writer.writeln('Users:');
        writer.writeObjectsAsTable(displayUsers);
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('List all users in the system');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(
            `  ${writer.wrapInColor('listusers', CliForegroundColor.Cyan)}                              List all users`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('listusers --query=<search>', CliForegroundColor.Cyan)}              Filter users by name/email`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('listusers --skip=5 --take=10', CliForegroundColor.Cyan)}            Paginate results`,
        );
    }
}
