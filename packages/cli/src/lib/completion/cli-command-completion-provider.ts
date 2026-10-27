import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliCommandProcessorRegistry,
    ICliCommandProcessor,
} from '@qodalis/cli-core';
import { getAccelerator } from '../wasm';
import { resolveCompletionPath } from './cli-completion-path';

/**
 * Provides tab-completion for command names and sub-command names.
 * Priority 100 (default).
 */
export class CliCommandCompletionProvider implements ICliCompletionProvider {
    priority = 100;

    constructor(private readonly registry: ICliCommandProcessorRegistry) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        if (tokenIndex === 0) {
            // Complete top-level command names + aliases
            return this.getCommandNames(this.registry.processors, token);
        }

        // Complete sub-commands of the command the words before the cursor
        // matched; flag values (`--sides 6`) are not sub-commands
        const path = resolveCompletionPath(
            tokens,
            tokenIndex,
            this.registry.processors,
            token,
        );
        if (path.isFlagValue || !path.subCommands) {
            return [];
        }

        return this.getCommandNames(path.subCommands, token);
    }

    private getCommandNames(
        processors: ICliCommandProcessor[],
        prefix: string,
    ): string[] {
        const names: string[] = [];
        for (const p of processors) {
            names.push(p.command);
            if (p.aliases) {
                names.push(...p.aliases);
            }
        }
        return getAccelerator().prefixMatch(names, prefix);
    }
}
