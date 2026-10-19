import { splitShellWords } from '@qodalis/cli-core';

/**
 * Split command arguments like a shell, removing the quotes:
 * `"my file.txt" -n 'a b' x\ y` -> `my file.txt`, `-n`, `a b`, `x y`.
 * (Commands can also read `command.positionals`, split the same way.)
 */
export function splitArgs(raw: string): string[] {
    return splitShellWords(raw);
}
