import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

interface AwkRule {
    pattern: AwkPattern;
    action: string;
}

type AwkPattern =
    | { type: 'all' }
    | { type: 'begin' }
    | { type: 'end' }
    | { type: 'regex'; regex: RegExp }
    | { type: 'comparison'; field: string; op: string; value: string };

export class CliAwkCommandProcessor implements ICliCommandProcessor {
    command = 'awk';
    description = 'Pattern scanning and text processing';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    acceptsRawInput = true;
    metadata = { icon: '🔧', module: 'file management' };

    parameters = [
        {
            name: 'F',
            aliases: [] as string[],
            description: 'Field separator (default: whitespace)',
            required: false,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const { program, filePath, fieldSep } = this.parseArgs(command);

        if (!program) {
            context.writer.writeError(
                "awk: missing program. Usage: awk [-F sep] 'program' file",
            );
            return;
        }

        let content = '';
        if (filePath) {
            try {
                if (!fs.exists(filePath)) {
                    context.writer.writeError(
                        `awk: ${filePath}: No such file or directory`,
                    );
                    return;
                }
                content = fs.readFile(filePath) ?? '';
            } catch (e: any) {
                context.writer.writeError(`awk: ${e.message}`);
                return;
            }
        } else if (command.data != null) {
            content = typeof command.data === 'string'
                ? command.data : JSON.stringify(command.data);
        }

        const rules = this.parseProgram(program);
        const lines = content
            ? content.replace(/\n$/, '').split('\n')
            : [];
        const fs_regex = fieldSep
            ? new RegExp(this.escapeRegex(fieldSep))
            : /\s+/;

        const variables: Record<string, string | number> = {};
        const output: string[] = [];

        // Execute BEGIN rules
        for (const rule of rules) {
            if (rule.pattern.type === 'begin') {
                this.executeAction(
                    rule.action,
                    [],
                    '',
                    0,
                    0,
                    variables,
                    output,
                );
            }
        }

        // Process each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const fields = line.split(fs_regex).filter((f) => f !== '');
            const nr = i + 1;
            const nf = fields.length;

            for (const rule of rules) {
                if (
                    rule.pattern.type === 'begin' ||
                    rule.pattern.type === 'end'
                ) {
                    continue;
                }

                if (this.matchesPattern(rule.pattern, line, fields, nr)) {
                    this.executeAction(
                        rule.action,
                        fields,
                        line,
                        nr,
                        nf,
                        variables,
                        output,
                    );
                }
            }
        }

        // Execute END rules
        for (const rule of rules) {
            if (rule.pattern.type === 'end') {
                this.executeAction(
                    rule.action,
                    [],
                    '',
                    lines.length,
                    0,
                    variables,
                    output,
                );
            }
        }

        for (const line of output) {
            context.writer.writeln(line);
        }
    }

