import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliBackgroundServiceInfo,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

/**
 * Format an uptime value (in milliseconds) as a human-readable string.
 * Examples: "12m 34s", "2h 15m", "3d 1h".
 */
function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
}

/**
 * Return a color-coded status string.
 * running = Green, stopped = White, failed = Red, done = Cyan, pending = Yellow.
 */
function colorStatus(
    status: string,
    wrapInColor: (text: string, color: CliForegroundColor) => string,
): string {
    switch (status) {
        case 'running':
            return wrapInColor(status, CliForegroundColor.Green);
        case 'stopped':
            return wrapInColor(status, CliForegroundColor.White);
        case 'failed':
            return wrapInColor(status, CliForegroundColor.Red);
        case 'done':
            return wrapInColor(status, CliForegroundColor.Cyan);
        case 'pending':
            return wrapInColor(status, CliForegroundColor.Yellow);
        default:
            return status;
    }
}

export class CliServicesCommandProcessor implements ICliCommandProcessor {
    command = 'services';

    aliases = ['svc'];

    description = 'Manage background services and jobs';

    author = DefaultLibraryAuthor;

    processors?: ICliCommandProcessor[] = [];

    metadata?: CliProcessorMetadata = {
        sealed: true,
        icon: '\u2699',
        module: 'system',
    };

