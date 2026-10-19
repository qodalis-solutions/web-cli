import { Terminal } from '@xterm/xterm';
import { CliForegroundColor } from '@qodalis/cli-core';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const CLEAR_LINE = '\r\x1b[2K';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

/** Width of the progress bar in cells (shrinks on narrow terminals). */
const BAR_WIDTH = 32;

type BootLogLevel = 'info' | 'ok' | 'slow' | 'warn' | 'error';

const ICONS: Record<BootLogLevel, string> = {
    info: `${CliForegroundColor.Cyan}ℹ${RESET}`,
    ok: `${CliForegroundColor.Green}✔${RESET}`,
    slow: `${CliForegroundColor.Yellow}✔${RESET}`,
    warn: `${CliForegroundColor.Yellow}⚠${RESET}`,
    error: `${CliForegroundColor.Red}✘${RESET}`,
};

export interface CliBootLogOptions {
    /** Steps taking at least this long are highlighted as slow. */
    slowStepMs?: number;
    /** When boot started (ms since epoch); defaults to now. */
    startedAt?: number;
}

/**
 * Live boot report written to the terminal while the CLI starts: a list of
 * the steps (terminal, services, servers, modules) with a thin progress bar
 * and percentage pinned below it.
 *
 * Anything else written to the terminal meanwhile is captured and the bar
 * steps aside for it. When boot is complete the report is cleared so the
 * regular terminal takes over; warnings, errors and other output (plugin
 * warnings) are written again in order. First-run setup prompts, answered
 * while the report is suspended, are cleared with it.
 *
 * A disabled log records problems but writes nothing.
 */
export class CliBootLog {
    private readonly startedAt: number;
    private readonly slowStepMs: number;
    private readonly problems: { level: BootLogLevel; text: string }[] = [];
    private finished = false;
    private totalSteps = 0;
    private completedSteps = 0;
    private current = '';
    private barVisible = false;
    private cursorHidden = false;
    private suspended = false;
    private startRow = -1;
    /** Output written by others during boot, replayed after the report is cleared. */
    private readonly captured: string[] = [];
    private originalWrite?: Terminal['write'];
    private originalWriteln?: Terminal['writeln'];
    private redrawScheduled = false;
    /** The last setup output did not end its line (cursor after a prompt). */
    private promptOpen = false;

    constructor(
        private readonly terminal: Terminal | undefined,
        readonly enabled: boolean,
        options?: CliBootLogOptions,
    ) {
        this.slowStepMs = options?.slowStepMs ?? 500;
        this.startedAt = options?.startedAt ?? Date.now();
    }

    /** Milliseconds since boot started. */
    get elapsedMs(): number {
        return Date.now() - this.startedAt;
    }

    /** Whether `finish()` was called; later entries are ignored. */
    get isFinished(): boolean {
        return this.finished;
    }

    /** Completed share of the planned steps, 0–100. */
    get percent(): number {
        if (this.totalSteps === 0) return 0;
        return Math.min(
            100,
            Math.round((this.completedSteps / this.totalSteps) * 100),
        );
    }

    /** Announce `count` more steps that will each be completed with `completeStep`. */
    addSteps(count: number): void {
        if (this.finished || count <= 0) return;
        this.totalSteps += count;
        this.drawBar();
    }

    /** Name what is being set up now (shown next to the bar). */
    setCurrent(text: string): void {
        if (this.finished) return;
        this.current = text;
        this.drawBar();
    }

    /** Mark one planned step as done (successfully or not). */
    completeStep(): void {
        if (this.finished) return;
        this.completedSteps = Math.min(
            this.totalSteps,
            this.completedSteps + 1,
        );
        this.drawBar();
    }

    /**
     * Step aside for interactive output (e.g. a module's first-run setup
     * prompt): remove the bar and show the cursor until `resume()`.
     */
    suspend(): void {
        this.suspended = true;
        this.hideBar();
        if (this.cursorHidden && this.terminal) {
            this.out(SHOW_CURSOR);
            this.cursorHidden = false;
        }
    }

    /** Bring the bar back after `suspend()`. */
    resume(): void {
        this.suspended = false;
        this.drawBar();
    }

    info(text: string): void {
        this.write('info', text);
    }

    /** A completed step, optionally with how long it took. */
    ok(text: string, durationMs?: number): void {
        const slow = durationMs !== undefined && durationMs >= this.slowStepMs;
        this.write(slow ? 'slow' : 'ok', text, durationMs);
    }

    warn(text: string): void {
        if (this.finished) return;
        this.problems.push({ level: 'warn', text });
        this.write('warn', text);
    }

    error(text: string): void {
        if (this.finished) return;
        this.problems.push({ level: 'error', text });
        this.write('error', text);
    }

