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
import { CliCommandHistoryService } from '../../services';

@Injectable({
    providedIn: 'root',
})
export class CliHistoryCommandProcessor implements ICliCommandProcessor {
    command = 'history';

    aliases = ['hist'];

    description?: string | undefined =
        'Prints the command history of the current session';

    processors?: ICliCommandProcessor[] | undefined = [];

    author?: ICliCommandAuthor | undefined = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata | undefined = {
        sealed: true,
        icon: CliIcon.Code,
        module: 'system',
    };

    constructor(
        private readonly commandHistoryService: CliCommandHistoryService,
    ) {
        this.processors?.push({
            command: 'list',
            description: this.description,
            processCommand: this.processCommand.bind(this),
            writeDescription: this.writeDescription.bind(this),
        });

        this.processors?.push({
            command: 'clear',
            description: 'Clears the command history',
            processCommand: async (
                _: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.commandHistoryService.clearHistory();
                context.writer.writeInfo('Command history cleared');
            },
            writeDescription: (context: ICliExecutionContext) => {
                context.writer.writeln('Clears the command history');
            },
        });
    }

    async processCommand(
        _: CliProcessCommand,
        { writer }: ICliExecutionContext,
    ): Promise<void> {
        const history = this.commandHistoryService.getHistory();

        if (history.length === 0) {
            writer.writeInfo('📜 No command history yet');
            return;
        } else {
            writer.writeln(
                writer.wrapInColor('📜 Command history:', CliForegroundColor.Yellow),
            );
            history.forEach((command, index) => {
                writer.writeln(
                    `  ${writer.wrapInColor(String(index + 1).padStart(3), CliForegroundColor.Yellow)}  ${command}`,
                );
            });
        }
    }

    writeDescription({ writer }: ICliExecutionContext): void {
        writer.writeln('Prints the command history of the current session');
        writer.writeln();
        writer.writeln('📋 Usage:');
        writer.writeln(`  ${writer.wrapInColor('history', CliForegroundColor.Cyan)}                Show command history`);
        writer.writeln(`  ${writer.wrapInColor('history clear', CliForegroundColor.Cyan)}          Clear all history`);
        writer.writeln();
        writer.writeln(`💡 Use ${writer.wrapInColor('↑/↓', CliForegroundColor.Yellow)} arrow keys to navigate through history`);
    }
}
