import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';
    description = 'Display text or redirect output to a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    extendsProcessor = true;
    originalProcessor?: ICliCommandProcessor;
    metadata = { icon: '💬', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const afterEcho = command.value || '';

        // Check for file redirection syntax
        const hasRedirection = />>?\s*.+$/.test(afterEcho);

        if (!hasRedirection) {
            // No redirection — delegate to the original echo processor
            if (this.originalProcessor) {
                await this.originalProcessor.processCommand(command, context);
            } else {
                context.writer.writeln(afterEcho);
            }
            return;
        }

        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        let text: string;
        let filePath: string;
        let append = false;

        const appendMatch = afterEcho.match(/^(.*?)\s*>>\s*(.+)$/);
        const overwriteMatch = afterEcho.match(/^(.*?)\s*>\s*(.+)$/);

        if (appendMatch) {
            text = appendMatch[1].trim();
            filePath = appendMatch[2].trim();
            append = true;
        } else {
            text = overwriteMatch![1].trim();
            filePath = overwriteMatch![2].trim();
        }

        // Remove surrounding quotes
        if (
            (text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))
        ) {
            text = text.slice(1, -1);
        }

        // Interpret escape sequences (\n, \t, etc.)
        text = text.replace(/\\([\\nrtv0])/g, (_, ch: string) => {
            switch (ch) {
                case 'n': return '\n';
                case 't': return '\t';
                case 'r': return '\r';
                case 'v': return '\v';
                case '0': return '\0';
                case '\\': return '\\';
                default: return ch;
            }
        });

        try {
            fs.writeFile(filePath, text + '\n', append);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
