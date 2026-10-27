import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliCommandProcessorRegistry,
    ICliCommandExecutorService,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { getAccelerator } from '../wasm';
import { resolveCompletionPath } from './cli-completion-path';

/**
 * Provides tab-completion for parameter/flag names (e.g. --recursive, -r).
 * Priority 200 (checked after command completion).
 */
export class CliParameterCompletionProvider implements ICliCompletionProvider {
    priority = 200;

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly executor: ICliCommandExecutorService,
    ) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        // Only complete tokens that start with -
        if (!token.startsWith('-')) {
            return [];
        }

        if (tokens.length === 0) {
            return [];
        }

        // The command the words before the cursor matched, read like the
        // executor reads them (`dice roll --sides 6 --` is on `dice roll`)
        const path = resolveCompletionPath(
            tokens,
            tokenIndex,
            this.registry.processors,
            token,
        );

        // Its parameters, its parents' (nearest first), then the global ones
        const seen = new Set<string>();
        const allParameters: ICliCommandParameterDescriptor[] = [
            ...path.descriptors,
            ...this.executor.getGlobalParameters(),
        ].filter((p) => !seen.has(p.name) && !!seen.add(p.name));

        if (allParameters.length === 0) {
            return [];
        }

        const isDoubleDash = token.startsWith('--');
        const prefix = isDoubleDash ? token.slice(2) : token.slice(1);

        const candidates: string[] = [];
        for (const param of allParameters) {
            if (isDoubleDash) {
                candidates.push(`--${param.name}`);
            } else {
                if (param.aliases) {
                    for (const alias of param.aliases) {
                        candidates.push(`-${alias}`);
                    }
                }
                candidates.push(`--${param.name}`);
            }
        }

        const dashPrefix = isDoubleDash ? `--${prefix}` : `-${prefix}`;
        return getAccelerator().prefixMatch(candidates, dashPrefix);
    }
}
