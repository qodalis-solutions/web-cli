import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ObjectDescriber,
} from '@qodalis/cli-core';
import * as _ from 'lodash';

@Injectable()
export class CliStringCommandProcessor implements ICliCommandProcessor {
    command = 'string';

    description = 'String commands';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] | undefined = [];

    constructor() {
        this.processors = ObjectDescriber.describe((_ as any).default, {
            filter: ({ args }) => {
                const skip = args.length === 0 || args[0] !== 'string';
                return !skip;
            },
        });
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(
            "Provides string commands using lodash's string functions",
        );
        context.writer.writeln('Documentation: https://lodash.com/docs');
    }
}
