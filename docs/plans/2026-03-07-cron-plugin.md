# Cron/Scheduler Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@qodalis/cli-cron` plugin that schedules CLI commands to run on a repeating interval. Jobs run as background services visible in `services list`.

**Architecture:** New plugin scaffolded via `create-plugin`. Each cron job is registered as a `CliBackgroundService` in the `ICliBackgroundServiceRegistry`. The job schedule uses a simple interval string (`30s`, `5m`, `1h`) — no cron expression syntax to keep it simple. Jobs persist across sessions via state store. Subcommands: `add`, `list`, `remove`, `enable`, `disable`.

**Tech Stack:** TypeScript, ICliBackgroundServiceRegistry, CliStateStore, Jasmine

---

### Task 1: Scaffold the plugin

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name cron --description "Schedule commands to run on a repeating interval" --processor-name CliCronCommandProcessor
git add packages/plugins/cron/
git commit -m "chore(cron): scaffold cron plugin"
```

---

### Task 2: Write failing tests for schedule parsing

**Files:**
- Create: `packages/plugins/cron/src/tests/cron.spec.ts`

```typescript
import { parseInterval, formatInterval } from '../lib/cron-utils';

describe('cron-utils', () => {
    describe('parseInterval', () => {
        it('parses 30s → 30000ms', () => expect(parseInterval('30s')).toBe(30000));
        it('parses 5m → 300000ms', () => expect(parseInterval('5m')).toBe(300000));
        it('parses 1h → 3600000ms', () => expect(parseInterval('1h')).toBe(3600000));
        it('parses 2h30m → 9000000ms', () => expect(parseInterval('2h30m')).toBe(9000000));
        it('returns null for invalid', () => expect(parseInterval('abc')).toBeNull());
        it('returns null for empty', () => expect(parseInterval('')).toBeNull());
        it('enforces min 10s', () => expect(parseInterval('5s')).toBeNull());
    });

    describe('formatInterval', () => {
        it('formats 30000ms → 30s', () => expect(formatInterval(30000)).toBe('30s'));
        it('formats 300000ms → 5m', () => expect(formatInterval(300000)).toBe('5m'));
        it('formats 3600000ms → 1h', () => expect(formatInterval(3600000)).toBe('1h'));
        it('formats 9000000ms → 2h 30m', () => expect(formatInterval(9000000)).toBe('2h 30m'));
    });
});
```

Run to verify failure:
```bash
npx nx test cron
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 3: Implement cron utilities

**Files:**
- Create: `packages/plugins/cron/src/lib/cron-utils.ts`

```typescript
const MIN_INTERVAL_MS = 10_000; // 10 seconds minimum

export function parseInterval(input: string): number | null {
    if (!input.trim()) return null;
    const pattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
    const match = input.trim().match(pattern);
    if (!match || !match[0]) return null;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    const total = h * 3_600_000 + m * 60_000 + s * 1_000;
    if (total < MIN_INTERVAL_MS) return null;
    return total > 0 ? total : null;
}

export function formatInterval(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}
```

---

### Task 4: Implement the cron processor

**Files:**
- Modify: `packages/plugins/cron/src/lib/cli-cron-command-processor.ts`

