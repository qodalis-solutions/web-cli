import { splitArgs } from '../utils/split-args';
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
    quoteShellWord,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';
import { pipedText } from '../utils/lines';

export class CliXargsCommandProcessor implements ICliCommandProcessor {
    command = 'xargs';
    description = 'Build and execute commands from file input';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '⚡', module: 'file management' };

    parameters = [
        {
            name: 'replace',
            aliases: ['I'],
            description: 'Replace string in command template (e.g., -I {})',
            required: false,
            type: 'string' as const,
        },
        {
            name: 'max-args',
            aliases: ['n'],
            description: 'Maximum number of arguments per command',
            required: false,
            type: 'number' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.xargs.help.run_command_arguments_taken', 'Run a command with arguments taken from input, separated by blanks or newlines. By default all of them are appended to one command; -n runs it in batches and -I runs it once per line, replacing a placeholder. xargs options go before the command; everything after it, flags included, belongs to the command. Input is piped text or, without a pipe, the last file named.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ['<command> | xargs <cmd>', t.t('cli.xargs.help.append_input_lines', 'Append input lines to <cmd>')],
            ['<command> | xargs -I {} <cmd {}>', t.t('cli.xargs.help.run_once_per_line', 'Run <cmd> once per line')],
            ['xargs <cmd> <file>', t.t('cli.xargs.help.read_arguments_file', 'Read the arguments from a file')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['find . --name "*.tmp" | xargs rm', t.t('cli.xargs.help.delete_every_tmp_file', 'Delete every .tmp file')],
            [
                'cat files.txt | xargs -I {} cp {} backup',
                t.t('cli.xargs.help.copy_each_listed_file', 'Copy each listed file'),
            ],
            ['cat dirs.txt | xargs -n 1 mkdir', t.t('cli.xargs.help.one_mkdir_per_line', 'One mkdir per line')],
            ['find . --name "*.bak" | xargs rm -r', t.t('cli.xargs.help.inner_command_keeps_flags', 'The inner command keeps its flags')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        // The engine takes every flag on the line for xargs, including the
        // inner command's (`xargs rm -r`), so the line is read again here:
        // xargs' own options come first, the rest is the inner command.
        let parsed: XargsLine;
        try {
            parsed = command.rawCommand
                ? parseXargsLine(command.rawCommand)
                : {
                      replace: stringArg(command.args['replace'] ?? command.args['I']),
                      maxArgs:
                          parseInt(
                              String(command.args['max-args'] ?? command.args['n'] ?? ''),
                              10,
                          ) || undefined,
                      words: splitWords(command.value ?? ''),
                  };
        } catch (e: any) {
            context.writer.writeError(`xargs: ${e.message}`);
            return;
        }
        const replaceStr = parsed.replace;
        const maxArgs = parsed.maxArgs ?? 0;

        let commandTemplate: string;
        let argContent: string;

        if (command.data != null) {
            // Piped mode: the whole rest is the command (echo by default)
            commandTemplate = parsed.words.map((w) => w.raw).join(' ') || 'echo';
            argContent = pipedText(command.data);
        } else {
            // File mode: the last word is the input file
            if (parsed.words.length === 0) {
                context.writer.writeError('xargs: missing command');
                return;
            }
            if (parsed.words.length < 2) {
                context.writer.writeError('xargs: missing input file');
                return;
            }
            const inputFile = parsed.words[parsed.words.length - 1].value;
            commandTemplate = parsed.words
                .slice(0, -1)
                .map((w) => w.raw)
                .join(' ');
            if (!fs.exists(inputFile)) {
                context.writer.writeError(
                    `xargs: ${inputFile}: No such file or directory`,
                );
                return;
            }
            argContent = fs.readFile(inputFile) || '';
        }

        const commands: string[] = [];

        if (replaceStr) {
            // Replace mode: one command per input line
            const lines = argContent
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
            const placeholder = new RegExp(this.escapeRegex(replaceStr), 'g');
            for (const line of lines) {
                commands.push(
                    commandTemplate.replace(placeholder, () => quoteArg(line)),
                );
            }
        } else {
            // Arguments are the blank-separated words of the input
            const args = splitArgs(argContent).map(quoteArg);
            if (args.length === 0) return;
            const size = maxArgs > 0 ? maxArgs : args.length;
            for (let i = 0; i < args.length; i += size) {
                commands.push(
                    `${commandTemplate} ${args.slice(i, i + size).join(' ')}`,
                );
            }
        }

        // Try to execute via executor, or just output the commands
        const executor = context.executor;
        for (const cmd of commands) {
            if (executor && typeof executor.executeCommand === 'function') {
                try {
                    await executor.executeCommand(cmd, context);
                } catch {
                    context.writer.writeln(cmd);
                }
            } else {
                context.writer.writeln(cmd);
            }
        }
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

interface XargsWord {
    /** As written, quotes included */
    raw: string;
    /** Without quotes */
    value: string;
}

interface XargsLine {
    replace?: string;
    maxArgs?: number;
    /** The inner command (and, without piped input, the input file) */
    words: XargsWord[];
}

/** `xargs [-I str] [-n num] [--] command...` */
function parseXargsLine(raw: string): XargsLine {
    const words = splitWords(raw).slice(1); // drop "xargs"
    const result: XargsLine = { words: [] };
    let i = 0;
    const valueOf = (option: string, inline: string): string => {
        if (inline !== '') return inline;
        if (i + 1 >= words.length) {
            throw new Error(`option requires an argument -- '${option}'`);
        }
        return words[++i].value;
    };

    for (; i < words.length; i++) {
        const word = words[i].raw;
        if (word === '--') {
            i++;
            break;
        }
        if (!word.startsWith('-') || word === '-') break;

        let match: RegExpMatchArray | null;
        if ((match = word.match(/^(?:-I|--replace(?:=|$))(.*)$/))) {
            result.replace = valueOf('I', unquote(match[1]));
        } else if (word === '-i') {
            result.replace = '{}';
        } else if ((match = word.match(/^(?:-n|--max-args(?:=|$))(.*)$/))) {
            const value = valueOf('n', unquote(match[1]));
            const count = parseInt(value, 10);
            if (isNaN(count) || count < 1) {
                throw new Error(`invalid number of arguments: '${value}'`);
            }
            result.maxArgs = count;
        } else {
            throw new Error(`invalid option -- '${word.replace(/^-+/, '')}'`);
        }
    }

    result.words = words.slice(i);
    return result;
}

/** Splits on blanks outside quotes, keeping each word as written. */
function splitWords(raw: string): XargsWord[] {
    const words: XargsWord[] = [];
    const regex = /(?:"(?:[^"\\]|\\.)*"|'[^']*'|[^\s"']|["'])+/g;
    for (const match of raw.matchAll(regex)) {
        words.push({ raw: match[0], value: splitArgs(match[0]).join(' ') });
    }
    return words;
}

function unquote(value: string): string {
    return splitArgs(value).join(' ');
}

function stringArg(value: unknown): string | undefined {
    return value == null || value === true || value === '' ? undefined : String(value);
}

/**
 * An input argument as one literal word of a command line, quoted when it
 * has any shell character, so `*`, `$VAR`, `$(...)`, braces and operators in
 * the input are data, never expanded or run.
 */
function quoteArg(arg: string): string {
    return quoteShellWord(arg);
}
