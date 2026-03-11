import { ICliExecutionContext, CliServerConfig } from '@qodalis/cli-core';

export function resolveServer(
    serverName: string | undefined,
    context: ICliExecutionContext,
): CliServerConfig | null {
    const servers = context.options?.servers;
    if (!servers || servers.length === 0) {
        context.writer.writeError('No servers configured. Add servers to CLI options.');
        return null;
    }

    if (!serverName) {
        if (servers.length === 1) {
            return servers[0];
        }
        context.writer.writeError('Multiple servers configured. Specify server name.');
        context.writer.writeInfo('Available: ' + servers.map(s => s.name).join(', '));
        return null;
    }

    const server = servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
    if (!server) {
        context.writer.writeError(`Unknown server: ${serverName}`);
        context.writer.writeInfo('Available: ' + servers.map(s => s.name).join(', '));
        return null;
    }

    return server;
}

export function serverUrl(server: CliServerConfig): string {
    return server.url.replace(/\/+$/, '');
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Parse server and path from either positional args (command.value)
 * or named args (--server, --path).
 *
 * Supports:
 *   scp ls node /app           (positional)
 *   scp ls --server node --path /app  (named, space-separated)
 *   scp ls --server="node" --path="/app"  (named, equals syntax)
 */
export function parseServerAndPath(
    value: string | undefined,
    context: ICliExecutionContext,
    args?: Record<string, any>,
): [string, string] | null {
    // Try named args first (--server, --path)
    const serverArg = args?.['server'];
    const pathArg = args?.['path'];
    if (serverArg && pathArg) {
        return [String(serverArg), String(pathArg)];
    }

    // Fall back to positional from command.value
    if (!value?.trim()) {
        return null;
    }
    const parts = value.trim().split(/\s+/);
    if (parts.length < 2) {
        // If only one positional, maybe server is from --server and path is positional
        if (serverArg && parts.length >= 1) {
            return [String(serverArg), parts.join(' ')];
        }
        if (pathArg && parts.length >= 1) {
            return [parts[0], String(pathArg)];
        }
        return null;
    }
    return [parts[0], parts.slice(1).join(' ')];
}
