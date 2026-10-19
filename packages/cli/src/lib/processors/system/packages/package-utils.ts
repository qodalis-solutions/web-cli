/**
 * Helpers for the `pkg` command: argument parsing, package specs and
 * prerelease-aware version comparison.
 */

import { splitShellWords } from '@qodalis/cli-core';

/** Short names of the official plugins, probed on file sources by `pkg browse`. */
export const KNOWN_PLUGIN_SHORT_NAMES: readonly string[] = [
    '2048',
    'browser-storage',
    'chart',
    'cron',
    'csv',
    'curl',
    'data-explorer',
    'encode',
    'files',
    'guid',
    'lang-de',
    'lang-es',
    'lang-fr',
    'lang-it',
    'lang-ja',
    'lang-ko',
    'lang-pt',
    'lang-ro',
    'lang-ru',
    'lang-zh',
    'markdown',
    'minesweeper',
    'password-generator',
    'qr',
    'regex',
    'scp',
    'server-jobs',
    'server-logs',
    'snake',
    'speed-test',
    'stopwatch',
    'string',
    'sudoku',
    'tetris',
    'text-to-image',
    'todo',
    'users',
    'wget',
    'wordle',
    'yesno',
];

/** Split a raw `pkg add a b  c` value into package names, like a shell (quotes removed). */
export function splitPackageArgs(value: string | undefined): string[] {
    return splitShellWords(value ?? '');
}

export interface PackageSpec {
    name: string;
    version?: string;
}

/**
 * Parse `name`, `name@version`, `@scope/name` or `@scope/name@version`.
 * A leading `@` (scope) is never treated as a version separator.
 */
export function parsePackageSpec(raw: string): PackageSpec {
    const spec = raw.trim();
    const atIndex = spec.lastIndexOf('@');
    if (atIndex > 0 && !spec.slice(0, atIndex).endsWith('/')) {
        const version = spec.slice(atIndex + 1);
        return version
            ? { name: spec.slice(0, atIndex), version }
            : { name: spec.slice(0, atIndex) };
    }
    return { name: spec };
}

/** Prefix a short name (`guid`) to its full package name (`@qodalis/cli-guid`). */
export function toFullPackageName(name: string, prefix: string): string {
    return name.startsWith(prefix) ? name : `${prefix}${name}`;
}

interface ParsedVersion {
    core: number[];
    prerelease: string[];
}

function parseVersion(version: string): ParsedVersion | null {
    const match =
        /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
            version.trim(),
        );
    if (!match) return null;
    return {
        core: [Number(match[1]), Number(match[2]), Number(match[3])],
        prerelease: match[4] ? match[4].split('.') : [],
    };
}

function comparePrerelease(a: string[], b: string[]): number {
    // A release (no prerelease) ranks above any prerelease of the same core.
    if (a.length === 0 || b.length === 0) return b.length - a.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] === undefined) return -1;
        if (b[i] === undefined) return 1;
        const aNum = /^\d+$/.test(a[i]);
        const bNum = /^\d+$/.test(b[i]);
        if (aNum && bNum) {
            const diff = Number(a[i]) - Number(b[i]);
            if (diff !== 0) return diff;
        } else if (aNum !== bNum) {
            return aNum ? -1 : 1;
        } else if (a[i] !== b[i]) {
            return a[i] < b[i] ? -1 : 1;
        }
    }
    return 0;
}

/**
 * Compare two semver versions, prerelease tags included
 * (`2.0.0-beta.9 < 2.0.0-beta.18 < 2.0.0`).
 * Returns `null` when either version is not valid semver.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 | null {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb) return null;
    for (let i = 0; i < 3; i++) {
        if (pa.core[i] !== pb.core[i]) return pa.core[i] < pb.core[i] ? -1 : 1;
    }
    const pre = comparePrerelease(pa.prerelease, pb.prerelease);
    return pre === 0 ? 0 : pre < 0 ? -1 : 1;
}

/**
 * Whether `candidate` should be offered as an update over `installed`.
 * Falls back to "different" when a version is not valid semver (e.g. `latest`).
 */
export function isNewerVersion(
    candidate: string | undefined,
    installed: string,
): boolean {
    if (!candidate || candidate === installed) return false;
    const cmp = compareSemver(candidate, installed);
    return cmp === null ? true : cmp > 0;
}