```typescript
import {
    ICliCommandProcessor, ICliExecutionContext, CliProcessCommand,
    CliStateConfiguration, DefaultLibraryAuthor, CliIcon,
    CliForegroundColor, ICliBackgroundServiceRegistry,
    CliBackgroundServiceRegistry_TOKEN,
} from '@qodalis/cli-core';
import { parseInterval, formatInterval } from './cron-utils';

interface CronJob {
    id: string;
    name: string;
    command: string;
    intervalMs: number;
    enabled: boolean;
    lastRun?: number;
    runCount: number;
}

interface CronState {
    jobs: CronJob[];
}

export class CliCronCommandProcessor implements ICliCommandProcessor {
    command = 'cron';
    description = 'Schedule commands to run on a repeating interval';
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.Clock };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'cron',
        initialState: { jobs: [] } as CronState,
    };

    private timers = new Map<string, ReturnType<typeof setInterval>>();

    processors: ICliCommandProcessor[] = [
        {
            command: 'add',
            description: 'Add a cron job: cron add <name> <interval> <command>',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                // Parse: <name> <interval> <rest as command>
                const parts = (cmd.value ?? '').trim().split(/\s+/);
                if (parts.length < 3) {
                    context.writer.writeError('Usage: cron add <name> <interval> <command>');
                    context.writer.writeln('  Example: cron add ping 5m echo "heartbeat"');
                    return;
                }
                const [name, intervalStr, ...cmdParts] = parts;
                const command = cmdParts.join(' ');
                const intervalMs = parseInterval(intervalStr);
                if (!intervalMs) {
                    context.writer.writeError(`Invalid interval "${intervalStr}". Examples: 10s, 5m, 1h`);
                    return;
                }
                const state = context.state.getState<CronState>();
                if (state.jobs.find((j) => j.name === name)) {
                    context.writer.writeError(`Job "${name}" already exists. Use cron remove ${name} first.`);
                    return;
                }
                const job: CronJob = {
                    id: `cron_${Date.now()}`,
                    name,
                    command,
                    intervalMs,
                    enabled: true,
                    runCount: 0,
                };
                state.jobs.push(job);
                context.state.updateState({ jobs: [...state.jobs] });
                await context.state.persist();
                this.startJob(job, context);
                context.writer.writeSuccess(
                    `Cron job "${name}" added — runs every ${formatInterval(intervalMs)}: ${command}`,
                );
            },
        },
        {
            command: 'list',
            description: 'List all cron jobs',
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { jobs } = context.state.getState<CronState>();
                if (!jobs.length) {
                    context.writer.writeInfo('No cron jobs. Use: cron add <name> <interval> <command>');
                    return;
                }
                context.writer.writeln(
                    context.writer.wrapInColor('Cron Jobs:', CliForegroundColor.Yellow),
                );
                for (const job of jobs) {
                    const status = job.enabled
                        ? context.writer.wrapInColor('enabled', CliForegroundColor.Green)
                        : context.writer.wrapInColor('disabled', CliForegroundColor.Red);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(job.name.padEnd(12), CliForegroundColor.Cyan)} [${status}]  every ${formatInterval(job.intervalMs)}  →  ${job.command}  (ran ${job.runCount}x)`,
                    );
                }
            },
        },
        {
            command: 'remove',
            description: 'Remove a cron job by name',
            aliases: ['rm', 'delete'],
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const name = (cmd.value ?? '').trim();
                const state = context.state.getState<CronState>();
                const idx = state.jobs.findIndex((j) => j.name === name);
                if (idx === -1) {
                    context.writer.writeError(`Job "${name}" not found`);
                    return;
                }
                const [job] = state.jobs.splice(idx, 1);
                this.stopJob(job.id);
                context.state.updateState({ jobs: [...state.jobs] });
                await context.state.persist();
                context.writer.writeSuccess(`Cron job "${name}" removed`);
            },
        },
        {
            command: 'enable',
            description: 'Enable a paused cron job',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                this.setEnabled(cmd.value?.trim() ?? '', true, context);
            },
        },
        {
            command: 'disable',
            description: 'Pause a cron job without removing it',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                this.setEnabled(cmd.value?.trim() ?? '', false, context);
            },
        },
    ];

    async initialize(context: ICliExecutionContext): Promise<void> {
        const { jobs } = context.state.getState<CronState>();
        for (const job of jobs.filter((j) => j.enabled)) {
            this.startJob(job, context);
        }
    }

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const { jobs } = context.state.getState<CronState>();
        context.writer.writeln(`${jobs.length} job(s). Sub-commands: add, list, remove, enable, disable`);
    }

    private startJob(job: CronJob, context: ICliExecutionContext): void {
        if (this.timers.has(job.id)) return;
        const timer = setInterval(async () => {
            if (!job.enabled) return;
            try {
                await context.executor.executeCommand(job.command, context);
                job.runCount++;
                job.lastRun = Date.now();
                context.state.updateState({ jobs: [...context.state.getState<CronState>().jobs] });
            } catch (e) {
                console.error(`Cron job "${job.name}" failed:`, e);
            }
        }, job.intervalMs);
        this.timers.set(job.id, timer);
    }

    private stopJob(id: string): void {
        const timer = this.timers.get(id);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(id);
        }
    }

    private async setEnabled(name: string, enabled: boolean, context: ICliExecutionContext): Promise<void> {
        const state = context.state.getState<CronState>();
        const job = state.jobs.find((j) => j.name === name);
        if (!job) {
            context.writer.writeError(`Job "${name}" not found`);
            return;
        }
        job.enabled = enabled;
        if (enabled) {
            this.startJob(job, context);
        } else {
            this.stopJob(job.id);
        }
        context.state.updateState({ jobs: [...state.jobs] });
        await context.state.persist();
        context.writer.writeSuccess(`Job "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    }
}
```

---

### Task 5: Run tests and commit

```bash
npx nx test cron
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
npx nx build cron
git add packages/plugins/cron/
git commit -m "feat(cron): add cron scheduler plugin for repeating commands"
```
