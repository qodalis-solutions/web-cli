import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { splitWords } from '../executor/cli-script-runner';

/** The file system calls `test -f/-d/-e` needs (`@qodalis/cli-files`). */
interface TestFileSystem {
    resolvePath(path: string): string;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
}

const FS_TOKEN = 'cli-file-system-service';

const UNARY = new Set(['-z', '-n', '-e', '-f', '-d']);
const BINARY = new Set(['=', '==', '!=', '-eq', '-ne', '-lt', '-le', '-gt', '-ge']);

class TestExpressionError extends Error {}

/**
 * Evaluates a `test` expression (tokens without the command name and `]`).
 * Grammar: or := and (-o and)*; and := not (-a not)*;
 * not := ! not | ( or ) | primary.
 */
class TestEvaluator {
    private pos = 0;

    constructor(
        private readonly tokens: string[],
        private readonly fs: TestFileSystem | undefined,
    ) {}

    evaluate(): boolean {
        if (this.tokens.length === 0) return false;
        const result = this.parseOr();
        if (this.pos < this.tokens.length) {
            throw new TestExpressionError(`unexpected argument '${this.tokens[this.pos]}'`);
        }
        return result;
    }

    private peek(offset = 0): string | undefined {
        return this.tokens[this.pos + offset];
    }

    private parseOr(): boolean {
        let result = this.parseAnd();
        while (this.peek() === '-o') {
            this.pos++;
            const right = this.parseAnd();
            result = result || right;
        }
        return result;
    }

    private parseAnd(): boolean {
        let result = this.parseNot();
        while (this.peek() === '-a') {
            this.pos++;
            const right = this.parseNot();
            result = result && right;
        }
        return result;
    }

    private parseNot(): boolean {
        const token = this.peek();
        if (token === undefined) {
            throw new TestExpressionError('argument expected');
        }
        // `!` alone (or followed by a binary operator) is a string
        if (token === '!' && this.peek(1) !== undefined && !BINARY.has(this.peek(1)!)) {
            this.pos++;
            return !this.parseNot();
        }
        if (token === '(' && this.peek(1) !== undefined && !BINARY.has(this.peek(1)!)) {
            this.pos++;
            const result = this.parseOr();
            if (this.peek() !== ')') {
                throw new TestExpressionError("missing ')'");
            }
            this.pos++;
            return result;
        }
        return this.parsePrimary();
    }

    private parsePrimary(): boolean {
        const token = this.tokens[this.pos];
        const next = this.peek(1);

        if (next !== undefined && BINARY.has(next) && this.peek(2) !== undefined) {
            const right = this.tokens[this.pos + 2];
            this.pos += 3;
            return this.binary(token, next, right);
        }
        if (UNARY.has(token) && next !== undefined) {
            this.pos += 2;
            return this.unary(token, next);
        }
        // A single word: true when not empty
        this.pos++;
        return token.length > 0;
    }

    private unary(op: string, operand: string): boolean {
        switch (op) {
            case '-z':
                return operand.length === 0;
            case '-n':
                return operand.length > 0;
            default:
                return this.fileTest(op, operand);
        }
    }

    private fileTest(op: string, path: string): boolean {
        if (!this.fs || !path) return false;
        try {
            const resolved = this.fs.resolvePath(path);
            if (!this.fs.exists(resolved)) return false;
            if (op === '-e') return true;
            const isDir = this.fs.isDirectory(resolved);
            return op === '-d' ? isDir : !isDir;
        } catch {
            return false;
        }
    }

    private binary(left: string, op: string, right: string): boolean {
        switch (op) {
            case '=':
            case '==':
                return left === right;
            case '!=':
                return left !== right;
        }
        const a = toInteger(left);
        const b = toInteger(right);
        switch (op) {
            case '-eq':
                return a === b;
            case '-ne':
                return a !== b;
            case '-lt':
                return a < b;
            case '-le':
                return a <= b;
            case '-gt':
                return a > b;
            default:
                return a >= b;
        }
    }
}

