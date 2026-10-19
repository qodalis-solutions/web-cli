import { createCliToken, ICliExecutionContext, quoteShellWord } from '@qodalis/cli-core';
import { ICliEnvironment, ICliEnvironment_TOKEN } from '../services/cli-environment';
import { expandEnvironmentVars } from './cli-script-executor';
import { expandBraces, expandGlobs } from './cli-glob-expander';
import { substituteCommands } from './cli-command-substitution';

/**
 * Shell-style script runner shared by `sh <file>` / `source` (files plugin)
 * and `./script.sh` (the executor).
 *
 * Supported (a POSIX sh subset):
 *   - one command per line or several separated by `;` (pipes, `&&`, `||`
 *     and redirects are left to the executor)
 *   - `# comments`, blank lines, `\` line continuation
 *   - `set -e` (default) / `set +e`, `VAR=value` (script-scoped), `exit [n]`
 *   - `if cmd; then ...; elif cmd; then ...; else ...; fi`
 *   - `for NAME in words...; do ...; done` (words after `$VAR` and wildcard
 *     expansion; NAME is set for this terminal)
 *   - `while cmd; do ...; done`, `until cmd; do ...; done`
 *   - `break [n]`, `continue [n]`, `! cmd` (negated status)
 *
 * Every simple command runs through the executor; its status is
 * `context.process.exitCode` (0 or undefined = success).
 */

/** Service token under which the engine provides the runner (for plugins). */
export const ICliScriptRunner_TOKEN =
    createCliToken<ICliScriptRunner>('cli-script-runner');

export interface ICliScriptRunOptions {
    /** Prefix for error messages (`sh: line 4: ...`). Default `sh`. */
    name?: string;
    /** Runs one command line. Default `context.executor.executeCommand`. */
    executeCommand?: (command: string, context: ICliExecutionContext) => Promise<void>;
    /** Loop iterations allowed before a `while`/`until` is stopped. Default 10000. */
    maxLoopIterations?: number;
    /** Stop at the first failing command (`set -e`). Default true; false for typed lines. */
    stopOnError?: boolean;
}

export interface ICliScriptRunner {
    /** Run script `content`; resolves to its exit status. */
    run(content: string, context: ICliExecutionContext, options?: ICliScriptRunOptions): Promise<number>;
}

/** The runner as a service value. */
export const cliScriptRunner: ICliScriptRunner = {
    run: (content, context, options) => runScript(content, context, options),
};

const DEFAULT_MAX_LOOP_ITERATIONS = 10000;

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

interface CommandNode {
    type: 'command';
    text: string;
    line: number;
    negate: boolean;
}

interface IfNode {
    type: 'if';
    line: number;
    branches: { condition: ScriptNode[]; body: ScriptNode[] }[];
    elseBody?: ScriptNode[];
}

interface ForNode {
    type: 'for';
    line: number;
    name: string;
    words: string;
    body: ScriptNode[];
}

interface WhileNode {
    type: 'while';
    line: number;
    until: boolean;
    condition: ScriptNode[];
    body: ScriptNode[];
}

type ScriptNode = CommandNode | IfNode | ForNode | WhileNode;

/** A syntax error found while parsing. */
export class CliScriptSyntaxError extends Error {
    constructor(
        readonly line: number,
        readonly detail: string,
    ) {
        super(`line ${line}: syntax error: ${detail}`);
    }
}

// ---------------------------------------------------------------------------
// Lexing: lines -> segments (split on `;`) -> tokens
// ---------------------------------------------------------------------------

type Token =
    | { kind: 'keyword'; word: string; line: number }
    | { kind: 'for'; name: string; words: string; line: number }
    | { kind: 'command'; text: string; line: number };

const OPENING_KEYWORDS = new Set(['if', 'elif', 'while', 'until']);
const LIST_KEYWORDS = new Set(['then', 'else', 'do']);
const CLOSING_KEYWORDS = new Set(['fi', 'done']);

