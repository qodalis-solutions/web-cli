import { Inject, Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliUserSessionService,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    CliStateConfiguration,
} from '@qodalis/cli-core';

import { firstValueFrom } from 'rxjs';
import {
    ICliUserSessionService_TOKEN,
    ICliUsersStoreService_TOKEN,
} from '../../tokens';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';

@Injectable({
    providedIn: 'root',
})
export class CliSwitchUserCommandProcessor implements ICliCommandProcessor {
    command = 'su';

    description?: string | undefined = 'Switch user';

    allowUnlistedCommands?: boolean | undefined = true;

    parameters?: ICliCommandParameterDescriptor[] | undefined = [
        {
            name: 'reload',
            description: 'Reload the page after switching user',
            type: 'boolean',
            required: false,
            aliases: ['r'],
        },
    ];

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

    constructor(
        @Inject(ICliUserSessionService_TOKEN)
        private readonly userSessionService: ICliUserSessionService,
        @Inject(ICliUsersStoreService_TOKEN)
        private readonly usersStore: ICliUsersStoreService,
    ) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        try {
            const fromUser = context.userSession?.user;

            const toUser = command.value;

            if (!fromUser) {
                context.writer.writeError('Missing user to switch from');
                context.process.exit(-1);
                return;
            }

            if (!toUser) {
                context.writer.writeError('Missing user to switch to');
                context.process.exit(-1);
                return;
            }

            context.spinner?.show();

            const user = await firstValueFrom(this.usersStore.getUser(toUser));

            if (!user) {
                context.writer.writeError(`User ${toUser} not found`);

                context.spinner?.hide();
                context.process.exit(-1);
                return;
            }

            if (user.id === fromUser.id) {
                context.writer.writeError('Already on the user');
                context.spinner?.hide();
                context.process.exit(-1);
                return;
            }

            await this.userSessionService.setUserSession({
                user,
            });

            context.spinner?.hide();

            context.writer.writeSuccess(
                `Switch to ${context.writer.wrapInColor(toUser, CliForegroundColor.Cyan)} was successfully`,
            );

            const reload =
                command.args['reload'] ||
                command.args['r'] ||
                context.options?.usersModule?.reloadPageOnUserChange === true;

            if (reload) {
                context.writer.writeln('Reloading the page in 3 seconds...');
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            }
        } catch (e) {
            console.error(e);
            context.spinner?.hide();
            context.writer.writeError('Failed to switch user');

            context.process.exit(-1);
            return;
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Switch user command');
        context.writer.writeln('Usage: su <user email>');
        context.writer.writeln('Example: su user@domain.com');
    }
}
