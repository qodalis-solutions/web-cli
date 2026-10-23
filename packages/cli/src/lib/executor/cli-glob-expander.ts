import { ICliExecutionContext, quoteShellWord } from '@qodalis/cli-core';

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
 * The value of these flags is a pattern for the command (`find --name *.txt`):
 * it is passed on as typed, not matched here (unquoted, a shell would match
 * it against the current directory and give the command file names).
 */
const PATTERN_FLAGS = /^--?(?:i?name|i?path|i?regex|pattern|include|exclude)$/;

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
    let previous = '';
    return command.replace(/(\s*)((?:"[^"]*"|'[^']*'|\S)+)/g, (whole, space: string, word: string) => {
        const isCommandName = first;
        const afterPatternFlag = PATTERN_FLAGS.test(previous);
        first = false;
        previous = word;
        if (
            isCommandName ||
            afterPatternFlag ||
            word.startsWith('-') ||
            /["'\\]/.test(word) ||
            !GLOB_CHARS.test(word)
        ) {
            return whole;
        }
        const matches = matchGlob(fs, word);
        if (matches.length === 0) return whole;
        return space + matches.map((m) => quoteShellWord(m)).join(' ');
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
            if (segment === '**') {
                // Zero or more directories (`docs/**/*.md`); alone at the end, everything below
                next.push(c);
                next.push(...descendants(fs, c, last && !dirsOnly ? 'all' : 'directories'));
                continue;
            }
            if (!GLOB_CHARS.test(segment)) {
                next.push(join(fs, c, segment));
                continue;
            }
            const regex = globToRegExp(segment);
            let children: { name: string; type: 'file' | 'directory' }[];
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

    return [...new Map(candidates.map((c) => [c.shown, c])).values()]
        .filter((c) => c.shown !== '' && safeExists(fs, c.resolved))
        .map((c) => (dirsOnly ? `${c.shown}/` : c.shown))
        .sort();
}

/** Everything below a directory (no dot entries), depth first. */
function descendants(
    fs: GlobFileSystem,
    from: { shown: string; resolved: string },
    kind: 'all' | 'directories',
): { shown: string; resolved: string }[] {
    const found: { shown: string; resolved: string }[] = [];
    const walk = (dir: { shown: string; resolved: string }, depth: number) => {
        if (depth > 32) return;
        let children: { name: string; type: 'file' | 'directory' }[];
        try {
            if (!fs.isDirectory(dir.resolved)) return;
            children = fs.listDirectory(dir.resolved);
        } catch {
            return;
        }
        for (const child of children) {
            if (child.name.startsWith('.')) continue;
            const entry = join(fs, dir, child.name);
            if (child.type === 'directory') {
                found.push(entry);
                walk(entry, depth + 1);
            } else if (kind === 'all') {
                found.push(entry);
            }
        }
    };
    walk(from, 0);
    return found;
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

/**
 * Brace expansion, as a shell does before wildcards: `file.{ts,js}` is
 * `file.ts file.js`, `img{1..3}.png` is `img1.png img2.png img3.png`
 * (letters too: `{a..c}`). Only unquoted words with a `,` or `..` inside
 * balanced braces; `${VAR}` and quoted text are left alone. Works without
 * the files plugin.
 */
export function expandBraces(command: string): string {
    if (!command.includes('{')) return command;
    let first = true;
    return command.replace(/(\s*)((?:"[^"]*"|'[^']*'|\\.|\S)+)/g, (whole, space: string, word: string) => {
        const isCommandName = first;
        first = false;
        if (isCommandName || /["'\\]|\$\{/.test(word) || !word.includes('{')) return whole;
        const expanded = braceWords(word);
        return expanded.length > 1 ? space + expanded.join(' ') : whole;
    });
}

const MAX_BRACE_WORDS = 1000;

function braceWords(word: string): string[] {
    // The first top-level {...} with a comma or a range
    for (let start = word.indexOf('{'); start !== -1; start = word.indexOf('{', start + 1)) {
        let depth = 0;
        let end = -1;
        const commas: number[] = [];
        for (let i = start; i < word.length; i++) {
            if (word[i] === '{') depth++;
            else if (word[i] === '}') {
                depth--;
                if (depth === 0) {
                    end = i;
                    break;
                }
            } else if (word[i] === ',' && depth === 1) commas.push(i);
        }
        if (end === -1) return [word];
        const prefix = word.slice(0, start);
        const suffix = word.slice(end + 1);
        const body = word.slice(start + 1, end);
        let options: string[] | undefined;
        if (commas.length) {
            options = [];
            let from = start + 1;
            for (const comma of [...commas, end]) {
                options.push(word.slice(from, comma));
                from = comma + 1;
            }
        } else {
            options = braceRange(body);
        }
        if (!options) continue;
        const result: string[] = [];
        for (const option of options) {
            for (const expanded of braceWords(prefix + option + suffix)) {
                result.push(expanded);
                if (result.length >= MAX_BRACE_WORDS) return result;
            }
        }
        return result;
    }
    return [word];
}

/** `1..5`, `5..1`, `01..10` (padded), `a..e`, with an optional `..step`. */
function braceRange(body: string): string[] | undefined {
    const numeric = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(body);
    if (numeric) {
        const [, a, b, stepText] = numeric;
        const from = parseInt(a, 10);
        const to = parseInt(b, 10);
        const step = Math.max(1, Math.abs(parseInt(stepText ?? '1', 10)));
        const width = /^-?0\d/.test(a) || /^-?0\d/.test(b) ? Math.max(a.length, b.length) : 0;
        const out: string[] = [];
        for (let n = from; from <= to ? n <= to : n >= to; n += from <= to ? step : -step) {
            out.push(width ? String(n).padStart(width, '0') : String(n));
            if (out.length >= MAX_BRACE_WORDS) break;
        }
        return out;
    }
    const letters = /^([a-zA-Z])\.\.([a-zA-Z])$/.exec(body);
    if (letters) {
        const from = letters[1].charCodeAt(0);
        const to = letters[2].charCodeAt(0);
        const out: string[] = [];
        for (let c = from; from <= to ? c <= to : c >= to; c += from <= to ? 1 : -1) {
            out.push(String.fromCharCode(c));
        }
        return out;
    }
    return undefined;
}