    private parseArgs(
        command: CliProcessCommand,
    ): { program: string | null; filePath: string | null; fieldSep: string | null } {
        const raw = command.rawCommand || '';

        let fieldSep: string | null = null;
        let rest = raw;

        // Extract -F option
        const fMatch = rest.match(/^-F\s+(?:'([^']*)'|"([^"]*)"|(\S+))\s*/);
        if (fMatch) {
            fieldSep = fMatch[1] ?? fMatch[2] ?? fMatch[3];
            rest = rest.slice(fMatch[0].length);
        } else {
            const fMatch2 = rest.match(/^-F(?:'([^']*)'|"([^"]*)"|(\S+))\s*/);
            if (fMatch2) {
                fieldSep = fMatch2[1] ?? fMatch2[2] ?? fMatch2[3];
                rest = rest.slice(fMatch2[0].length);
            }
        }

        // Extract program (in quotes)
        let program: string | null = null;
        const sqMatch = rest.match(/^'((?:[^'\\]|\\.)*)'\s*/);
        if (sqMatch) {
            program = sqMatch[1];
            rest = rest.slice(sqMatch[0].length);
        } else {
            const dqMatch = rest.match(/^"((?:[^"\\]|\\.)*)"\s*/);
            if (dqMatch) {
                program = dqMatch[1];
                rest = rest.slice(dqMatch[0].length);
            }
        }

        const filePath = rest.trim() || null;

        return { program, filePath, fieldSep };
    }

    private parseProgram(program: string): AwkRule[] {
        const rules: AwkRule[] = [];
        let pos = 0;

        while (pos < program.length) {
            // Skip whitespace
            while (pos < program.length && /\s/.test(program[pos])) pos++;
            if (pos >= program.length) break;

            let pattern: AwkPattern = { type: 'all' };
            let action = 'print $0';

            // Check for BEGIN
            if (program.slice(pos).startsWith('BEGIN')) {
                pattern = { type: 'begin' };
                pos += 5;
                while (pos < program.length && /\s/.test(program[pos])) pos++;
            }
            // Check for END
            else if (program.slice(pos).startsWith('END')) {
                pattern = { type: 'end' };
                pos += 3;
                while (pos < program.length && /\s/.test(program[pos])) pos++;
            }
            // Check for /regex/
            else if (program[pos] === '/') {
                const endSlash = program.indexOf('/', pos + 1);
                if (endSlash !== -1) {
                    const regexStr = program.slice(pos + 1, endSlash);
                    pattern = { type: 'regex', regex: new RegExp(regexStr) };
                    pos = endSlash + 1;
                    while (pos < program.length && /\s/.test(program[pos]))
                        pos++;
                }
            }
            // Check for field comparison ($N op value)
            else if (program[pos] === '$' && program[pos + 1] !== '0') {
                const compMatch = program
                    .slice(pos)
                    .match(
                        /^\$(\w+)\s*(>=|<=|!=|==|>|<)\s*(?:"([^"]*)"|'([^']*)'|(\S+))/,
                    );
                if (compMatch) {
                    pattern = {
                        type: 'comparison',
                        field: compMatch[1],
                        op: compMatch[2],
                        value:
                            compMatch[3] ?? compMatch[4] ?? compMatch[5],
                    };
                    pos += compMatch[0].length;
                    while (pos < program.length && /\s/.test(program[pos]))
                        pos++;
                }
            }

            // Extract action block
            if (pos < program.length && program[pos] === '{') {
                const actionEnd = this.findMatchingBrace(program, pos);
                action = program.slice(pos + 1, actionEnd).trim();
                pos = actionEnd + 1;
            } else if (pattern.type === 'all' && pos < program.length) {
                // No pattern matched and no brace — might be just an action block
                // or something unparseable, skip a char
                pos++;
                continue;
            }

            rules.push({ pattern, action });
        }

        return rules;
    }

    private findMatchingBrace(str: string, start: number): number {
        let depth = 0;
        let inSingleQuote = false;
        let inDoubleQuote = false;

        for (let i = start; i < str.length; i++) {
            const ch = str[i];
            if (inSingleQuote) {
                if (ch === "'") inSingleQuote = false;
                continue;
            }
            if (inDoubleQuote) {
                if (ch === '"') inDoubleQuote = false;
                continue;
            }
            if (ch === "'") {
                inSingleQuote = true;
            } else if (ch === '"') {
                inDoubleQuote = true;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return str.length - 1;
    }

    private matchesPattern(
        pattern: AwkPattern,
        line: string,
        fields: string[],
        _nr: number,
    ): boolean {
        switch (pattern.type) {
            case 'all':
                return true;
            case 'regex':
                return pattern.regex.test(line);
            case 'comparison': {
                const fieldVal = this.getFieldValue(
                    pattern.field,
                    fields,
                    line,
                );
                return this.compareValues(fieldVal, pattern.op, pattern.value);
            }
            default:
                return false;
        }
    }

    private getFieldValue(
        field: string,
        fields: string[],
        line: string,
    ): string {
        if (field === '0') return line;
        const idx = parseInt(field, 10);
        if (!isNaN(idx) && idx >= 1 && idx <= fields.length) {
            return fields[idx - 1];
        }
        return '';
    }

    private compareValues(a: string, op: string, b: string): boolean {
        const numA = Number(a);
        const numB = Number(b);
        const useNumeric = !isNaN(numA) && !isNaN(numB) && a !== '' && b !== '';

        switch (op) {
            case '==':
                return useNumeric ? numA === numB : a === b;
            case '!=':
                return useNumeric ? numA !== numB : a !== b;
            case '>':
                return useNumeric ? numA > numB : a > b;
            case '<':
                return useNumeric ? numA < numB : a < b;
            case '>=':
                return useNumeric ? numA >= numB : a >= b;
            case '<=':
                return useNumeric ? numA <= numB : a <= b;
            default:
                return false;
        }
    }

    private executeAction(
        action: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
        output: string[],
    ): void {
        const statements = action.split(/\s*;\s*/);

        for (const stmt of statements) {
            const trimmed = stmt.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('print')) {
                this.executePrint(
                    trimmed,
                    fields,
                    line,
                    nr,
                    nf,
                    variables,
                    output,
                );
            } else {
                // Assignment: variable op= expression or variable = expression
                this.executeAssignment(
                    trimmed,
                    fields,
                    line,
                    nr,
                    nf,
                    variables,
                );
            }
        }
    }

    private executePrint(
        stmt: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
        output: string[],
    ): void {
        const argStr = stmt.slice(5).trim();

        if (!argStr) {
            output.push(line);
            return;
        }

        // Split by comma for OFS-separated output
        const commaParts = this.splitByComma(argStr);

        if (commaParts.length > 1) {
            // Comma-separated: each part printed with OFS (space)
            const values = commaParts.map((part) =>
                this.evaluateConcatExpr(
                    part.trim(),
                    fields,
                    line,
                    nr,
                    nf,
                    variables,
                ),
            );
            output.push(values.join(' '));
        } else {
            // Single expression (may contain concatenation)
            output.push(
                this.evaluateConcatExpr(
                    argStr,
                    fields,
                    line,
                    nr,
                    nf,
                    variables,
                ),
            );
        }
    }

    private splitByComma(expr: string): string[] {
        const parts: string[] = [];
        let current = '';
        let inQuote: string | null = null;

        for (let i = 0; i < expr.length; i++) {
            const ch = expr[i];
            if (inQuote) {
                current += ch;
                if (ch === inQuote) inQuote = null;
            } else if (ch === '"' || ch === "'") {
                current += ch;
                inQuote = ch;
            } else if (ch === ',') {
                parts.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        if (current) parts.push(current);
        return parts;
    }

    private evaluateConcatExpr(
        expr: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
    ): string {
        // Tokenize the expression into parts, then concatenate
        const tokens = this.tokenizeExpr(expr);
        return tokens
            .map((t) => this.resolveToken(t, fields, line, nr, nf, variables))
            .join('');
    }

    private tokenizeExpr(expr: string): string[] {
        const tokens: string[] = [];
        let pos = 0;

        while (pos < expr.length) {
            // Skip spaces (they act as concatenation separator)
            while (pos < expr.length && expr[pos] === ' ') pos++;
            if (pos >= expr.length) break;

            // Quoted string
            if (expr[pos] === '"') {
                const end = expr.indexOf('"', pos + 1);
                if (end !== -1) {
                    tokens.push(expr.slice(pos, end + 1));
                    pos = end + 1;
                } else {
                    tokens.push(expr.slice(pos));
                    break;
                }
            }
            // Field reference $N
            else if (expr[pos] === '$') {
                const match = expr.slice(pos).match(/^\$(\w+)/);
                if (match) {
                    tokens.push(match[0]);
                    pos += match[0].length;
                } else {
                    tokens.push('$');
                    pos++;
                }
            }
            // Identifier or number
            else {
                const match = expr.slice(pos).match(/^[\w.]+/);
                if (match) {
                    tokens.push(match[0]);
                    pos += match[0].length;
                } else {
                    // Other character (operator, etc.)
                    tokens.push(expr[pos]);
                    pos++;
                }
            }
        }

        return tokens;
    }

    private resolveToken(
        token: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
    ): string {
        // Quoted string
        if (token.startsWith('"') && token.endsWith('"')) {
            return token.slice(1, -1);
        }

        // Field reference
        if (token.startsWith('$')) {
            const fieldRef = token.slice(1);
            if (fieldRef === '0') return line;
            if (fieldRef === 'NF') {
                const idx = nf;
                return idx >= 1 && idx <= fields.length
                    ? fields[idx - 1]
                    : '';
            }
            const idx = parseInt(fieldRef, 10);
            if (!isNaN(idx)) {
                return idx >= 1 && idx <= fields.length
                    ? fields[idx - 1]
                    : '';
            }
            return '';
        }

        // Built-in variables
        if (token === 'NR') return String(nr);
        if (token === 'NF') return String(nf);

        // User variable
        if (/^[a-zA-Z_]\w*$/.test(token) && token in variables) {
            return String(variables[token]);
        }

        // Literal (number or unresolved)
        return token;
    }

    private executeAssignment(
        stmt: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
    ): void {
        // Match: variable += expression
        const addAssign = stmt.match(/^([a-zA-Z_]\w*)\s*\+=\s*(.+)$/);
        if (addAssign) {
            const varName = addAssign[1];
            const exprVal = this.evaluateNumericExpr(
                addAssign[2].trim(),
                fields,
                line,
                nr,
                nf,
                variables,
            );
            if (!(varName in variables)) {
                variables[varName] = 0;
            }
            variables[varName] =
                (Number(variables[varName]) || 0) + exprVal;
            return;
        }

        // Match: variable -= expression
        const subAssign = stmt.match(/^([a-zA-Z_]\w*)\s*-=\s*(.+)$/);
        if (subAssign) {
            const varName = subAssign[1];
            const exprVal = this.evaluateNumericExpr(
                subAssign[2].trim(),
                fields,
                line,
                nr,
                nf,
                variables,
            );
            if (!(varName in variables)) {
                variables[varName] = 0;
            }
            variables[varName] =
                (Number(variables[varName]) || 0) - exprVal;
            return;
        }

        // Match: variable = expression
        const assign = stmt.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
        if (assign) {
            const varName = assign[1];
            const exprStr = assign[2].trim();
            // Try numeric first
            const numVal = this.evaluateNumericExpr(
                exprStr,
                fields,
                line,
                nr,
                nf,
                variables,
            );
            variables[varName] = numVal;
            return;
        }

        // Variable increment: variable++
        const increment = stmt.match(/^([a-zA-Z_]\w*)\+\+$/);
        if (increment) {
            const varName = increment[1];
            if (!(varName in variables)) variables[varName] = 0;
            variables[varName] = (Number(variables[varName]) || 0) + 1;
            return;
        }
    }

    private evaluateNumericExpr(
        expr: string,
        fields: string[],
        line: string,
        nr: number,
        nf: number,
        variables: Record<string, string | number>,
    ): number {
        const resolved = this.resolveToken(
            expr.trim(),
            fields,
            line,
            nr,
            nf,
            variables,
        );
        return Number(resolved) || 0;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
