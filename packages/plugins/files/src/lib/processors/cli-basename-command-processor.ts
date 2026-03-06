import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliBasenameCommandProcessor implements ICliCommandProcessor {
    command = 'basename';
    description = 'Strip directory from path';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '📛', module: 'file management' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const tokens = this.parseTokens(command);

        if (tokens.length === 0) {
            context.writer.writeError('basename: missing operand');
            return;
        }

        const path = tokens[0];
        const suffix = tokens.length > 1 ? tokens[1] : undefined;

        // Handle root path
        if (path === '/') {
            context.writer.writeln('/');
            return;
        }

        // Remove trailing slashes
        const cleaned = path.replace(/\/+$/, '') || '/';
        const parts = cleaned.split('/');
        let name = parts[parts.length - 1];

        // If after cleaning we got empty (shouldn't happen), fallback
        if (!name) {
            name = '/';
        }

        // Strip suffix if provided and name ends with it
        if (suffix && name.endsWith(suffix) && name !== suffix) {
            name = name.slice(0, -suffix.length);
        }

        context.writer.writeln(name);
    }

    private parseTokens(command: CliProcessCommand): string[] {
        const raw = command.value || '';
        return raw.split(/\s+/).filter(Boolean);
    }
}
