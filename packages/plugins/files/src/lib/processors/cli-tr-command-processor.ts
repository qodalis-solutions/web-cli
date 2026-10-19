import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
    writeExamples,
    writeUsage,
    writeWrapped,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

/**
 * Expand character set notation (ranges like a-z, character classes like [:upper:])
 * into an array of individual characters.
 */
function expandSet(set: string): string[] {
    const chars: string[] = [];
    let i = 0;
    while (i < set.length) {
        // Escapes: \n, \t, \r, \\ and any other escaped character as itself
        if (set[i] === '\\' && i + 1 < set.length) {
            const next = set[i + 1];
            chars.push(
                next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next,
            );
            i += 2;
            continue;
        }
        // Character classes
        if (set[i] === '[' && set[i + 1] === ':') {
            const end = set.indexOf(':]', i + 2);
            if (end !== -1) {
                const className = set.substring(i + 2, end);
                chars.push(...getCharClass(className));
                i = end + 2;
                continue;
            }
        }
        // Ranges like a-z
        if (
            i + 2 < set.length &&
            set[i + 1] === '-' &&
            set[i + 2] !== '\\'
        ) {
            const start = set.charCodeAt(i);
            const finish = set.charCodeAt(i + 2);
            if (start <= finish) {
                for (let c = start; c <= finish; c++) {
                    chars.push(String.fromCharCode(c));
                }
            } else {
                for (let c = start; c >= finish; c--) {
                    chars.push(String.fromCharCode(c));
                }
            }
            i += 3;
            continue;
        }
        chars.push(set[i]);
        i++;
    }
    return chars;
}

function getCharClass(name: string): string[] {
    switch (name) {
        case 'upper':
            return expandSet('A-Z');
        case 'lower':
            return expandSet('a-z');
        case 'digit':
            return expandSet('0-9');
        case 'alpha':
            return [...expandSet('a-z'), ...expandSet('A-Z')];
        case 'alnum':
            return [...expandSet('a-z'), ...expandSet('A-Z'), ...expandSet('0-9')];
        case 'space':
            return [' ', '\t', '\n', '\r', '\x0b', '\x0c'];
        default:
            return [];
    }
}

/**
 * Parse quoted or unquoted tokens from a raw command string.
 * Returns an array of parsed tokens (SET1, SET2).
 */
function parseTokens(raw: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < raw.length) {
        // Skip whitespace
        if (/\s/.test(raw[i])) {
            i++;
            continue;
        }
        // Quoted string
        if (raw[i] === "'" || raw[i] === '"') {
            const quote = raw[i];
            i++;
            let token = '';
            while (i < raw.length && raw[i] !== quote) {
                token += raw[i];
                i++;
            }
            i++; // skip closing quote
            tokens.push(token);
            continue;
        }
        // Unquoted token
        let token = '';
        while (i < raw.length && !/\s/.test(raw[i])) {
            token += raw[i];
            i++;
        }
        tokens.push(token);
    }
    return tokens;
}

export class CliTrCommandProcessor implements ICliCommandProcessor {
    command = 'tr';
    description = 'Translate or delete characters in piped input';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔀', module: 'file management' };