    constructor() {
        this.processors = [
            // ── list ──────────────────────────────────────────────
            {
                command: 'list',
                aliases: ['ls'],
                description: 'List all registered background services',
                processCommand: async (
                    _: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const { writer } = context;
                    const services = context.backgroundServices.list();

                    if (services.length === 0) {
                        writer.writeInfo('No background services registered');
                        return;
                    }

                    const rows = services.map(
                        (svc: ICliBackgroundServiceInfo) => [
                            svc.name,
                            svc.type,
                            colorStatus(
                                svc.status,
                                writer.wrapInColor.bind(writer),
                            ),
                            svc.executionMode,
                            svc.status === 'running' && svc.uptime != null
                                ? formatUptime(svc.uptime)
                                : '-',
                        ],
                    );

                    writer.writeTable(
                        ['Name', 'Type', 'Status', 'Mode', 'Uptime'],
                        rows,
                    );
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'List all registered background services with their status',
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services list', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // ── start ─────────────────────────────────────────────
            {
                command: 'start',
                description: 'Start a background service',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value as string;
                    try {
                        await context.backgroundServices.start(name);
                        context.writer.writeSuccess(
                            `Service '${name}' started`,
                        );
                    } catch (err: any) {
                        context.writer.writeError(
                            err?.message || `Failed to start service '${name}'`,
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Start a registered background service');
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services start <name>', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // ── stop ──────────────────────────────────────────────
            {
                command: 'stop',
                description: 'Stop a running background service',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value as string;
                    try {
                        await context.backgroundServices.stop(name);
                        context.writer.writeSuccess(
                            `Service '${name}' stopped`,
                        );
                    } catch (err: any) {
                        context.writer.writeError(
                            err?.message || `Failed to stop service '${name}'`,
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln('Stop a running background service');
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services stop <name>', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // ── restart ───────────────────────────────────────────
            {
                command: 'restart',
                description: 'Restart a background service',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value as string;
                    try {
                        await context.backgroundServices.restart(name);
                        context.writer.writeSuccess(
                            `Service '${name}' restarted`,
                        );
                    } catch (err: any) {
                        context.writer.writeError(
                            err?.message ||
                                `Failed to restart service '${name}'`,
                        );
                        context.process.exit(-1);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'Restart a background service (stop then start)',
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services restart <name>', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // ── logs ──────────────────────────────────────────────
            {
                command: 'logs',
                description: 'Show logs for a background service',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value as string;
                    const limit =
                        parseInt(command.args['limit'] || command.args['n']) ||
                        50;
                    const { writer } = context;

                    const entries = context.backgroundServices.getLogs(
                        name,
                        limit,
                    );

                    if (entries.length === 0) {
                        writer.writeInfo(
                            `No log entries for service '${name}'`,
                        );
                        return;
                    }

                    for (const entry of entries) {
                        const ts = new Date(entry.timestamp).toLocaleString();
                        let levelStr: string;
                        switch (entry.level) {
                            case 'error':
                                levelStr = writer.wrapInColor(
                                    'ERR',
                                    CliForegroundColor.Red,
                                );
                                break;
                            case 'warn':
                                levelStr = writer.wrapInColor(
                                    'WRN',
                                    CliForegroundColor.Yellow,
                                );
                                break;
                            default:
                                levelStr = writer.wrapInColor(
                                    'INF',
                                    CliForegroundColor.Cyan,
                                );
                                break;
                        }
                        writer.writeln(`[${ts}] ${levelStr} ${entry.message}`);
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'Display recent log entries for a background service',
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services logs <name>', CliForegroundColor.Cyan)}`,
                    );
                    writer.writeln(
                        `  ${writer.wrapInColor('services logs <name> --limit 100', CliForegroundColor.Cyan)}`,
                    );
                },
            },

            // ── info ──────────────────────────────────────────────
            {
                command: 'info',
                description: 'Show detailed information about a service',
                valueRequired: true,
                processCommand: async (
                    command: CliProcessCommand,
                    context: ICliExecutionContext,
                ) => {
                    const name = command.value as string;
                    const { writer } = context;

                    const info = context.backgroundServices.getStatus(name);
                    if (!info) {
                        writer.writeError(`Service '${name}' not found`);
                        context.process.exit(-1);
                        return;
                    }

                    writer.writeln(
                        writer.wrapInColor(
                            `Service: ${info.name}`,
                            CliForegroundColor.Cyan,
                        ),
                    );
                    writer.writeln(
                        `  Description : ${info.description || '-'}`,
                    );
                    writer.writeln(`  Type        : ${info.type}`);
                    writer.writeln(
                        `  Status      : ${colorStatus(info.status, writer.wrapInColor.bind(writer))}`,
                    );
                    writer.writeln(`  Mode        : ${info.executionMode}`);

                    if (info.startedAt) {
                        writer.writeln(
                            `  Started at  : ${new Date(info.startedAt).toLocaleString()}`,
                        );
                    }
                    if (info.stoppedAt) {
                        writer.writeln(
                            `  Stopped at  : ${new Date(info.stoppedAt).toLocaleString()}`,
                        );
                    }
                    if (
                        info.status === 'running' &&
                        info.uptime != null
                    ) {
                        writer.writeln(
                            `  Uptime      : ${writer.wrapInColor(formatUptime(info.uptime), CliForegroundColor.Green)}`,
                        );
                    }
                    if (info.error) {
                        writer.writeln(
                            `  Error       : ${writer.wrapInColor(info.error, CliForegroundColor.Red)}`,
                        );
                    }
                },
                writeDescription: (context: ICliExecutionContext) => {
                    const { writer } = context;
                    writer.writeln(
                        'Show detailed information about a specific background service',
                    );
                    writer.writeln();
                    writer.writeln(
                        `  ${writer.wrapInColor('services info <name>', CliForegroundColor.Cyan)}`,
                    );
                },
            },
        ];
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.executor.showHelp(command, context);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.services.long_description', 'Manage background services and jobs'));
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('services list', CliForegroundColor.Cyan)}              ${t.t('cli.services.list_desc', 'List all services')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('services start <name>', CliForegroundColor.Cyan)}       ${t.t('cli.services.start_desc', 'Start a service')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('services stop <name>', CliForegroundColor.Cyan)}        ${t.t('cli.services.stop_desc', 'Stop a service')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('services restart <name>', CliForegroundColor.Cyan)}     ${t.t('cli.services.restart_desc', 'Restart a service')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('services logs <name>', CliForegroundColor.Cyan)}        ${t.t('cli.services.logs_desc', 'View service logs')}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('services info <name>', CliForegroundColor.Cyan)}        ${t.t('cli.services.info_desc', 'Service details')}`,
        );
    }
}
