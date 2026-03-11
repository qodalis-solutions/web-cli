import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliChownCommandProcessor implements ICliCommandProcessor {
    command = 'chown';
    description = 'Change file owner and group';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔑', module: 'file management' };

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
        const { recursive, ownerSpec, paths } = this.parseArgs(command);

        if (!ownerSpec || paths.length === 0) {
            context.writer.writeError(
                'chown: missing operand. Usage: chown [user][:group] <file>',
            );
            return;
        }

        const { uid, gid } = this.parseOwnerSpec(ownerSpec);
        if (!uid && !gid) {
            context.writer.writeError(
                `chown: invalid owner: '${ownerSpec}'`,
            );
            return;
        }

        for (const path of paths) {
            const resolved = fs.resolvePath(path);
            const node = fs.getNode(resolved);

            if (!node) {
                context.writer.writeError(
                    `chown: cannot access '${path}': No such file or directory`,
                );
                continue;
            }

            this.applyOwnership(fs, resolved, node, uid, gid, recursive);
        }

        await fs.persist();
    }

    private parseArgs(command: CliProcessCommand): {
        recursive: boolean;
        ownerSpec: string | null;
        paths: string[];
    } {
        const raw = command.value || '';
        const tokens = raw.split(/\s+/).filter(Boolean);
        const recursive = command.args['R'] || false;
        const ownerSpec = tokens.length > 0 ? tokens[0] : null;
        const paths = tokens.slice(1);
        return { recursive, ownerSpec, paths };
    }

    /** Parse "user:group", "user:", ":group", or "user" */
    private parseOwnerSpec(spec: string): { uid: string | null; gid: string | null } {
        if (spec.includes(':')) {
            const [uid, gid] = spec.split(':', 2);
            return {
                uid: uid || null,
                gid: gid || null,
            };
        }
        return { uid: spec, gid: null };
    }

    private applyOwnership(
        fs: IFileSystemService,
        basePath: string,
        node: IFileNode,
        uid: string | null,
        gid: string | null,
        recursive: boolean,
    ): void {
        const current = node.ownership || { uid: 'root', gid: 'admin' };
        fs.chown(basePath, {
            uid: uid ?? current.uid,
            gid: gid ?? current.gid,
        });

        if (recursive && node.type === 'directory' && node.children) {
            for (const child of node.children) {
                const childPath =
                    basePath === '/'
                        ? `/${child.name}`
                        : `${basePath}/${child.name}`;
                this.applyOwnership(fs, childPath, child, uid, gid, recursive);
            }
        }
    }
}
