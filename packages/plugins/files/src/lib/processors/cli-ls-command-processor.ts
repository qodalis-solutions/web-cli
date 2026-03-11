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
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const targetPath = command.value || fs.getCurrentDirectory();
        const showAll = command.args['all'] || command.args['a'];
        const longFormat = command.args['long'] || command.args['l'];

        try {
            const entries = fs.listDirectory(targetPath);
            const filtered = showAll
                ? entries
                : entries.filter((e) => !e.name.startsWith('.'));

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
            }
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
        context.writer.writeln();
        context.writer.writeln('Usage: ls [path] [--all] [--long]');
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
            const size = entry.type === 'file' ? entry.size.toString() : '-';
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