/**
 * Split one line into `;`-separated segments, dropping a trailing comment.
 * Quotes, `$( ... )` and backticks are kept intact.
 */
function splitSegments(line: string): string[] {
    const segments: string[] = [];
    let current = '';
    let quote: '"' | "'" | '`' | null = null;
    let depth = 0;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            current += ch;
            if (ch === '\\' && quote !== "'" && i + 1 < line.length) {
                current += line[++i];
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '\\' && i + 1 < line.length) {
            current += ch + line[++i];
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            current += ch;
            continue;
        }
        if (ch === '$' && line[i + 1] === '(') {
            depth++;
            current += '$(';
            i++;
            continue;
        }
        if (depth > 0) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            current += ch;
            continue;
        }
        if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
            break;
        }
        if (ch === ';') {
            segments.push(current);
            current = '';
            continue;
        }
        current += ch;
    }
    segments.push(current);
    return segments.map((s) => s.trim()).filter((s) => s.length > 0);
}

function firstWord(text: string): [string, string] {
    const match = text.match(/^(\S+)\s*([\s\S]*)$/);
    return match ? [match[1], match[2]] : ['', ''];
}

/** Script content as tokens: keywords, `for` headers and simple commands. */
function tokenize(content: string): { tokens: Token[]; lastLine: number } {
    const rawLines = content.split(/\r?\n/);
    const tokens: Token[] = [];

    for (let i = 0; i < rawLines.length; i++) {
        const lineNumber = i + 1;
        let line = rawLines[i];
        // `\` at the end of a line continues it on the next
        while (/\\$/.test(line) && i + 1 < rawLines.length) {
            line = line.slice(0, -1) + rawLines[++i];
        }

        for (let segment of splitSegments(line)) {
            while (segment) {
                const [word, rest] = firstWord(segment);
                if (OPENING_KEYWORDS.has(word) || LIST_KEYWORDS.has(word)) {
                    tokens.push({ kind: 'keyword', word, line: lineNumber });
                    segment = rest;
                    continue;
                }
                if (CLOSING_KEYWORDS.has(word)) {
                    tokens.push({ kind: 'keyword', word, line: lineNumber });
                    if (rest) {
                        throw new CliScriptSyntaxError(
                            lineNumber,
                            `unexpected '${rest}' after '${word}'`,
                        );
                    }
                    segment = '';
                    continue;
                }
                if (word === 'for') {
                    const header = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+in(?:\s+([\s\S]*))?$/);
                    if (!header) {
                        throw new CliScriptSyntaxError(
                            lineNumber,
                            `expected 'for NAME in WORDS...'`,
                        );
                    }
                    tokens.push({
                        kind: 'for',
                        name: header[1],
                        words: header[2] ?? '',
                        line: lineNumber,
                    });
                    segment = '';
                    continue;
                }
                tokens.push({ kind: 'command', text: segment, line: lineNumber });
                segment = '';
            }
        }
    }

    // A final newline does not start another line
    const lineCount = rawLines.length > 1 && rawLines[rawLines.length - 1] === ''
        ? rawLines.length - 1
        : rawLines.length;
    return { tokens, lastLine: Math.max(lineCount, 1) };
}

// ---------------------------------------------------------------------------
// Parsing: tokens -> AST
// ---------------------------------------------------------------------------

class ScriptParser {
    private pos = 0;

    constructor(
        private readonly tokens: Token[],
        private readonly lastLine: number,
    ) {}

    parse(): ScriptNode[] {
        const { nodes } = this.parseList([]);
        return nodes;
    }

