import { isCliAccessDeniedError } from '@qodalis/cli-core';
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService } from '../interfaces/i-file-system-service';

/**
 * Children of a directory the current principal may list (`r` + `x`).
 * Recursive commands (find, tree, du, grep -r) walk through this so they
 * never reveal what is inside directories the user cannot read.
 * Returns `null` when listing is denied.
 */
export function readableChildren(fs: IFileSystemService, path: string): IFileNode[] | null {
    try {
        return fs.listDirectory(path);
    } catch (e) {
        if (isCliAccessDeniedError(e)) return null;
        throw e;
    }
}
