import { Inject, Injectable } from '@angular/core';
import {
    CliProcessCommand,
    CliProcessorMetadata,
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

    description?: string | undefined = 'List all users';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        module: 'users',
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
        writer.writeObjectArrayTable(users);
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln(this.description!);
        writer.writeln('Usage: listusers');
    }
}
