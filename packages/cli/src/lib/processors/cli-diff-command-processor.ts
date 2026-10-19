import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { computeDiff, formatDiff } from './diff-utils';

export class CliDiffCommandProcessor implements ICliCommandProcessor {
    command = 'diff';
    description = 'Show colored diff between two text inputs';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Edit, module: 'system' };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'b',
            description: 'Second text to compare',
            required: false,
            type: 'string',
        },
        {
            name: 'a',
            description: 'First text (alternative to pipe)',
            required: false,
            type: 'string',
        },
        {
            name: 'context',
            description: 'Number of context lines around changes (default: 3)',
            required: false,
            type: 'number',
        },
    ];

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        // First text: --a, the value, or piped input (`echo x | diff --b y`)
        const piped =
            command.data === undefined || command.data === null
                ? undefined
                : typeof command.data === 'string'
                  ? command.data
                  : JSON.stringify(command.data, null, 2);
        const a =
            (command.args['a'] as string | undefined) ??
            (command.value || piped || '');
        const b = command.args['b'] as string | undefined;
        const rawContext = command.args?.['context'];
        const parsed = rawContext !== undefined ? parseInt(String(rawContext), 10) : NaN;
        const contextLines = Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;

        if (b === undefined) {
            context.writer.writeError(
                'Usage: diff --a "text1" --b "text2"\n' +
                '       echo "text1" | diff --b "text2"',
            );
            return;
        }

        const diffLines = computeDiff(a, b);
        const hasChanges = diffLines.some((l) => l.type !== 'same');

        if (!hasChanges) {
            context.writer.writeSuccess('No differences found');
            return;
        }

        const added = diffLines.filter((l) => l.type === 'add').length;
        const removed = diffLines.filter((l) => l.type === 'remove').length;
        context.writer.writeln(`\x1b[32m+${added} added\x1b[0m  \x1b[31m-${removed} removed\x1b[0m`);
        context.writer.writeln('');

        const formatted = formatDiff(diffLines, contextLines);
        for (const line of formatted) {
            context.writer.writeln(line);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Compare two texts line by line: added lines are shown in green with +, removed lines in red with -, with a few unchanged lines around each change for context.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['diff --a "<text1>" --b "<text2>"', 'Compare two texts'],
            ['diff --a "<text1>" --b "<text2>" --context 0', 'Only the changed lines'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['diff --a "hello world" --b "hello there"', 'One line changed'],
            ['diff --a "v1.2.0" --b "v1.2.0"', 'Prints: No differences found'],
        ]);
    }
}
