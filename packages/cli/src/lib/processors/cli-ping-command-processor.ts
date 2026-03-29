import {
    CliForegroundColor,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import {
    CliProcessCommand,
    ICliCommandAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';

export class CliPingCommandProcessor implements ICliCommandProcessor {
    command = 'ping';

    description = 'Send ICMP-like pings to a host';

    author: ICliCommandAuthor = DefaultLibraryAuthor;

    acceptsRawInput = true;

    metadata: CliProcessorMetadata = {
        icon: '🏓',
    };

    parameters = [
        {
            name: 'c',
            aliases: ['count'],
            description: 'Number of pings to send (default: 4, 0 = infinite)',
            required: false,
            type: 'number' as const,
        },
        {
            name: 'i',
            aliases: ['interval'],
            description: 'Interval between pings in seconds (default: 1)',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const host = (command.value || '').trim();

        if (!host) {
            context.writer.writeError(
                'ping: missing host operand',
            );
            context.writer.writeln(
                `Usage: ${context.writer.wrapInColor('ping [-c count] [-i interval] <host>', CliForegroundColor.Cyan)}`,
            );
            context.process.exit(1, { silent: true });
            return;
        }

        const count = command.args['c'] ?? command.args['count'] ?? 4;
        const interval = command.args['i'] ?? command.args['interval'] ?? 1;
        const intervalMs = Math.max(200, interval * 1000);

        // Normalize host to a URL we can fetch
        const url = this.normalizeUrl(host);

        context.writer.writeln(
            `PING ${host} (${url}):`,
        );
        context.setStatusText(`ping ${host}`);

        const times: number[] = [];
        let transmitted = 0;
        let received = 0;
        let seq = 0;
        let stopped = false;

        // Handle abort (Ctrl+C) — print stats and exit
        const abortSub = context.onAbort.subscribe(() => {
            stopped = true;
        });

        try {
            const maxCount = count === 0 ? Infinity : count;

            while (seq < maxCount && !stopped) {
                transmitted++;
                const start = performance.now();

                try {
                    const response = await context.http.fetch(url, {
                        method: 'HEAD',
                        mode: 'no-cors',
                        cache: 'no-store',
                    });

                    const elapsed = performance.now() - start;
                    const ms = elapsed.toFixed(1);
                    received++;
                    times.push(elapsed);

                    const status = response.type === 'opaque' ? 'ok' : `status=${response.status}`;
                    context.setStatusText(`ping ${host}: seq=${seq} time=${ms}ms`);
                    context.writer.writeln(
                        `${url}: seq=${seq} ${status} time=${ms} ms`,
                    );
                } catch (e: any) {
                    if (e?.name === 'AbortError') {
                        stopped = true;
                        break;
                    }
                    const elapsed = performance.now() - start;
                    context.writer.writeln(
                        `${url}: seq=${seq} request timed out (${elapsed.toFixed(1)} ms)`,
                    );
                }

                seq++;

                // Wait for interval unless this is the last one or stopped
                if (seq < maxCount && !stopped) {
                    await this.sleep(intervalMs, context);
                    if (context.signal?.aborted) {
                        stopped = true;
                    }
                }
            }
        } finally {
            abortSub.unsubscribe();
        }

        // Print statistics (like Linux ping)
        context.writer.writeln('');
        context.writer.writeln(
            `--- ${host} ping statistics ---`,
        );

        const lost = transmitted - received;
        const lossPercent = transmitted > 0
            ? ((lost / transmitted) * 100).toFixed(0)
            : '0';
        context.writer.writeln(
            `${transmitted} packets transmitted, ${received} received, ${lossPercent}% packet loss`,
        );

        if (times.length > 0) {
            const min = Math.min(...times).toFixed(1);
            const max = Math.max(...times).toFixed(1);
            const avg = (
                times.reduce((a, b) => a + b, 0) / times.length
            ).toFixed(1);

            // Standard deviation
            const mean = times.reduce((a, b) => a + b, 0) / times.length;
            const variance =
                times.reduce((sum, t) => sum + (t - mean) ** 2, 0) /
                times.length;
            const stddev = Math.sqrt(variance).toFixed(1);

            context.writer.writeln(
                `rtt min/avg/max/mdev = ${min}/${avg}/${max}/${stddev} ms`,
            );
        }

        if (received === 0) {
            context.process.exit(1, { silent: true });
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        writer.writeln(t.t('cli.ping.long_description', 'Send ICMP-like HTTP pings to a host and display round-trip statistics'));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(
            `  ${writer.wrapInColor('ping <host>', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('ping -c 10 google.com', CliForegroundColor.Cyan)}`,
        );
        writer.writeln(
            `  ${writer.wrapInColor('ping -c 0 -i 2 example.com', CliForegroundColor.Cyan)}  (infinite, 2s interval)`,
        );
        writer.writeln();
        writer.writeln(t.t('cli.help.options', 'Options:'));
        writer.writeln('  -c, --count      Number of pings (default: 4, 0 = infinite)');
        writer.writeln('  -i, --interval   Seconds between pings (default: 1)');
        writer.writeln();
        writer.writeln(t.t('cli.ping.ctrl_c', 'Press Ctrl+C to stop and show statistics.'));
    }

    private normalizeUrl(host: string): string {
        if (host.startsWith('http://') || host.startsWith('https://')) {
            return host;
        }
        return `https://${host}`;
    }

    private sleep(
        ms: number,
        context: ICliExecutionContext,
    ): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            // If aborted during sleep, resolve immediately
            const onAbort = () => {
                clearTimeout(timer);
                resolve();
            };
            if (context.signal) {
                context.signal.addEventListener('abort', onAbort, { once: true });
            }
        });
    }
}
