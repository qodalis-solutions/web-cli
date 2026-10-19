import { CliForegroundColor, ICliExecutionContext } from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../../services/script-loader';

/** A help row: the left column and its description. */
export type HelpRow = readonly [string, string];

function writeColumns(
    context: ICliExecutionContext,
    rows: readonly HelpRow[],
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
    rows: readonly HelpRow[],
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
    rows: readonly HelpRow[],
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
    const { writer } = context;
    const text = `💡 Use ${writer.wrapInColor(command, CliForegroundColor.Cyan)} ${action}`;
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

/** Message shown by commands that need at least one installed package. */
export function writeNoPackages(context: ICliExecutionContext): void {
    context.writer.writeInfo('📦 No packages installed');
    context.writer.writeln();
    writeHint(context, 'pkg add <name>', 'to install a package');
}

/** Current download source and its fallbacks. */
export function writeSourceSummary(
    context: ICliExecutionContext,
    loader: ScriptLoaderService,
    current = loader.getCdnSource(),
): void {
    const { writer } = context;
    writer.writeln(
        `🌐 Current source: ${writer.wrapInColor(current, CliForegroundColor.Cyan)}`,
    );
    const fallbacks = loader.getSources().filter((s) => s !== current);
    if (fallbacks.length > 0) {
        writer.writeln(
            `   Fallbacks: ${fallbacks.map((s) => writer.wrapInColor(s, CliForegroundColor.Yellow)).join(', ')}`,
        );
    }
}

/** Every configured source with its kind and URL. */
export function writeSourceList(
    context: ICliExecutionContext,
    loader: ScriptLoaderService,
): void {
    const { writer } = context;
    writer.writeln('🌐 Available sources:');
    const names = loader.getSources();
    const width = Math.max(...names.map((n) => n.length)) + 2;
    for (const name of names) {
        const entry = loader.getSource(name);
        writer.writeln(
            `  ${writer.wrapInColor(name.padEnd(width), CliForegroundColor.Cyan)}${writer.wrapInColor(`[${entry?.kind ?? '?'}]`.padEnd(12), CliForegroundColor.Yellow)}${entry?.url ?? ''}`,
        );
    }
}
