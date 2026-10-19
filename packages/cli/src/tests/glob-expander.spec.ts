import { expandGlobs } from '../lib/executor/cli-glob-expander';

/** A tiny tree: /home/u (cwd) with files and a docs folder. */
function fakeFs() {
    const tree: Record<string, { name: string; type: 'file' | 'directory' }[]> = {
        '/': [{ name: 'home', type: 'directory' }],
        '/home': [{ name: 'u', type: 'directory' }],
        '/home/u': [
            { name: 'a.txt', type: 'file' },
            { name: 'b.txt', type: 'file' },
            { name: 'my notes.txt', type: 'file' },
            { name: '.hidden.txt', type: 'file' },
            { name: 'c.md', type: 'file' },
            { name: 'docs', type: 'directory' },
        ],
        '/home/u/docs': [
            { name: 'x.md', type: 'file' },
            { name: 'y.md', type: 'file' },
        ],
    };
    const resolve = (p: string) => {
        const parts = (p.startsWith('/') ? p : `/home/u/${p}`).split('/');
        const out: string[] = [];
        for (const part of parts) {
            if (!part || part === '.') continue;
            if (part === '..') out.pop();
            else out.push(part);
        }
        return '/' + out.join('/');
    };
    const exists = (p: string) => {
        if (p === '/') return true;
        const parent = p.slice(0, p.lastIndexOf('/')) || '/';
        return !!tree[parent]?.some((c) => c.name === p.slice(p.lastIndexOf('/') + 1));
    };
    return {
        getCurrentDirectory: () => '/home/u',
        resolvePath: resolve,
        listDirectory: (p: string) => tree[p] ?? [],
        exists,
        isDirectory: (p: string) => !!tree[p],
    };
}

describe('expandGlobs', () => {
    const context: any = {
        services: { get: (t: string) => (t === 'cli-file-system-service' ? fakeFs() : undefined) },
    };
    const expand = (cmd: string) => expandGlobs(cmd, context);

    it('expands * to sorted matches, quoting names with spaces, skipping dot files', () => {
        expect(expand('rm *.txt')).toBe('rm a.txt b.txt "my notes.txt"');
    });

    it('matches . files only with a leading dot', () => {
        expect(expand('ls .*.txt')).toBe('ls .hidden.txt');
    });

    it('expands in sub-directories, ./ and absolute paths', () => {
        expect(expand('cat docs/*.md')).toBe('cat docs/x.md docs/y.md');
        expect(expand('cat ./docs/?.md')).toBe('cat ./docs/x.md ./docs/y.md');
        expect(expand('cat /home/u/[ab].txt')).toBe('cat /home/u/a.txt /home/u/b.txt');
        expect(expand('ls */')).toBe('ls docs/');
    });

    it('keeps a pattern with no match, quoted words, flags and the command name', () => {
        expect(expand('calc 2*3')).toBe('calc 2*3');
        expect(expand('grep "*.txt" f')).toBe('grep "*.txt" f');
        expect(expand('find . --name=*.txt')).toBe('find . --name=*.txt');
        expect(expand('*.txt')).toBe('*.txt');
    });

    it('does nothing without the files plugin', () => {
        const bare: any = { services: { get: () => undefined } };
        expect(expandGlobs('rm *.txt', bare)).toBe('rm *.txt');
    });
});
