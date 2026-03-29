import { ICliExecutionContext } from '@qodalis/cli-core';
import { CapturingTerminalWriter } from '../services/capturing-terminal-writer';

const FS_TOKEN = 'cli-file-system-service';

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
        const resolved = fs.resolvePath(filePath.trim());
        const content =
            typeof output === 'string' ? output : JSON.stringify(output);
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
        const resolved = fs.resolvePath(filePath.trim());
        const content =
            typeof output === 'string' ? output : JSON.stringify(output);
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
        const resolved = fs.resolvePath(filePath.trim());
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
        const resolved = fs.resolvePath(filePath.trim());
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
