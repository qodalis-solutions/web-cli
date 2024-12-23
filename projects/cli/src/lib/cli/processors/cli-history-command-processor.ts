import { Injectable } from '@angular/core';
import {
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandProcessor,
} from '../models';
import { CliBaseProcessor } from './cli-base-processor';
import { CommandHistoryService } from '../services/command-history.service';

@Injectable({
    providedIn: 'root',
})
export class CliHistoryCommandProcessor
    extends CliBaseProcessor
    implements ICliCommandProcessor
{
    command = 'history';

    description?: string | undefined =
        'Prints the command history of the current session';

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor(private readonly commandHistoryService: CommandHistoryService) {
        super();

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
                this.commandHistoryService.clearHistory();
                context.writer.writeln('Command history cleared');
            },
            writeDescription: (context: ICliExecutionContext) => {
                context.writer.writeln('Clears the command history');
            },
        });
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const history = this.commandHistoryService.getHistory();

        if (history.length === 0) {
            context.writer.writeln('No history available');
            return;
        } else {
            context.writer.writeln('Command history:');
            history.forEach((command, index) => {
                context.writer.writeln(`${index + 1}. ${command}`);
            });
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(
            'Prints the command history of the current session',
        );
    }
}
