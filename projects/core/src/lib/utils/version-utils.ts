/**
 * Compares two dotted version strings (e.g. "1.0.37" vs "0.0.16").
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const length = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < length; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;

        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }

    return 0;
}

/**
 * Returns true if the installed version satisfies the minimum required version.
 */
export function satisfiesMinVersion(
    installed: string,
    required: string,
): boolean {
    return compareVersions(installed, required) >= 0;
}
