import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    CliStateConfiguration,
    DefaultLibraryAuthor,
    CliForegroundColor,
    ICliCommandChildProcessor,
} from '@qodalis/cli-core';
import { parseInterval, formatInterval } from '../cron-utils';

interface CronJob {
    id: string;
    name: string;
    command: string;
    intervalMs: number;
    enabled: boolean;
    runCount: number;
    lastRun?: number;
}

interface CronState {
    jobs: CronJob[];
}

export class CliCronCommandProcessor implements ICliCommandProcessor {
    command = 'cron';
    description = 'Schedule commands to run on a repeating interval';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Clock };

    stateConfiguration: CliStateConfiguration = {
        storeName: 'cron',
        initialState: { jobs: [] } as CronState,
    };

    private timers = new Map<string, ReturnType<typeof setInterval>>();

    processors: ICliCommandChildProcessor[] = [
        {
            command: 'add',
            description: 'Add a cron job: cron add <name> <interval> <command>',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const parts = (cmd.value ?? '').trim().split(/\s+/);
                if (parts.length < 3) {
                    context.writer.writeError('Usage: cron add <name> <interval> <command>');
                    context.writer.writeln('  Example: cron add ping 5m echo heartbeat');
                    return;
                }
                const [name, intervalStr, ...cmdParts] = parts;
                const command = cmdParts.join(' ');
                const intervalMs = parseInterval(intervalStr);
                if (!intervalMs) {
                    context.writer.writeError(`Invalid interval "${intervalStr}". Min 10s. Examples: 10s, 5m, 1h`);
                    return;
                }
                const state = context.state.getState<CronState>();
                if (state.jobs.find((j) => j.name === name)) {
                    context.writer.writeError(`Job "${name}" already exists. Remove it first: cron remove ${name}`);
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
                const updated = [...state.jobs, job];
                context.state.updateState({ jobs: updated });
                await context.state.persist();
                this.startJob(job, context);
                context.writer.writeSuccess(
                    `Job "${name}" added — runs every ${formatInterval(intervalMs)}: ${command}`,
                );
            },
        },
        {
            command: 'list',
            description: 'List all cron jobs',
            aliases: ['ls'],
            processCommand: async (_: CliProcessCommand, context: ICliExecutionContext) => {
                const { jobs } = context.state.getState<CronState>();
                if (!jobs.length) {
                    context.writer.writeInfo('No cron jobs. Use: cron add <name> <interval> <command>');
                    return;
                }
                context.writer.writeln(context.writer.wrapInColor('Cron Jobs:', CliForegroundColor.Yellow));
                for (const job of jobs) {
                    const status = job.enabled
                        ? context.writer.wrapInColor('enabled ', CliForegroundColor.Green)
                        : context.writer.wrapInColor('disabled', CliForegroundColor.Red);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(job.name.padEnd(12), CliForegroundColor.Cyan)}` +
                        `[${status}]  every ${formatInterval(job.intervalMs)}  \u2192 ${job.command}  (ran ${job.runCount}x)`,
                    );
                }
            },
        },
        {
            command: 'remove',
            description: 'Remove a cron job: cron remove <name>',
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
                const job = state.jobs[idx];
                this.stopJob(job.id);
                const updated = state.jobs.filter((j) => j.name !== name);
                context.state.updateState({ jobs: updated });
                await context.state.persist();
                context.writer.writeSuccess(`Job "${name}" removed`);
            },
        },
        {
            command: 'enable',
            description: 'Enable a paused cron job',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                await this.setEnabled((cmd.value ?? '').trim(), true, context);
            },
        },
        {
            command: 'disable',
            description: 'Pause a cron job without removing it',
            acceptsRawInput: true,
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                await this.setEnabled((cmd.value ?? '').trim(), false, context);
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
        if (this.timers.has(job.id)) return; // already running
        const timer = setInterval(async () => {
            if (!job.enabled) return;
            try {
                await context.executor.executeCommand(job.command, context);
                job.runCount++;
                job.lastRun = Date.now();
                const state = context.state.getState<CronState>();
                const updated = state.jobs.map((j) =>
                    j.id === job.id ? { ...j, runCount: job.runCount, lastRun: job.lastRun } : j,
                );
                context.state.updateState({ jobs: updated });
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
        const jobIdx = state.jobs.findIndex((j) => j.name === name);
        if (jobIdx === -1) {
            context.writer.writeError(`Job "${name}" not found`);
            return;
        }
        const job = state.jobs[jobIdx];
        job.enabled = enabled;
        if (enabled) {
            this.startJob(job, context);
        } else {
            this.stopJob(job.id);
        }
        const updated = state.jobs.map((j) => j.name === name ? { ...j, enabled } : j);
        context.state.updateState({ jobs: updated });
        await context.state.persist();
        context.writer.writeSuccess(`Job "${name}" ${enabled ? 'enabled' : 'disabled'}`);
    }
}
