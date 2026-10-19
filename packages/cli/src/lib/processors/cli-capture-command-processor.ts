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
import { ITheme } from '@xterm/xterm';

export class CliCaptureCommandProcessor implements ICliCommandProcessor {
    command = 'capture';
    description = 'Export terminal output to a downloadable file';
    aliases = ['export-output'];
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Save, module: 'system' };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'format',
            description: 'Output format: html (default) or txt',
            required: false,
            type: 'string',
        },
        {
            name: 'filename',
            description: 'Output filename (without extension)',
            required: false,
            type: 'string',
        },
        {
            name: 'lines',
            description: 'Number of recent lines to capture (default: all)',
            required: false,
            type: 'number',
        },
    ];

    async processCommand(cmd: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const format = (cmd.args?.['format'] as string) ?? 'html';
        const filename = (cmd.args?.['filename'] as string) ?? `terminal-${Date.now()}`;
        const linesParam = cmd.args?.['lines'] as number | undefined;

        if (format !== 'html' && format !== 'txt') {
            context.writer.writeError('Format must be "html" or "txt"');
            context.process.exit(-1);
            return;
        }

        const terminal = context.terminal;
        const buffer = terminal?.buffer?.active;

        if (!buffer) {
            context.writer.writeError('Terminal buffer is not available');
            context.process.exit(-1);
            return;
        }

        const totalLines = buffer.length;
        const startLine = linesParam ? Math.max(0, totalLines - linesParam) : 0;

        const lines: string[] = [];
        for (let i = startLine; i < totalLines; i++) {
            const line = buffer.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            }
        }

        if (format === 'txt') {
            const content = lines.join('\n');
            this.download(`${filename}.txt`, content, 'text/plain');
            context.writer.writeSuccess(`Downloaded ${filename}.txt (${lines.length} lines)`);
        } else {
            const theme = context.terminal?.options?.theme;
            const content = this.toHtml(lines, theme);
            this.download(`${filename}.html`, content, 'text/html');
            context.writer.writeSuccess(`Downloaded ${filename}.html (${lines.length} lines)`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.capture.help.save_what_terminal_including', 'Save what is on the terminal, including the scrollback, as a file your browser downloads. HTML keeps the theme background and text color; txt is plain text. Colors of individual lines are not kept.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['capture', t.t('cli.capture.help.everything_terminal_html', 'Everything as terminal-<timestamp>.html')],
            ['capture --format txt', t.t('cli.capture.help.plain_text_file', 'Plain text file')],
            ['capture --lines <n>', t.t('cli.capture.help.only_last_n_lines', 'Only the last n lines')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['capture --format txt --filename session', t.t('cli.capture.help.downloads_session_txt', 'Downloads session.txt')],
            ['capture --lines 50', t.t('cli.capture.help.last_50_lines_html', 'The last 50 lines as HTML')],
            ['export-output', t.t('cli.capture.help.same_capture', 'Same as capture')],
        ]);
    }

    private sanitizeCssColor(value: string | undefined, fallback: string): string {
        if (!value) return fallback;
        // Allow only hex colors, rgb(), rgba(), named colors (no special chars)
        return /^[a-zA-Z0-9#(),. %]+$/.test(value) ? value : fallback;
    }

    private toHtml(lines: string[], theme: ITheme | undefined): string {
        const bg = this.sanitizeCssColor(theme?.background, '#0c0c0c');
        const fg = this.sanitizeCssColor(theme?.foreground, '#cccccc');
        const escaped = lines.map((l) => this.escapeHtml(l)).join('\n');
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Terminal Output</title>
  <style>
    body { background: ${bg}; color: ${fg}; font-family: 'Courier New', monospace; font-size: 14px; padding: 16px; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>${escaped}</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    private download(filename: string, content: string, mimeType: string): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
