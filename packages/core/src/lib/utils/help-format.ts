import { CliForegroundColor } from '../models';
import { ICliExecutionContext } from '../interfaces';

// Formatting for command help pages (writeDescription) and hints, shared by
// the built-in commands and plugins so they all look the same.

/** A help row: the left column and its description. */
export type CliHelpRow = readonly [string, string];

function writeColumns(
    context: ICliExecutionContext,
    rows: readonly CliHelpRow[],
    formatLeft: (padded: string) => string,
    formatRight: (text: string) => string,
): void {
    const width = Math.max(...rows.map(([left]) => left.length)) + 2;
    for (const [left, right] of rows) {
        context.writer.writeln(
            `  ${formatLeft(left.padEnd(width))}${formatRight(right)}`,
        );
    }
}

/** Write a `📋 Usage:` block with aligned, highlighted commands. */
export function writeUsage(
    context: ICliExecutionContext,
    rows: readonly CliHelpRow[],
): void {
    const { writer, translator } = context;
    writer.writeln(`📋 ${translator.t('cli.common.usage', 'Usage:')}`);
    writeColumns(
        context,
        rows,
        (cmd) => writer.wrapInColor(cmd, CliForegroundColor.Cyan),
        (text) => text,
    );
}

/** Write a `📝 Examples:` block with aligned `# comments`. */
export function writeExamples(
    context: ICliExecutionContext,
    rows: readonly CliHelpRow[],
): void {
    const { writer, translator } = context;
    writer.writeln(`📝 ${translator.t('cli.common.examples', 'Examples:')}`);
    writeColumns(
        context,
        rows,
        (cmd) => cmd,
        (comment) =>
            writer.wrapInColor(`# ${comment}`, CliForegroundColor.Green),
    );
}

/**
 * Write a paragraph wrapped at word boundaries to the terminal width (at
 * most 100 columns), so long help text never breaks inside a word.
 */
export function writeWrapped(
    context: ICliExecutionContext,
    text: string,
    indent = 0,
): void {
    const cols = context.terminal?.cols ?? 80;
    const width = Math.max(20, Math.min(cols - 1, 100) - indent);
    const pad = ' '.repeat(indent);
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && visibleLength(line) + 1 + visibleLength(word) > width) {
            context.writer.writeln(pad + line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) context.writer.writeln(pad + line);
}

function visibleLength(text: string): number {
    return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

/** `💡 Use <command> to <action>` hint. */
export function writeHint(
    context: ICliExecutionContext,
    command: string,
    action: string,
): void {
    const { writer, translator } = context;
    const text = `💡 ${translator.t('cli.common.use_hint', 'Use {command} {action}', {
        command: writer.wrapInColor(command, CliForegroundColor.Cyan),
        action,
    })}`;
    // "ℹ " prefix + the emoji's double width
    const width = Math.min((context.terminal?.cols ?? 80) - 1, 100) - 3;
    if (visibleLength(text) + 1 <= width) {
        writer.writeInfo(text);
        return;
    }
    // Narrow terminal: wrap at words, continuation lines under the text
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
        if (line && visibleLength(line) + 1 + visibleLength(word) > width) {
            lines.push(line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) lines.push(line);
    writer.writeInfo(lines[0]);
    for (const rest of lines.slice(1)) {
        writer.writeln(`   ${rest}`);
    }
}
