import {
    ICliCompletionProvider,
    ICliCompletionContext,
} from '@qodalis/cli-core';
import { IFileSystemService } from '../interfaces/i-file-system-service';

/** Commands that accept file/directory path arguments. */
const FILE_COMMANDS = new Set([
    'ls',
    'cd',
    'cat',
    'cp',
    'mv',
    'rm',
    'touch',
    'mkdir',
    'rmdir',
    'tree',
    'echo',
    'nano',
    'edit',
    'grep',
    'find',
    'head',
    'tail',
    'wc',
]);

/**
 * Provides tab-completion for file and directory names from the virtual filesystem.
 * Priority 50 (checked before command/parameter providers for file-related commands).
 */
export class FilePathCompletionProvider implements ICliCompletionProvider {
    priority = 50;

    constructor(private readonly fs: IFileSystemService) {}

    getCompletions(context: ICliCompletionContext): string[] {
        const { tokens, tokenIndex, token } = context;

        // Only activate when the command is a file command and we're completing an argument
        if (tokenIndex === 0) {
            return []; // Let command completion handle the first token
        }

        const command = tokens[0];
        if (!FILE_COMMANDS.has(command)) {
            return [];
        }

        // Skip flag tokens
        if (token.startsWith('-')) {
            return [];
        }

        return this.completePath(token);
    }

    private completePath(partial: string): string[] {
        // Split into directory part and name prefix
        let dirPath: string;
        let namePrefix: string;

        if (partial.includes('/')) {
            const lastSlash = partial.lastIndexOf('/');
            dirPath = partial.slice(0, lastSlash) || '/';
            namePrefix = partial.slice(lastSlash + 1);
        } else {
            dirPath = this.fs.getCurrentDirectory();
            namePrefix = partial;
        }

        // Resolve the directory
        let resolvedDir: string;
        try {
            resolvedDir = this.fs.resolvePath(dirPath);
        } catch {
            return [];
        }

        if (!this.fs.exists(resolvedDir) || !this.fs.isDirectory(resolvedDir)) {
            return [];
        }

        // List entries and filter by prefix
        const entries = this.fs.listDirectory(resolvedDir);
        const lowerPrefix = namePrefix.toLowerCase();

        const results: string[] = [];
        for (const entry of entries) {
            if (entry.name.toLowerCase().startsWith(lowerPrefix)) {
                // Build the completion string preserving the directory prefix
                let completion: string;
                if (partial.includes('/')) {
                    const lastSlash = partial.lastIndexOf('/');
                    completion = partial.slice(0, lastSlash + 1) + entry.name;
                } else {
                    completion = entry.name;
                }

                // Append / for directories
                if (entry.type === 'directory') {
                    completion += '/';
                }

                results.push(completion);
            }
        }

        return results.sort();
    }
}
