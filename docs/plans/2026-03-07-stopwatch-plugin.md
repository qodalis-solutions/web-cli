# Stopwatch Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@qodalis/cli-stopwatch` plugin with interactive stopwatch (`stopwatch`) and countdown timer (`timer <duration>`) commands that run in full-screen mode.

**Architecture:** New plugin scaffolded via `create-plugin`. Uses `context.enterFullScreenMode()` + `onData` for keyboard input + `context.createInterval` for tick management. The stopwatch supports start/pause/lap/reset via keyboard (Space=pause, L=lap, R=reset, Q=quit). Timer accepts duration like `5m`, `30s`, `1h30m`.

**Tech Stack:** TypeScript, xterm.js full-screen mode, Jasmine

---

### Task 1: Scaffold the plugin

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name stopwatch --description "Interactive stopwatch and countdown timer" --processor-name CliStopwatchCommandProcessor
git add packages/plugins/stopwatch/
git commit -m "chore(stopwatch): scaffold stopwatch plugin"
```

---

### Task 2: Write failing tests for duration parsing

**Files:**
- Create: `packages/plugins/stopwatch/src/tests/stopwatch.spec.ts`

```typescript
import { parseDuration, formatDuration } from '../lib/stopwatch-utils';

describe('stopwatch-utils', () => {
    describe('parseDuration', () => {
        it('parses seconds: 30s → 30000ms', () => {
            expect(parseDuration('30s')).toBe(30000);
        });

        it('parses minutes: 5m → 300000ms', () => {
            expect(parseDuration('5m')).toBe(300000);
        });

        it('parses hours: 1h → 3600000ms', () => {
            expect(parseDuration('1h')).toBe(3600000);
        });

        it('parses combined: 1h30m → 5400000ms', () => {
            expect(parseDuration('1h30m')).toBe(5400000);
        });

        it('parses combined: 2m30s → 150000ms', () => {
            expect(parseDuration('2m30s')).toBe(150000);
        });

        it('returns null for invalid input', () => {
            expect(parseDuration('abc')).toBeNull();
            expect(parseDuration('')).toBeNull();
        });

        it('parses plain number as seconds', () => {
            expect(parseDuration('60')).toBe(60000);
        });
    });

    describe('formatDuration', () => {
        it('formats ms to HH:MM:SS.ms', () => {
            expect(formatDuration(3661000)).toBe('01:01:01.000');
        });

        it('formats zero', () => {
            expect(formatDuration(0)).toBe('00:00:00.000');
        });

        it('formats milliseconds', () => {
            expect(formatDuration(1500)).toBe('00:00:01.500');
        });
    });
});
```

Run to verify failure:
```bash
npx nx test stopwatch
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 3: Implement stopwatch utilities

**Files:**
- Create: `packages/plugins/stopwatch/src/lib/stopwatch-utils.ts`

```typescript
export function parseDuration(input: string): number | null {
    if (!input.trim()) return null;

    // Plain number = seconds
    if (/^\d+$/.test(input)) return parseInt(input, 10) * 1000;

    const pattern = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
    const match = input.match(pattern);
    if (!match || !match[0]) return null;

    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    const total = h * 3600000 + m * 60000 + s * 1000;
    return total > 0 ? total : null;
}

export function formatDuration(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return [
        String(h).padStart(2, '0'),
        String(m).padStart(2, '0'),
        String(s).padStart(2, '0'),
    ].join(':') + '.' + String(millis).padStart(3, '0');
}
```

---

### Task 4: Implement the stopwatch processor

**Files:**
- Modify: `packages/plugins/stopwatch/src/lib/cli-stopwatch-command-processor.ts`

