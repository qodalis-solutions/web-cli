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
 * Parse "serverName /remote/path" from command.value
 * Returns [serverName, remotePath] or null on error.
 */
export function parseServerAndPath(
    value: string | undefined,
    context: ICliExecutionContext,
): [string, string] | null {
    if (!value?.trim()) {
        return null;
    }
    const parts = value.trim().split(/\s+/);
    if (parts.length < 2) {
        return null;
    }
    return [parts[0], parts.slice(1).join(' ')];
}
