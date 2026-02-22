import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    LIBRARY_VERSION as CORE_VERSION,
} from '@qodalis/cli-core';

import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../../../version';
import { getCliNameArt } from '../../constants';

@Injectable({
    providedIn: 'root',
})
export class CliVersionCommandProcessor implements ICliCommandProcessor {
    command = 'version';

    aliases = ['ver'];

    description?: string | undefined = 'Prints the version information';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Settings,
        module: 'system',
    };

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        writer.writeln(
            `⚙️  Qodalis CLI ${writer.wrapInColor(`v${LIBRARY_VERSION}`, CliForegroundColor.Green)}`,
        );

        writer.writeln(
            `📦  Core ${writer.wrapInColor(`v${CORE_VERSION}`, CliForegroundColor.Green)}`,
        );

        writer.writeln(getCliNameArt(context.terminal.cols));

        writer.writeln(
            `📖 ${writer.wrapInColor('Documentation:', CliForegroundColor.Green)} https://cli-docs.qodalis.com/`,
        );

        writer.writeln();
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Prints the current version of the CLI and documentation link');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('version', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln(`📖 Documentation: ${writer.wrapInColor('https://cli-docs.qodalis.com/', CliForegroundColor.Blue)}`);
    }
}
