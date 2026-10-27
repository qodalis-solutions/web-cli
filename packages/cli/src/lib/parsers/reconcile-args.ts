import { ICliCommandParameterDescriptor, splitShellWords } from '@qodalis/cli-core';
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

        // `-rf` is `-r -f` when it is not a parameter itself and each letter is
        const letters = !descriptor && token.short && !token.hasEquals
            ? expandShortFlags(token.name, descriptors)
            : undefined;
        if (letters) {
            const last = letters[letters.length - 1];
            for (const letter of letters.slice(0, -1)) {
                args.push({ name: letter.name, value: true });
            }
            if (
                last.descriptor.type !== 'boolean' &&
                i + 1 < tokens.length &&
                tokens[i + 1].kind === 'word'
            ) {
                const nextToken = tokens[i + 1] as { kind: 'word'; value: string };
                args.push({ name: last.name, value: parseValue(unquote(nextToken.value)) });
                i++;
            } else {
                args.push({ name: last.name, value: true });
            }
            continue;
        }

        // `-n5` is `-n 5` when `n` takes a value
        const stuck = !descriptor && token.short && !token.hasEquals
            ? /^([a-zA-Z])(.+)$/.exec(token.name)
            : null;
        const stuckDescriptor = stuck ? findDescriptor(stuck[1], descriptors) : undefined;
        if (stuck && stuckDescriptor && stuckDescriptor.type !== 'boolean') {
            args.push({ name: stuck[1], value: parseValue(stuck[2]) });
            continue;
        }

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
                value: parseValue(unquote(nextToken.value)),
            });
            i++; // skip consumed word
        } else {
            args.push({ name: token.name, value: token.value });
        }
    }

    return { args, commandParts };
}

/**
 * Whether `flag` takes the word after it as its value (`--sides 6`,
 * `-rn 5`), the way {@link reconcileArgs} reads it.
 */
export function flagTakesNextWord(
    flag: Extract<ParsedToken, { kind: 'flag' }>,
    descriptors: ICliCommandParameterDescriptor[] | undefined,
): boolean {
    if (flag.hasEquals) return false;
    const descriptor = findDescriptor(flag.name, descriptors);
    if (descriptor) return descriptor.type !== 'boolean';
    const letters = flag.short ? expandShortFlags(flag.name, descriptors) : undefined;
    return !!letters && letters[letters.length - 1].descriptor.type !== 'boolean';
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

/**
 * The letters of `-abc` as short flags, when every letter is a parameter
 * name or alias and all but the last are boolean.
 */
function expandShortFlags(
    name: string,
    descriptors: ICliCommandParameterDescriptor[] | undefined,
): { name: string; descriptor: ICliCommandParameterDescriptor }[] | undefined {
    if (name.length < 2 || !/^[a-zA-Z]+$/.test(name)) return undefined;
    const letters = [...name].map((letter) => ({
        name: letter,
        descriptor: findDescriptor(letter, descriptors),
    }));
    const valid = letters.every(
        (l, index) =>
            l.descriptor &&
            (index === letters.length - 1 || l.descriptor.type === 'boolean'),
    );
    return valid
        ? (letters as { name: string; descriptor: ICliCommandParameterDescriptor }[])
        : undefined;
}

/** A value as one shell word: `"a b"` -> `a b`, `my\\ file` -> `my file`. */
function unquote(value: string): string {
    return splitShellWords(value).join(' ');
}

function parseValue(value: string): string | number | boolean {
    if (value.length > 0 && !isNaN(Number(value))) return Number(value);
    if (value === 'true' || value === 'false') return value === 'true';
    return value;
}
