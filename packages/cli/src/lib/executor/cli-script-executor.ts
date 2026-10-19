import { ICliExecutionContext, CliForegroundColor } from '@qodalis/cli-core';
import { ICliEnvironment, ICliEnvironment_TOKEN } from '../services/cli-environment';
import { ICliExecutionHost } from './cli-command-executor';
import { runScript } from './cli-script-runner';

/**
 * Attempt to execute a file path as a script.
 * Returns true if the file was found and executed, false otherwise.
 * Requires the @qodalis/cli-files plugin for filesystem access.
 */
export async function tryExecuteScript(
    filePath: string,
    context: ICliExecutionHost,
    executeCommand: (command: string, context: ICliExecutionContext) => Promise<void>,
): Promise<boolean> {
    const FS_TOKEN = 'cli-file-system-service';

    const fs: any = context.services.get(FS_TOKEN);
    if (!fs) {
        return false;
    }

    const resolved = fs.resolvePath(filePath);
    const node = fs.getNode(resolved);

    if (!node || node.type !== 'file') {
        return false;
    }

    // Check execute permission (owner 'x' bit — position 2 in rwxr-xr-x)
    const perms = node.permissions || 'rw-r--r--';
    const ownerExecute = perms.length >= 3 && perms[2] === 'x';

    if (!ownerExecute) {
        context.writer.writeError(
            `${filePath}: Permission denied (missing execute permission)`,
        );
        context.writer.writeInfo(
            `Use ${context.writer.wrapInColor(`chmod u+x ${filePath}`, CliForegroundColor.Cyan)} to make it executable, or run with ${context.writer.wrapInColor(`sh ${filePath}`, CliForegroundColor.Cyan)}`,
        );
        context.process.exit(126, { silent: true });
        return true;
    }

    const content = fs.readFile(resolved);
    if (content === null || content === undefined) {
        context.writer.writeError(`${filePath}: Cannot read file`);
        context.process.exit(1, { silent: true });
        return true;
    }

    await runScript(content, context, { name: filePath, executeCommand });
    return true;
}

/**
 * Substitute script-local variables ($VAR / ${VAR}) in a string.
 */
export function substituteVars(
    input: string,
    variables: Record<string, string>,
): string {
    let result = input.replace(
        /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
        (_, name) => variables[name] ?? '',
    );
    result = result.replace(
        /\$([A-Za-z_][A-Za-z0-9_]*)/g,
        (_, name) => variables[name] ?? '',
    );
    return result;
}

/**
 * Expand `$VAR` and `${VAR}` references using the global environment store, `$?`
 * to the last exit status, and a leading `~` (alone or as `~/…`) to `$HOME`.
 * Nothing is expanded inside single-quoted strings (like bash).
 */
export function expandEnvironmentVars(
    command: string,
    context: ICliExecutionContext,
    lastExitCode?: number,
): string {
    const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
    if (!env) {
        return command;
    }

    // Don't expand inside single quotes (an apostrophe inside double quotes
    // or without a closing one is ordinary text)
    const parts = splitSingleQuoted(command);
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.quoted) continue;
        let text = part.text;
        if (lastExitCode !== undefined) {
            text = text.replace(/(?<!\\)\$\?/g, String(lastExitCode));
        }
        text = text.replace(
            /(?<!\\)\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
            (_, name) => env.get(name) ?? '',
        );
        text = text.replace(
            /(?<!\\)\$([A-Za-z_][A-Za-z0-9_]*)/g,
            (_, name) => env.get(name) ?? '',
        );
        const home = env.get('HOME');
        if (home) {
            // Only a word that starts with ~ (and the very first part may start the line)
            text = text.replace(
                /(^|\s)~(?=\/|\s|$)/g,
                (match, before, offset) => (i > 0 && offset === 0 && !before ? match : `${before}${home}`),
            );
        }
        part.text = text;
    }

    return parts.map((p) => p.text).join('');
}

/**
 * The command in pieces: single-quoted pieces (quotes included) are
 * `quoted`; the rest, double-quoted text included, is not.
 */
function splitSingleQuoted(command: string): { text: string; quoted: boolean }[] {
    const parts: { text: string; quoted: boolean }[] = [];
    let current = '';
    let inDouble = false;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i];
        if (ch === '"') inDouble = !inDouble;
        if (ch === "'" && !inDouble) {
            const end = command.indexOf("'", i + 1);
            if (end !== -1) {
                if (current) parts.push({ text: current, quoted: false });
                parts.push({ text: command.slice(i, end + 1), quoted: true });
                current = '';
                i = end;
                continue;
            }
        }
        current += ch;
    }
    if (current) parts.push({ text: current, quoted: false });
    return parts;
}
