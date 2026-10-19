import { ICliExecutionContext } from '@qodalis/cli-core';

const FS_TOKEN = 'cli-file-system-service';

/** The file system calls glob expansion needs (`@qodalis/cli-files`). */
interface GlobFileSystem {
    getCurrentDirectory(): string;
    resolvePath(path: string): string;
    listDirectory(path: string): { name: string; type: 'file' | 'directory' }[];
    exists(path: string): boolean;
    isDirectory(path: string): boolean;
}

const GLOB_CHARS = /[*?[]/;

/**
 * Expand `*`, `?` and `[...]` in unquoted arguments to the matching paths,
 * as a shell does: `rm *.txt`, `cat docs/*.md`. The command name and flags
 * are left alone, names starting with `.` match only a pattern that starts
 * with `.`, and a pattern that matches nothing is kept as typed.
 * Without the files plugin the command is returned unchanged.
 */
export function expandGlobs(command: string, context: ICliExecutionContext): string {
    if (!GLOB_CHARS.test(command)) return command;
    const fs = context.services.get<GlobFileSystem>(FS_TOKEN);
    if (!fs?.listDirectory) return command;

    let first = true;
    return command.replace(/(\s*)((?:"[^"]*"|'[^']*'|\S)+)/g, (whole, space: string, word: string) => {
        const isCommandName = first;
        first = false;
        if (isCommandName || word.startsWith('-') || /["']/.test(word) || !GLOB_CHARS.test(word)) {
            return whole;
        }
        const matches = matchGlob(fs, word);
        if (matches.length === 0) return whole;
        return space + matches.map((m) => (/\s/.test(m) ? `"${m}"` : m)).join(' ');
    });
}

/** Paths matching `pattern`, sorted, relative when the pattern is. */
export function matchGlob(fs: GlobFileSystem, pattern: string): string[] {
    const absolute = pattern.startsWith('/');
    // `*/` matches directories only, shown with the slash
    const dirsOnly = pattern.length > 1 && pattern.endsWith('/');
    const segments = pattern.split('/').filter((s, i) => s !== '' || i === 0);
    if (absolute) segments.shift();

    // Each candidate: the path to show and the resolved path to list
    let candidates: { shown: string; resolved: string }[] = [
        { shown: absolute ? '/' : '', resolved: absolute ? '/' : fs.getCurrentDirectory() },
    ];

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const last = i === segments.length - 1;
        const next: { shown: string; resolved: string }[] = [];
        for (const c of candidates) {
            if (!GLOB_CHARS.test(segment)) {
                next.push(join(fs, c, segment));
                continue;
            }
            const regex = globToRegExp(segment);
            let children: { name: string; type: 'file' | 'directory' }[] = [];
            try {
                if (!fs.isDirectory(c.resolved)) continue;
                children = fs.listDirectory(c.resolved);
            } catch {
                continue; // unreadable directory: no matches there
            }
            for (const child of children) {
                if (child.name.startsWith('.') && !segment.startsWith('.')) continue;
                if (!regex.test(child.name)) continue;
                if ((!last || dirsOnly) && child.type !== 'directory') continue;
                next.push(join(fs, c, child.name));
            }
        }
        candidates = next;
        if (candidates.length === 0) return [];
    }

    return candidates
        .filter((c) => safeExists(fs, c.resolved))
        .map((c) => (dirsOnly ? `${c.shown}/` : c.shown))
        .sort();
}

function join(
    fs: GlobFileSystem,
    c: { shown: string; resolved: string },
    name: string,
): { shown: string; resolved: string } {
    const shown = c.shown === '' ? name : c.shown.endsWith('/') ? c.shown + name : `${c.shown}/${name}`;
    // resolvePath handles `.`, `..` and `~`
    return { shown, resolved: fs.resolvePath(shown) };
}

function safeExists(fs: GlobFileSystem, path: string): boolean {
    try {
        return fs.exists(path);
    } catch {
        return false;
    }
}

/** A glob segment (`*.md`, `file?.txt`, `[abc]*`) as an anchored regex. */
function globToRegExp(glob: string): RegExp {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === '*') source += '[^/]*';
        else if (ch === '?') source += '[^/]';
        else if (ch === '[') {
            const end = glob.indexOf(']', i + 2);
            if (end === -1) {
                source += '\\[';
                continue;
            }
            let set = glob.slice(i + 1, end);
            if (set.startsWith('!')) set = '^' + set.slice(1);
            source += `[${set.replace(/\\/g, '\\\\')}]`;
            i = end;
        } else source += ch.replace(/[.+^${}()|\\]/g, '\\$&');
    }
    return new RegExp(`^${source}$`);
}
