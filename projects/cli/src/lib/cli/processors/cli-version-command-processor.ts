import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../../version';

@Injectable({
    providedIn: 'root',
})
export class CliVersionCommandProcessor implements ICliCommandProcessor {
    command = 'version';

    description?: string | undefined = 'Prints the version information';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    sealed = true;

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln(`CLI Version: ${LIBRARY_VERSION}`);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Prints the current version of the CLI');
    }
}
