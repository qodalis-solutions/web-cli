import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import { formatDuration, parseDuration } from '../stopwatch-utils';

// -- ANSI helpers -----------------------------------------------------------

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    showCursor: `${CSI}?25h`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    reset: `${CSI}0m`,
    fg: {
        white: `${CSI}97m`,
        cyan: `${CSI}36m`,
        yellow: `${CSI}93m`,
        green: `${CSI}32m`,
        red: `${CSI}91m`,
        gray: `${CSI}90m`,
        brightGreen: `${CSI}92m`,
        brightCyan: `${CSI}96m`,
    },
};

// -- Timer sub-processor ----------------------------------------------------

class CliStopwatchTimerCommandProcessor implements ICliCommandProcessor {
    command = 'timer';
    description = 'Run a countdown timer (e.g. timer 5m, timer 1h30m, timer 90s)';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;

    private intervalId: ReturnType<typeof setInterval> | null = null;
    private remaining = 0;
    private total = 0;
    private running = false;
    private done = false;
    private context: ICliExecutionContext | null = null;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const input = (command.value ?? '').trim();
        const durationMs = parseDuration(input);

        if (!durationMs) {
            context.writer.writeError(
                input
                    ? `Invalid or too-short duration "${input}". Use formats like 30s, 5m, 1h, 2h30m (minimum 10s).`
                    : 'Usage: stopwatch timer <duration>  (e.g. timer 5m)',
            );
            return;
        }

        this.total = durationMs;
        this.remaining = durationMs;
        this.running = true;
        this.done = false;
        this.context = context;

        context.enterFullScreenMode(this);
        this.render(context);

