import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
    CliForegroundColor,
    CliProcessorMetadata,
} from '@qodalis/cli-core';
import { DefaultLibraryAuthor } from '@qodalis/cli-core';
import { hotkeysInfo } from '../../constants';

@Injectable({
    providedIn: 'root',
})
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

        writer.writeln(
            writer.wrapInColor(
                '⌨️  Keyboard Shortcuts:',
                CliForegroundColor.Yellow,
            ),
        );

        hotkeysInfo.forEach((hotkey) => {
            writer.writeln(
                `  ${writer.wrapInColor(
                    hotkey.key.padEnd(12),
                    CliForegroundColor.Yellow,
                )} ${hotkey.description}`,
            );
        });
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Displays all available keyboard shortcuts and hotkeys');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('hotkeys', CliForegroundColor.Cyan)}`);
        writer.writeln();
        writer.writeln('💡 Hotkeys help you navigate and control the terminal faster');
    }
}
