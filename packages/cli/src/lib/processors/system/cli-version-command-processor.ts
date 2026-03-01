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
import { LIBRARY_VERSION } from '../../version';
import { getCliNameArt } from '../../constants';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

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
            writer.wrapInColor(getCliNameArt(context.terminal.cols), CliForegroundColor.Cyan),
        );

        writer.writeln(
            `  ${DIM}CLI${RESET}  ${writer.wrapInColor(`v${LIBRARY_VERSION}`, CliForegroundColor.Green)}    ${DIM}Core${RESET}  ${writer.wrapInColor(`v${CORE_VERSION}`, CliForegroundColor.Green)}`,
        );

        let framework = 'vanilla';
        try {
            framework = context.services.get<string>('cli-framework');
        } catch {
            // no framework registered — standalone usage
        }
        writer.writeln(
            `  ${DIM}Framework${RESET}  ${writer.wrapInColor(framework, CliForegroundColor.Cyan)}`,
        );

        writer.writeln(
            `  ${DIM}Docs${RESET}  ${writer.wrapInColor('https://cli.qodalis.com/docs/', CliForegroundColor.Blue)}`,
        );

        writer.writeln();
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(
            'Prints the current version of the CLI and documentation link',
        );
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('Usage:', CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  ${writer.wrapInColor('version', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln(
            `  ${DIM}Docs${RESET}  ${writer.wrapInColor('https://cli.qodalis.com/docs/', CliForegroundColor.Blue)}`,
        );
    }
}
