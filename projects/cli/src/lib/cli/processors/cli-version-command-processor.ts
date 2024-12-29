import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
} from '@qodalis/cli-core';

import { CliVersion } from '../..';
import { DefaultLibraryAuthor } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class CliVersionCommandProcessor implements ICliCommandProcessor {
    command = 'version';

    description?: string | undefined = 'Prints the version information';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln(`CLI Version: ${CliVersion}`);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Prints the current version of the CLI');
    }
}
