import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    CliForegroundColor,
    CliProcessorMetadata,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { hotkeysInfo } from '../../constants';

const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export class CliHotKeysCommandProcessor implements ICliCommandProcessor {
    command = 'hotkeys';

    aliases = ['shortcuts', 'keys'];

    description = 'Displays the hotkeys information';

    processors?: ICliCommandProcessor[] | undefined = [];

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: '🔥',
        module: 'system',
    };

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const { writer } = context;

        hotkeysInfo.forEach((hotkey) => {
            writer.writeln(
                `    ${writer.wrapInColor(hotkey.key.padEnd(12), CliForegroundColor.Cyan)} ${DIM}${hotkey.description}${RESET}`,
            );
        });
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Displays all available keyboard shortcuts and hotkeys');
        writer.writeln();
        writer.writeln(
            writer.wrapInColor('Usage:', CliForegroundColor.Yellow),
        );
        writer.writeln(
            `  ${writer.wrapInColor('hotkeys', CliForegroundColor.Cyan)}`,
        );
    }
}
