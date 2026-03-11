/**
 * Generates a v4 UUID using crypto.getRandomValues when available,
 * falling back to Math.random.
 */
export const generateGUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        const hex = Array.from(bytes, (b) =>
            b.toString(16).padStart(2, '0'),
        ).join('');
        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32),
        ].join('-');
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
        const random = (Math.random() * 16) | 0;
        const value = char === 'x' ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
};

/**
 * Validates a UUID v4 string.
 */
export const validateGUID = (guid: string): boolean => {
    const guidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    return guidRegex.test(guid);
};

/**
 * Validates any UUID version (v1-v5, nil).
 */
export const validateAnyGUID = (guid: string): boolean => {
    const guidRegex =
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return guidRegex.test(guid);
};

/** The nil UUID (all zeros). */
export const NIL_GUID = '00000000-0000-0000-0000-000000000000';

/**
 * Detects the version of a UUID string.
 * Returns the version number (1-5) or 0 for nil, or null if invalid.
 */
export const detectGUIDVersion = (guid: string): number | null => {
    if (!validateAnyGUID(guid)) {
        return null;
    }
    if (guid === NIL_GUID) {
        return 0;
    }
    const versionChar = guid.charAt(14);
    const version = parseInt(versionChar, 16);
    return version >= 1 && version <= 5 ? version : null;
};

export type GuidFormat = 'default' | 'uppercase' | 'braces' | 'parentheses' | 'digits' | 'urn';

/**
 * Formats a UUID string into different representations.
 */
export const formatGUID = (guid: string, format: GuidFormat): string => {
    const clean = guid.replace(/[-{}() ]/g, '').toLowerCase();
    const d = `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;

    switch (format) {
        case 'uppercase':
            return d.toUpperCase();
        case 'braces':
            return `{${d}}`;
        case 'parentheses':
            return `(${d})`;
        case 'digits':
            return clean;
        case 'urn':
            return `urn:uuid:${d}`;
        case 'default':
        default:
            return d;
    }
};
