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
    const manager = context.services.get<any>('cli-server-manager');
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
        const headers = config.headers ?? {};
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
    command = 'jobs';
    description = 'Manage background jobs on connected servers';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = {
        icon: CliIcon.Gear,
        module: '@qodalis/cli-jobs',
    };

    parameters: ICliCommandParameterDescriptor[] = [serverParam];

    processors: ICliCommandChildProcessor[] = [
        // list
        {
            command: 'list',
            description: 'List all jobs across connected servers',
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
            parameters: [serverParam],
            processCommand: async (
                cmd: CliProcessCommand,
                context: ICliExecutionContext,
            ) => {
                await this.handleWatch(cmd, context);
            },
        },
    ];

    async processCommand(
        cmd: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        // Default action: list jobs
        await this.handleList(cmd, context);
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
            context.writer.writeError('Usage: jobs info <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    if (services.length === 1) {
                        context.writer.writeError(
                            `Job "${nameOrId}" not found on server ${name}.`,
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
            context.writer.writeError(`Usage: jobs ${action} <id|name>`);
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    if (services.length === 1) {
                        context.writer.writeError(
                            `Job "${nameOrId}" not found on server ${name}.`,
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
                    `Job "${job.name}" ${action}${action.endsWith('e') ? 'd' : 'ed'}${serverSuffix}.`,
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
            context.writer.writeError('Usage: jobs history <id|name>');
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

        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    if (services.length === 1) {
                        context.writer.writeError(
                            `Job "${nameOrId}" not found on server ${name}.`,
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
            context.writer.writeError('Usage: jobs logs <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        const execId = cmd.args['exec'] as string | undefined;

        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    if (services.length === 1) {
                        context.writer.writeError(
                            `Job "${nameOrId}" not found on server ${name}.`,
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
            context.writer.writeError('Usage: jobs edit <id|name>');
            return;
        }

        const services = getServices(context, cmd.args);
        if (services.length === 0) {
            context.writer.writeInfo('No connected servers.');
            return;
        }

        // Use the first matching server
        for (const { name, service } of services) {
            try {
                const job = await resolveJobId(service, nameOrId);
                if (!job) {
                    if (services.length === 1) {
                        context.writer.writeError(
                            `Job "${nameOrId}" not found on server ${name}.`,
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
        const manager = context.services.get<any>('cli-server-manager');
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
            const wsUrl =
                baseUrl
                    .replace(/^https:/, 'wss:')
                    .replace(/^http:/, 'ws:') + '/ws/v1/qcli/events';

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
