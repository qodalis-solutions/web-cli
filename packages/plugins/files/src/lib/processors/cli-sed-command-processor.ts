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
import { splitLines } from '../utils/lines';

type SedSingleAddress =
    | { type: 'line'; line: number }
    | { type: 'last' }
    | { type: 'regex'; regex: RegExp };

interface SedExpression {
    start: SedSingleAddress | null;
    /** End of a range address (`1,5`, `/a/,/b/`) */
    end: SedSingleAddress | null;
    negate: boolean;
    /** Inside a range: the start matched and the end not yet */
    active: boolean;
    command: 's' | 'd' | 'p' | 'q';
    // For substitution:
    pattern?: RegExp;
    replacement?: string;
    groupCount?: number;
    printFlag?: boolean;
    /** `s/a/b/2`: replace only the Nth match (with g, the Nth and later) */
    occurrence?: number;
    globalFlag?: boolean;
}

export class CliSedCommandProcessor implements ICliCommandProcessor {
    command = 'sed';
    description = 'Stream editor for filtering and transforming text';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '✏️', module: 'file management' };

    parameters = [
        {
            name: 'in-place',
            aliases: ['i'],
            description: 'Edit file in place',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'quiet',
            aliases: ['n'],
            description: 'Suppress automatic printing of pattern space',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'expression',
            aliases: ['e'],
            description: 'Add the expression to the commands to be executed (repeatable)',
            required: false,
            type: 'array' as const,
        },
        {
            name: 'regexp-extended',
            aliases: ['E', 'r'],
            description: 'Use extended regular expressions: (, ), +, ?, | and { } without backslashes',
            required: false,
            type: 'boolean' as const,
        },
    ];

    writeDescription(context: ICliExecutionContext): void {
        const t = context.translator;
        writeWrapped(
            context,
            t.t('cli.sed.help.edit_text_line_line', 'Edit text line by line with a script: substitute (s/old/new/), delete (d), print (p) or quit (q), optionally limited to a line number, a range (1,5, 3,$ or /start/,/end/) or lines matching /regex/; ! after an address inverts it and ; separates commands. The replacement can use & (the match) and \\1 to \\9 (groups, written \\(...\\) or, with -E, (...)). Reads files or piped input and prints the result, or rewrites the files with -i.'),
        );
        context.writer.writeln();
        writeUsage(context, [
            ["sed '<script>' <file>", t.t('cli.sed.help.print_edited_file', 'Print the edited file')],
            ["sed -i '<script>' <file>", t.t('cli.sed.help.save_edits_file', 'Save the edits into the file')],
            ["sed -n '<script>p' <file>", t.t('cli.sed.help.print_only_selected_lines', 'Print only selected lines')],
            ["<command> | sed '<script>'", t.t('cli.sed.help.edit_piped_input', 'Edit piped input')],
        ]);
        context.writer.writeln();
        writeExamples(context, [
            ["sed 's/cat/dog/g' pets.txt", t.t('cli.sed.help.replace_every_cat_dog', 'Replace every cat with dog')],
            ["sed -i 's/v1/v2/' config.txt", t.t('cli.sed.help.edit_file_place', 'Edit the file in place')],
            ["sed '/^#/d' config.txt", t.t('cli.sed.help.drop_comment_lines', 'Drop comment lines')],
            ["sed -n '1,5p' notes.txt", t.t('cli.sed.help.print_lines_1_5', 'Print lines 1 to 5')],
            ["sed -E 's/(\\w+) (\\w+)/\\2 \\1/' names.txt", t.t('cli.sed.help.swap_two_words', 'Swap two words')],
        ]);
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const { inPlace, suppress, extended, expressions, filePaths } =
            this.parseRawCommand(command);

        if (expressions.length === 0) {
            context.writer.writeError(
                'sed: missing expression. Usage: sed [options] \'expression\' <file>',
            );
            return;
        }

        const parse = (): SedExpression[] | null => {
            try {
                return expressions.flatMap((e) => this.parseScript(e, extended));
            } catch (e: any) {
                context.writer.writeError(`sed: ${e.message}`);
                return null;
            }
        };

        if (filePaths.length === 0) {
            if (command.data == null) {
                context.writer.writeError(
                    'sed: missing file operand. Usage: sed [options] \'expression\' <file>',
                );
                return;
            }
            const script = parse();
            if (!script) return;
            const content = typeof command.data === 'string'
                ? command.data : JSON.stringify(command.data);
            this.writeLines(context, this.run(script, splitLines(content), suppress));
            return;
        }

        // Read every file first, so a missing one stops before any edit
        const contents: string[] = [];
        for (const filePath of filePaths) {
            const resolved = fs.resolvePath(filePath);
            if (!fs.exists(resolved)) {
                context.writer.writeError(
                    `sed: ${filePath}: No such file or directory`,
                );
                return;
            }
            if (fs.isDirectory(resolved)) {
                context.writer.writeError(`sed: ${filePath}: Is a directory`);
                return;
            }
            try {
                contents.push(fs.readFile(resolved) ?? '');
            } catch (e: any) {
                context.writer.writeError(`sed: ${e.message}`);
                return;
            }
        }

        if (inPlace) {
            // Each file is edited on its own
            for (let i = 0; i < filePaths.length; i++) {
                const script = parse();
                if (!script) return;
                const output = this.run(script, splitLines(contents[i]), suppress);
                const keepNewline = contents[i].endsWith('\n') && output.length > 0;
                try {
                    fs.writeFile(
                        fs.resolvePath(filePaths[i]),
                        output.join('\n') + (keepNewline ? '\n' : ''),
                    );
                } catch (e: any) {
                    context.writer.writeError(`sed: ${e.message}`);
                    return;
                }
            }
            await fs.persist();
            return;
        }

        // Several files are one stream: line numbers and $ span them all
        const script = parse();
        if (!script) return;
        const lines = contents.flatMap((c) => splitLines(c));
        this.writeLines(context, this.run(script, lines, suppress));
    }

    private writeLines(context: ICliExecutionContext, lines: string[]): void {
        for (const line of lines) {
            context.writer.writeln(line);
        }
    }

    /** Runs the script over the lines and returns the output lines. */
    private run(
        script: SedExpression[],
        lines: string[],
        suppress: boolean,
    ): string[] {
        const output: string[] = [];

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            let line = lines[lineIdx];
            let deleted = false;
            let quit = false;

            for (const expr of script) {
                if (!this.addressMatches(expr, lineIdx + 1, lines.length, line)) {
                    continue;
                }

                if (expr.command === 's') {
                    let replaced = false;
                    let seen = 0;
                    const pattern = expr.pattern!;
                    pattern.lastIndex = 0;
                    line = line.replace(pattern, (...args: any[]) => {
                        seen++;
                        const nth = expr.occurrence;
                        if (nth && (expr.globalFlag ? seen < nth : seen !== nth)) {
                            return args[0];
                        }
                        replaced = true;
                        const groups = args.slice(0, expr.groupCount! + 1);
                        return this.expandReplacement(expr.replacement!, groups);
                    });
                    if (replaced && expr.printFlag) output.push(line);
                } else if (expr.command === 'p') {
                    output.push(line);
                } else if (expr.command === 'd') {
                    deleted = true;
                    break;
                } else if (expr.command === 'q') {
                    quit = true;
                    break;
                }
            }

            if (!deleted && !suppress) output.push(line);
            if (quit) break;
        }

        return output;
    }

    /** `&` is the match, `\1`..`\9` the groups, `\n` a newline, `\x` a literal x. */
    private expandReplacement(replacement: string, groups: string[]): string {
        let out = '';
        for (let i = 0; i < replacement.length; i++) {
            const ch = replacement[i];
            if (ch === '\\' && i + 1 < replacement.length) {
                const next = replacement[++i];
                if (next >= '0' && next <= '9') {
                    out += groups[Number(next)] ?? '';
                } else if (next === 'n') {
                    out += '\n';
                } else if (next === 't') {
                    out += '\t';
                } else {
                    out += next;
                }
            } else if (ch === '&') {
                out += groups[0];
            } else {
                out += ch;
            }
        }
        return out;
    }

    private parseRawCommand(command: CliProcessCommand): {
        inPlace: boolean;
        suppress: boolean;
        extended: boolean;
        expressions: string[];
        filePaths: string[];
    } {
        const raw = command.value || '';
        const tokens = this.tokenize(raw);

        const inPlace = !!command.args['in-place'] || !!command.args['i'];
        const suppress = !!command.args['quiet'] || !!command.args['n'];
        const extended =
            !!command.args['regexp-extended'] ||
            !!command.args['E'] ||
            !!command.args['r'];
        const expressions: string[] = [];

        // -e expressions (one or several)
        const eValue = command.args['expression'] ?? command.args['e'];
        for (const v of Array.isArray(eValue) ? eValue : [eValue]) {
            if (v != null && v !== true && v !== '') {
                expressions.push(String(v));
            }
        }

        // Without -e, the first operand is the script
        if (expressions.length === 0 && tokens.length > 0) {
            expressions.push(tokens.shift()!);
        }

        return { inPlace, suppress, extended, expressions, filePaths: tokens };
    }

    private tokenize(raw: string): string[] {
        const tokens: string[] = [];
        let i = 0;
        while (i < raw.length) {
            // Skip whitespace
            if (raw[i] === ' ' || raw[i] === '\t') {
                i++;
                continue;
            }

            // A word, with quoted parts (quotes removed)
            let token = '';
            while (i < raw.length && raw[i] !== ' ' && raw[i] !== '\t') {
                if (raw[i] === "'" || raw[i] === '"') {
                    const quote = raw[i];
                    i++;
                    while (i < raw.length && raw[i] !== quote) {
                        token += raw[i];
                        i++;
                    }
                    if (i < raw.length) i++; // skip closing quote
                } else {
                    token += raw[i];
                    i++;
                }
            }
            tokens.push(token);
        }
        return tokens;
    }

    /** Commands of a script, separated by `;` or newlines. */
    private parseScript(script: string, extended: boolean): SedExpression[] {
        const result: SedExpression[] = [];
        let pos = 0;
        const skipSeparators = () => {
            while (pos < script.length && /[\s;]/.test(script[pos])) pos++;
        };

        skipSeparators();
        while (pos < script.length) {
            const parsed = this.parseCommand(script, pos, extended);
            result.push(parsed.expression);
            pos = parsed.pos;
            while (pos < script.length && /[ \t]/.test(script[pos])) pos++;
            if (pos < script.length && !/[;\n]/.test(script[pos])) {
                throw new Error(`extra characters after command: '${script.slice(pos)}'`);
            }
            skipSeparators();
        }

        if (result.length === 0) {
            throw new Error(`invalid expression: '${script}'`);
        }
        return result;
    }

    private parseCommand(
        expr: string,
        pos: number,
        extended: boolean,
    ): { expression: SedExpression; pos: number } {
        // Optional address, or range of two
        let start: SedSingleAddress | null = null;
        let end: SedSingleAddress | null = null;
        const first = this.parseAddress(expr, pos, extended);
        if (first) {
            start = first.address;
            pos = first.pos;
            if (expr[pos] === ',') {
                const second = this.parseAddress(expr, pos + 1, extended);
                if (!second) {
                    throw new Error(`unexpected ',' in '${expr}'`);
                }
                end = second.address;
                pos = second.pos;
            }
        }
        while (pos < expr.length && /[ \t]/.test(expr[pos])) pos++;
        let negate = false;
        if (expr[pos] === '!') {
            negate = true;
            pos++;
            while (pos < expr.length && /[ \t]/.test(expr[pos])) pos++;
        }

        if (pos >= expr.length) {
            throw new Error(`invalid expression: '${expr}'`);
        }

        const base = { start, end, negate, active: false };
        const cmd = expr[pos];

        if (cmd === 's') {
            return this.parseSubstitution(expr, pos, base, extended);
        }
        if (cmd === 'd' || cmd === 'p' || cmd === 'q') {
            return { expression: { ...base, command: cmd }, pos: pos + 1 };
        }
        throw new Error(`unknown command: '${cmd}'`);
    }

    private parseAddress(
        expr: string,
        pos: number,
        extended: boolean,
    ): { address: SedSingleAddress; pos: number } | null {
        if (pos >= expr.length) return null;

        // Line number
        if (expr[pos] >= '0' && expr[pos] <= '9') {
            let numStr = '';
            while (pos < expr.length && expr[pos] >= '0' && expr[pos] <= '9') {
                numStr += expr[pos];
                pos++;
            }
            return {
                address: { type: 'line', line: parseInt(numStr, 10) },
                pos,
            };
        }

        // Last line
        if (expr[pos] === '$') {
            return { address: { type: 'last' }, pos: pos + 1 };
        }

        // Regex address
        if (expr[pos] === '/') {
            const parsed = this.readDelimited(expr, pos + 1, '/');
            try {
                return {
                    address: {
                        type: 'regex',
                        regex: new RegExp(this.toJsRegex(parsed.text, extended)),
                    },
                    pos: parsed.pos,
                };
            } catch {
                throw new Error(`invalid regex in address: '${parsed.text}'`);
            }
        }

        return null;
    }

    /**
     * Text up to the next unescaped delimiter, escapes kept (an escaped
     * delimiter becomes the plain character when it has no regex meaning).
     */
    private readDelimited(
        expr: string,
        pos: number,
        delimiter: string,
    ): { text: string; pos: number } {
        let text = '';
        while (pos < expr.length && expr[pos] !== delimiter) {
            if (expr[pos] === '\\' && pos + 1 < expr.length) {
                const next = expr[pos + 1];
                text += next === delimiter && /\w|\//.test(next) ? next : '\\' + next;
                pos += 2;
            } else {
                text += expr[pos];
                pos++;
            }
        }
        if (pos < expr.length) pos++; // skip the delimiter
        return { text, pos };
    }

    /**
     * Basic regular expressions use \( \) \{ \} \+ \? \| for groups and
     * operators. When a pattern uses them (or never in -E mode), they are
     * turned into the JavaScript form and the bare characters made literal.
     */
    private toJsRegex(pattern: string, extended: boolean): string {
        if (extended || !/\\[(){}+?|]/.test(pattern)) return pattern;
        let out = '';
        for (let i = 0; i < pattern.length; i++) {
            const ch = pattern[i];
            if (ch === '\\' && i + 1 < pattern.length) {
                const next = pattern[++i];
                out += '(){}+?|'.includes(next) ? next : '\\' + next;
            } else if ('(){}+?|'.includes(ch)) {
                out += '\\' + ch;
            } else {
                out += ch;
            }
        }
        return out;
    }

    private parseSubstitution(
        expr: string,
        pos: number,
        base: Pick<SedExpression, 'start' | 'end' | 'negate' | 'active'>,
        extended: boolean,
    ): { expression: SedExpression; pos: number } {
        pos++; // skip 's'
        if (pos >= expr.length) {
            throw new Error(`invalid substitution expression: '${expr}'`);
        }

        const delimiter = expr[pos];
        const pattern = this.readDelimited(expr, pos + 1, delimiter);
        pos = pattern.pos;

        // Replacement: escapes kept for expandReplacement, except the delimiter
        let replacement = '';
        while (pos < expr.length && expr[pos] !== delimiter) {
            if (expr[pos] === '\\' && pos + 1 < expr.length) {
                replacement +=
                    expr[pos + 1] === delimiter ? delimiter : '\\' + expr[pos + 1];
                pos += 2;
            } else {
                replacement += expr[pos];
                pos++;
            }
        }
        if (pos < expr.length) pos++; // skip delimiter

        // Flags, up to the end of the command
        let globalFlag = false;
        let caseInsensitive = false;
        let printFlag = false;
        let occurrence = '';
        while (pos < expr.length && !/[;\n\s}]/.test(expr[pos])) {
            const f = expr[pos];
            if (f === 'g') globalFlag = true;
            else if (f === 'i' || f === 'I') caseInsensitive = true;
            else if (f === 'p') printFlag = true;
            else if (f >= '0' && f <= '9') occurrence += f;
            else throw new Error(`unknown option to 's': '${f}'`);
            pos++;
        }
        const nth = occurrence ? parseInt(occurrence, 10) : undefined;
        if (nth === 0) {
            throw new Error("number option to 's' command may not be zero");
        }

        let regexFlags = '';
        if (caseInsensitive) regexFlags += 'i';
        if (globalFlag || nth) regexFlags += 'g';

        let regex: RegExp;
        let groupCount: number;
        try {
            const source = this.toJsRegex(pattern.text, extended);
            regex = new RegExp(source, regexFlags);
            groupCount = (new RegExp(`${source}|`).exec('')?.length ?? 1) - 1;
        } catch {
            throw new Error(`invalid regex: '${pattern.text}'`);
        }

        return {
            expression: {
                ...base,
                command: 's',
                pattern: regex,
                replacement,
                groupCount,
                printFlag,
                occurrence: nth,
                globalFlag,
            },
            pos,
        };
    }

    private addressMatches(
        expr: SedExpression,
        lineNum: number,
        totalLines: number,
        lineText: string,
    ): boolean {
        let matches: boolean;
        if (!expr.start) {
            matches = true;
        } else if (!expr.end) {
            matches = this.singleMatches(expr.start, lineNum, totalLines, lineText);
        } else if (!expr.active) {
            matches = this.singleMatches(expr.start, lineNum, totalLines, lineText);
            if (matches) {
                // A line-number end at or before the start ends the range at once
                const end = expr.end;
                const endsHere =
                    (end.type === 'line' && end.line <= lineNum) ||
                    (end.type === 'last' && lineNum === totalLines);
                expr.active = !endsHere;
            }
        } else {
            matches = true;
            const end = expr.end;
            const endsHere =
                end.type === 'line'
                    ? lineNum >= end.line
                    : this.singleMatches(end, lineNum, totalLines, lineText);
            if (endsHere) expr.active = false;
        }
        return expr.negate ? !matches : matches;
    }

    private singleMatches(
        address: SedSingleAddress,
        lineNum: number,
        totalLines: number,
        lineText: string,
    ): boolean {
        switch (address.type) {
            case 'line':
                return lineNum === address.line;
            case 'last':
                return lineNum === totalLines;
            case 'regex':
                return address.regex.test(lineText);
        }
    }
}
