import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { Terminal } from '@xterm/xterm';

export class CliUptimeCommandProcessor implements ICliCommandProcessor {
    command = 'uptime';

    description = 'Show session uptime';

    author = DefaultLibraryAuthor;

    metadata?: CliProcessorMetadata = {
        icon: '⏱️',
        module: 'misc',
    };

    private sessionStartTimes = new WeakMap<Terminal, number>();

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.sessionStartTimes.set(context.terminal, Date.now());

        try {
            context.backgroundServices.register({
                name: 'uptime-tracker',
                description: 'Tracks terminal session uptime',
                type: 'daemon',
                onStart: async (ctx) => {
                    ctx.log('Uptime tracking started');
                },
            });
            await context.backgroundServices.start('uptime-tracker');
        } catch {
            // Already registered or failed — WeakMap fallback is fine
        }
    }

    async processCommand(
        _: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const svcInfo = context.backgroundServices.getStatus('uptime-tracker');
        const startTime = (svcInfo?.status === 'running' && svcInfo.startedAt)
            ? svcInfo.startedAt.getTime()
            : this.sessionStartTimes.get(context.terminal) ?? Date.now();
        const elapsed = Date.now() - startTime;
        const { writer } = context;

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
