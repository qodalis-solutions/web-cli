import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliChmodCommandProcessor implements ICliCommandProcessor {
    command = 'chmod';
    description = 'Change file permissions';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔒', module: 'file management' };

    parameters = [
        {
            name: 'R',
            description: 'Change files and directories recursively',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const { recursive, mode, paths } = this.parseArgs(command);

        if (!mode || paths.length === 0) {
            context.writer.writeError(
                'chmod: missing operand',
            );
            return;
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
            const node = fs.getNode(resolved);

            if (!node) {
                context.writer.writeError(
                    `chmod: cannot access '${path}': No such file or directory`,
                );
                continue;
            }

            const perms = this.resolvePermissions(mode, node.permissions || 'rw-r--r--');
            if (perms === null) {
                context.writer.writeError(
                    `chmod: invalid mode: '${mode}'`,
                );
                return;
            }

            this.applyPermissions(fs, resolved, node, perms, recursive);
        }

        await fs.persist();
    }

    private parseArgs(command: CliProcessCommand): {
        recursive: boolean;
        mode: string | null;
        paths: string[];
    } {
        const raw = command.value || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const recursive = command.args['R'] || false;
        const mode = tokens.length > 0 ? tokens[0] : null;
        const paths = tokens.slice(1);
        return { recursive, mode, paths };
    }

    private resolvePermissions(
        mode: string,
        current: string,
    ): string | null {
        // Octal mode (e.g., 755, 644)
        if (/^[0-7]{3}$/.test(mode)) {
            return this.octalToPermString(mode);
        }

        // Symbolic mode (e.g., u+x, go-w, a+r)
        const match = mode.match(/^([ugoa]+)([+\-=])([rwx]+)$/);
        if (!match) {
            return null;
        }

        const who = match[1];
        const op = match[2];
        const perms = match[3];
        const chars = current.split('');

        // Map who to indices: u=0-2, g=3-5, o=6-8
        const indices: number[] = [];
        const addIndices = (start: number) => {
            if (perms.includes('r')) indices.push(start);
            if (perms.includes('w')) indices.push(start + 1);
            if (perms.includes('x')) indices.push(start + 2);
        };

        if (who.includes('u') || who.includes('a')) addIndices(0);
        if (who.includes('g') || who.includes('a')) addIndices(3);
        if (who.includes('o') || who.includes('a')) addIndices(6);

        for (const idx of indices) {
            const permChar = idx % 3 === 0 ? 'r' : idx % 3 === 1 ? 'w' : 'x';
            if (op === '+') {
                chars[idx] = permChar;
            } else if (op === '-') {
                chars[idx] = '-';
            } else if (op === '=') {
                chars[idx] = permChar;
            }
        }

        // For '=' operation, clear bits not mentioned
        if (op === '=') {
            const clearIndices: number[] = [];
            const clearGroup = (start: number) => {
                if (!perms.includes('r')) clearIndices.push(start);
                if (!perms.includes('w')) clearIndices.push(start + 1);
                if (!perms.includes('x')) clearIndices.push(start + 2);
            };

            if (who.includes('u') || who.includes('a')) clearGroup(0);
            if (who.includes('g') || who.includes('a')) clearGroup(3);
            if (who.includes('o') || who.includes('a')) clearGroup(6);

            for (const idx of clearIndices) {
                chars[idx] = '-';
            }
        }

        return chars.join('');
    }

    private octalToPermString(octal: string): string {
        const digitToPerms = (d: number): string => {
            return (
                ((d & 4) ? 'r' : '-') +
                ((d & 2) ? 'w' : '-') +
                ((d & 1) ? 'x' : '-')
            );
        };
        return (
            digitToPerms(parseInt(octal[0], 10)) +
            digitToPerms(parseInt(octal[1], 10)) +
            digitToPerms(parseInt(octal[2], 10))
        );
    }

    private applyPermissions(
        fs: IFileSystemService,
        basePath: string,
        node: IFileNode,
        perms: string,
        recursive: boolean,
    ): void {
        fs.chmod(basePath, perms);
        if (recursive && node.type === 'directory' && node.children) {
            for (const child of node.children) {
                const childPath =
                    basePath === '/'
                        ? `/${child.name}`
                        : `${basePath}/${child.name}`;
                this.applyPermissions(fs, childPath, child, perms, recursive);
            }
        }
    }
}
