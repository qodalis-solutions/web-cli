import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliUptimeCommandProcessor implements ICliCommandProcessor {
    command = 'uptime';

    description = 'Show session uptime';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '⏱️',
        module: 'misc',
    };

    async initialize(context: ICliExecutionContext): Promise<void> {
        try {
            context.backgroundServices.register({
                name: 'uptime-tracker',
                description: 'Tracks terminal session uptime',
                type: 'daemon',
                onStart: async (ctx) => {
                    ctx.log('Uptime tracking started');
                    // Keep the daemon alive by waiting on the abort signal
                    await new Promise<void>((resolve) => {
                        ctx.signal.addEventListener('abort', () => resolve(), { once: true });
                    });
                    ctx.log('Uptime tracking stopped');
                },
            });
            await context.backgroundServices.start('uptime-tracker');
        } catch {
            // Already registered or failed
        }
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const svcInfo = context.backgroundServices.getStatus('uptime-tracker');
        const { writer } = context;

        if (!svcInfo || svcInfo.status !== 'running') {
            writer.writeError('Uptime tracker is not running.');
            writer.writeInfo(
                `Use ${writer.wrapInColor('services start uptime-tracker', CliForegroundColor.Cyan)} to restart.`,
            );
            return;
        }

        const startTime = svcInfo.startedAt!.getTime();
        const elapsed = Date.now() - startTime;

        const seconds = Math.floor(elapsed / 1000) % 60;
        const minutes = Math.floor(elapsed / (1000 * 60)) % 60;
        const hours = Math.floor(elapsed / (1000 * 60 * 60)) % 24;
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));

        const parts: string[] = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);

        const uptimeStr = parts.join(' ');
        const startDate = new Date(startTime).toLocaleString();

        writer.writeln(
            `⏱️  Uptime: ${writer.wrapInColor(uptimeStr, CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `📅 Started: ${writer.wrapInColor(startDate, CliForegroundColor.Green)}`,
        );
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(
            t.t('cli.uptime.long_description', 'Show how long the current terminal session has been active'),
        );
        writer.writeln();
        writer.writeln(`📋 ${t.t('cli.common.usage', 'Usage:')}`);
        writer.writeln(
            `  ${writer.wrapInColor('uptime', CliForegroundColor.Cyan)}`,
        );
    }
}
