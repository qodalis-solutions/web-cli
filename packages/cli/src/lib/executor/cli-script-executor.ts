import { ICliExecutionContext, CliForegroundColor } from '@qodalis/cli-core';
import { ICliEnvironment, ICliEnvironment_TOKEN } from '../services/cli-environment';
import { ICliExecutionHost } from './cli-command-executor';

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

    // Execute the script content line by line
    const lines = content.split('\n');
    const variables: Record<string, string> = {};
    let stopOnError = true;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line || line.startsWith('#')) {
            continue;
        }

        if (line === 'set -e') {
            stopOnError = true;
            continue;
        }
        if (line === 'set +e') {
            stopOnError = false;
            continue;
        }

        // Variable assignment
        const assignMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (assignMatch) {
            const varName = assignMatch[1];
            let varValue = assignMatch[2];
            if (
                (varValue.startsWith('"') && varValue.endsWith('"')) ||
                (varValue.startsWith("'") && varValue.endsWith("'"))
            ) {
                varValue = varValue.slice(1, -1);
            }
            varValue = substituteVars(varValue, variables);
            variables[varName] = varValue;
            continue;
        }

        const expanded = substituteVars(line, variables);
        await executeCommand(expanded, context);

        const exitCode = context.process.exitCode;
        if (stopOnError && exitCode !== undefined && exitCode !== 0) {
            context.writer.writeError(
                `${filePath}: script aborted at line: ${line}`,
            );
            return true;
        }
    }

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
 * Expand $VAR and ${VAR} references using the global environment store.
 * Variables inside single-quoted strings are NOT expanded (like bash).
 */
export function expandEnvironmentVars(
    command: string,
    context: ICliExecutionContext,
): string {
    const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
    if (!env) {
        return command;
    }

    // Don't expand inside single-quoted strings
    // Split by single quotes, expand only outside quotes
    const parts = command.split("'");
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            // Outside single quotes — expand variables
            parts[i] = parts[i].replace(
                /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
                (_, name) => env.get(name) ?? '',
            );
            parts[i] = parts[i].replace(
                /\$([A-Za-z_][A-Za-z0-9_]*)/g,
                (_, name) => env.get(name) ?? '',
            );
        }
    }

    return parts.join("'");
}
