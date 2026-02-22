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
        context.writer.writeln(
            context.writer.wrapInColor(
                'Available hotkeys:',
                CliForegroundColor.Yellow,
            ),
        );

        hotkeysInfo.forEach((hotkey) => {
            context.writer.writeln(
                `- ${context.writer.wrapInColor(
                    hotkey.key,
                    CliForegroundColor.Yellow,
                )} - ${hotkey.description}`,
            );
        });
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(
            this.description || 'Displays the hotkeys information',
        );
    }
}