        this.intervalId = setInterval(() => {
            if (!this.running) return;
            this.remaining = Math.max(0, this.remaining - 100);
            this.render(context);

            if (this.remaining === 0) {
                this.finishTimer(context);
            }
        }, 100);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.done) {
            // Any key exits
            this.exit(context);
            return;
        }

        switch (data) {
            case ' ':
            case 'p':
            case 'P':
                this.running = !this.running;
                this.render(context);
                break;
            case 'q':
            case 'Q':
            case '\x03': // Ctrl+C
                this.exit(context);
                break;
        }
    }

    onDispose(_context: ICliExecutionContext): void {
        this.clearInterval();
    }

    onResize(
        _cols: number,
        _rows: number,
        context: ICliExecutionContext,
    ): void {
        this.render(context);
    }

    private finishTimer(context: ICliExecutionContext): void {
        this.clearInterval();
        this.running = false;
        this.done = true;
        this.renderDone(context);
    }

    private exit(context: ICliExecutionContext): void {
        this.clearInterval();
        this.running = false;
        context.exitFullScreenMode();
        if (this.done) {
            context.writer.writeSuccess('Timer complete!');
        } else {
            const elapsed = this.total - this.remaining;
            context.writer.writeln(
                `Timer stopped. Elapsed: ${formatDuration(elapsed)} / ${formatDuration(this.total)}`,
            );
        }
        this.context = null;
    }

    private clearInterval(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private render(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const centerRow = Math.floor(rows / 2);
        const buf: string[] = [];

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // Title
        const title = ' COUNTDOWN TIMER ';
        const titleCol = Math.max(1, Math.floor((cols - title.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow - 4, titleCol));
        buf.push(ansi.fg.cyan, ansi.bold, title, ansi.reset);

        // Time display
        const timeStr = formatDuration(this.remaining);
        const timeCol = Math.max(1, Math.floor((cols - timeStr.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow - 2, timeCol));
        buf.push(ansi.bold, ansi.fg.yellow, timeStr, ansi.reset);

        // Progress bar
        const barWidth = Math.min(50, cols - 6);
        const fraction = this.total > 0 ? (this.total - this.remaining) / this.total : 0;
        const filled = Math.round(fraction * barWidth);
        const empty = barWidth - filled;
        const barCol = Math.max(1, Math.floor((cols - barWidth - 2) / 2) + 1);

        buf.push(ansi.cursorTo(centerRow, barCol));
        buf.push(ansi.fg.gray, '[', ansi.reset);
        if (filled > 0) {
            buf.push(ansi.fg.brightGreen, '='.repeat(filled), ansi.reset);
        }
        if (empty > 0) {
            buf.push(ansi.fg.gray, ' '.repeat(empty), ansi.reset);
        }
        buf.push(ansi.fg.gray, ']', ansi.reset);

        // Percentage
        const pct = Math.round(fraction * 100);
        const pctStr = `${pct}%`;
        const pctCol = Math.max(1, Math.floor((cols - pctStr.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow + 1, pctCol));
        buf.push(ansi.fg.gray, pctStr, ansi.reset);

        // Status / paused indicator
        buf.push(ansi.cursorTo(centerRow + 2, Math.max(1, Math.floor((cols - 8) / 2) + 1)));
        if (!this.running) {
            buf.push(ansi.fg.yellow, ' PAUSED ', ansi.reset);
        } else {
            buf.push('        ');
        }

        // Controls hint
        const hint = '[Space/P] Pause   [Q/Ctrl+C] Quit';
        const hintCol = Math.max(1, Math.floor((cols - hint.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow + 4, hintCol));
        buf.push(ansi.dim, hint, ansi.reset);

        context.terminal.write(buf.join(''));
    }

    private renderDone(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const centerRow = Math.floor(rows / 2);
        const buf: string[] = [];

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        const msg1 = 'Timer complete!';
        const msg2 = formatDuration(this.total);
        const msg3 = 'Press any key to exit';

        buf.push(ansi.cursorTo(centerRow - 2, Math.max(1, Math.floor((cols - msg1.length) / 2) + 1)));
        buf.push(ansi.fg.brightGreen, ansi.bold, msg1, ansi.reset);

        buf.push(ansi.cursorTo(centerRow, Math.max(1, Math.floor((cols - msg2.length) / 2) + 1)));
        buf.push(ansi.fg.cyan, msg2, ansi.reset);

        buf.push(ansi.cursorTo(centerRow + 2, Math.max(1, Math.floor((cols - msg3.length) / 2) + 1)));
        buf.push(ansi.dim, msg3, ansi.reset);

        context.terminal.write(buf.join(''));
    }
}

// -- Stopwatch processor ----------------------------------------------------

export class CliStopwatchCommandProcessor implements ICliCommandProcessor {
    command = 'stopwatch';

    description = 'Interactive stopwatch and countdown timer';

    aliases = ['sw'];

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    processors: ICliCommandProcessor[] = [
        new CliStopwatchTimerCommandProcessor(),
    ];

    // Stopwatch state
    private startTime = 0;
    private elapsed = 0;
    private running = false;
    private laps: number[] = [];
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private context: ICliExecutionContext | null = null;

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.reset();
        this.context = context;
        context.enterFullScreenMode(this);
        this.startTicking(context);
        this.render(context);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        switch (data) {
            case ' ':
            case 'p':
            case 'P':
                this.togglePause(context);
                break;
            case 'l':
            case 'L':
                this.recordLap(context);
                break;
            case 'r':
            case 'R':
                this.resetAndRestart(context);
                break;
            case 'q':
            case 'Q':
            case '\x03': // Ctrl+C
                this.exit(context);
                break;
        }
    }

    onResize(
        _cols: number,
        _rows: number,
        context: ICliExecutionContext,
    ): void {
        this.render(context);
    }

    onDispose(_context: ICliExecutionContext): void {
        this.clearInterval();
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln('  stopwatch          Start interactive stopwatch');
        writer.writeln('  stopwatch timer <duration>   Run countdown timer');
        writer.writeln();
        writer.writeln('Duration formats: 30s, 5m, 1h, 2h30m, 1h30m45s');
        writer.writeln();
        writer.writeln('Stopwatch controls:');
        writer.writeln('  [Space/P]  Pause / resume');
        writer.writeln('  [L]        Record lap');
        writer.writeln('  [R]        Reset');
        writer.writeln('  [Q/Ctrl+C] Quit');
    }

    // -- Internal helpers ---------------------------------------------------

    private reset(): void {
        this.clearInterval();
        this.startTime = Date.now();
        this.elapsed = 0;
        this.running = true;
        this.laps = [];
    }

    private resetAndRestart(context: ICliExecutionContext): void {
        this.reset();
        this.startTicking(context);
        this.render(context);
    }

    private togglePause(context: ICliExecutionContext): void {
        if (this.running) {
            // Capture elapsed before pausing
            this.elapsed += Date.now() - this.startTime;
            this.running = false;
            this.clearInterval();
        } else {
            this.startTime = Date.now();
            this.running = true;
            this.startTicking(context);
        }
        this.render(context);
    }

    private recordLap(context: ICliExecutionContext): void {
        const current = this.currentElapsed();
        this.laps.push(current);
        this.render(context);
    }

    private exit(context: ICliExecutionContext): void {
        this.clearInterval();
        const finalTime = this.currentElapsed();
        context.exitFullScreenMode();
        context.writer.writeln(`Final time: ${formatDuration(finalTime)}`);
        if (this.laps.length > 0) {
            context.writer.writeln('Laps:');
            this.laps.forEach((lap, i) => {
                context.writer.writeln(`  Lap ${i + 1}: ${formatDuration(lap)}`);
            });
        }
        this.context = null;
    }

    private startTicking(context: ICliExecutionContext): void {
        this.clearInterval();
        this.intervalId = setInterval(() => {
            this.render(context);
        }, 100);
    }

    private clearInterval(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private currentElapsed(): number {
        if (this.running) {
            return this.elapsed + (Date.now() - this.startTime);
        }
        return this.elapsed;
    }

    // -- Rendering ----------------------------------------------------------

    private render(context: ICliExecutionContext): void {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const centerRow = Math.floor(rows / 2);
        const buf: string[] = [];

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // Title
        const title = ' STOPWATCH ';
        const titleCol = Math.max(1, Math.floor((cols - title.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow - 4, titleCol));
        buf.push(ansi.fg.cyan, ansi.bold, title, ansi.reset);

        // Main time display
        const timeStr = formatDuration(this.currentElapsed());
        const timeCol = Math.max(1, Math.floor((cols - timeStr.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow - 2, timeCol));
        buf.push(ansi.bold, ansi.fg.yellow, timeStr, ansi.reset);

        // Status line
        const statusStr = this.running ? '  RUNNING  ' : '  PAUSED   ';
        const statusColor = this.running ? ansi.fg.brightGreen : ansi.fg.yellow;
        const statusCol = Math.max(1, Math.floor((cols - statusStr.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow, statusCol));
        buf.push(statusColor, statusStr, ansi.reset);

        // Controls hint
        const hint = '[Space/P] Pause  [L] Lap  [R] Reset  [Q/Ctrl+C] Quit';
        const hintCol = Math.max(1, Math.floor((cols - hint.length) / 2) + 1);
        buf.push(ansi.cursorTo(centerRow + 2, hintCol));
        buf.push(ansi.dim, hint, ansi.reset);

        // Laps (show last 5)
        if (this.laps.length > 0) {
            const lapsToShow = this.laps.slice(-5);
            const startIndex = this.laps.length - lapsToShow.length;
            lapsToShow.forEach((lap, i) => {
                const lapIndex = startIndex + i + 1;
                const lapStr = `Lap ${lapIndex}: ${formatDuration(lap)}`;
                const lapCol = Math.max(1, Math.floor((cols - lapStr.length) / 2) + 1);
                buf.push(ansi.cursorTo(centerRow + 4 + i, lapCol));
                buf.push(ansi.fg.gray, lapStr, ansi.reset);
            });
        }

        context.terminal.write(buf.join(''));
    }
}
