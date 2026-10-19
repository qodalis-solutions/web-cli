import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    CliForegroundColor,
    ICliCommandChildProcessor,
    ICliCommandParameterDescriptor,
    resolveServerWebSocketUrl,
    resolveServerHeaders,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { CliJobsService } from '../services/cli-jobs-service';
import { JobDto, JobExecutionDto, UpdateJobRequest } from '../models';

/**
 * Resolve connected server URLs and optional headers from the CliServerManager.
 * Returns an array of { name, service } for each connected server.
 * When --server is specified, only that server is returned.
 */
function getServices(
    context: ICliExecutionContext,
    args: Record<string, any>,
): { name: string; service: CliJobsService }[] {
    // The CliServerManager is registered under the 'cli-server-manager' token
    const manager = context.services.getRequired<any>('cli-server-manager');
    if (!manager || !manager.connections) {
        return [];
    }

    const targetServer = args['server'] as string | undefined;
    const results: { name: string; service: CliJobsService }[] = [];

    for (const [name, connection] of manager.connections as Map<string, any>) {
        if (targetServer && name !== targetServer) continue;
        if (!connection.connected) continue;

        const config = connection.config;
        const baseUrl = config.url.endsWith('/')
            ? config.url.slice(0, -1)
            : config.url;
        const headers = resolveServerHeaders(context.services, name, config.headers);
        results.push({ name, service: new CliJobsService(baseUrl, headers) });
    }

    return results;
}

/**
 * Resolve a job by name or ID. If the value looks like a UUID, use it directly;
 * otherwise, fetch the job list and find a match by name.
 */
async function resolveJobId(
    service: CliJobsService,
    nameOrId: string,
): Promise<JobDto | null> {
    // If it looks like a UUID, try fetching directly
    if (/^[0-9a-f-]{8,}$/i.test(nameOrId)) {
        try {
            return await service.getJob(nameOrId);
        } catch {
            // fall through to name search
        }
    }

    const jobs = await service.listJobs();
    const match = jobs.find(
        (j) =>
            j.name.toLowerCase() === nameOrId.toLowerCase() ||
            j.id === nameOrId,
    );
    return match ?? null;
}

function formatRelativeTime(isoString?: string): string {
    if (!isoString) return '-';
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) {
        // future
        const absDiff = -diff;
        if (absDiff < 60_000) return `in ${Math.round(absDiff / 1000)}s`;
        if (absDiff < 3_600_000) return `in ${Math.round(absDiff / 60_000)}m`;
        if (absDiff < 86_400_000) return `in ${Math.round(absDiff / 3_600_000)}h`;
        return `in ${Math.round(absDiff / 86_400_000)}d`;
    }
    if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return `${Math.round(diff / 86_400_000)}d ago`;
}

