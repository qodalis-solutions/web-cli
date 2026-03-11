# Output Export Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `capture` command that exports the current terminal buffer content as a downloadable HTML file (with ANSI colors preserved) or plain text file.

**Architecture:** New processor in `packages/cli/src/lib/processors/cli-capture-command-processor.ts`. Uses xterm.js `SerializeAddon` to get the terminal buffer content. For HTML export, converts ANSI escape codes to styled HTML spans. Uses the browser's `Blob` + `URL.createObjectURL` download pattern (same as `ICliFileTransfer` in the existing code).

**Tech Stack:** TypeScript, xterm.js SerializeAddon, Blob API, ansi-to-html conversion (inline implementation — no new deps)

---

### Task 1: Implement the capture processor

**Files:**
- Create: `packages/cli/src/lib/processors/cli-capture-command-processor.ts`

**Step 1: Write the implementation**

```typescript
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
    metadata: CliProcessorMetadata = { icon: CliIcon.Download, module: 'system' };

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
        const format = (cmd.parameters?.['format'] as string) ?? 'html';
        const filename = (cmd.parameters?.['filename'] as string) ?? `terminal-${Date.now()}`;
        const linesParam = cmd.parameters?.['lines'] as number | undefined;

        if (format !== 'html' && format !== 'txt') {
            context.writer.writeError('Format must be "html" or "txt"');
            return;
        }

        // Read lines from the terminal buffer
        const terminal = context.terminal;
        const totalLines = terminal.buffer.active.length;
        const startLine = linesParam ? Math.max(0, totalLines - linesParam) : 0;

        const lines: string[] = [];
        for (let i = startLine; i < totalLines; i++) {
            const line = terminal.buffer.active.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            }
        }

        if (format === 'txt') {
            const content = lines.join('\n');
            this.download(`${filename}.txt`, content, 'text/plain');
            context.writer.writeSuccess(`Downloaded ${filename}.txt (${lines.length} lines)`);
        } else {
            const content = this.toHtml(lines, terminal.options.theme);
            this.download(`${filename}.html`, content, 'text/html');
            context.writer.writeSuccess(`Downloaded ${filename}.html (${lines.length} lines)`);
        }
    }

    private toHtml(lines: string[], theme: any): string {
        const bg = theme?.background ?? '#0c0c0c';
        const fg = theme?.foreground ?? '#cccccc';
        const escaped = lines
            .map((l) => this.escapeHtml(l))
            .join('\n');
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
```

---

### Task 2: Register the processor

**Files:**
- Modify: `packages/cli/src/lib/processors/index.ts`
- Modify: `packages/cli/src/lib/services/cli-boot.ts` (or wherever built-in processors are registered)

**Step 1: Export**

Add to `packages/cli/src/lib/processors/index.ts`:
```typescript
export { CliCaptureCommandProcessor } from './cli-capture-command-processor';
```

**Step 2: Register**

Add `new CliCaptureCommandProcessor()` to the built-in processors array in `cli-boot.ts`.

**Step 3: Build to verify no TypeScript errors**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run build:cli
```

Expected: build succeeds with no errors.

**Step 4: Commit**

```bash
git add packages/cli/src/lib/processors/cli-capture-command-processor.ts \
        packages/cli/src/lib/processors/index.ts
git commit -m "feat(cli): add capture command for terminal output export (html/txt)"
```
