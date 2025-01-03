import { Inject, Injectable } from '@angular/core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliUserSessionService,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { ICliUserSessionService_TOKEN } from '../tokens';
import { firstValueFrom } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class CliWhoamiCommandProcessor implements ICliCommandProcessor {
    command = 'whoami';

    description?: string | undefined = 'Display current user information';

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    sealed = true;

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

        context.writer.writeln(user?.user.email);
    }

    writeDescription(context: ICliExecutionContext): void {}
}
