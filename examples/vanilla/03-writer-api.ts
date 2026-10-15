/**
 * Example 03 — Writer API (Vanilla JS)
 *
 * Demonstrates all 16 methods of ICliTerminalWriter for rich terminal output.
 * Type `demo-writer` to see all output methods in action.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/writer-api
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliForegroundColor, CliBackgroundColor } from '@qodalis/cli-core';

const writerDemoProcessor: ICliCommandProcessor = {
    command: 'demo-writer',
    description: 'Showcase all terminal writer methods',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const { writer } = context;

        // ── 1. Basic output ────────────────────────────────────
        writer.writeln('=== Basic Output ===');
        writer.write('write() does not add a newline. ');
        writer.writeln('writeln() does.');
        writer.writeln();

        // ── 2. Styled messages ─────────────────────────────────
        writer.writeln('=== Styled Messages ===');
        writer.writeSuccess('writeSuccess() — green checkmark prefix');
        writer.writeInfo('writeInfo() — blue info prefix');
        writer.writeWarning('writeWarning() — yellow warning prefix');
        writer.writeError('writeError() — red error prefix');
        writer.writeln();

        // ── 3. Color wrapping ──────────────────────────────────
        writer.writeln('=== Color Wrapping ===');
        writer.writeln(
            writer.wrapInColor('Foreground: Red', CliForegroundColor.Red) + ' | ' +
            writer.wrapInColor('Green', CliForegroundColor.Green) + ' | ' +
            writer.wrapInColor('Yellow', CliForegroundColor.Yellow) + ' | ' +
            writer.wrapInColor('Blue', CliForegroundColor.Blue) + ' | ' +
            writer.wrapInColor('Cyan', CliForegroundColor.Cyan) + ' | ' +
            writer.wrapInColor('Magenta', CliForegroundColor.Magenta),
        );
        writer.writeln(
            writer.wrapInBackgroundColor('Background: Red', CliBackgroundColor.Red) + ' ' +
            writer.wrapInBackgroundColor('Green', CliBackgroundColor.Green) + ' ' +
            writer.wrapInBackgroundColor('Blue', CliBackgroundColor.Blue),
        );
        writer.writeln();

        // ── 4. JSON output ─────────────────────────────────────
        writer.writeln('=== JSON Output ===');
        writer.writeJson({
            name: 'Qodalis CLI',
            version: '2.0.0',
            features: ['themes', 'plugins', 'server integration'],
        });
        writer.writeln();

        // ── 5. Tables ──────────────────────────────────────────
        writer.writeln('=== Table ===');
        writer.writeTable(
            ['Command', 'Description', 'Aliases'],
            [
                ['help', 'Show available commands', 'h, ?'],
                ['clear', 'Clear the terminal', 'cls'],
                ['theme', 'Manage themes', '-'],
            ],
        );
        writer.writeln();

        // Full-width table (columns expand to fill terminal width)
        writer.writeln('=== Full-Width Table ===');
        writer.writeTable(
            ['Key', 'Value'],
            [
                ['OS', 'Linux'],
                ['Shell', 'bash'],
                ['Node', '22.0.0'],
            ],
            { fullWidth: true },
        );
        writer.writeln();

        // Auto-inferred table from objects
        writer.writeln('=== Object Array Table ===');
        writer.writeObjectsAsTable([
            { id: 1, name: 'Alice', role: 'admin' },
            { id: 2, name: 'Bob', role: 'user' },
            { id: 3, name: 'Charlie', role: 'user' },
        ]);
        writer.writeln();

        // ── 6. Divider ────────────────────────────────────────
        writer.writeln('=== Dividers ===');
        writer.writeDivider(); // default
        writer.writeDivider({ char: '=', color: CliForegroundColor.Cyan });
        writer.writeDivider({ char: '·', length: 30, color: CliForegroundColor.Yellow });
        writer.writeln();

        // ── 7. Lists ───────────────────────────────────────────
        writer.writeln('=== Lists ===');
        writer.writeList(['Bullet item 1', 'Bullet item 2', 'Bullet item 3']);
        writer.writeln();
        writer.writeList(['First', 'Second', 'Third'], { ordered: true });
        writer.writeln();
        writer.writeList(['Star 1', 'Star 2'], {
            prefix: '★',
            color: CliForegroundColor.Yellow,
        });
        writer.writeln();

        // ── 8. Key-Value pairs ─────────────────────────────────
        writer.writeln('=== Key-Value Pairs ===');
        writer.writeKeyValue({
            'Name': 'Qodalis CLI',
            'Version': '2.0.0-beta.14',
            'License': 'MIT',
            'Author': 'Qodalis Solutions',
        });
        writer.writeln();

        // With custom separator and color
        writer.writeKeyValue(
            [
                ['Status', 'Running'],
                ['Uptime', '3h 42m'],
                ['Memory', '128 MB'],
            ],
            { separator: ' → ', keyColor: CliForegroundColor.Cyan },
        );
        writer.writeln();

        // ── 9. Columns ────────────────────────────────────────
        writer.writeln('=== Multi-Column Layout ===');
        writer.writeColumns(
            ['help', 'clear', 'theme', 'version', 'history', 'alias', 'config', 'eval', 'echo'],
            { columns: 3, padding: 4 },
        );
        writer.writeln();

        // ── 10. Links ──────────────────────────────────────────
        writer.writeln('=== Clickable Link ===');
        writer.writeLink('Qodalis CLI Docs', 'https://qodalis-solutions.github.io/web-cli/');
        writer.writeln();

        // ── 11. Boxes ──────────────────────────────────────────
        writer.writeln('=== Boxes ===');
        writer.writeBox('Simple box with a single line of content.');
        writer.writeln();

        writer.writeBox(
            ['Multi-line box content.', 'Each string becomes a line.', 'Great for notices!'],
            {
                title: 'Notice',
                borderColor: CliForegroundColor.Yellow,
                padding: 1,
            },
        );
        writer.writeln();

        // ── 12. Indentation ────────────────────────────────────
        writer.writeln('=== Indentation ===');
        writer.writeln('Root level');
        writer.writeIndented('Level 1 (2 spaces)');
        writer.writeIndented('Level 2 (4 spaces)', 2);
        writer.writeIndented('Level 3 (6 spaces)', 3);
        writer.writeln();

        // ── 13. File download ──────────────────────────────────
        writer.writeln('=== File Download ===');
        writer.writeInfo('writeToFile() triggers a browser download:');
        writer.writeIndented('writer.writeToFile("report.json", JSON.stringify(data))');
        // Uncomment to actually trigger a download:
        // writer.writeToFile('report.json', JSON.stringify({ status: 'ok' }, null, 2));
    },
};

// ── Module & Bootstrap ─────────────────────────────────────────

const writerDemoModule: ICliModule = {
    apiVersion: 2,
    name: 'writer-demo',
    processors: [writerDemoProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([writerDemoModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
