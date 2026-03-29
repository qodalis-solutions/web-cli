import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

interface SedExpression {
    address: SedAddress | null;
    command: string; // 's', 'd', 'p'
    // For substitution:
    pattern?: RegExp;
    replacement?: string;
    globalFlag?: boolean;
    printFlag?: boolean;
}

interface SedAddress {
    type: 'line' | 'last' | 'range' | 'regex';
    line?: number;
    startLine?: number;
    endLine?: number;
    endIsLast?: boolean;
    regex?: RegExp;
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
            description: 'Add the expression to the commands to be executed',
            required: false,
            type: 'string' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.getRequired<IFileSystemService>(
            IFileSystemService_TOKEN,
        );

        const { inPlace, suppress, expressions, filePath } =
            this.parseRawCommand(command);

        if (expressions.length === 0) {
            context.writer.writeError(
                'sed: missing expression. Usage: sed [options] \'expression\' <file>',
            );
            return;
        }

        let content: string;
        if (filePath) {
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

            content = fs.readFile(resolved) ?? '';
        } else if (command.data != null) {
            content = typeof command.data === 'string'
                ? command.data : JSON.stringify(command.data);
        } else {
            context.writer.writeError(
                'sed: missing file operand. Usage: sed [options] \'expression\' <file>',
            );
            return;
        }

        // Parse expressions
        const parsedExpressions: SedExpression[] = [];
        for (const expr of expressions) {
            try {
                const parsed = this.parseExpression(expr);
                parsedExpressions.push(parsed);
            } catch (e: any) {
                context.writer.writeError(`sed: ${e.message}`);
                return;
            }
        }
        const lines = content.split('\n');
        const outputLines: string[] = [];

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            let line = lines[lineIdx];
            let deleted = false;
            let printed = false;

            for (const expr of parsedExpressions) {
                if (deleted) break;

                if (
                    !this.addressMatches(
                        expr.address,
                        lineIdx + 1,
                        lines.length,
                        line,
                    )
                ) {
                    continue;
                }

                switch (expr.command) {
                    case 's': {
                        const pattern = expr.pattern!;
                        pattern.lastIndex = 0;
                        const newLine = line.replace(pattern, (...args) => {
                            const match = args[0];
                            return expr.replacement!.replace(/&/g, match);
                        });
                        const matched = newLine !== line;
                        line = newLine;
                        if (matched && expr.printFlag) {
                            printed = true;
                        }
                        break;
                    }
                    case 'd':
                        deleted = true;
                        break;
                    case 'p':
                        printed = true;
                        break;
                }
            }

