import {
    CliProcessCommand,
    CliForegroundColor,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliUploadCommandProcessor implements ICliCommandProcessor {
    command = 'upload';
    description = 'Upload a file from your local machine into the virtual filesystem';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '📤', module: 'file management' };

    parameters = [
        {
            name: 'accept',
            description: 'File type filter (e.g. ".json,.txt" or "image/*")',
            required: false,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        const fileService = context.services.get<ICliFileTransferService>(
            ICliFileTransferService_TOKEN,
        );

        if (!fileService) {
            context.writer.writeError('File transfer service not available.');
            return;
        }

        const accept = command.args?.['accept'] as string | undefined;
        const destPath = command.value?.trim() || undefined;

        const picked = await fileService.uploadFromBrowser(accept);

        if (!picked) {
            context.writer.writeln('Upload cancelled.');
            return;
        }

        const cwd = fs.getCurrentDirectory();
        const filename = destPath || picked.name;
        const resolved = fs.resolvePath(
            filename.startsWith('/') ? filename : cwd + '/' + filename,
        );

        try {
            fs.writeFile(resolved, picked.content);
            await fs.persist();
            context.writer.writeSuccess(
                `Uploaded ${context.writer.wrapInColor(picked.name, CliForegroundColor.Cyan)} (${picked.content.length} bytes) → ${resolved}`,
            );
        } catch (e: any) {
            context.writer.writeError(e.message || 'Failed to write file');
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
        context.writer.writeln('');
        context.writer.writeln('Usage:');
        context.writer.writeln('  upload                    Open file picker, save to current directory');
        context.writer.writeln('  upload myfile.txt         Open file picker, save as myfile.txt');
        context.writer.writeln('  upload /home/user/data    Open file picker, save to absolute path');
        context.writer.writeln('  upload --accept=".json"   Filter file picker to .json files');
    }
}
