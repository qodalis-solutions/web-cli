/**
 * Example 09 — Full-Screen Mode (Vanilla JS)
 *
 * Shows how to build interactive full-screen TUI commands using
 * the alternate screen buffer. Used by games, editors, and pagers.
 *
 * Key APIs:
 *   context.enterFullScreenMode(processor, options)
 *   context.exitFullScreenMode()
 *   processor.onData(data, context)     — handle raw key input
 *   processor.onResize(cols, rows, ctx) — handle terminal resize
 *   processor.onDispose(context)        — cleanup on exit
 *   context.createInterval(fn, ms)      — managed timer (auto-cleared)
 *   context.createTimeout(fn, ms)       — managed timeout (auto-cleared)
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliForegroundColor } from '@qodalis/cli-core';

// ── Bouncing ball full-screen demo ─────────────────────────────

interface BallState {
    x: number;
    y: number;
    dx: number;
    dy: number;
}

const bouncingBallProcessor: ICliCommandProcessor = {
    command: 'bounce',
    description: 'Bouncing ball animation (press q to exit)',

    // Internal state (not using stateConfiguration since it's ephemeral)
    _ball: { x: 5, y: 5, dx: 1, dy: 1 } as BallState,
    _context: null as ICliExecutionContext | null,

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        this._context = context;
        this._ball = { x: 5, y: 5, dx: 1, dy: 1 };

        // Enter full-screen: switches to alternate screen buffer,
        // hides cursor, routes all input to onData()
        context.enterFullScreenMode(this, { showCursor: false });

        // Initial render
        this._render(context);

        // Managed interval — auto-cleared when full-screen mode exits
        context.createInterval(() => {
            this._update(context);
            this._render(context);
        }, 100);
    },

    _update(context: ICliExecutionContext) {
        const { cols, rows } = context.terminal;
        const ball = this._ball as BallState;

        // Move
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Bounce off walls
        if (ball.x <= 0 || ball.x >= cols - 1) ball.dx *= -1;
        if (ball.y <= 0 || ball.y >= rows - 2) ball.dy *= -1;

        // Clamp
        ball.x = Math.max(0, Math.min(cols - 1, ball.x));
        ball.y = Math.max(0, Math.min(rows - 2, ball.y));
    },

    _render(context: ICliExecutionContext) {
        const { writer, terminal } = context;
        const { cols, rows } = terminal;
        const ball = this._ball as BallState;

        // Clear screen
        writer.write('\x1b[2J');

        // Draw border
        writer.write('\x1b[1;1H');
        writer.write('┌' + '─'.repeat(cols - 2) + '┐');
        for (let y = 1; y < rows - 1; y++) {
            writer.write(`\x1b[${y + 1};1H│`);
            writer.write(`\x1b[${y + 1};${cols}H│`);
        }
        writer.write(`\x1b[${rows};1H└${'─'.repeat(cols - 2)}┘`);

        // Draw ball
        writer.write(`\x1b[${ball.y + 1};${ball.x + 1}H`);
        writer.write(writer.wrapInColor('●', CliForegroundColor.Cyan));

        // Draw instructions
        const msg = ' Press q to exit ';
        writer.write(`\x1b[${rows};${Math.floor((cols - msg.length) / 2)}H`);
        writer.write(writer.wrapInColor(msg, CliForegroundColor.Yellow));
    },

    // Handle all keyboard input in full-screen mode
    async onData(data: string, context: ICliExecutionContext) {
        if (data === 'q' || data === 'Q' || data === '\x1b') {
            // Exit full-screen: restores main buffer, shows cursor, re-displays prompt
            context.exitFullScreenMode();
        }
    },

    // Called when terminal is resized during full-screen mode
    onResize(_cols: number, _rows: number, context: ICliExecutionContext) {
        this._render(context);
    },

    // Called when full-screen mode ends or terminal is destroyed
    onDispose(_context: ICliExecutionContext) {
        this._ball = { x: 5, y: 5, dx: 1, dy: 1 };
        this._context = null;
        // Managed intervals/timeouts are auto-cleared — no manual cleanup needed
    },
} as ICliCommandProcessor & {
    _ball: BallState;
    _context: ICliExecutionContext | null;
    _update: (ctx: ICliExecutionContext) => void;
    _render: (ctx: ICliExecutionContext) => void;
};

// ── Full-screen with cursor (REPL style) ───────────────────────

const replProcessor: ICliCommandProcessor = {
    command: 'mini-repl',
    description: 'Minimal full-screen REPL (press Ctrl+D to exit)',

    _buffer: '',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        this._buffer = '';

        // showCursor: true for REPL/input-line interfaces
        context.enterFullScreenMode(this, { showCursor: true });

        context.writer.write('\x1b[2J\x1b[1;1H');
        context.writer.writeln('Mini REPL — type expressions, Ctrl+D to exit');
        context.writer.writeln('─'.repeat(40));
        context.writer.write('> ');
    },

    async onData(data: string, context: ICliExecutionContext) {
        if (data === '\x04') { // Ctrl+D
            context.exitFullScreenMode();
            return;
        }

        if (data === '\r') { // Enter
            context.writer.writeln();
            if (this._buffer.trim()) {
                context.writer.writeln(`  = ${this._buffer.split('').reverse().join('')}`);
            }
            this._buffer = '';
            context.writer.write('> ');
            return;
        }

        if (data === '\x7f') { // Backspace
            if (this._buffer.length > 0) {
                this._buffer = this._buffer.slice(0, -1);
                context.writer.write('\b \b');
            }
            return;
        }

        // Printable character
        if (data.length === 1 && data.charCodeAt(0) >= 32) {
            this._buffer += data;
            context.writer.write(data);
        }
    },

    onDispose() {
        this._buffer = '';
    },
} as ICliCommandProcessor & { _buffer: string };

// ── Module & Bootstrap ─────────────────────────────────────────

const fullScreenModule: ICliModule = {
    apiVersion: 2,
    name: 'fullscreen-demo',
    processors: [bouncingBallProcessor, replProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([fullScreenModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