```typescript
import {
    ICliCommandProcessor, ICliExecutionContext, CliProcessCommand,
    DefaultLibraryAuthor, CliIcon, CliForegroundColor,
} from '@qodalis/cli-core';
import { formatDuration, parseDuration } from './stopwatch-utils';

export class CliStopwatchCommandProcessor implements ICliCommandProcessor {
    command = 'stopwatch';
    description = 'Interactive stopwatch. Space=pause, L=lap, R=reset, Q=quit';
    aliases = ['sw', 'timer'];
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.Clock };

    processors: ICliCommandProcessor[] = [
        {
            command: 'timer',
            description: 'Countdown timer. Usage: timer 5m, timer 1h30m',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const ms = parseDuration((cmd.value ?? '').trim());
                if (!ms) {
                    context.writer.writeError('Invalid duration. Examples: 30s, 5m, 1h30m');
                    return;
                }
                await this.runTimer(context, ms);
            },
        },
    ];

    async processCommand(cmd: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        // "stopwatch" with no subcommand → run the stopwatch
        await this.runStopwatch(context);
    }

    private async runStopwatch(context: ICliExecutionContext): Promise<void> {
        let elapsed = 0;
        let paused = false;
        let running = true;
        const laps: number[] = [];

        const CLEAR_LINE = '\r\x1b[2K';
        const renderLaps = () =>
            laps.map((l, i) => `  Lap ${i + 1}: ${formatDuration(l)}`).join('\r\n');

        context.terminal.write('\x1b[?25l'); // hide cursor

        await context.enterFullScreenMode({
            onData: async (data: string) => {
                const key = data.toLowerCase();
                if (key === ' ' || key === 'p') {
                    paused = !paused;
                } else if (key === 'l' && !paused) {
                    laps.push(elapsed);
                } else if (key === 'r') {
                    elapsed = 0;
                    laps.length = 0;
                } else if (key === 'q' || data === '\x03') {
                    running = false;
                    context.terminal.write('\x1b[?25h'); // show cursor
                    await context.exitFullScreenMode();
                }
            },
            onDispose: async () => {
                running = false;
                context.terminal.write('\x1b[?25h');
            },
        });

        const tick = context.createInterval(() => {
            if (!running) return;
            if (!paused) elapsed += 100;

            const status = paused
                ? context.writer.wrapInColor('PAUSED', CliForegroundColor.Yellow)
                : context.writer.wrapInColor('RUNNING', CliForegroundColor.Green);

            context.terminal.write(
                CLEAR_LINE +
                `\r${formatDuration(elapsed)}  [${status}]  Space=pause  L=lap  R=reset  Q=quit\r\n` +
                renderLaps(),
            );

            // Move cursor back up to overwrite next tick
            if (laps.length > 0) {
                context.terminal.write(`\x1b[${laps.length + 1}A`);
            } else {
                context.terminal.write('\x1b[1A');
            }
        }, 100);

        // Wait until stopped
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (!running) {
                    clearInterval(check);
                    tick.cancel();
                    resolve();
                }
            }, 100);
        });

        context.writer.writeln(`\r\nStopped at ${formatDuration(elapsed)}`);
        if (laps.length > 0) {
            context.writer.writeln('Laps:');
            laps.forEach((l, i) => context.writer.writeln(`  Lap ${i + 1}: ${formatDuration(l)}`));
        }
    }

    private async runTimer(context: ICliExecutionContext, totalMs: number): Promise<void> {
        let remaining = totalMs;
        let running = true;

        context.terminal.write('\x1b[?25l');
        const CLEAR_LINE = '\r\x1b[2K';

        await context.enterFullScreenMode({
            onData: async (data: string) => {
                if (data === 'q' || data === 'Q' || data === '\x03') {
                    running = false;
                    context.terminal.write('\x1b[?25h');
                    await context.exitFullScreenMode();
                }
            },
            onDispose: async () => {
                running = false;
                context.terminal.write('\x1b[?25h');
            },
        });

        const tick = context.createInterval(() => {
            if (!running) return;
            remaining = Math.max(0, remaining - 100);

            const ratio = remaining / totalMs;
            const barWidth = 30;
            const filled = Math.round(ratio * barWidth);
            const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);

            const color = remaining < 10000
                ? CliForegroundColor.Red
                : remaining < 30000
                  ? CliForegroundColor.Yellow
                  : CliForegroundColor.Green;

            context.terminal.write(
                CLEAR_LINE +
                `\r[${context.writer.wrapInColor(bar, color)}] ${formatDuration(remaining)}  Q=quit`,
            );
            context.terminal.write('\x1b[1A');

            if (remaining <= 0) {
                running = false;
                context.terminal.write('\x1b[?25h');
                context.terminal.write('\r\n');
                context.exitFullScreenMode();
                // Browser notification if available
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification('Timer complete!', { body: 'Your countdown has finished.' });
                }
                context.writer.writeSuccess('Timer complete!');
            }
        }, 100);

        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (!running) {
                    clearInterval(check);
                    tick.cancel();
                    resolve();
                }
            }, 100);
        });
    }
}
```

---

### Task 5: Run tests and commit

```bash
npx nx test stopwatch
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
npx nx build stopwatch
git add packages/plugins/stopwatch/
git commit -m "feat(stopwatch): add interactive stopwatch and countdown timer plugin"
```
