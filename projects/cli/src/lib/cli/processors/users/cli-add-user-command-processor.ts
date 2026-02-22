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

@Injectable({
    providedIn: 'root',
})
export class CliAddUserCommandProcessor implements ICliCommandProcessor {
    command = 'adduser';

    aliases = ['useradd'];

    description?: string | undefined = 'Add a new user';

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

    allowUnlistedCommands?: boolean | undefined = true;

    valueRequired?: boolean | undefined = true;

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'email',
            description: 'The email of the user',
            required: true,
            type: 'email',
            validator: (value: string) => {
                //validate email format
                const emailRegex =
                    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(value)) {
                    return {
                        valid: false,
                        message: 'Invalid email format',
                    };
                }

                return {
                    valid: true,
                };
            },
        },
        {
            name: 'groups',
            description: 'The groups the user belongs to, separated by commas',
            type: 'string',
            required: false,
        },
    ];

    constructor(
        @Inject(ICliUsersStoreService_TOKEN)
        private readonly usersStore: ICliUsersStoreService,
    ) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const name: string = command.value as string;
        const email: string = command.args['email'];
        const groups: string[] = command.args['groups']?.split(',') || [];

        try {
            await this.usersStore.createUser({
                name,
                email,
                groups,
            });

            context.writer.writeInfo('User created successfully');
        } catch (e) {
            console.error(e);
            context.writer.writeError(
                e?.toString() || 'An error occurred while creating the user',
            );
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Add a new user to the system');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('adduser <name> --email=<email> [--groups=<groups>]', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('📝 Examples:');
        writer.writeln(`  adduser John --email=john@example.com                   ${writer.wrapInColor('# Basic', CliForegroundColor.Green)}`);
        writer.writeln(`  adduser Jane --email=jane@test.com --groups=admin,dev   ${writer.wrapInColor('# With groups', CliForegroundColor.Green)}`);
    }
}
