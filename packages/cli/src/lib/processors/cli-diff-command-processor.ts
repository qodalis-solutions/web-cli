import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    ICliCommandParameterDescriptor,
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
        // First text: from --a param or piped value
        const a = (command.args['a'] as string | undefined) ?? (command.value ?? '');
        const b = command.args['b'] as string | undefined;
        const contextLines = command.args['context'] !== undefined
            ? parseInt(String(command.args['context']), 10)
            : 3;

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
}