            if (!deleted) {
                if (suppress) {
                    if (printed) {
                        outputLines.push(line);
                    }
                } else {
                    outputLines.push(line);
                }
            }
        }

        const result = outputLines.join('\n');

        if (inPlace && filePath) {
            const resolved = fs.resolvePath(filePath);
            fs.writeFile(resolved, result);
            await fs.persist();
        } else {
            // Print the result
            const resultLines = result.split('\n');
            for (const line of resultLines) {
                context.writer.writeln(line);
            }
        }
    }

    private parseRawCommand(command: CliProcessCommand): {
        inPlace: boolean;
        suppress: boolean;
        expressions: string[];
        filePath: string | null;
    } {
        const raw = command.value || '';
        const tokens = this.tokenize(raw);

        const inPlace = !!command.args['in-place'] || !!command.args['i'];
        const suppress = !!command.args['quiet'] || !!command.args['n'];
        const expressions: string[] = [];
        let filePath: string | null = null;
        const nonFlagTokens: string[] = [];

        // Check for -e expressions from args
        if (command.args['expression'] || command.args['e']) {
            const eValue = command.args['expression'] || command.args['e'];
            if (Array.isArray(eValue)) {
                for (const v of eValue) {
                    if (v && typeof v === 'string') {
                        expressions.push(v);
                    }
                }
            } else if (eValue && typeof eValue === 'string') {
                expressions.push(eValue);
            }
        }

        for (const t of tokens) {
            nonFlagTokens.push(t);
        }

        // If no -e expressions, first non-flag token is the expression
        if (expressions.length === 0 && nonFlagTokens.length > 0) {
            expressions.push(nonFlagTokens.shift()!);
        }

        // Remaining non-flag token is the file path
        if (nonFlagTokens.length > 0) {
            filePath = nonFlagTokens[nonFlagTokens.length - 1];
        }

        return { inPlace, suppress, expressions, filePath };
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

            // Handle quoted strings
            if (raw[i] === "'" || raw[i] === '"') {
                const quote = raw[i];
                i++;
                let token = '';
                while (i < raw.length && raw[i] !== quote) {
                    token += raw[i];
                    i++;
                }
                if (i < raw.length) i++; // skip closing quote
                tokens.push(token);
                continue;
            }

            // Regular token
            let token = '';
            while (i < raw.length && raw[i] !== ' ' && raw[i] !== '\t') {
                token += raw[i];
                i++;
            }
            tokens.push(token);
        }
        return tokens;
    }

    private parseExpression(expr: string): SedExpression {
        let pos = 0;

        // Parse optional address
        let address: SedAddress | null = null;
        if (pos < expr.length) {
            const addrResult = this.parseAddress(expr, pos);
            if (addrResult) {
                address = addrResult.address;
                pos = addrResult.pos;

                // Check for range address
                if (pos < expr.length && expr[pos] === ',') {
                    pos++;
                    const endResult = this.parseAddress(expr, pos);
                    if (endResult) {
                        if (endResult.address.type === 'last') {
                            address = {
                                type: 'range',
                                startLine: address.line,
                                endLine: 0,
                                endIsLast: true,
                            };
                        } else {
                            address = {
                                type: 'range',
                                startLine: address.line,
                                endLine: endResult.address.line,
                            };
                        }
                        pos = endResult.pos;
                    }
                }
            }
        }

        if (pos >= expr.length) {
            throw new Error(`invalid expression: '${expr}'`);
        }

        const cmd = expr[pos];

        if (cmd === 's') {
            return this.parseSubstitution(expr, pos, address);
        } else if (cmd === 'd') {
            return { address, command: 'd' };
        } else if (cmd === 'p') {
            return { address, command: 'p' };
        } else {
            throw new Error(`unknown command: '${cmd}'`);
        }
    }

    private parseAddress(
        expr: string,
        pos: number,
    ): { address: SedAddress; pos: number } | null {
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
            pos++; // skip opening /
            let pattern = '';
            while (pos < expr.length && expr[pos] !== '/') {
                if (expr[pos] === '\\' && pos + 1 < expr.length) {
                    pattern += expr[pos + 1];
                    pos += 2;
                } else {
                    pattern += expr[pos];
                    pos++;
                }
            }
            if (pos < expr.length) pos++; // skip closing /
            try {
                return {
                    address: { type: 'regex', regex: new RegExp(pattern) },
                    pos,
                };
            } catch {
                throw new Error(`invalid regex in address: '${pattern}'`);
            }
        }

        return null;
    }

    private parseSubstitution(
        expr: string,
        pos: number,
        address: SedAddress | null,
    ): SedExpression {
        pos++; // skip 's'
        if (pos >= expr.length) {
            throw new Error(`invalid substitution expression: '${expr}'`);
        }

        const delimiter = expr[pos];
        pos++;

        // Parse pattern
        let pattern = '';
        while (pos < expr.length && expr[pos] !== delimiter) {
            if (expr[pos] === '\\' && pos + 1 < expr.length) {
                pattern += '\\' + expr[pos + 1];
                pos += 2;
            } else {
                pattern += expr[pos];
                pos++;
            }
        }
        if (pos < expr.length) pos++; // skip delimiter

        // Parse replacement
        let replacement = '';
        while (pos < expr.length && expr[pos] !== delimiter) {
            if (expr[pos] === '\\' && pos + 1 < expr.length) {
                replacement += expr[pos + 1];
                pos += 2;
            } else {
                replacement += expr[pos];
                pos++;
            }
        }
        if (pos < expr.length) pos++; // skip delimiter

        // Parse flags
        let globalFlag = false;
        let caseInsensitive = false;
        let printFlag = false;
        while (pos < expr.length) {
            const f = expr[pos];
            if (f === 'g') globalFlag = true;
            else if (f === 'i') caseInsensitive = true;
            else if (f === 'p') printFlag = true;
            pos++;
        }

        let regexFlags = '';
        if (caseInsensitive) regexFlags += 'i';
        if (globalFlag) regexFlags += 'g';

        let regex: RegExp;
        try {
            regex = new RegExp(pattern, regexFlags);
        } catch {
            throw new Error(`invalid regex: '${pattern}'`);
        }

        return {
            address,
            command: 's',
            pattern: regex,
            replacement,
            globalFlag,
            printFlag,
        };
    }

    private addressMatches(
        address: SedAddress | null,
        lineNum: number,
        totalLines: number,
        lineText: string,
    ): boolean {
        if (!address) return true;

        switch (address.type) {
            case 'line':
                return lineNum === address.line!;
            case 'last':
                return lineNum === totalLines;
            case 'range': {
                const start = address.startLine!;
                const end = address.endIsLast
                    ? totalLines
                    : address.endLine!;
                return lineNum >= start && lineNum <= end;
            }
            case 'regex':
                return address.regex!.test(lineText);
            default:
                return true;
        }
    }
}
