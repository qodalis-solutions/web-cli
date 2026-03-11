import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

/**
 * Expand character set notation (ranges like a-z, character classes like [:upper:])
 * into an array of individual characters.
 */
function expandSet(set: string): string[] {
    const chars: string[] = [];
    let i = 0;
    while (i < set.length) {
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
            set[i + 2] !== undefined
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
 * Returns an array of parsed tokens (flags, SET1, SET2, file path).
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
    description = 'Translate or delete characters in a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    valueRequired = true;
    metadata = { icon: '🔀', module: 'file management' };

    parameters = [
        {
            name: 'd',
            description: 'Delete characters in SET1',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 's',
            description: 'Squeeze repeated characters in last operand set',
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

        const raw = command.value || '';
        const positional = parseTokens(raw);

        const deleteMode = !!command.args['d'];
        const squeezeMode = !!command.args['s'];

        if (positional.length === 0) {
            context.writer.writeError('tr: missing operand');
            return;
        }

        let set1Str: string | undefined;
        let set2Str: string | undefined;
        let filePath: string | undefined;

        if (deleteMode && squeezeMode) {
            // -d -s SET1 SET2 [file]
            if (positional.length < 2) {
                context.writer.writeError('tr: missing operand');
                return;
            }
            set1Str = positional[0];
            set2Str = positional[1];
            if (positional.length >= 3) {
                filePath = positional[2];
            }
        } else if (deleteMode) {
            // -d SET1 [file]
            if (positional.length < 1) {
                context.writer.writeError('tr: missing operand');
                return;
            }
            set1Str = positional[0];
            if (positional.length >= 2) {
                filePath = positional[1];
            }
        } else if (squeezeMode) {
            if (positional.length < 1) {
                context.writer.writeError('tr: missing operand');
                return;
            }
            if (positional.length >= 3) {
                // -s SET1 SET2 file => translate + squeeze
                set1Str = positional[0];
                set2Str = positional[1];
                filePath = positional[2];
            } else if (positional.length === 2) {
                // -s SET1 file  OR  -s SET1 SET2 (piped)
                // If piped data exists and there's no file at positional[1], treat as SET1 + file
                set1Str = positional[0];
                filePath = positional[1];
            } else {
                // -s SET1 (piped)
                set1Str = positional[0];
            }
        } else {
            // translate: SET1 SET2 [file]
            if (positional.length < 2) {
                context.writer.writeError('tr: missing operand');
                return;
            }
            set1Str = positional[0];
            set2Str = positional[1];
            if (positional.length >= 3) {
                filePath = positional[2];
            }
        }

        let content: string | null;
        if (filePath) {
            try {
                if (fs.isDirectory(filePath)) {
                    context.writer.writeError(`tr: ${filePath}: Is a directory`);
                    return;
                }
                content = fs.readFile(filePath);
                if (content === null) {
                    context.writer.writeError(
                        `tr: ${filePath}: No such file or directory`,
                    );
                    return;
                }
            } catch (e: any) {
                context.writer.writeError(`tr: ${e.message}`);
                return;
            }
        } else if (command.data != null) {
            content = typeof command.data === 'string'
                ? command.data : JSON.stringify(command.data);
        } else {
            context.writer.writeError('tr: missing file operand');
            return;
        }

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
            context.writer.writeError(`tr: ${e.message}`);
        }
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
