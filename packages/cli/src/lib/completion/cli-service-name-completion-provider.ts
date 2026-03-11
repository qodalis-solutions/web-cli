import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliBackgroundServiceRegistry,
} from '@qodalis/cli-core';

/**
 * Sub-commands of `services` (and alias `svc`) that accept a service name value.
 */
const SERVICE_NAME_SUBCOMMANDS = new Set([
    'start',
    'stop',
    'restart',
    'logs',
    'info',
]);

/**
 * Provides tab-completion for background service names when typing
 * `services <subcommand> <name>` (or `svc <subcommand> <name>`).
 *
 * Priority 50 — checked before command and parameter completion so that
 * service names are suggested instead of treating the value position as
 * a sub-command or flag.
 */
export class CliServiceNameCompletionProvider
    implements ICliCompletionProvider
{
    priority = 50;

    constructor(
        private readonly backgroundServices: ICliBackgroundServiceRegistry,
    ) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        // We need at least the root command + sub-command already typed,
        // and the cursor positioned at token index 2 (the value position).
        if (tokenIndex !== 2 || tokens.length < 2) {
            return [];
        }

        const rootCommand = tokens[0].toLowerCase();
        if (rootCommand !== 'services' && rootCommand !== 'svc') {
            return [];
        }

        const subCommand = tokens[1].toLowerCase();
        if (!SERVICE_NAME_SUBCOMMANDS.has(subCommand)) {
            return [];
        }

        const lowerPrefix = token.toLowerCase();
        const services = this.backgroundServices.list();

        return services
            .map((svc) => svc.name)
            .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
            .sort();
    }
}
