import { CliBackgroundColor, CliForegroundColor } from '../models';

export interface CliTableOptions {
    /** Expand columns to fill the full terminal width. Default: false */
    fullWidth?: boolean;
}

export interface ICliTerminalWriter {
    /**
     * Write text to the terminal
     * @param text The text to write
     */
    write(text: string): void;

    /**
     * Write text to the terminal followed by a newline
     * @param text The text to write
     */
    writeln(text?: string): void;

    /**
     * Write a success message to the terminal
     * @param message The message to write
     */
    writeSuccess(message: string): void;

    /**
     * Write an info message to the terminal
     * @param message The message to write
     */
    writeInfo(message: string): void;

    /**
     * Write an error message to the terminal
     * @param message The message to write
     */
    writeError(message: string): void;

    /**
     * Write a warning message to the terminal
     * @param message The message to write
     */
    writeWarning(message: string): void;

    /**
     * Wrap text in the specified foreground color.
     * @param text The text to wrap
     * @param color The foreground color to apply
     * @returns The text wrapped in ANSI color codes
     */
    wrapInColor(text: string, color: CliForegroundColor): string;

    /**
     * Wrap text in the specified background color.
     * @param text The text to wrap
     * @param color The background color to apply
     * @returns The text wrapped in ANSI background color codes
     */
    wrapInBackgroundColor(text: string, color: CliBackgroundColor): string;

    /**
     * Write a JSON object to the terminal
     * @param json The JSON object to write
     */
    writeJson(json: any): void;

    /**
     * Write content to a file (triggers a browser download)
     * @param fileName The name of the file to download
     * @param content The content to write to the file
     */
    writeToFile(fileName: string, content: string): void;

    /**
     * Write an object array as a table to the terminal
     * @param objects The objects to write to the table
     */
    writeObjectsAsTable(objects: any[]): void;

    /**
     * Write a table to the terminal
     * @param headers The headers of the table
     * @param rows The rows of the table
     * @param options Optional table rendering options
     */
    writeTable(headers: string[], rows: string[][], options?: CliTableOptions): void;

    /**
     * Write a divider to the terminal
     * @param options Optional: color, length, character
     */
    writeDivider(options?: {
        color?: CliForegroundColor;
        length?: number;
        char?: string;
    }): void;

    /**
     * Write a list of items to the terminal with bullet, numbered, or custom prefix.
     * @param items The list items to display
     * @param options Optional: ordered (numbered), prefix (custom marker), color
     */
    writeList(
        items: string[],
        options?: {
            ordered?: boolean;
            prefix?: string;
            color?: CliForegroundColor;
        },
    ): void;

    /**
     * Write aligned key-value pairs to the terminal.
     * @param entries Key-value pairs as a Record or array of tuples
     * @param options Optional: separator string, key color
     */
    writeKeyValue(
        entries: Record<string, string> | [string, string][],
        options?: { separator?: string; keyColor?: CliForegroundColor },
    ): void;

    /**
     * Write items in a multi-column layout.
     * @param items The items to arrange in columns
     * @param options Optional: number of columns, padding between columns
     */
    writeColumns(
        items: string[],
        options?: { columns?: number; padding?: number },
    ): void;

    /**
     * Write a clickable hyperlink using OSC 8 escape sequences.
     * In terminals that support OSC 8, the text is clickable. In others,
     * it falls back to displaying "text (url)".
     * @param text The visible link text
     * @param url The URL to link to
     */
    writeLink(text: string, url: string): void;

    /**
     * Write text inside a bordered box.
     * Useful for callouts, notices, and highlighted information.
     * @param content The content lines to display inside the box
     * @param options Optional: title, border color, padding
     */
    writeBox(
        content: string | string[],
        options?: {
            title?: string;
            borderColor?: CliForegroundColor;
            padding?: number;
        },
    ): void;

    /**
     * Write text with a specified indentation level.
     * Each level adds 2 spaces of indentation.
     * @param text The text to write
     * @param level The indentation level (default: 1)
     */
    writeIndented(text: string, level?: number): void;
}