    parameters = [
        {
            name: 'delete',
            aliases: ['d'],
            description: 'Delete characters in SET1',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'squeeze-repeats',
            aliases: ['s'],
            description: 'Squeeze repeated characters in last operand set',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        writeWrapped(
            context,
            'Translate characters from SET1 into the matching characters of SET2, delete them (-d) or squeeze repeats into one (-s). Sets can use ranges like a-z and classes like [:upper:], [:lower:], [:digit:], [:alpha:], [:alnum:] and [:space:]. Escapes \\n, \\t and \\\\ are understood. Like Unix tr, it reads only piped input and takes no file operands: to transform a file, pipe it in with cat.',
        );
        context.writer.writeln();
        writeUsage(context, [
            ['<command> | tr <set1> <set2>', 'Replace characters'],
            ['<command> | tr -d <set1>', 'Delete characters'],
            ['<command> | tr -s <set1> [set2]', 'Squeeze repeated characters'],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ['cat notes.txt | tr a-z A-Z', 'Convert a file to upper case'],
            ['echo hello | tr a-z A-Z', 'Upper-case piped text'],
            ['cat notes.txt | tr -d 0-9', 'Remove all digits'],
            ["cat notes.txt | tr -s ' '", 'Collapse runs of spaces'],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const raw = command.value || '';
        const positional = parseTokens(raw);

        const deleteMode = !!command.args['d'] || !!command.args['delete'];
        const squeezeMode =
            !!command.args['s'] || !!command.args['squeeze-repeats'];

        if (positional.length === 0) {
            this.fail(context, 'tr: missing operand');
            return;
        }

        // How many operands are sets: -d takes one, -d -s and plain
        // translation two, -s one or two. Like Unix tr there are no file
        // operands: tr reads only piped input.
        let setCount: number;
        if (deleteMode) {
            setCount = squeezeMode ? 2 : 1;
        } else if (squeezeMode) {
            setCount = Math.min(positional.length, 2);
        } else {
            setCount = 2;
        }

        if (positional.length < setCount) {
            this.fail(context, 'tr: missing operand');
            return;
        }
        if (positional.length > setCount) {
            this.fail(context, `tr: extra operand '${positional[setCount]}'`);
            return;
        }

        if (command.data == null) {
            this.fail(
                context,
                "tr: no input: tr reads only piped input and takes no file operands; use 'cat file | tr a-z A-Z'",
            );
            return;
        }

        const set1Str: string = positional[0];
        const set2Str: string | undefined =
            setCount === 2 ? positional[1] : undefined;
        const content: string =
            typeof command.data === 'string'
                ? command.data
                : JSON.stringify(command.data);

        try {
            const set1 = expandSet(set1Str!);
            const set1Set = new Set(set1);
            const set2 = set2Str ? expandSet(set2Str) : [];

            let result = content;

            if (deleteMode && squeezeMode) {
                // Delete SET1 chars, then squeeze SET2 chars
                result = this.deleteChars(result, set1Set);
                const squeezeSet = new Set(set2);
                result = this.squeezeChars(result, squeezeSet);
            } else if (deleteMode) {
                result = this.deleteChars(result, set1Set);
            } else if (squeezeMode && set2.length > 0) {
                // Translate then squeeze
                result = this.translateChars(result, set1, set2);
                const squeezeSet = new Set(set2);
                result = this.squeezeChars(result, squeezeSet);
            } else if (squeezeMode) {
                result = this.squeezeChars(result, set1Set);
            } else {
                result = this.translateChars(result, set1, set2);
            }

            context.writer.writeln(result);
        } catch (e: any) {
            this.fail(context, `tr: ${e.message}`);
        }
    }

    private fail(context: ICliExecutionContext, message: string): void {
        context.writer.writeError(message);
        context.process.exit(1, { silent: true });
    }

    private deleteChars(content: string, deleteSet: Set<string>): string {
        let result = '';
        for (const ch of content) {
            if (!deleteSet.has(ch)) {
                result += ch;
            }
        }
        return result;
    }

    private squeezeChars(content: string, squeezeSet: Set<string>): string {
        let result = '';
        let prevChar = '';
        for (const ch of content) {
            if (squeezeSet.has(ch) && ch === prevChar) {
                continue;
            }
            result += ch;
            prevChar = ch;
        }
        return result;
    }

    private translateChars(
        content: string,
        set1: string[],
        set2: string[],
    ): string {
        if (set2.length === 0) return content;

        // Build translation map; if SET2 is shorter, last char repeats
        const map = new Map<string, string>();
        for (let i = 0; i < set1.length; i++) {
            const replacement =
                i < set2.length ? set2[i] : set2[set2.length - 1];
            map.set(set1[i], replacement);
        }

        let result = '';
        for (const ch of content) {
            result += map.has(ch) ? map.get(ch)! : ch;
        }
        return result;
    }
}
