import { Inject, Injectable } from '@angular/core';
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
import { ICliUsersStoreService_TOKEN } from '../../tokens';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
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

    constructor(
        @Inject(ICliUsersStoreService_TOKEN)
        private readonly usersStore: ICliUsersStoreService,
    ) {}

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

        writer.writeln('Users:');
        writer.writeObjectsAsTable(users);
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('List all users in the system');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('listusers', CliForegroundColor.Cyan)}                              List all users`);
        writer.writeln(`  ${writer.wrapInColor('listusers --query=<search>', CliForegroundColor.Cyan)}              Filter users by name/email`);
        writer.writeln(`  ${writer.wrapInColor('listusers --skip=5 --take=10', CliForegroundColor.Cyan)}            Paginate results`);
    }
}
