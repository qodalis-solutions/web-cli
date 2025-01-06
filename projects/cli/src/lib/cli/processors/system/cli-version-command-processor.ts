import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../../../version';
import { CLi_Name_Art } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class CliVersionCommandProcessor implements ICliCommandProcessor {
    command = 'version';

    description?: string | undefined = 'Prints the version information';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Settings,
    };

    async processCommand(
        _: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ): Promise<void> {
        writer.writeln(
            `CLI Version@${writer.wrapInColor(LIBRARY_VERSION, CliForegroundColor.Green)}`,
        );

        writer.writeln(CLi_Name_Art);

        writer.writeln(
            writer.wrapInColor('Documentation: ', CliForegroundColor.Green) +
                'https://cli-docs.qodalis.com/',
        );

        writer.writeln();
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln('Prints the current version of the CLI');
    }
}
