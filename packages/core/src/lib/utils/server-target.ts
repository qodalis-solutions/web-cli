import type { CliServerConfig } from '../models/server';
import type { ICliExecutionContext } from '../interfaces/execution-context';
import type { ICliServerManager } from '../interfaces/services';
import { ICliServerManager_TOKEN } from '../interfaces/services';

/**
 * The server a command should use when the user does not name one.
 *
 * Prefers the server manager's choice (the default server, else the first
 * connected one) so a command does not pick a server that is down or that
 * rejects the user (a protected server they have not signed in to). Falls
 * back to the first configured server when no manager is available or
 * nothing is connected, so callers still get a clear error from that server.
 */
export function cliDefaultServer(context: Pick<ICliExecutionContext, 'services' | 'options'>): CliServerConfig | undefined {
    const servers = context.options?.servers ?? [];
    const manager = context.services?.get<ICliServerManager>(ICliServerManager_TOKEN);
    const preferred = manager?.preferredServer?.();
    return (preferred ? servers.find((s) => s.name === preferred) : undefined) ?? servers[0];
}
