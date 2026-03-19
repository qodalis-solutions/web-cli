import { ICliCommandParameterDescriptor } from '../interfaces';
import { CliBackgroundColor, CliForegroundColor } from '../models';
import { delay } from './delay';
import { ObjectDescriber } from './object-describer';
import {
    getConfigValue,
    getPluginConfigValue,
    resolveConfigurationCategories,
    CLI_CONFIGURE_STORE_NAME,
} from './config-utils';

/**
 * Retrieve a parameter's value from the parsed arguments, checking aliases.
 * @param p The parameter descriptor
 * @param args The parsed command arguments
 * @returns The matched value, or `undefined` if not found
 */
export const getParameterValue = (
    p: ICliCommandParameterDescriptor,
    args: Record<string, any>,
): unknown => {
    if (args[p.name] !== undefined) {
        return args[p.name];
    }
    const matchedAlias = p.aliases?.find((alias) => args[alias] !== undefined);
    return matchedAlias ? args[matchedAlias] : undefined;
};

/**
 * Pretty-print a JSON value with ANSI color highlighting.
 * @param json The value to format
 * @returns A colorized, indented string suitable for terminal output
 */
export const formatJson = (json: any): string => {
    const identedJson = JSON.stringify(json, null, 2);

    return colorizeJson(identedJson.split('\n').join('\r\n'));
};

/**
 * Apply ANSI color codes to a JSON string (keys, strings, numbers, booleans, null).
 * @param jsonString The raw JSON string to colorize
 * @returns The colorized string
 */
export const colorizeJson = (jsonString: string): string => {
    return jsonString
        .replace(/"([^"]+)":/g, '\x1b[33m"$1":\x1b[0m') // Keys (yellow)
        .replace(/: "([^"]*)"/g, ': \x1b[32m"$1"\x1b[0m') // Strings (green)
        .replace(/: (\d+)/g, ': \x1b[34m$1\x1b[0m') // Numbers (blue)
        .replace(/: (true|false)/g, ': \x1b[35m$1\x1b[0m') // Booleans (magenta)
        .replace(/: (null)/g, ': \x1b[36m$1\x1b[0m'); // Null (cyan)
};

/**
 * Convert a key-value object to a URL query string. Arrays produce repeated keys.
 * @param params The parameters to encode
 * @returns The encoded query string (without leading `?`)
 */
export const toQueryString = (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v.toString()));
        } else if (value !== null && value !== undefined) {
            searchParams.append(key, value.toString());
        }
    }

    return searchParams.toString();
};

/**
 * Highlight regex matches in text using an ANSI background color.
 * @param text The source text
 * @param pattern The regex pattern to highlight
 * @param bgColor The background color to apply (default: Yellow)
 * @returns The text with matching segments wrapped in ANSI background color codes
 */
export const highlightTextWithBg = (
    text: string,
    pattern: RegExp,
    bgColor: CliBackgroundColor = CliBackgroundColor.Yellow,
): string => {
    // Replace matches with background-colored text
    return text.replace(
        pattern,
        (match) => `${bgColor}${match}${CliForegroundColor.Reset}`,
    );
};

/**
 * Extract the substring to the right of a given word in a command string.
 * @param command The full command string
 * @param word The word to search for
 * @returns The trimmed text after the word, or `undefined` if not found
 */
export const getRightOfWord = (
    command: string,
    word: string,
): string | undefined => {
    // Find the position of the word in the command
    const index = command.indexOf(word);

    // If the word is found, extract the substring to the right
    if (index !== -1) {
        return command.slice(index + word.length).trim();
    }

    // If the word is not found, return null
    return undefined;
};

/**
 * Apply a color function to the first word of a text string, preserving leading whitespace.
 * @param text The text to process
 * @param colorFunction A function that wraps a word in ANSI color codes
 * @returns The text with only the first word colorized
 */
export const colorFirstWord = (
    text: string,
    colorFunction: (word: string) => string,
) => {
    if (!text) return text;

    // Match leading spaces and first word separately
    const match = text.match(/^(\s*)(\S+)(.*)$/);

    if (!match) return text; // If no match, return original text

    const [, leadingSpaces, firstWord, restOfText] = match;

    // Apply color only to the first word
    const firstWordColored = colorFunction(firstWord);

    // Reconstruct string: Keep spaces, color first word, and append rest
    return `${leadingSpaces}${firstWordColored}${restOfText}`;
};

export * from './object-describer';

export * from './delay';

export * from './terminal-utils';

export * from './version-utils';

export * from './config-utils';

export * from './server-version-negotiator';

export * from './panel-theme-sync';

export * from './panel-position-store';

export * from './ansi-utils';

export const utils = {
    getParameterValue,
    formatJson,
    colorizeJson,
    toQueryString,
    highlightTextWithBg,
    getRightOfWord,
    colorFirstWord,
    ObjectDescriber,
    delay,
    getConfigValue,
    getPluginConfigValue,
    resolveConfigurationCategories,
    CLI_CONFIGURE_STORE_NAME,
};
