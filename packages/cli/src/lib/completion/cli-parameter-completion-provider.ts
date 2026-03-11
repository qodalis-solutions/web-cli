import {
    ICliCompletionProvider,
    ICliCompletionContext,
    ICliCommandProcessorRegistry,
    ICliCommandExecutorService,
    ICliCommandParameterDescriptor,
} from '@qodalis/cli-core';
import { getAccelerator } from '../wasm';

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
        const { tokens, token } = context;

        // Only complete tokens that start with -
        if (!token.startsWith('-')) {
            return [];
        }

        if (tokens.length === 0) {
            return [];
        }

        // Find the processor for the command
        const mainCommand = tokens[0];
        const chainCommands = tokens.slice(1).filter((t) => !t.startsWith('-'));

        const processor = this.registry.findProcessorInCollection(
            mainCommand,
            chainCommands,
            this.registry.processors,
        );

        // Merge processor-specific parameters with global parameters
        const allParameters: ICliCommandParameterDescriptor[] = [
            ...(processor?.parameters ?? []),
            ...this.executor.getGlobalParameters(),
        ];

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
