import {
    ICliCompletionContext,
    ICliCompletionProvider,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { getAccelerator } from '../wasm';
import { findParameter, resolveCompletionPath } from './cli-completion-path';

/**
 * Tab-completion of a parameter's allowed values (`allowedValues`): after
 * `--format ` it offers `table`, `json`; in `--format=j` it offers
 * `--format=json`. Priority 190, before parameter names.
 */
export class CliParameterValueCompletionProvider implements ICliCompletionProvider {
    priority = 190;

    constructor(private readonly registry: ICliCommandProcessorRegistry) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;
        if (tokens.length === 0) return [];

        // --name=value: complete the value inside the word
        const inline = /^(--?)([^\s=]+)=(.*)$/.exec(token);
        if (inline) {
            const path = resolveCompletionPath(tokens, tokenIndex, this.registry.processors, token);
            const values = findParameter(inline[2], path.descriptors)?.allowedValues;
            if (!values?.length) return [];
            const prefix = `${inline[1]}${inline[2]}=`;
            return matchIgnoringCase(values, inline[3]).map((v) => `${prefix}${v}`);
        }

        if (token.startsWith('-')) return [];
        const path = resolveCompletionPath(tokens, tokenIndex, this.registry.processors, token);
        const values = path.isFlagValue ? path.flag?.allowedValues : undefined;
        return values?.length ? matchIgnoringCase(values, token) : [];
    }
}

/** The values that start with `prefix`, ignoring case (exact-case matches through the accelerator first). */
function matchIgnoringCase(values: string[], prefix: string): string[] {
    const exact = getAccelerator().prefixMatch(values, prefix);
    if (exact.length) return exact;
    const lower = prefix.toLowerCase();
    return values.filter((v) => v.toLowerCase().startsWith(lower));
}
