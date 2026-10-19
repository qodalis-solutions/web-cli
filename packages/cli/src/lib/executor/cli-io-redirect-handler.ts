import { ICliExecutionContext } from '@qodalis/cli-core';
import { CapturingTerminalWriter } from '../services/capturing-terminal-writer';

const FS_TOKEN = 'cli-file-system-service';

/**
 * Output as file text: whole lines, as in a Unix shell, so that
 * `echo a > f; echo b >> f` gives two lines rather than `ab`.
 */
/** A redirect target without its quotes: `> "my dir/f.txt"`. */
function targetPath(filePath: string): string {
    const path = filePath.trim();
    return path.length > 1 &&
        ((path.startsWith('"') && path.endsWith('"')) ||
            (path.startsWith("'") && path.endsWith("'")))
        ? path.slice(1, -1)
        : path;
}

function asFileText(output: unknown): string {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    return text === '' || text.endsWith('\n') ? text : text + '\n';
}

/**
 * Write stdout data to a file (overwrite mode).
 */
export async function writeOutputToFile(
    filePath: string,
    context: ICliExecutionContext,
): Promise<void> {
    const fs: any = context.services.get(FS_TOKEN);
    if (!fs) {
        context.writer.writeError(
            '> redirect requires @qodalis/cli-files plugin',
        );
        return;
    }

    const output = context.process.data;
    if (output === undefined || output === null) {
        return;
    }

    try {
        const resolved = fs.resolvePath(targetPath(filePath));
        const content = asFileText(output);
        if (fs.exists(resolved)) {
            fs.writeFile(resolved, content); // overwrite (no append flag)
        } else {
            fs.createFile(resolved, content);
        }
        await fs.persist();
    } catch (e: any) {
        context.writer.writeError(`> failed: ${e.message || e}`);
    }
}

/**
 * Append stdout data to a file.
 */
export async function appendOutputToFile(
    filePath: string,
    context: ICliExecutionContext,
): Promise<void> {
    const fs: any = context.services.get(FS_TOKEN);
    if (!fs) {
        context.writer.writeError(
            '>> redirect requires @qodalis/cli-files plugin',
        );
        return;
    }

    const output = context.process.data;
    if (output === undefined || output === null) {
        return;
    }

    try {
        const resolved = fs.resolvePath(targetPath(filePath));
        const content = asFileText(output);
        if (fs.exists(resolved)) {
            fs.writeFile(resolved, content, true); // append
        } else {
            fs.createFile(resolved, content);
        }
        await fs.persist();
    } catch (e: any) {
        context.writer.writeError(`>> failed: ${e.message || e}`);
    }
}

/**
 * Write stderr data to a file (overwrite mode).
 */
export async function writeStderrToFile(
    filePath: string,
    context: ICliExecutionContext,
    capturingWriter?: CapturingTerminalWriter,
): Promise<void> {
    const stderr = capturingWriter?.getCapturedStderr();
    if (!stderr) return;

    const fs: any = context.services.get(FS_TOKEN);
    if (!fs) {
        context.writer.writeError(
            '2> redirect requires @qodalis/cli-files plugin',
        );
        return;
    }

    try {
        const resolved = fs.resolvePath(targetPath(filePath));
        if (fs.exists(resolved)) {
            fs.writeFile(resolved, stderr);
        } else {
            fs.createFile(resolved, stderr);
        }
        await fs.persist();
    } catch (e: any) {
        context.writer.writeError(`2> failed: ${e.message || e}`);
    }
}

/**
 * Append stderr data to a file.
 */
export async function appendStderrToFile(
    filePath: string,
    context: ICliExecutionContext,
    capturingWriter?: CapturingTerminalWriter,
): Promise<void> {
    const stderr = capturingWriter?.getCapturedStderr();
    if (!stderr) return;

    const fs: any = context.services.get(FS_TOKEN);
    if (!fs) {
        context.writer.writeError(
            '2>> redirect requires @qodalis/cli-files plugin',
        );
        return;
    }

    try {
        const resolved = fs.resolvePath(targetPath(filePath));
        if (fs.exists(resolved)) {
            fs.writeFile(resolved, stderr, true); // append
        } else {
            fs.createFile(resolved, stderr);
        }
        await fs.persist();
    } catch (e: any) {
        context.writer.writeError(`2>> failed: ${e.message || e}`);
    }
}
