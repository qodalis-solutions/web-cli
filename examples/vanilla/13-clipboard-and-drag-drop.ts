/**
 * Example 13 — Clipboard & Drag-and-Drop (Vanilla JS)
 *
 * Demonstrates:
 *   - context.clipboard — read/write the system clipboard
 *   - ICliDragDropService — react to files dropped onto the terminal
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
    ICliDragDropService,
} from '@qodalis/cli-core';
import { ICliDragDropService_TOKEN } from '@qodalis/cli-core';

// ── 1. Clipboard — copy & paste ───────────────────────────────

const clipboardDemo: ICliCommandProcessor = {
    command: 'clip',
    description: 'Clipboard operations',

    processors: [
        {
            command: 'copy',
            description: 'Copy text to the system clipboard',
            valueRequired: true,

            async processCommand(command, context: ICliExecutionContext) {
                const text = command.value;
                await context.clipboard.write(text);
                context.writer.writeSuccess(`Copied to clipboard: "${text}"`);
            },
        },
        {
            command: 'paste',
            description: 'Read and display clipboard contents',

            async processCommand(_command, context: ICliExecutionContext) {
                const text = await context.clipboard.read();
                if (text) {
                    context.writer.writeln(`Clipboard contains: "${text}"`);
                } else {
                    context.writer.writeWarning('Clipboard is empty');
                }
            },
        },
        {
            command: 'transform',
            description: 'Read clipboard, transform, and write back',

            async processCommand(_command, context: ICliExecutionContext) {
                const original = await context.clipboard.read();
                if (!original) {
                    context.writer.writeWarning('Clipboard is empty');
                    return;
                }

                const transformed = original.toUpperCase();
                await context.clipboard.write(transformed);
                context.writer.writeln(`Original:    "${original}"`);
                context.writer.writeln(`Transformed: "${transformed}"`);
                context.writer.writeSuccess('Clipboard updated with uppercase version');
            },
        },
    ],

    async processCommand(_command, context: ICliExecutionContext) {
        context.writer.writeln('Usage: clip <copy|paste|transform>');
    },
};

// ── 2. Drag & Drop — handle dropped files ─────────────────────

const dropDemo: ICliCommandProcessor = {
    command: 'drop-watch',
    description: 'Watch for files dragged onto the terminal',

    async processCommand(_command, context: ICliExecutionContext) {
        const dragDrop = context.services.get<ICliDragDropService>(
            ICliDragDropService_TOKEN,
        );

        if (!dragDrop) {
            context.writer.writeWarning('Drag & drop service not available');
            return;
        }

        context.writer.writeInfo('Watching for dropped files... (press Ctrl+C to stop)');
        context.writer.writeln('Drag files onto the terminal to see their details.');
        context.writer.writeln('');

        // Subscribe to file drop events
        const subscription = dragDrop.onFileDrop.subscribe((files: File[]) => {
            context.writer.writeSuccess(`Received ${files.length} file(s):`);

            for (const file of files) {
                context.writer.writeKeyValue({
                    Name: file.name,
                    Size: formatSize(file.size),
                    Type: file.type || 'unknown',
                    'Last Modified': new Date(file.lastModified).toLocaleString(),
                });
                context.writer.writeln('');
            }
        });

        // Clean up subscription when command is aborted (Ctrl+C)
        context.onAbort(() => {
            subscription.unsubscribe();
            context.writer.writeln('');
            context.writer.writeInfo('Stopped watching for drops.');
        });

        // Keep the command alive until aborted
        await new Promise<void>((resolve) => {
            context.onAbort(resolve);
        });
    },
};

// ── 3. Practical example — clipboard + drop combined ──────────

const importDemo: ICliCommandProcessor = {
    command: 'import-data',
    description: 'Import data from clipboard or dropped file',

    parameters: [
        {
            name: 'source',
            description: 'Source: "clipboard" or "drop"',
            required: false,
            type: 'string',
            defaultValue: 'clipboard',
        },
    ],

    async processCommand(command, context: ICliExecutionContext) {
        const source = command.args['source'] || 'clipboard';

        if (source === 'clipboard') {
            const data = await context.clipboard.read();
            if (!data) {
                context.writer.writeWarning('No data in clipboard');
                return;
            }

            try {
                const parsed = JSON.parse(data);
                context.writer.writeSuccess('Parsed JSON from clipboard:');
                context.writer.writeJSON(parsed);
            } catch {
                context.writer.writeln('Clipboard text (not JSON):');
                context.writer.writeln(data);
            }
        } else {
            context.writer.writeInfo('Drop a file onto the terminal...');

            const dragDrop = context.services.get<ICliDragDropService>(
                ICliDragDropService_TOKEN,
            );

            if (!dragDrop) {
                context.writer.writeError('Drag & drop not available');
                return;
            }

            // Wait for the first file drop
            const files = await new Promise<File[]>((resolve) => {
                const sub = dragDrop.onFileDrop.subscribe((f) => {
                    sub.unsubscribe();
                    resolve(f);
                });
                context.onAbort(() => {
                    sub.unsubscribe();
                    resolve([]);
                });
            });

            if (files.length === 0) {
                context.writer.writeWarning('No file received');
                return;
            }

            const file = files[0];
            const text = await file.text();
            context.writer.writeSuccess(`Read ${file.name} (${formatSize(file.size)}):`);
            context.writer.writeln(text.substring(0, 500));
            if (text.length > 500) {
                context.writer.writeInfo(`... (${text.length - 500} more characters)`);
            }
        }
    },
};

// ── Helpers ───────────────────────────────────────────────────

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Module & Bootstrap ────────────────────────────────────────

const clipboardModule: ICliModule = {
    apiVersion: 2,
    name: 'clipboard-demo',
    description: 'Clipboard and drag-and-drop demos',
    processors: [clipboardDemo, dropDemo, importDemo],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([clipboardModule]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