    /** Nodes up to one of `terminators` (consumed and returned). */
    private parseList(
        terminators: string[],
        opener?: { word: string; line: number },
    ): { nodes: ScriptNode[]; terminator?: Token & { kind: 'keyword' } } {
        const nodes: ScriptNode[] = [];
        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            if (token.kind === 'keyword') {
                if (terminators.includes(token.word)) {
                    this.pos++;
                    return { nodes, terminator: token };
                }
                if (token.word === 'if') {
                    this.pos++;
                    nodes.push(this.parseIf(token.line));
                    continue;
                }
                if (token.word === 'while' || token.word === 'until') {
                    this.pos++;
                    nodes.push(this.parseWhile(token.line, token.word === 'until'));
                    continue;
                }
                throw new CliScriptSyntaxError(
                    token.line,
                    `unexpected '${token.word}'`,
                );
            }
            this.pos++;
            if (token.kind === 'for') {
                nodes.push(this.parseFor(token));
                continue;
            }
            const negate = /^!\s+/.test(token.text);
            nodes.push({
                type: 'command',
                text: negate ? token.text.replace(/^!\s+/, '') : token.text,
                line: token.line,
                negate,
            });
        }
        if (terminators.length > 0) {
            // The word that closes the block (`fi` rather than `elif`/`else`)
            const expected = `'${terminators[terminators.length - 1]}'`;
            const where = opener ? ` to close '${opener.word}' on line ${opener.line}` : '';
            throw new CliScriptSyntaxError(this.lastLine, `expected ${expected}${where}`);
        }
        return { nodes };
    }

    private requireNonEmpty(nodes: ScriptNode[], line: number, what: string): void {
        if (nodes.length === 0) {
            throw new CliScriptSyntaxError(line, `empty ${what}`);
        }
    }

    private parseIf(line: number): IfNode {
        const node: IfNode = { type: 'if', line, branches: [] };
        let keyword = 'if';
        let keywordLine = line;
        for (;;) {
            const cond = this.parseList(['then'], { word: keyword, line: keywordLine });
            this.requireNonEmpty(cond.nodes, keywordLine, `'${keyword}' condition`);
            const body = this.parseList(['elif', 'else', 'fi'], { word: 'if', line });
            node.branches.push({ condition: cond.nodes, body: body.nodes });
            const end = body.terminator!;
            if (end.word === 'fi') return node;
            if (end.word === 'else') {
                node.elseBody = this.parseList(['fi'], { word: 'if', line }).nodes;
                return node;
            }
            keyword = 'elif';
            keywordLine = end.line;
        }
    }

    private parseWhile(line: number, until: boolean): WhileNode {
        const word = until ? 'until' : 'while';
        const cond = this.parseList(['do'], { word, line });
        this.requireNonEmpty(cond.nodes, line, `'${word}' condition`);
        const body = this.parseList(['done'], { word, line });
        return { type: 'while', line, until, condition: cond.nodes, body: body.nodes };
    }

    private parseFor(token: Token & { kind: 'for' }): ForNode {
        const next = this.tokens[this.pos];
        if (!next || next.kind !== 'keyword' || next.word !== 'do') {
            throw new CliScriptSyntaxError(
                next?.line ?? this.lastLine,
                `expected 'do' after 'for ${token.name} in ...'`,
            );
        }
        this.pos++;
        const body = this.parseList(['done'], { word: 'for', line: token.line });
        return {
            type: 'for',
            line: token.line,
            name: token.name,
            words: token.words,
            body: body.nodes,
        };
    }
}

