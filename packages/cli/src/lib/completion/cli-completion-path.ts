import {
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
} from '@qodalis/cli-core';
import { ParsedToken } from '../parsers/command-parser';
import { flagTakesNextWord } from '../parsers/reconcile-args';

/** What the words before the cursor resolve to, read as the executor reads them. */
export interface CliCompletionPath {
    /** The deepest command the words matched (`dice roll`), if any */
    processor?: ICliCommandProcessor;
    /** Parameters of the matched commands, nearest first */
    descriptors: ICliCommandParameterDescriptor[];
    /** Sub-commands that may follow; undefined once past the command path */
    subCommands?: ICliCommandProcessor[];
    /** The word at the cursor is the value of the flag before it (`--sides |`) */
    isFlagValue: boolean;
}

/**
 * Reads the words before the cursor left to right, like the executor: each
 * word is matched against the sub-commands of the command matched so far,
 * and a flag that takes a value consumes the word after it, so
 * `dice roll --sides 6 |` is still on `dice roll`.
 */
export function resolveCompletionPath(
    tokens: string[],
    tokenIndex: number,
    processors: ICliCommandProcessor[],
    currentToken = '',
): CliCompletionPath {
    const parsed = tokens.slice(0, tokenIndex).map(toParsedToken);
    let processor: ICliCommandProcessor | undefined;
    let descriptors: ICliCommandParameterDescriptor[] = [];
    let candidates: ICliCommandProcessor[] | undefined = processors;
    let isFlagValue = false;

    for (let i = 0; i < parsed.length; i++) {
        const token = parsed[i];
        if (token.kind === 'flag') {
            if (!flagTakesNextWord(token, descriptors)) continue;
            if (i + 1 < parsed.length) {
                if (parsed[i + 1].kind === 'word') i++;
            } else if (!currentToken.startsWith('-')) {
                // The flag is the last word: the cursor is on its value
                isFlagValue = true;
            }
            continue;
        }
        const name = token.value.toLowerCase();
        const match: ICliCommandProcessor | undefined = candidates?.find(
            (p) =>
                p.command.toLowerCase() === name ||
                p.aliases?.some((a) => a.toLowerCase() === name),
        );
        if (match) {
            processor = match;
            descriptors = [...(match.parameters ?? []), ...descriptors];
        }
        // Past the command path, the remaining words are its value
        candidates = match?.processors?.length ? match.processors : undefined;
    }

    return { processor, descriptors, subCommands: candidates, isFlagValue };
}

function toParsedToken(text: string): ParsedToken {
    const flag = /^(--?)([a-zA-Z0-9_][^\s=]*)(=.*)?$/.exec(text);
    if (!flag) {
        return { kind: 'word', value: text };
    }
    return {
        kind: 'flag',
        name: flag[2],
        value: flag[3]?.slice(1) ?? true,
        hasEquals: flag[3] !== undefined,
        ...(flag[1] === '-' ? { short: true } : {}),
    };
}