    /**
     * Write the summary line, then hand the screen over to the terminal:
     * clear the report (unless `keep`), then write warnings, errors and the
     * output captured during boot again. The report is not cleared when the
     * terminal already held something before boot started.
     */
    async finish(summary: string, keep = false): Promise<void> {
        if (this.finished) return;
        this.completedSteps = this.totalSteps;
        this.current = '';
        this.ok(summary);
        this.finished = true;
        if (!this.enabled || !this.terminal) return;

        this.hideBar();
        if (this.cursorHidden) {
            this.out(SHOW_CURSOR);
            this.cursorHidden = false;
        }
        this.stopCapture();
        await this.flush();

        if (keep || this.startRow !== 0) {
            this.terminal.write('\r\n');
            return;
        }

        // Clear screen and scrollback, cursor home
        this.terminal.write('\x1b[2J\x1b[3J\x1b[H');
        for (const problem of this.problems) {
            this.terminal.write(
                this.format(problem.level, problem.text) + '\r\n',
            );
        }
        if (this.problems.length > 0) {
            this.terminal.write('\r\n');
        }
        if (this.captured.length > 0) {
            // One blank line between this output and the welcome screen
            // (trailing line breaks and style codes are normalized)
            const output = this.captured
                .join('')
                .replace(/(?:\s|\x1b\[[0-9;?]*[A-Za-z])+$/, '');
            this.terminal.write(output + RESET + '\r\n\r\n');
        }
    }

    private write(
        level: BootLogLevel,
        text: string,
        durationMs?: number,
    ): void {
        if (this.finished || !this.enabled || !this.terminal) return;
        this.begin();
        this.hideBar();
        this.out(this.format(level, text, durationMs) + '\r\n');
        this.drawBar();
    }

    /** Redraw the bar on the line below the list (the cursor stays on it). */
    private drawBar(): void {
        if (
            this.suspended ||
            this.finished ||
            !this.enabled ||
            !this.terminal ||
            this.totalSteps === 0
        )
            return;
        this.begin();
        // Never draw over a line someone else is still writing (a prompt)
        const last = this.captured[this.captured.length - 1];
        if (last !== undefined && !last.endsWith('\n')) return;
        if (this.promptOpen) {
            // Start below the setup transcript
            this.out('\r\n');
            this.promptOpen = false;
        }
        if (!this.cursorHidden) {
            this.out(HIDE_CURSOR);
            this.cursorHidden = true;
        }

        const cols = this.terminal.cols;
        const width = Math.max(8, Math.min(BAR_WIDTH, cols - 12));
        const filled = Math.round((this.percent / 100) * width);
        const bar =
            `${CliForegroundColor.White}${'━'.repeat(filled)}${RESET}` +
            `${DIM}${'━'.repeat(width - filled)}${RESET}`;
        const percent = `${String(this.percent).padStart(3)}%`;

        let line = `${bar} ${percent}`;
        const room = cols - width - percent.length - 4;
        if (this.current && room > 4) {
            const label =
                this.current.length > room
                    ? `${this.current.slice(0, room - 1)}…`
                    : this.current;
            line += `  ${DIM}${label}${RESET}`;
        }

        this.out(CLEAR_LINE + line);
        this.barVisible = true;
    }

    /** First output: remember where the report starts and capture other writes. */
    private begin(): void {
        if (this.startRow >= 0 || !this.terminal) return;
        this.startRow = this.absoluteRow();

        const terminal = this.terminal;
        this.originalWrite = terminal.write;
        this.originalWriteln = terminal.writeln;
        terminal.write = (data: string | Uint8Array, callback?: () => void) =>
            this.onExternalWrite(data, callback);
        terminal.writeln = (data: string | Uint8Array, callback?: () => void) =>
            this.onExternalWrite(
                typeof data === 'string' ? data + '\r\n' : concat(data, '\r\n'),
                callback,
            );
    }

    private stopCapture(): void {
        if (!this.terminal || !this.originalWrite) return;
        this.terminal.write = this.originalWrite;
        this.terminal.writeln = this.originalWriteln!;
        this.originalWrite = undefined;
        this.originalWriteln = undefined;
    }

    /** Someone else writes during boot: move the bar aside and keep a copy. */
    private onExternalWrite(
        data: string | Uint8Array,
        callback?: () => void,
    ): void {
        this.hideBar();
        const text =
            typeof data === 'string' ? data : new TextDecoder().decode(data);
        // Setup prompts (written while suspended) are done once boot is: they
        // are cleared with the report. Other output (warnings) is kept.
        if (this.suspended) {
            this.promptOpen = !text.endsWith('\n');
        } else if (text) {
            this.captured.push(text);
        }
        this.out(data, callback);
        if (!this.redrawScheduled) {
            this.redrawScheduled = true;
            queueMicrotask(() => {
                this.redrawScheduled = false;
                this.drawBar();
            });
        }
    }

    /** Write without being captured. */
    private out(data: string | Uint8Array, callback?: () => void): void {
        const write = this.originalWrite ?? this.terminal!.write;
        write.call(this.terminal, data, callback);
    }

    private hideBar(): void {
        if (!this.barVisible || !this.terminal) return;
        this.out(CLEAR_LINE);
        this.barVisible = false;
    }

    private format(
        level: BootLogLevel,
        text: string,
        durationMs?: number,
    ): string {
        const duration =
            durationMs !== undefined ? formatDuration(durationMs) : '';
        // Step lines are shortened to one row to keep the list tidy (they are
        // cleared anyway). Warnings and errors stay on screen: never cut them.
        const keepWhole = level === 'warn' || level === 'error';
        const max = Math.max(
            10,
            (this.terminal?.cols ?? 80) -
                3 -
                (duration ? duration.length + 2 : 0),
        );
        const body =
            !keepWhole && text.length > max
                ? `${text.slice(0, max - 1)}…`
                : text;
        const time = duration ? `  ${DIM}${duration}${RESET}` : '';
        return `${ICONS[level]} ${body}${time}`;
    }

    private absoluteRow(): number {
        const buffer = this.terminal!.buffer.active;
        return buffer.baseY + buffer.cursorY;
    }

    /** Resolve once xterm has parsed everything written so far. */
    private flush(): Promise<void> {
        return new Promise((resolve) => this.out('', resolve));
    }
}

function formatDuration(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function concat(data: Uint8Array, suffix: string): Uint8Array {
    const tail = new TextEncoder().encode(suffix);
    const out = new Uint8Array(data.length + tail.length);
    out.set(data);
    out.set(tail, data.length);
    return out;
}
