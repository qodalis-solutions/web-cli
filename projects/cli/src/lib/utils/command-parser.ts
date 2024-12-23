/**
 * A utility class for parsing command strings into command names and arguments.
 */
export class CommandParser {
    /**
     * Parse a command string into a full command name and arguments.
     * @param command - The full command string.
     * @returns An object containing the full command name and arguments.
     */
    parse(command: string): { commandName: string; args: Record<string, any> } {
        try {
            // Match quoted strings, single-quoted strings, or unquoted words
            const regex =
                /(?:--?([a-zA-Z0-9-_]+)(?:=("[^"]*"|'[^']*'|[^\s]+))?)|(?:[^\s]+)/g;

            const matches = Array.from(command.matchAll(regex));

            if (matches.length === 0) {
                throw new Error('Invalid command string');
            }

            const commandParts: string[] = [];
            const args: Record<string, any> = {};

            // Process matches
            matches.forEach((match) => {
                if (match[1]) {
                    // Handle arguments
                    const key = match[1];
                    let value: any = match[2];
                    if (value) {
                        // Remove surrounding quotes, if any
                        value = value.replace(/^['"]|['"]$/g, '');
                    } else {
                        // Flag without a value
                        value = true;
                    }
                    args[key] = this.parseValue(value);
                } else if (!match[0].startsWith('--')) {
                    // Command name
                    commandParts.push(match[0]);
                }
            });

            const commandName = commandParts.join(' ');

            return {
                commandName,
                args,
            };
        } catch (e) {
            console.error('Unable to parse the command:', command, e);

            return {
                commandName: '',
                args: {},
            };
        }
    }

    /**
     * Parse individual values to their appropriate type.
     * @param value - The value to parse.
     * @returns The parsed value.
     */
    private parseValue(value: string): any {
        if (!isNaN(Number(value))) return Number(value); // Convert numeric strings to numbers
        if (value === 'true' || value === 'false') return value === 'true'; // Convert "true"/"false" to boolean
        return value; // Return as string otherwise
    }
}