function toInteger(value: string): number {
    const trimmed = value.trim();
    if (!/^[+-]?\d+$/.test(trimmed)) {
        throw new TestExpressionError(`${value}: integer expression expected`);
    }
    return parseInt(trimmed, 10);
}

/**
 * `test EXPR` / `[ EXPR ]`: evaluate a condition; exit status 0 when true,
 * 1 when false and 2 on an error. Used by `if`, `while` and `&&`/`||`.
 */
export class CliTestCommandProcessor implements ICliCommandProcessor {
    command = 'test';

    aliases = ['['];

    description = 'Evaluate a condition (exit status 0 when true)';

    author = DefaultLibraryAuthor;

    acceptsRawInput = true;

    metadata?: CliProcessorMetadata = {
        icon: '❓',
        module: 'misc',
    };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const words = splitWords(command.rawCommand ?? '');
        const name = words.shift() ?? 'test';
        if (name === '[') {
            if (words[words.length - 1] !== ']') {
                context.writer.writeError("[: missing ']'");
                context.process.exit(2, { silent: true });
                return;
            }
            words.pop();
        }

        const fs = context.services.get<TestFileSystem>(FS_TOKEN);
        let result: boolean;
        try {
            result = new TestEvaluator(words, fs?.exists ? fs : undefined).evaluate();
        } catch (e) {
            if (e instanceof TestExpressionError) {
                context.writer.writeError(`${name}: ${e.message}`);
                context.process.exit(2, { silent: true });
                return;
            }
            throw e;
        }

        if (!result) {
            context.process.exit(1, { silent: true });
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer, translator: t } = context;
        const cmd = (text: string) => writer.wrapInColor(text, CliForegroundColor.Cyan);
        writer.writeln(t.t('cli.test.description', this.description));
        writer.writeln();
        writer.writeln(t.t('cli.common.usage', 'Usage:'));
        writer.writeln(`  ${cmd('test EXPRESSION')}`);
        writer.writeln(`  ${cmd('[ EXPRESSION ]')}`);
        writer.writeln();
        writer.writeln(t.t('cli.test.help.expressions', 'Expressions:'));
        writer.writeln(`  -z STRING / -n STRING      ${t.t('cli.test.help.empty_not_empty', 'empty / not empty')}`);
        writer.writeln(`  STRING = STRING, !=        ${t.t('cli.test.help.equal_not_equal', 'equal / not equal')}`);
        writer.writeln(`  N -eq N (-ne -lt -le -gt -ge)  ${t.t('cli.test.help.integer_comparison', 'integer comparison')}`);
        writer.writeln(`  -e PATH / -f PATH / -d PATH    ${t.t('cli.test.help.exists_file_directory', 'exists / file / directory')}`);
        writer.writeln('  ! EXPR, EXPR -a EXPR, EXPR -o EXPR, ( EXPR )');
        writer.writeln();
        writer.writeln(t.t('cli.common.examples', 'Examples:'));
        writer.writeln(`  ${cmd('[ -f notes.txt ] && cat notes.txt')}`);
        writer.writeln(`  ${cmd('if [ "$USER" = admin ]; then echo hi; fi')}`);
    }
}

/** `true`: do nothing, successfully (also `:`). */
export class CliTrueCommandProcessor implements ICliCommandProcessor {
    command = 'true';

    aliases = [':'];

    description = 'Do nothing, successfully (exit status 0)';

    author = DefaultLibraryAuthor;

    acceptsRawInput = true;

    metadata?: CliProcessorMetadata = { icon: '✔', module: 'misc' };

    async processCommand(): Promise<void> {
        // Nothing to do
    }
}

/** `false`: do nothing, unsuccessfully (exit status 1). */
export class CliFalseCommandProcessor implements ICliCommandProcessor {
    command = 'false';

    description = 'Do nothing, unsuccessfully (exit status 1)';

    author = DefaultLibraryAuthor;

    acceptsRawInput = true;

    metadata?: CliProcessorMetadata = { icon: '✖', module: 'misc' };

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.process.exit(1, { silent: true });
    }
}
