import * as semver from 'semver';

/**
 * Compares two dotted version strings.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const coercedA = semver.coerce(a);
    const coercedB = semver.coerce(b);
    if (!coercedA || !coercedB) return 0;
    return semver.compare(coercedA, coercedB) as -1 | 0 | 1;
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

/**
 * Returns true if the installed version satisfies the given semver range.
 * If range is undefined/empty, returns true (no constraint).
 * If range looks like a plain version (no operators), treats it as >= that version.
 */
export function satisfiesVersionRange(
    installed: string,
    range: string | undefined,
): boolean {
    if (!range) return true;
    const coerced = semver.coerce(installed);
    if (!coerced) return false;
    if (semver.valid(range)) {
        return semver.gte(coerced, semver.coerce(range)!);
    }
    return semver.satisfies(coerced, range);
}
