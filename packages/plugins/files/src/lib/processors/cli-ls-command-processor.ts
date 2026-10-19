import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { splitArgs } from '../utils/split-args';

export class CliLsCommandProcessor implements ICliCommandProcessor {
    command = 'ls';
    description = 'List directory contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📋', module: 'file management' };

    parameters = [
        {
            name: 'all',
            aliases: ['a'],
            description: 'Show hidden files (starting with .)',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'long',
            aliases: ['l'],
            description: 'Use long listing format',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'human-readable',
            aliases: ['h'],
            description: 'With -l, print sizes like 1.5K and 2M',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const paths = splitArgs(command.value || '');
        const showAll = command.args['all'] || command.args['a'];
        const longFormat = command.args['long'] || command.args['l'];
        this.humanReadable = !!(command.args['human-readable'] || command.args['h']);
        const targets = paths.length > 0 ? paths : [fs.getCurrentDirectory()];
        // Down a pipe or into `$(...)`: one name per line, as a shell's ls
        const piped: string[] = [];

        targets.forEach((targetPath, index) => {
            try {
                const node = fs.getNode(targetPath);
                const entries =
                    node && node.type !== 'directory'
                        ? [{ ...node, name: targetPath }]
                        : fs.listDirectory(targetPath);
                const filtered = showAll
                    ? entries
                    : entries.filter((e) => !e.name.startsWith('.'));

                if (targets.length > 1) {
                    if (index > 0) context.writer.writeln();
                    context.writer.writeln(`${targetPath}:`);
                }

                if (filtered.length === 0) {
                    return;
                }

                filtered.sort((a, b) => {
                    if (a.type !== b.type) {
                        return a.type === 'directory' ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                });

                if (longFormat) {
                    this.writeLongFormat(filtered, context);
                } else {
                    this.writeShortFormat(filtered, context);
                    piped.push(...filtered.map((e) => e.name));
                }
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        });

        if (!longFormat && piped.length > 0) {
            context.process.output(piped.join('\n'));
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
        context.writer.writeln();
        context.writer.writeln('Usage: ls [path...] [-a|--all] [-l|--long] [-h|--human-readable]');
    }

    private writeLongFormat(
        entries: IFileNode[],
        context: ICliExecutionContext,
    ): void {
        const { writer } = context;
        for (const entry of entries) {
            const typeChar = entry.type === 'directory' ? 'd' : '-';
            const perms =
                entry.permissions ||
                (entry.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
            const owner = entry.ownership?.uid || '-';
            const group = entry.ownership?.gid || '-';
            const size =
                entry.type !== 'file'
                    ? '-'
                    : this.humanReadable
                      ? this.formatSize(entry.size)
                      : entry.size.toString();
            const date = new Date(entry.modifiedAt);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
            const name =
                entry.type === 'directory'
                    ? writer.wrapInColor(entry.name, CliForegroundColor.Cyan)
                    : entry.name;

            writer.writeln(
                `${typeChar}${perms}  ${owner.padEnd(8)} ${group.padEnd(8)} ${size.padStart(6)}  ${dateStr}  ${name}`,
            );
        }
    }

    private humanReadable = false;

    private formatSize(bytes: number): string {
        const units = ['K', 'M', 'G', 'T'];
        let size = bytes;
        let unit = '';
        for (const next of units) {
            if (size < 1024) break;
            size /= 1024;
            unit = next;
        }
        return unit ? `${size < 10 ? size.toFixed(1) : Math.round(size)}${unit}` : String(bytes);
    }

    private writeShortFormat(
        entries: IFileNode[],
        context: ICliExecutionContext,
    ): void {
        const { writer } = context;
        const names = entries.map((e) =>
            e.type === 'directory'
                ? writer.wrapInColor(e.name, CliForegroundColor.Cyan)
                : e.name,
        );
        writer.writeln(names.join('  '));
    }
}