/** Parse script content (throws {@link CliScriptSyntaxError}). */
export function parseScript(content: string): ScriptNode[] {
    const { tokens, lastLine } = tokenize(content);
    return new ScriptParser(tokens, lastLine).parse();
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

type Flow =
    | { kind: 'normal' }
    | { kind: 'break'; levels: number }
    | { kind: 'continue'; levels: number }
    /** Stop the script: `exit`, `set -e` failure, Ctrl+C or a runtime error */
    | { kind: 'stop' };

const NORMAL: Flow = { kind: 'normal' };
const STOP: Flow = { kind: 'stop' };

class ScriptRunner {
    status = 0;
    private readonly variables: Record<string, string> = {};
    private stopOnError = true;
    private loopDepth = 0;
    private aborted = false;
    private abortSeen = false;
    private iterationsSinceYield = 0;
    private readonly name: string;
    private readonly exec: (command: string, context: ICliExecutionContext) => Promise<void>;
    private readonly maxIterations: number;

    constructor(
        private readonly context: ICliExecutionContext,
        options: ICliScriptRunOptions,
    ) {
        this.name = options.name ?? 'sh';
        this.exec = options.executeCommand
            ?? ((command, ctx) => ctx.executor.executeCommand(command, ctx));
        this.maxIterations = options.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS;
        this.stopOnError = options.stopOnError ?? true;
    }

    /** Ctrl+C (onAbort / the command's signal) was seen. */
    markAbort(): void {
        this.abortSeen = true;
    }

    async runList(nodes: ScriptNode[], inCondition = false): Promise<Flow> {
        for (const node of nodes) {
            const flow = await this.runNode(node, inCondition);
            if (flow.kind !== 'normal') return flow;
        }
        return NORMAL;
    }

    private async runNode(node: ScriptNode, inCondition: boolean): Promise<Flow> {
        if (this.checkAborted()) return STOP;
        switch (node.type) {
            case 'command':
                return this.runCommand(node, inCondition);
            case 'if':
                return this.runIf(node);
            case 'for':
                return this.runFor(node);
            case 'while':
                return this.runWhile(node);
        }
    }

    private checkAborted(): boolean {
        if (this.abortSeen) {
            this.aborted = true;
            this.status = 130;
        }
        return this.aborted;
    }

    private async runIf(node: IfNode): Promise<Flow> {
        for (const branch of node.branches) {
            const flow = await this.runList(branch.condition, true);
            if (flow.kind !== 'normal') return flow;
            if (this.status === 0) {
                return this.runList(branch.body);
            }
        }
        if (node.elseBody) {
            return this.runList(node.elseBody);
        }
        this.status = 0;
        return NORMAL;
    }

    private async runFor(node: ForNode): Promise<Flow> {
        const words = await this.expandWords(node.words);
        const env = this.context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
        this.status = 0;
        this.loopDepth++;
        try {
            for (const word of words) {
                if (this.checkAborted()) return STOP;
                this.variables[node.name] = word;
                env?.set(node.name, word, 'session');
                const flow = await this.runList(node.body);
                const next = this.loopControl(flow);
                if (next !== 'next') return next === 'end' ? NORMAL : next;
                await this.maybeYield();
            }
        } finally {
            this.loopDepth--;
        }
        return NORMAL;
    }

    private async runWhile(node: WhileNode): Promise<Flow> {
        const word = node.until ? 'until' : 'while';
        let iterations = 0;
        let bodyStatus = 0;
        this.loopDepth++;
        try {
            for (;;) {
                if (this.checkAborted()) return STOP;
                const condFlow = await this.runList(node.condition, true);
                if (condFlow.kind !== 'normal') return condFlow;
                if ((this.status === 0) === node.until) break;
                if (++iterations > this.maxIterations) {
                    this.context.writer.writeError(
                        `${this.name}: line ${node.line}: ${word}: stopped after ${this.maxIterations} iterations`,
                    );
                    this.status = 1;
                    return STOP;
                }
                const flow = await this.runList(node.body);
                bodyStatus = this.status;
                const next = this.loopControl(flow);
                if (next === 'end') break;
                if (next !== 'next') return next;
                await this.maybeYield();
            }
        } finally {
            this.loopDepth--;
        }
        this.status = bodyStatus;
        return NORMAL;
    }

    /** What a loop does after its body: next iteration, end, or pass a flow up. */
    private loopControl(flow: Flow): 'next' | 'end' | Flow {
        if (flow.kind === 'break') {
            return flow.levels > 1 ? { kind: 'break', levels: flow.levels - 1 } : 'end';
        }
        if (flow.kind === 'continue') {
            return flow.levels > 1 ? { kind: 'continue', levels: flow.levels - 1 } : 'next';
        }
        return flow.kind === 'stop' ? flow : 'next';
    }

    /** Let key events (Ctrl+C) through in long loops. */
    private async maybeYield(): Promise<void> {
        if (++this.iterationsSinceYield >= 50) {
            this.iterationsSinceYield = 0;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
    }

    private async runCommand(node: CommandNode, inCondition: boolean): Promise<Flow> {
        const { text, line } = node;
        const [word, rest] = firstWord(text);

        if (text === 'set -e') {
            this.stopOnError = true;
            this.status = 0;
            return NORMAL;
        }
        if (text === 'set +e') {
            this.stopOnError = false;
            this.status = 0;
            return NORMAL;
        }

        if (word === 'break' || word === 'continue') {
            const levels = rest ? parseInt(this.substitute(rest, 'value'), 10) : 1;
            if (!Number.isInteger(levels) || levels < 1) {
                this.context.writer.writeError(`${this.name}: line ${line}: ${word}: ${rest}: loop count out of range`);
                this.status = 1;
                return this.failed(node, inCondition);
            }
            if (this.loopDepth === 0) {
                this.context.writer.writeError(`${this.name}: line ${line}: ${word}: only meaningful in a loop`);
                this.status = 0;
                return NORMAL;
            }
            this.status = 0;
            return { kind: word, levels: Math.min(levels, this.loopDepth) };
        }

        if (word === 'exit') {
            const code = rest ? parseInt(this.substitute(rest, 'value'), 10) : this.status;
            this.status = Number.isInteger(code) ? code & 255 : 2;
            return STOP;
        }

        // Variable assignment: VAR=value (script-scoped)
        const assign = text.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (assign) {
            let value = assign[2];
            if (
                value.length >= 2 &&
                ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'")))
            ) {
                value = value.startsWith("'")
                    ? value.slice(1, -1)
                    : this.substitute(value.slice(1, -1), 'value');
            } else {
                value = this.substitute(value, 'value');
            }
            this.variables[assign[1]] = value;
            this.status = 0;
            return NORMAL;
        }

        const abortedBefore = this.abortSeen;
        await this.exec(this.substitute(text), this.context);
        const process = this.context.process;
        const code = process.exitCode;
        if (!abortedBefore && this.abortSeen && process.exited && code !== undefined && code !== 0 && code !== 130) {
            // A command that exits with `process.exit(code)` also fires
            // onAbort: that is its own failure, not Ctrl+C
            this.abortSeen = false;
        }
        if (this.checkAborted()) return STOP;

        const success = code === undefined || code === 0;
        this.status = success ? 0 : code < 0 ? 1 : code;
        if (node.negate) {
            this.status = success ? 1 : 0;
            return NORMAL;
        }
        return success ? NORMAL : this.failed(node, inCondition);
    }

    /** `set -e`: stop on a failure outside a condition. */
    private failed(node: CommandNode, inCondition: boolean): Flow {
        if (inCondition || !this.stopOnError) return NORMAL;
        this.context.writer.writeError(
            `${this.name}: script aborted at line ${node.line}: ${node.text}`,
        );
        return STOP;
    }

    /**
     * Replace script variables (`$VAR`, `${VAR}`) outside single quotes
     * (`\$VAR` is left as typed).
     * Unknown names are left for the executor (terminal variables);
     * for `value`, they also come from the terminal or expand to nothing.
     *
     * `code` (a command to run) quotes the values, so a value is always
     * data: a file named `$(rm -r docs)` or `a;b` is never run. `words` (a
     * `for` list, split into words, never run) and `value` (an assignment)
     * take the plain value.
     */
    substitute(input: string, mode: 'code' | 'words' | 'value' = 'code'): string {
        const code = mode === 'code';
        const all = mode === 'value';
        const value = (name: string): string | undefined => {
            if (name in this.variables) return this.variables[name];
            if (!all) return undefined;
            const env = this.context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN);
            return env?.get(name) ?? '';
        };
        let result = '';
        let inSingle = false;
        let inDouble = false;
        for (let i = 0; i < input.length; i++) {
            const ch = input[i];
            if (ch === '\\' && !inSingle && i + 1 < input.length) {
                result += ch + input[++i];
                continue;
            }
            if (ch === "'" && !inDouble) inSingle = !inSingle;
            else if (ch === '"' && !inSingle) inDouble = !inDouble;
            else if (ch === '$' && !inSingle) {
                const match = /^\$(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))/.exec(input.slice(i));
                if (match) {
                    const name = match[1] ?? match[2];
                    const found = value(name);
                    if (found !== undefined) {
                        result += !code
                            ? found
                            : inDouble
                              ? found.replace(/["\\$`]/g, '\\$&')
                              : quoteShellWord(found);
                        i += match[0].length - 1;
                        continue;
                    }
                }
            }
            result += ch;
        }
        return result;
    }

    /**
     * `for` words: the script's own `$(...)` (run here, before any value is
     * inserted, so values are never run), variables, then braces and
     * wildcards, then split with quotes removed.
     */
    private async expandWords(text: string): Promise<string[]> {
        const capture = this.context.executor.capture?.bind(this.context.executor);
        let expanded = capture
            ? await substituteCommands(text, (inner) => capture(inner, this.context))
            : text;
        expanded = this.substitute(expanded, 'words');
        expanded = expandEnvironmentVars(expanded, this.context);
        // These leave the first word (a command name) alone
        expanded = expandGlobs(expandBraces(`for ${expanded}`), this.context).replace(/^for\s?/, '');
        return splitWords(expanded);
    }
}

/** Split a line into words, removing quotes (empty quoted words are kept). */
export function splitWords(text: string): string[] {
    const words: string[] = [];
    let current = '';
    let inWord = false;
    let quote: '"' | "'" | null = null;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            if (ch === quote) {
                quote = null;
            } else if (ch === '\\' && quote === '"' && i + 1 < text.length && /["\\$`]/.test(text[i + 1])) {
                current += text[++i];
            } else {
                current += ch;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            inWord = true;
            continue;
        }
        if (ch === '\\' && i + 1 < text.length) {
            current += text[++i];
            inWord = true;
            continue;
        }
        if (/\s/.test(ch)) {
            if (inWord) words.push(current);
            current = '';
            inWord = false;
            continue;
        }
        current += ch;
        inWord = true;
    }
    if (inWord) words.push(current);
    return words;
}

/**
 * Run script content with shell control flow. Resolves to the exit status
 * (also set as the context's process exit code).
 */
export async function runScript(
    content: string,
    context: ICliExecutionContext,
    options: ICliScriptRunOptions = {},
): Promise<number> {
    const name = options.name ?? 'sh';

    let nodes: ScriptNode[];
    try {
        nodes = parseScript(content);
    } catch (e) {
        if (e instanceof CliScriptSyntaxError) {
            context.writer.writeError(`${name}: ${e.message}`);
            context.process.exit(2, { silent: true });
            return 2;
        }
        throw e;
    }

    const runner = new ScriptRunner(context, options);
    if (context.signal?.aborted) {
        context.process.exit(130, { silent: true });
        return 130;
    }

    const subscription = context.onAbort?.subscribe(() => runner.markAbort());
    const onSignal = () => runner.markAbort();
    context.signal?.addEventListener('abort', onSignal);
    try {
        await runner.runList(nodes);
    } finally {
        subscription?.unsubscribe();
        context.signal?.removeEventListener('abort', onSignal);
    }

    context.process.exit(runner.status, { silent: true });
    return runner.status;
}
