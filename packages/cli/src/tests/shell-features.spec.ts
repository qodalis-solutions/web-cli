import { joinShellWords, quoteShellWord, splitShellWords, ICliCommandProcessor } from '@qodalis/cli-core';
import { CommandParser } from '../lib/parsers/command-parser';
import { expandBraces, expandGlobs } from '../lib/executor/cli-glob-expander';
import { substituteCommands } from '../lib/executor/cli-command-substitution';
import { CliTestHarness } from '../lib/testing';
import { CliEchoCommandProcessor } from '../lib/processors/cli-echo-command-processor';

describe('splitShellWords', () => {
    it('splits like a shell', () => {
        expect(splitShellWords(`a "b c" 'd e' f\\ g`)).toEqual(['a', 'b c', 'd e', 'f g']);
        expect(splitShellWords(`"say \\"hi\\"" 'a\\b' x\\\\y`)).toEqual(['say "hi"', 'a\\b', 'x\\y']);
        expect(splitShellWords(`"a\\nb" it's`)).toEqual(['a\\nb', "it's"]);
        expect(splitShellWords(`""  x`)).toEqual(['', 'x']);
    });

    it('quoteShellWord reads back as one word', () => {
        for (const v of ['plain', 'two words', `it's`, `say "hi"`, `a'b"c`, '$HOME', '', 'x*y']) {
            expect(splitShellWords(quoteShellWord(v))).toEqual([v]);
        }
        expect(quoteShellWord('plain')).toBe('plain');
    });

    it('joinShellWords is the words joined by a space', () => {
        expect(joinShellWords('"a" "b"   c')).toBe('a b c');
    });
});

describe('command line with backslashes and substitutions', () => {
    it('keeps escaped operators and substitutions in one command', () => {
        const parts = CommandParser.splitByOperators('echo a\\|b $(ls | wc -l) `x | y` | grep 1');
        expect(parts.map((p) => p.type)).toEqual(['command', '|', 'command']);
        expect(parts[0].value).toBe('echo a\\|b $(ls | wc -l) `x | y`');
    });

    it('treats a backslash-space as part of the word', () => {
        const out = new CommandParser().parse('cat my\\ file.txt other');
        expect(out.tokens.filter((t) => t.kind === 'word').map((t: any) => t.value)).toEqual([
            'cat',
            'my\\ file.txt',
            'other',
        ]);
    });
});

describe('substituteCommands', () => {
    const run = async (inner: string) => `[${inner}]\n\n`;

    it('replaces $(...) and backticks, not in single quotes', async () => {
        // Outside quotes the output's shell characters are escaped (here `[` `]`)
        expect(await substituteCommands('echo $(date) `whoami` \'$(no)\' "$(yes)"', run)).toBe(
            String.raw`echo \[date\] \[whoami\] '$(no)' "[yes]"`,
        );
    });

    it('handles nesting and escapes $ in the output', async () => {
        const inner: string[] = [];
        await substituteCommands('echo $(a $(b))', async (c) => (inner.push(c), 'x'));
        expect(inner).toEqual(['a $(b)']); // the inner run expands $(b) itself
        expect(await substituteCommands('echo $(x)', async () => 'cost $5')).toBe('echo cost \\$5');
    });
});

describe('expandBraces', () => {
    it('expands lists and ranges', () => {
        expect(expandBraces('touch file.{ts,js,md}')).toBe('touch file.ts file.js file.md');
        expect(expandBraces('echo img{1..3}.png')).toBe('echo img1.png img2.png img3.png');
        expect(expandBraces('echo {a..c}{1,2}')).toBe('echo a1 a2 b1 b2 c1 c2');
        expect(expandBraces('echo {01..03} {5..1..2}')).toBe('echo 01 02 03 5 3 1');
    });

    it('leaves braces without , or .., quoted ones and ${VAR}', () => {
        expect(expandBraces('awk {print} f')).toBe('awk {print} f');
        expect(expandBraces('echo "{a,b}" ${HOME}')).toBe('echo "{a,b}" ${HOME}');
        expect(expandBraces('json {"a":1,"b":2}')).toBe('json {"a":1,"b":2}');
    });
});

