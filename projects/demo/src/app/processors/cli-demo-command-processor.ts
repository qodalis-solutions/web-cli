import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/angular-cli';

@Injectable({
    providedIn: 'root',
})
export class CliDemoCommandProcessor implements ICliCommandProcessor {
    command = 'demo';

    description = 'demo command';

    author?: ICliCommandAuthor | undefined = {
        name: 'demo',
        email: 'demo',
    };

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        this.processors = [
            {
                command: 'demo-subcommand',
                description: 'demo subcommand',
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.writer.writeln('demo subcommand executed');
                },
            },
            {
                command: 'input',
                description: 'Show input',
                allowUnlistedCommands: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    context.writer.writeln('Input: ' + command.value);
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln('demo command executed');
    }

    writeDescription?(context: ICliExecutionContext): void {
        context.writer.writeln('demo command');
    }
}
