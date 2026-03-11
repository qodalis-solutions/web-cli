import {
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { CliServerManager } from '../server/cli-server-manager';

/**
 * Sub-commands of `server` that accept a server name value.
 */
const SERVER_NAME_SUBCOMMANDS = new Set([
    'status',
    'reconnect',
    'default',
]);

/**
 * Provides tab-completion for server names when typing
 * `server status|reconnect|default <name>` or `ssh <name>`.
 *
 * Priority 50 — checked before command and parameter completion.
 */
export class CliServerNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    constructor(private readonly serverManager: CliServerManager) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;
        const rootCommand = tokens[0]?.toLowerCase();

        // ssh <name>
        if (rootCommand === 'ssh' && tokenIndex === 1) {
            return this.matchServerNames(token, true);
        }

        // server status|reconnect|default <name>
        if (
            rootCommand === 'server' &&
            tokenIndex === 2 &&
            tokens.length >= 2
        ) {
            const subCommand = tokens[1].toLowerCase();
            if (SERVER_NAME_SUBCOMMANDS.has(subCommand)) {
                return this.matchServerNames(token);
            }
        }

        return [];
    }

    private matchServerNames(
        prefix: string,
        shellOnly = false,
    ): string[] {
        const lowerPrefix = prefix.toLowerCase();
        const results: string[] = [];

        for (const [name, connection] of this.serverManager.connections) {
            if (shellOnly && !connection.capabilities?.shell) {
                continue;
            }
            if (name.toLowerCase().startsWith(lowerPrefix)) {
                results.push(name);
            }
        }

        return results.sort();
    }
}
