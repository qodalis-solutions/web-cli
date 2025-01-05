import { Injectable } from '@angular/core';
import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ObjectDescriber,
} from '@qodalis/cli-core';
import * as _ from 'lodash';
import { LIBRARY_VERSION } from '../version';

@Injectable()
export class CliStringCommandProcessor implements ICliCommandProcessor {
    command = 'string';

    description = 'String commands';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors?: ICliCommandProcessor[] | undefined = [];

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🔤',
    };

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
