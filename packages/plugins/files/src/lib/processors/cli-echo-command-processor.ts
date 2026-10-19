import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    joinShellWords,
    writeExamples,
    writeUsage,
    writeWrapped,
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

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Print text to the terminal. Add > file to save it to a file (replacing it) or >> file to add it to the end.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['echo <text>', 'Print text'],
            ['echo <text> > <file>', 'Write text to a file'],
            ['echo <text> >> <file>', 'Append text to a file'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['echo Hello world', 'Print a greeting'],
            ['echo first line > notes.txt', 'Create or replace notes.txt'],
            ['echo another line >> notes.txt', 'Add a line to it'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const afterEcho = command.value || '';

        // Check for file redirection syntax (a `>` inside quotes is text)
        const redirect = findRedirect(afterEcho);

        if (!redirect) {
            // No redirection — delegate to the original echo processor
            if (this.originalProcessor) {
                await this.originalProcessor.processCommand(command, context);
            } else {
                const text = joinShellWords(afterEcho);
                context.writer.writeln(text);
                context.process.output(text);
            }
            return;
        }

        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        let text = redirect.text;
        const { filePath, append } = redirect;

        text = unquote(text);

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

/**
 * The first `>` or `>>` outside quotes, splitting `text > file`.
 * Undefined when there is none or no file name follows it.
 */
export function findRedirect(
    input: string,
): { text: string; filePath: string; append: boolean } | undefined {
    let quote: string | null = null;
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (ch === '\\' && quote === '"') i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch !== '>') continue;
        const append = input[i + 1] === '>';
        const filePath = unquote(input.slice(i + (append ? 2 : 1)).trim());
        if (!filePath) return undefined;
        return { text: input.slice(0, i).trim(), filePath, append };
    }
    return undefined;
}

/** Text without one pair of surrounding quotes. */
function unquote(text: string): string {
    return text.length > 1 &&
        ((text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'")))
        ? text.slice(1, -1)
        : text;
}
