import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliDirnameCommandProcessor implements ICliCommandProcessor {
    command = 'dirname';
    description = 'Strip last component from path';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📂', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const tokens = this.parseTokens(command);

        if (tokens.length === 0) {
            context.writer.writeError('dirname: missing operand');
            return;
        }

        const path = tokens[0];

        // Handle root path
        if (path === '/') {
            context.writer.writeln('/');
            return;
        }

        // Remove trailing slashes
        const cleaned = path.replace(/\/+$/, '') || '/';

        // No slash at all => bare filename => return '.'
        if (!cleaned.includes('/')) {
            context.writer.writeln('.');
            return;
        }

        const parts = cleaned.split('/');
        parts.pop(); // remove last component

        let dir = parts.join('/');
        // If dir is empty after removing last component (e.g. "/home" -> "")
        if (!dir) {
            dir = '/';
        }

        context.writer.writeln(dir);
    }

    private parseTokens(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}
