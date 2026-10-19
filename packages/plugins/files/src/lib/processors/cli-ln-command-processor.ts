import { splitArgs } from '../utils/split-args';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliLnCommandProcessor implements ICliCommandProcessor {
    command = 'ln';
    description = 'Create symbolic links';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔗', module: 'file management' };

    parameters = [
        {
            name: 's',
            description: 'Create a symbolic link',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'force',
            aliases: ['f'],
            description: 'Replace an existing file at the link path',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.ln.help.create_symbolic_link_new', 'Create a symbolic link: a new path that points to another file or directory. Only symbolic links (-s) are supported, and the target does not need to exist yet.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['ln -s <target> <link>', t.t('cli.ln.help.create_pointing', 'Create <link> pointing at <target>')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['ln -s ~/docs/notes.txt notes', t.t('cli.ln.help.shortcut_file', 'Shortcut to a file')],
            ['ln -s /var/log logs', t.t('cli.ln.help.shortcut_directory', 'Shortcut to a directory')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const { symbolic, target, linkName } = this.parseArgs(command);

        if (!symbolic) {
            context.writer.writeError(
                'ln: hard links not supported in virtual filesystem',
            );
            return;
        }

        if (!target || !linkName) {
            context.writer.writeError('ln: missing operand');
            return;
        }

        const resolvedLink = fs.resolvePath(linkName);
        const resolvedTarget = fs.resolvePath(target);

        // Check if the link already exists (-f replaces a file, not a directory)
        const force = !!(command.args['force'] || command.args['f']);
        if (force && fs.exists(resolvedLink) && !fs.isDirectory(resolvedLink)) {
            fs.remove(resolvedLink);
        }
        if (fs.exists(resolvedLink)) {
            context.writer.writeError(
                `ln: failed to create symbolic link '${linkName}': File exists`,
            );
            return;
        }

        // Create the symlink as a file node with linkTarget set
        // We allow dangling symlinks so we don't check if target exists
        fs.createFile(resolvedLink, '');
        const node = fs.getNode(resolvedLink);
        if (node) {
            node.linkTarget = resolvedTarget;
            node.size = 0;
        }

        await fs.persist();
    }

    private parseArgs(command: CliProcessCommand): {
        symbolic: boolean;
        target: string | null;
        linkName: string | null;
    } {
        const raw = command.value || '';
        const tokens = splitArgs(raw).filter(Boolean);
        const symbolic = command.args['s'] || false;

        return {
            symbolic,
            target: tokens[0] || null,
            linkName: tokens[1] || null,
        };
    }
}
