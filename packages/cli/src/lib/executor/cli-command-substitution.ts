import { substitutionEnd } from '../parsers/command-parser';

/**
 * Replace `$(command)` and `` `command` `` with the command's output, as a
 * shell does: `echo "Today: $(date)"`. Not inside single quotes; inside
 * double quotes yes. Trailing newlines of the output are removed, and the
 * output is escaped so it is only ever text: inside double quotes `"`, `\`,
 * `$` and `` ` ``; outside quotes every shell character but spaces (which
 * still separate words), so quotes, operators, `$`, wildcards and braces in
 * the output are not interpreted.
 */
export async function substituteCommands(
    command: string,
    run: (inner: string) => Promise<string>,
): Promise<string> {
    if (!command.includes('$(') && !command.includes('`')) return command;

    let result = '';
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i];
        if (ch === '\\' && !inSingle && i + 1 < command.length) {
            result += ch + command[++i];
            continue;
        }
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (!inSingle && ((ch === '$' && command[i + 1] === '(') || ch === '`')) {
            const end = substitutionEnd(command, i);
            if (end !== -1) {
                const inner = ch === '`' ? command.slice(i + 1, end) : command.slice(i + 2, end);
                const output = (await run(inner.trim())).replace(/\n+$/, '');
                result += inDouble
                    ? output.replace(/["\\$`]/g, '\\$&')
                    : output.replace(/["'\\$`|&;<>(){}*?[\]#~]/g, '\\$&');
                i = end;
                continue;
            }
        }
        result += ch;
    }
    return result;
}
