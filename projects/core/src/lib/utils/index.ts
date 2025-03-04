import { ICliCommandParameterDescriptor } from '../interfaces';
import { CliBackgroundColor, CliForegroundColor } from '../models';
import { delay } from './delay';
import { ObjectDescriber } from './object-describer';

export const getParameterValue = (
    p: ICliCommandParameterDescriptor,
    args: Record<string, any>,
): any | undefined => {
    return (
        args[p.name] ??
        (p.aliases?.find((alias) => args[alias]) &&
            args[p.aliases!.find((alias) => args[alias])!])
    );
};

export const formatJson = (json: any): string => {
    const identedJson = JSON.stringify(json, null, 2);

    return colorizeJson(identedJson.split('\n').join('\r\n'));
};

export const colorizeJson = (jsonString: any): string => {
    return jsonString
        .replace(/"([^"]+)":/g, '\x1b[33m"$1":\x1b[0m') // Keys (yellow)
        .replace(/: "([^"]*)"/g, ': \x1b[32m"$1"\x1b[0m') // Strings (green)
        .replace(/: (\d+)/g, ': \x1b[34m$1\x1b[0m') // Numbers (blue)
        .replace(/: (true|false)/g, ': \x1b[35m$1\x1b[0m') // Booleans (magenta)
        .replace(/: (null)/g, ': \x1b[36m$1\x1b[0m'); // Null (cyan)
};

export const toQueryString = (params: Record<string, any>): string => {
    const searchParams = new URLSearchParams();

    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            const value = params[key];
            // Handle array and non-primitive values
            if (Array.isArray(value)) {
                value.forEach((v) => searchParams.append(key, v.toString()));
            } else if (value !== null && value !== undefined) {
                searchParams.append(key, value.toString());
            }
        }
    }

    return searchParams.toString();
};

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
};
