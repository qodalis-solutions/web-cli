import { ICliCommandParameterDescriptor } from '@qodalis/cli-core';
import { ParsedArg, ParsedToken } from './command-parser';

/**
 * Re-interprets parsed tokens using processor parameter descriptors to support
 * `--param value` (space-separated) argument format in addition to `--param=value`.
 *
 * When a flag has no explicit `=` value and the matching descriptor's type is
 * not boolean, the next word token is consumed as the flag's value.
 *
 * @param tokens - Ordered tokens from the parser.
 * @param descriptors - Parameter descriptors from the matched processor.
 * @returns Reconciled args array and remaining command parts.
 */
export function reconcileArgs(
    tokens: ParsedToken[],
    descriptors: ICliCommandParameterDescriptor[] | undefined,
): { args: ParsedArg[]; commandParts: string[] } {
    const args: ParsedArg[] = [];
    const commandParts: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.kind === 'word') {
            commandParts.push(token.value);
            continue;
        }

        // token.kind === 'flag'
        const descriptor = findDescriptor(token.name, descriptors);

        if (
            descriptor &&
            descriptor.type !== 'boolean' &&
            !token.hasEquals &&
            i + 1 < tokens.length &&
            tokens[i + 1].kind === 'word'
        ) {
            // Consume the next word token as this flag's value
            const nextToken = tokens[i + 1] as { kind: 'word'; value: string };
            args.push({
                name: token.name,
                value: parseValue(nextToken.value),
            });
            i++; // skip consumed word
        } else {
            args.push({ name: token.name, value: token.value });
        }
    }

    return { args, commandParts };
}

function findDescriptor(
    name: string,
    descriptors: ICliCommandParameterDescriptor[] | undefined,
): ICliCommandParameterDescriptor | undefined {
    if (!descriptors) return undefined;
    return descriptors.find(
        (d) =>
            d.name === name ||
            d.aliases?.some((a) => a === name),
    );
}

function parseValue(value: string): string | number | boolean {
    if (value.length > 0 && !isNaN(Number(value))) return Number(value);
    if (value === 'true' || value === 'false') return value === 'true';
    return value;
}
