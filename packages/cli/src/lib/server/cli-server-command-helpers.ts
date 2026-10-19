import { CliForegroundColor, ICliExecutionContext } from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';

/** The server manager, or an error (and exit code 1) when there is none. */
export function serverManagerOf(
    context: ICliExecutionContext,
): CliServerManager | undefined {
    const manager = context.services.get(CliServerManager_TOKEN);
    if (!manager) {
        context.writer.writeError('Server support is not available.');
        context.process.exit(1, { silent: true });
    }
    return manager;
}

/**
 * The configured server called `name` (case-insensitive). Otherwise writes
 * an error with the closest names and the configured ones, and exits 1.
 */
export function resolveServer(
    context: ICliExecutionContext,
    manager: CliServerManager,
    name: string,
): { name: string; connection: CliServerConnection } | undefined {
    const wanted = name.trim();
    for (const [serverName, connection] of manager.connections) {
        if (serverName.toLowerCase() === wanted.toLowerCase()) {
            return { name: serverName, connection };
        }
    }
    writeUnknownServer(context, manager, wanted);
    context.process.exit(1, { silent: true });
    return undefined;
}

/** `✘ Unknown server 'nod'. Did you mean 'node'?` plus the configured names. */
export function writeUnknownServer(
    context: ICliExecutionContext,
    manager: CliServerManager,
    name: string,
): void {
    const { writer } = context;
    const names = [...manager.connections.keys()];
    if (names.length === 0) {
        writer.writeError(`Unknown server '${name}': no servers are configured.`);
        writeConfigureHint(context);
        return;
    }
    const suggestion = closest(name, names);
    writer.writeError(
        suggestion
            ? `Unknown server '${name}'. Did you mean '${suggestion}'?`
            : `Unknown server '${name}'.`,
    );
    writer.writeln(
        `  Configured servers: ${names.map((n) => writer.wrapInColor(n, CliForegroundColor.Cyan)).join(', ')}`,
    );
}

/** How to add servers, for when none are configured. */
export function writeConfigureHint(context: ICliExecutionContext): void {
    const { writer } = context;
    writer.writeln(
        `  Servers are configured by the app: ${writer.wrapInColor("servers: [{ name: 'node', url: 'http://localhost:8047' }]", CliForegroundColor.Yellow)}`,
    );
    writer.writeln(
        `  See ${writer.wrapInColor('https://cli.qodalis.com/docs/server-integration', CliForegroundColor.Blue)}`,
    );
}

/** `● connected` / `○ unreachable`, colored. */
export function statusLabel(
    context: ICliExecutionContext,
    connection: CliServerConnection,
): string {
    return connection.connected
        ? context.writer.wrapInColor('● connected', CliForegroundColor.Green)
        : context.writer.wrapInColor('○ unreachable', CliForegroundColor.Red);
}

/** Ping a server and measure the round trip. */
export async function pingServer(
    connection: CliServerConnection,
): Promise<{ reachable: boolean; ms: number }> {
    const started = performance.now();
    const reachable = await connection.ping();
    return { reachable, ms: Math.round(performance.now() - started) };
}

/** Whether `name` is the default server, as a short marker. */
export function defaultMarker(
    context: ICliExecutionContext,
    manager: CliServerManager,
    name: string,
): string {
    return manager.defaultServer === name
        ? ` ${context.writer.wrapInColor('(default)', CliForegroundColor.Yellow)}`
        : '';
}

/** The candidate closest to `input` (edit distance), if it is close enough. */
export function closest(input: string, candidates: string[]): string | undefined {
    const target = input.toLowerCase();
    // A unique prefix is the clearest suggestion (`dot` -> `dotnet`)
    const prefixed = candidates.filter((c) =>
        c.toLowerCase().startsWith(target),
    );
    if (prefixed.length === 1) return prefixed[0];

    let best: string | undefined;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
        const distance = editDistance(target, candidate.toLowerCase());
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    // Allow about one typo per three letters
    const allowed = Math.max(1, Math.floor(target.length / 3));
    return bestDistance <= allowed ? best : undefined;
}

function editDistance(a: string, b: string): number {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let previous = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const current = row[j];
            row[j] =
                a[i - 1] === b[j - 1]
                    ? previous
                    : 1 + Math.min(previous, row[j], row[j - 1]);
            previous = current;
        }
    }
    return row[b.length];
}
