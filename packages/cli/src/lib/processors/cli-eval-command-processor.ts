import {
    CliForegroundColor,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliEvalCommandProcessor implements ICliCommandProcessor {
    command = 'eval';
    aliases = ['calc', 'js'];
    description = 'Evaluate a JavaScript expression';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;

    metadata?: CliProcessorMetadata | undefined = {
        icon: '🧮',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!context.options?.allowEval) {
            context.writer.writeError(
                'eval is disabled by default for security. Set allowEval: true in CliOptions to enable it.',
            );
            context.process.exit(1, { silent: true });
            return;
        }

        try {
            const output = eval(command.value ?? '');

            if (Array.isArray(output)) {
                context.writer.writeln('Output:');
                context.writer.writeJson(output);
                return;
            }

            if (typeof output === 'object') {
                context.writer.writeln('Output:');
                context.writer.writeJson(output);
                return;
            }

            context.writer.writeln('Output: ' + output?.toString());
        } catch (e) {
            context.writer.writeError(e!.toString());
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.eval.long_description', this.description));
        writer.writeln(
            t.t('cli.eval.supports', 'Supports arithmetic, strings, arrays, objects, and any valid JS'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('eval <expression>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln();
        writer.writeln(`📝 ${t.t('cli.common.examples', 'Examples:')}`);
        writer.writeln(
            `  eval 1 + 1                       ${writer.wrapInColor('# → 2', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  eval "Hello, " + "World!"        ${writer.wrapInColor('# → Hello, World!', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  eval Math.random()               ${writer.wrapInColor('# → 0.1234...', CliForegroundColor.Green)}`,
        );
        writer.writeln(
            `  eval [1,2,3].map(x => x * 2)     ${writer.wrapInColor('# → [2, 4, 6]', CliForegroundColor.Green)}`,
        );
    }
}
