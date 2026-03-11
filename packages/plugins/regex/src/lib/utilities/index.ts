/**
 * Valid regex flag characters.
 */
export const VALID_FLAGS = ['g', 'i', 'm', 's', 'u'] as const;

export type RegexFlag = (typeof VALID_FLAGS)[number];

/**
 * Merges --flags and --case-insensitive args into a single flags string.
 * Deduplicates and validates flags.
 */
export const parseFlags = (
    args: Record<string, any>,
    defaultFlags: string = '',
): string => {
    let flags = (args['flags'] || args['f'] || defaultFlags) as string;
    const caseInsensitive = args['case-insensitive'] || args['i'];

    if (caseInsensitive && !flags.includes('i')) {
        flags += 'i';
    }

    // Deduplicate
    const unique = [...new Set(flags.split(''))];
    return unique.filter((f) => VALID_FLAGS.includes(f as RegexFlag)).join('');
};

/**
 * Result of a regex match operation.
 */
export interface RegexMatchResult {
    match: string;
    index: number;
    length: number;
    groups: Record<string, string> | null;
    captureGroups: string[];
}

/**
 * Safely creates a RegExp from a pattern string and flags.
 * Returns the RegExp or an error message string.
 */
export const createRegex = (
    pattern: string,
    flags: string,
): RegExp | string => {
    try {
        return new RegExp(pattern, flags);
    } catch (e: any) {
        return `Invalid regex pattern: ${e.message || e}`;
    }
};

/**
 * Formats a RegExpExecArray into a structured match result.
 */
export const formatMatchResult = (
    match: RegExpExecArray,
): RegexMatchResult => {
    return {
        match: match[0],
        index: match.index,
        length: match[0].length,
        groups: match.groups ? { ...match.groups } : null,
        captureGroups: match.slice(1),
    };
};
