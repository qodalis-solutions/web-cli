export type ParsedArg = {
    name: string;
    value: any;
};

export type ParsedToken =
    | { kind: 'flag'; name: string; value: string | number | boolean; hasEquals: boolean }
    | { kind: 'word'; value: string };

export type CommandParserOutput = {
    commandName: string;
    args: ParsedArg[];
    tokens: ParsedToken[];
};

export type CommandPart = {
    /** 'command' for a command to execute, or the operator string ('&&', '||', '>>', '|') */
    type: 'command' | '&&' | '||' | '>>' | '|';
    value: string;
};

/**
 * A utility class for parsing command strings into command names and arguments.
 */
export class CommandParser {
    /** Operators recognized during command-line splitting. */
    private static readonly OPERATORS = ['&&', '||', '>>', '|'] as const;

    /**
     * Split a raw command line into commands and operators.
     * Respects single and double quotes — operators inside quoted strings
     * are treated as literal text, not as operators.
     * @param input - The full raw input string.
     * @returns An array of command parts with their types.
     */
    static splitByOperators(input: string): CommandPart[] {
        const result: CommandPart[] = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i];

            // Toggle quote state
            if (ch === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
                current += ch;
                continue;
            }
            if (ch === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
                current += ch;
                continue;
            }

            // Inside quotes — everything is literal
            if (inSingleQuote || inDoubleQuote) {
                current += ch;
                continue;
            }

            // Check for two-character operators at this position
            const twoChar = input.slice(i, i + 2);
            if (twoChar === '&&' || twoChar === '||' || twoChar === '>>') {
                const trimmed = current.trim();
                if (trimmed) {
                    result.push({ type: 'command', value: trimmed });
                }
                current = '';
                result.push({
                    type: twoChar as CommandPart['type'],
                    value: twoChar,
                });
                i++; // skip the second character of the operator
                continue;
            }

            // Check for single-character pipe operator (after || is ruled out)
            if (ch === '|') {
                const trimmed = current.trim();
                if (trimmed) {
                    result.push({ type: 'command', value: trimmed });
                }
                current = '';
                result.push({ type: '|', value: '|' });
                continue;
            }

            current += ch;
        }

        const trimmed = current.trim();
        if (trimmed) {
            result.push({ type: 'command', value: trimmed });
        }

        return result;
    }

    /**
     * Parse a command string into a full command name and arguments.
     * @param command - The full command string.
     * @returns An object containing the full command name and arguments.
     */
    parse(command: string): CommandParserOutput {
        // Match quoted strings, single-quoted strings, or unquoted words
        const regex =
            /(?:--?([a-zA-Z0-9-_]+)(?:=("[^"]*"|'[^']*'|[^\s]+))?)|(?:[^\s]+)/g;

        const matches = Array.from(command.matchAll(regex));

        if (matches.length === 0) {
            return { commandName: '', args: [], tokens: [] };
        }

        const commandParts: string[] = [];
        const args: ParsedArg[] = [];
        const tokens: ParsedToken[] = [];

        for (const match of matches) {
            if (match[1]) {
                const key = match[1];
                const hasEquals = match[2] !== undefined;
                let value: any = match[2];
                if (value) {
                    // Remove surrounding quotes
                    value = value.replace(/^['"]|['"]$/g, '');
                } else if (!hasEquals) {
                    // Flag without a value
                    value = true;
                }
                const parsedValue = this.parseValue(value);
                args.push({
                    name: key,
                    value: parsedValue,
                });
                tokens.push({
                    kind: 'flag',
                    name: key,
                    value: parsedValue,
                    hasEquals,
                });
            } else if (!match[0].startsWith('-')) {
                commandParts.push(match[0]);
                tokens.push({ kind: 'word', value: match[0] });
            }
        }

        return {
            commandName: commandParts.join(' '),
            args,
            tokens,
        };
    }

    /**
     * Parse individual values to their appropriate type.
     * @param value - The value to parse.
     * @returns The parsed value.
     */
    private parseValue(value: any): any {
        if (typeof value !== 'string') return value;
        if (value.length > 0 && !isNaN(Number(value))) return Number(value);
        if (value === 'true' || value === 'false') return value === 'true';
        return value;
    }
}
