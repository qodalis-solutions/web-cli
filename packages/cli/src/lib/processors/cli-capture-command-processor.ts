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
            const theme = (terminal as any)?.options?.theme;
            const content = this.toHtml(lines, theme);
            this.download(`${filename}.html`, content, 'text/html');
            context.writer.writeSuccess(`Downloaded ${filename}.html (${lines.length} lines)`);
        }
    }

    private toHtml(lines: string[], theme: any): string {
        const bg = theme?.background ?? '#0c0c0c';
        const fg = theme?.foreground ?? '#cccccc';
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
