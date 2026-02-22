import { Inject, Injectable } from '@angular/core';
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
import { ICliUserSessionService_TOKEN } from '../../tokens';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
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
            description: 'Display user information',
            type: 'boolean',
            required: false,
            aliases: ['i'],
        },
    ];

    constructor(
        @Inject(ICliUserSessionService_TOKEN)
        private readonly userSessionService: ICliUserSessionService,
    ) {}

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const user = await firstValueFrom(
            this.userSessionService.getUserSession(),
        );

        if (!user) {
            context.writer.writeln('No user session found');
            return;
        }

        if (command.args['info'] || command.args['i']) {
            context.writer.writeln('User information:');
            context.writer.writeObjectsAsTable([user.user]);
        } else {
            context.writer.writeln(user?.user.email);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Display the current logged-in user information');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('whoami', CliForegroundColor.Cyan)}                 Show current user email`);
        writer.writeln(`  ${writer.wrapInColor('whoami --info', CliForegroundColor.Cyan)}           Show detailed user information`);
    }
}