function formatDuration(ms?: number): string {
    if (ms == null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
}

function statusColor(
    status: string,
    writer: ICliExecutionContext['writer'],
): string {
    switch (status) {
        case 'active':
        case 'completed':
        case 'running':
            return writer.wrapInColor(status, CliForegroundColor.Green);
        case 'paused':
            return writer.wrapInColor(status, CliForegroundColor.Yellow);
        case 'stopped':
        case 'failed':
        case 'timed_out':
        case 'cancelled':
            return writer.wrapInColor(status, CliForegroundColor.Red);
        default:
            return status;
    }
}

function logLevelColor(
    level: string,
    writer: ICliExecutionContext['writer'],
): string {
    switch (level) {
        case 'debug':
            return writer.wrapInColor(level, CliForegroundColor.Cyan);
        case 'info':
            return writer.wrapInColor(level, CliForegroundColor.Green);
        case 'warning':
            return writer.wrapInColor(level, CliForegroundColor.Yellow);
        case 'error':
            return writer.wrapInColor(level, CliForegroundColor.Red);
        default:
            return level;
    }
}

const serverParam: ICliCommandParameterDescriptor = {
    name: 'server',
    description: 'Target a specific server by name',
    required: false,
    type: 'string',
};

export class CliJobsCommandProcessor implements ICliCommandProcessor {
    command = 'server';

    extendsProcessor = true;

    description = 'Manage background jobs on connected servers';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = {
        icon: CliIcon.Gear,
        module: '@qodalis/cli-server-jobs',
    };

    processors?: ICliCommandProcessor[] = [
        {
            command: 'jobs',
            description: 'Manage background jobs on connected servers',
            author: DefaultLibraryAuthor,
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'See and control the background jobs that run on connected servers: list them, run one now, pause or stop it, read its history and logs, change its settings, or watch events live. A job is picked by name (any case) or ID and looked up on the connected servers; --server limits a command to one server.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs', 'Same as server jobs list'],
                    ['server jobs <action> <name|id>', 'info, trigger, pause, resume, stop, cancel, history, logs, edit'],
                    ['server jobs watch', 'Live job events'],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs', 'All jobs'],
                    ['server jobs trigger cleanup', 'Run the cleanup job now'],
                    ['server jobs history cleanup --status failed', 'Its failed runs'],
                    ['server jobs logs cleanup --server node', 'Last run output, on node'],
                ]);
            },
            metadata: {
                icon: CliIcon.Gear,
                module: '@qodalis/cli-server-jobs',
            },
            parameters: [serverParam],
            processors: [
        // list
        {
            command: 'list',
            description: 'List all jobs across connected servers',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'List the jobs of every connected server: group, status, schedule, last and next run, and how long the last run took. With several servers, each gets its own table.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs list', 'Jobs on all connected servers'],
                    ['server jobs ls --group <name>', 'Only one group'],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs ls --server node', 'Jobs on the node server'],
                    ['server jobs list --group reports', 'Jobs in the reports group'],
                ]);
            },
            aliases: ['ls'],
            parameters: [
                serverParam,
                {
                    name: 'group',
                    description: 'Filter jobs by group',
                    required: false,
                    type: 'string',
                },
            ],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleList(cmd, context);
            },
        },
        // info
        {
            command: 'info',
            description: 'Show detailed information about a job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Show everything about one job: schedule, retries, timeout, overlap policy, the execution running now and the result of the last run. The job is found by name (any case) or ID.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs info <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs info cleanup', 'Details of the cleanup job'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleInfo(cmd, context);
            },
        },
        // trigger
        {
            command: 'trigger',
            description: 'Trigger immediate execution of a job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Run a job now, without waiting for its next scheduled time. Its schedule does not change.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs trigger <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs trigger cleanup', 'Run cleanup now'],
                    ['server jobs logs cleanup', 'Then read its output'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleAction(cmd, context, 'trigger');
            },
        },
        // pause
        {
            command: 'pause',
            description: 'Pause scheduled execution of a job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Stop running a job on its schedule until it is resumed. Use cancel or stop for a run that is already in progress.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs pause <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs pause cleanup', 'Hold cleanup'],
                    ['server jobs resume cleanup', 'Put it back on schedule'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleAction(cmd, context, 'pause');
            },
        },
        // resume
        {
            command: 'resume',
            description: 'Resume a paused job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Put a paused job back on its schedule.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs resume <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs resume cleanup', 'Run cleanup on schedule again'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleAction(cmd, context, 'resume');
            },
        },
        // stop
        {
            command: 'stop',
            description: 'Stop a job and cancel current execution if running',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Take a job off its schedule and cancel the run in progress, if there is one.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs stop <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs stop cleanup', 'Stop cleanup completely'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleAction(cmd, context, 'stop');
            },
        },
        // cancel
        {
            command: 'cancel',
            description: 'Cancel the current execution of a job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Cancel the run in progress of a job. The job stays on its schedule and runs again at the next time.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs cancel <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs cancel cleanup', 'Abort the current cleanup run'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleAction(cmd, context, 'cancel');
            },
        },
        // history
        {
            command: 'history',
            description: 'Show execution history for a job',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'List the past runs of a job: status, start time, duration, retry attempt and the start of the error message. Use the short ID with logs --exec to read the output of one run.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs history <name|id>', 'The last 20 runs'],
                    ['server jobs history <name|id> --limit <n> --offset <n>', 'Page through older runs'],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs history cleanup --status failed', 'Only failed runs'],
                    ['server jobs history cleanup --limit 5', 'The last 5 runs'],
                ]);
            },
            valueRequired: true,
            parameters: [
                serverParam,
                {
                    name: 'limit',
                    description: 'Number of entries to show (default 20)',
                    required: false,
                    type: 'number',
                    defaultValue: 20,
                },
                {
                    name: 'offset',
                    description: 'Offset for pagination',
                    required: false,
                    type: 'number',
                    defaultValue: 0,
                },
                {
                    name: 'status',
                    description: 'Filter by execution status',
                    required: false,
                    type: 'string',
                },
            ],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleHistory(cmd, context);
            },
        },
        // logs
        {
            command: 'logs',
            description: 'Show logs from the latest or a specific execution',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Print the log entries of the latest run of a job, or of one run picked by its execution ID (from history).',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs logs <name|id>', 'Logs of the latest run'],
                    ['server jobs logs <name|id> --exec <id>', 'Logs of one run'],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs logs cleanup', 'What the last cleanup run printed'],
                ]);
            },
            valueRequired: true,
            parameters: [
                serverParam,
                {
                    name: 'exec',
                    description: 'Specific execution ID to show logs for',
                    required: false,
                    type: 'string',
                },
            ],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleLogs(cmd, context);
            },
        },
        // edit
        {
            command: 'edit',
            description: 'Interactively edit job settings',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Change a job step by step: description, group, cron schedule or interval, max retries, timeout and overlap policy (skip, queue or cancel). Press Enter to keep a value; nothing changes until you confirm.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs edit <name|id>', ''],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs edit cleanup', 'Edit cleanup on the server that has it'],
                ]);
            },
            valueRequired: true,
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleEdit(cmd, context);
            },
        },
        // watch
        {
            command: 'watch',
            description: 'Live view of job events via WebSocket',
            writeDescription: (context: ICliExecutionContext) => {
                writeWrapped(
                    context,
                    'Follow job events as they happen (started, completed, failed and so on) on every connected server, one line per event. Press Ctrl+C to stop.',
                );
                context.writer.writeln();
                writeUsage(context, [
                    ['server jobs watch', 'Events from all connected servers'],
                ]);
                context.writer.writeln();
                writeExamples(context, [
                    ['server jobs watch --server node', 'Only events from node'],
                ]);
            },
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleWatch(cmd, context);
            },
        },
            ] as ICliCommandChildProcessor[],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                // Default action: list jobs
                await this.handleList(cmd, context);
            },
        } as any,
    ];

    async processCommand(
        _cmd: CliProcessCommand,
        _context: ICliExecutionContext,
    ): Promise<void> {
        // Not called — this processor extends 'server' and delegates to child processors
    }

    // ── List ──────────────────────────────────────────────────────────

    private async handleList(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo(
                'No connected servers. Use "server list" to check connections.',
            );
            return;
        }

        const groupFilter = cmd.args['group'] as string | undefined;
        const multiServer = services.length > 1;

        for (const { name, service } of services) {
            try {
                let jobs = await service.listJobs();
                if (groupFilter) {
                    jobs = jobs.filter(
                        (j) =>
                            j.group?.toLowerCase() ===
                            groupFilter.toLowerCase(),
                    );
                }

                if (multiServer) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `Server: ${name}`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                }

                if (jobs.length === 0) {
                    context.writer.writeInfo('  No jobs found.');
                    continue;
                }

                const headers = [
                    'Name',
                    'Group',
                    'Status',
                    'Schedule',
                    'Last Run',
                    'Next Run',
                    'Duration',
                ];
                const rows: string[][] = jobs.map((j) => [
                    j.name,
                    j.group ?? '-',
                    statusColor(j.status, context.writer),
                    j.schedule ?? (j.interval ? `every ${j.interval}ms` : '-'),
                    formatRelativeTime(j.lastRunAt),
                    formatRelativeTime(j.nextRunAt),
                    formatDuration(j.lastRunDuration),
                ]);

                context.writer.writeTable(headers, rows);
            } catch (e: any) {
                context.writer.writeError(
                    `Failed to list jobs on ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── Info ──────────────────────────────────────────────────────────

    private async handleInfo(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const nameOrId = (cmd.value ?? '').trim();
        if (!nameOrId) {
            context.writer.writeError('Usage: server jobs info <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        let missing = 0;
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    // Report once, when no server has the job
                    if (++missing === services.length) {
                        context.writer.writeError(
                            services.length === 1
                                ? `Job "${nameOrId}" not found on server ${name}.`
                                : `Job "${nameOrId}" not found on any of the ${services.length} connected servers.`,
                        );
                    }
                    continue;
                }

                if (services.length > 1) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `Server: ${name}`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                }

                const lines: [string, string][] = [
                    ['ID', job.id],
                    ['Name', job.name],
                    ['Description', job.description],
                    ['Group', job.group ?? '-'],
                    ['Status', statusColor(job.status, context.writer)],
                    [
                        'Schedule',
                        job.schedule ??
                            (job.interval
                                ? `every ${job.interval}ms`
                                : '-'),
                    ],
                    ['Max Retries', String(job.maxRetries)],
                    [
                        'Timeout',
                        job.timeout ? `${job.timeout}ms` : 'none',
                    ],
                    ['Overlap Policy', job.overlapPolicy],
                    [
                        'Current Execution',
                        job.currentExecutionId ?? 'none',
                    ],
                    ['Next Run', formatRelativeTime(job.nextRunAt)],
                    ['Last Run', formatRelativeTime(job.lastRunAt)],
                    [
                        'Last Run Status',
                        job.lastRunStatus
                            ? statusColor(job.lastRunStatus, context.writer)
                            : '-',
                    ],
                    ['Last Run Duration', formatDuration(job.lastRunDuration)],
                ];

                for (const [label, value] of lines) {
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(
                            label.padEnd(20),
                            CliForegroundColor.Yellow,
                        )} ${value}`,
                    );
                }
                return; // found on this server
            } catch (e: any) {
                context.writer.writeError(
                    `Error on server ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── Action (trigger/pause/resume/stop/cancel) ────────────────────

    private async handleAction(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
        action: 'trigger' | 'pause' | 'resume' | 'stop' | 'cancel',
    ): Promise<void> {
        const nameOrId = (cmd.value ?? '').trim();
        if (!nameOrId) {
            context.writer.writeError(`Usage: server jobs ${action} <id|name>`);
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        let missing = 0;
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    // Report once, when no server has the job
                    if (++missing === services.length) {
                        context.writer.writeError(
                            services.length === 1
                                ? `Job "${nameOrId}" not found on server ${name}.`
                                : `Job "${nameOrId}" not found on any of the ${services.length} connected servers.`,
                        );
                    }
                    continue;
                }

                switch (action) {
                    case 'trigger':
                        await service.triggerJob(job.id);
                        break;
                    case 'pause':
                        await service.pauseJob(job.id);
                        break;
                    case 'resume':
                        await service.resumeJob(job.id);
                        break;
                    case 'stop':
                        await service.stopJob(job.id);
                        break;
                    case 'cancel':
                        await service.cancelJob(job.id);
                        break;
                }

                const serverSuffix =
                    services.length > 1 ? ` on server ${name}` : '';
                context.writer.writeSuccess(
                    `Job "${job.name}" ${PAST_TENSE[action] ?? `${action}ed`}${serverSuffix}.`,
                );
                return;
            } catch (e: any) {
                context.writer.writeError(
                    `Failed to ${action} job on ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── History ──────────────────────────────────────────────────────

    private async handleHistory(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const nameOrId = (cmd.value ?? '').trim();
        if (!nameOrId) {
            context.writer.writeError('Usage: server jobs history <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        const limit = (cmd.args['limit'] as number) ?? 20;
        const offset = (cmd.args['offset'] as number) ?? 0;
        const status = cmd.args['status'] as string | undefined;

        let missing = 0;
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    // Report once, when no server has the job
                    if (++missing === services.length) {
                        context.writer.writeError(
                            services.length === 1
                                ? `Job "${nameOrId}" not found on server ${name}.`
                                : `Job "${nameOrId}" not found on any of the ${services.length} connected servers.`,
                        );
                    }
                    continue;
                }

                if (services.length > 1) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `Server: ${name}`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                }

                const history = await service.getHistory(job.id, {
                    limit,
                    offset,
                    status,
                });

                if (history.items.length === 0) {
                    context.writer.writeInfo(
                        `No execution history for "${job.name}".`,
                    );
                    return;
                }

                context.writer.writeln(
                    `Showing ${history.items.length} of ${history.total} executions for "${job.name}":`,
                );

                const headers = [
                    'ID',
                    'Status',
                    'Started',
                    'Duration',
                    'Retry',
                    'Error',
                ];
                const rows: string[][] = history.items.map((exec) => [
                    exec.id.substring(0, 8),
                    statusColor(exec.status, context.writer),
                    formatRelativeTime(exec.startedAt),
                    formatDuration(exec.duration),
                    String(exec.retryAttempt),
                    exec.error ? exec.error.substring(0, 40) : '-',
                ]);

                context.writer.writeTable(headers, rows);
                return;
            } catch (e: any) {
                context.writer.writeError(
                    `Error on server ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── Logs ─────────────────────────────────────────────────────────

    private async handleLogs(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const nameOrId = (cmd.value ?? '').trim();
        if (!nameOrId) {
            context.writer.writeError('Usage: server jobs logs <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        const execId = cmd.args['exec'] as string | undefined;

        let missing = 0;
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    // Report once, when no server has the job
                    if (++missing === services.length) {
                        context.writer.writeError(
                            services.length === 1
                                ? `Job "${nameOrId}" not found on server ${name}.`
                                : `Job "${nameOrId}" not found on any of the ${services.length} connected servers.`,
                        );
                    }
                    continue;
                }

                let execution: JobExecutionDto;

                if (execId) {
                    execution = await service.getExecution(job.id, execId);
                } else {
                    // Get the latest execution
                    const history = await service.getHistory(job.id, {
                        limit: 1,
                    });
                    if (history.items.length === 0) {
                        context.writer.writeInfo(
                            `No executions found for "${job.name}".`,
                        );
                        return;
                    }
                    // Fetch full execution to get logs
                    execution = await service.getExecution(
                        job.id,
                        history.items[0].id,
                    );
                }

                if (services.length > 1) {
                    context.writer.writeln(
                        context.writer.wrapInColor(
                            `Server: ${name}`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                }

                context.writer.writeln(
                    `Logs for "${job.name}" execution ${execution.id.substring(0, 8)} (${statusColor(execution.status, context.writer)}):`,
                );

                if (!execution.logs || execution.logs.length === 0) {
                    context.writer.writeInfo('  No log entries.');
                    return;
                }

                for (const entry of execution.logs) {
                    const ts = new Date(entry.timestamp).toLocaleTimeString();
                    const level = logLevelColor(
                        entry.level,
                        context.writer,
                    ).padEnd(12);
                    context.writer.writeln(
                        `  ${context.writer.wrapInColor(ts, CliForegroundColor.White)} ${level} ${entry.message}`,
                    );
                }
                return;
            } catch (e: any) {
                context.writer.writeError(
                    `Error on server ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── Edit ─────────────────────────────────────────────────────────

    private async handleEdit(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const nameOrId = (cmd.value ?? '').trim();
        if (!nameOrId) {
            context.writer.writeError('Usage: server jobs edit <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        // Use the first matching server
        let missing = 0;
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    // Report once, when no server has the job
                    if (++missing === services.length) {
                        context.writer.writeError(
                            services.length === 1
                                ? `Job "${nameOrId}" not found on server ${name}.`
                                : `Job "${nameOrId}" not found on any of the ${services.length} connected servers.`,
                        );
                    }
                    continue;
                }

                context.writer.writeln(
                    `Editing job "${context.writer.wrapInColor(job.name, CliForegroundColor.Cyan)}" on server ${name}`,
                );
                context.writer.writeln(
                    'Press Enter to keep current value, or type a new value.',
                );
                context.writer.writeln('');

                const update: UpdateJobRequest = {};

                // Description
                const newDesc = await context.reader.readLine(
                    `Description [${job.description}]: `,
                );
                if (newDesc == null) {
                    context.writer.writeInfo('Edit cancelled.');
                    return;
                }
                if (newDesc.trim()) {
                    update.description = newDesc.trim();
                }

                // Group
                const newGroup = await context.reader.readLine(
                    `Group [${job.group ?? 'none'}]: `,
                );
                if (newGroup == null) {
                    context.writer.writeInfo('Edit cancelled.');
                    return;
                }
                if (newGroup.trim()) {
                    update.group = newGroup.trim();
                }

                // Schedule
                const currentSchedule =
                    job.schedule ??
                    (job.interval ? `interval: ${job.interval}ms` : 'none');
                const newSchedule = await context.reader.readLine(
                    `Cron schedule [${currentSchedule}]: `,
                );
                if (newSchedule == null) {
                    context.writer.writeInfo('Edit cancelled.');
                    return;
                }
                if (newSchedule.trim()) {
                    update.schedule = newSchedule.trim();
                }

                // Interval
                if (!newSchedule.trim()) {
                    const newInterval = await context.reader.readLine(
                        `Interval (e.g. 30s, 5m) [${job.interval ? `${job.interval}ms` : 'none'}]: `,
                    );
                    if (newInterval != null && newInterval.trim()) {
                        update.interval = newInterval.trim();
                    }
                }

                // Max retries
                const newRetries = await context.reader.readLine(
                    `Max retries [${job.maxRetries}]: `,
                );
                if (newRetries != null && newRetries.trim()) {
                    const parsed = parseInt(newRetries.trim(), 10);
                    if (!isNaN(parsed)) {
                        update.maxRetries = parsed;
                    }
                }

                // Timeout
                const newTimeout = await context.reader.readLine(
                    `Timeout (e.g. 5m, 1h) [${job.timeout ? `${job.timeout}ms` : 'none'}]: `,
                );
                if (newTimeout != null && newTimeout.trim()) {
                    update.timeout = newTimeout.trim();
                }

                // Overlap policy
                const newOverlap = await context.reader.readLine(
                    `Overlap policy (skip/queue/cancel) [${job.overlapPolicy}]: `,
                );
                if (
                    newOverlap != null &&
                    newOverlap.trim() &&
                    ['skip', 'queue', 'cancel'].includes(
                        newOverlap.trim().toLowerCase(),
                    )
                ) {
                    update.overlapPolicy = newOverlap.trim().toLowerCase();
                }

                // Check if anything changed
                if (Object.keys(update).length === 0) {
                    context.writer.writeInfo('No changes made.');
                    return;
                }

                // Confirm
                const confirm = await context.reader.readConfirm(
                    'Apply changes?',
                );
                if (!confirm) {
                    context.writer.writeInfo('Edit cancelled.');
                    return;
                }

                await service.updateJob(job.id, update);
                context.writer.writeSuccess(
                    `Job "${job.name}" updated successfully.`,
                );
                return;
            } catch (e: any) {
                context.writer.writeError(
                    `Error on server ${name}: ${e.message}`,
                );
            }
        }
    }

    // ── Watch ────────────────────────────────────────────────────────

    private async handleWatch(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.getRequired<any>('cli-server-manager');
        if (!manager || !manager.connections) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        const targetServer = cmd.args['server'] as string | undefined;

        context.writer.writeln(
            context.writer.wrapInColor(
                'Watching job events... (press Ctrl+C to stop)',
                CliForegroundColor.Cyan,
            ),
        );
        context.writer.writeln('');

        const sockets: WebSocket[] = [];
        const abortHandler = () => {
            for (const ws of sockets) {
                try {
                    ws.close();
                } catch {
                    // ignore
                }
            }
        };

        context.onAbort.subscribe(abortHandler);

        for (const [serverName, connection] of manager.connections as Map<
            string,
            any
        >) {
            if (targetServer && serverName !== targetServer) continue;
            if (!connection.connected) continue;

            const config = connection.config;
            const baseUrl = config.url.endsWith('/')
                ? config.url.slice(0, -1)
                : config.url;
            const wsUrl = await resolveServerWebSocketUrl(
                context.services,
                serverName,
                baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws/v1/qcli/events',
                config.headers,
            );

            try {
                const ws = new WebSocket(wsUrl);
                sockets.push(ws);

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (
                            !data.type ||
                            !data.type.startsWith('job:')
                        ) {
                            return;
                        }

                        const ts = new Date().toLocaleTimeString();
                        const serverPrefix =
                            manager.connections.size > 1
                                ? context.writer.wrapInColor(
                                      `[${serverName}] `,
                                      CliForegroundColor.Cyan,
                                  )
                                : '';

                        let detail = '';
                        if (data.jobId) {
                            detail += ` jobId=${data.jobId}`;
                        }
                        if (data.executionId) {
                            detail += ` execId=${data.executionId.substring(0, 8)}`;
                        }
                        if (data.duration != null) {
                            detail += ` duration=${formatDuration(data.duration)}`;
                        }
                        if (data.error) {
                            detail += ` error="${data.error}"`;
                        }

                        const eventType = statusColor(
                            data.type.replace('job:', ''),
                            context.writer,
                        );

                        context.writer.writeln(
                            `${context.writer.wrapInColor(ts, CliForegroundColor.White)} ${serverPrefix}${eventType}${detail}`,
                        );
                    } catch {
                        // ignore malformed messages
                    }
                };

                ws.onerror = () => {
                    context.writer.writeError(
                        `WebSocket error on server ${serverName}`,
                    );
                };

                ws.onclose = () => {
                    // Will close when aborted
                };
            } catch (e: any) {
                context.writer.writeError(
                    `Failed to connect to ${serverName}: ${e.message}`,
                );
            }
        }

        // Keep the command alive until aborted
        await new Promise<void>((resolve) => {
            const sub = context.onAbort.subscribe(() => {
                sub.unsubscribe();
                resolve();
            });
            // Also resolve if the signal fires
            if (context.signal) {
                context.signal.addEventListener('abort', () => {
                    sub.unsubscribe();
                    resolve();
                });
            }
        });

        context.writer.writeln('');
        context.writer.writeInfo('Stopped watching job events.');
    }
}

/** Past tense of the job actions, for the confirmation message. */
const PAST_TENSE: Record<string, string> = {
    trigger: 'triggered',
    pause: 'paused',
    resume: 'resumed',
    stop: 'stopped',
    cancel: 'cancelled',
};