describe('recursive ** wildcards', () => {
    const tree: Record<string, { name: string; type: 'file' | 'directory' }[]> = {
        '/w': [
            { name: 'a.md', type: 'file' },
            { name: 'docs', type: 'directory' },
            { name: '.git', type: 'directory' },
        ],
        '/w/docs': [
            { name: 'b.md', type: 'file' },
            { name: 'deep', type: 'directory' },
        ],
        '/w/docs/deep': [{ name: 'c.md', type: 'file' }],
        '/w/.git': [{ name: 'd.md', type: 'file' }],
    };
    const resolve = (p: string) => (p.startsWith('/') ? p : `/w/${p}`).replace(/\/+$/, '') || '/';
    const fs = {
        getCurrentDirectory: () => '/w',
        resolvePath: resolve,
        listDirectory: (p: string) => tree[p] ?? [],
        isDirectory: (p: string) => !!tree[p],
        exists: (p: string) => {
            const parent = p.slice(0, p.lastIndexOf('/')) || '/';
            return !!tree[p] || !!tree[parent]?.some((c) => c.name === p.slice(p.lastIndexOf('/') + 1));
        },
    };
    const context: any = { services: { get: (t: string) => (t === 'cli-file-system-service' ? fs : undefined) } };

    it('matches at any depth, skipping dot directories', () => {
        expect(expandGlobs('cat **/*.md', context)).toBe('cat a.md docs/b.md docs/deep/c.md');
        expect(expandGlobs('cat docs/**/*.md', context)).toBe('cat docs/b.md docs/deep/c.md');
        expect(expandGlobs('ls **/', context)).toBe('ls docs/ docs/deep/');
    });
});

describe('positionals and substitution through the engine', () => {
    function harnessWith(...extra: ICliCommandProcessor[]) {
        const harness = new CliTestHarness();
        harness.registerProcessors([new CliEchoCommandProcessor(), ...extra]);
        return harness;
    }

    it('gives commands their arguments split like a shell', async () => {
        let seen: string[] | undefined;
        const harness = harnessWith({
            command: 'args',
            description: '',
            acceptsRawInput: true,
            processCommand: async (cmd) => {
                seen = cmd.positionals;
            },
        });
        await harness.execute(`args "a b" c\\ d 'e' --flag x`);
        expect(seen).toEqual(['a b', 'c d', 'e', 'x']);
        await harness.execute('args');
        expect(seen).toEqual([]);
    });

    it('runs $(...) and uses its output', async () => {
        const harness = harnessWith();
        expect((await harness.execute('echo "got: $(echo inner)"')).output).toBe('got: inner');
        expect((await harness.execute('echo `echo a` $(echo b | echo c)')).output).toBe('a c');
        expect((await harness.execute("echo '$(echo no)'")).output).toBe('$(echo no)');
    });

    it('does not expand a variable written with a backslash', async () => {
        const harness = harnessWith();
        expect((await harness.execute('echo \\$HOME costs\\ 5')).output).toBe('$HOME costs 5');
    });
});


describe('review fixes: literal input, pattern flags, safe substitution output', () => {
    it('does not expand the input of a literalInput command', async () => {
        let seen: string | undefined;
        const harness = new CliTestHarness();
        harness.registerService('cli-file-system-service', {
            getCurrentDirectory: () => '/w',
            resolvePath: (p: string) => (p.startsWith('/') ? p : `/w/${p}`),
            listDirectory: () => [{ name: 'a.txt', type: 'file' }],
            isDirectory: (p: string) => p === '/w',
            exists: () => true,
        });
        harness.registerProcessors([
            {
                command: 'code',
                description: '',
                acceptsRawInput: true,
                metadata: { literalInput: true },
                processCommand: async (cmd) => {
                    seen = cmd.value;
                },
            },
            {
                command: 'files',
                description: '',
                acceptsRawInput: true,
                processCommand: async (cmd) => {
                    seen = cmd.value;
                },
            },
        ]);
        await harness.execute('code [1,2].map(x => x * 2) + `${y}` + $(boom) {a,b}');
        expect(seen).toBe('[1,2].map(x => x * 2) + `${y}` + $(boom) {a,b}');
        await harness.execute('files *');
        expect(seen).toBe('a.txt');
        await harness.execute('files --name *.txt');
        expect(seen).toBe('*.txt');
    });

    it('$(...) output with quotes and operators stays text', async () => {
        const out = await substituteCommands('echo $(x) "$(x)"', async () => '"a b" ; *');
        expect(out).toBe(String.raw`echo \"a b\" \; \* "\"a b\" ; *"`);
        expect(splitShellWords(out.slice(5))).toEqual(['"a', 'b"', ';', '*', '"a b" ; *']);
    });
});

describe('control flow typed at the prompt', () => {
    it('runs a for loop and an if on one line', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessors([new CliEchoCommandProcessor()]);
        expect((await harness.execute('for x in a b; do echo [$x]; done')).stdout).toEqual(['[a]', '[b]']);
    });
});
