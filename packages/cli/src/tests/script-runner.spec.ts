import { CliProcessCommand, ICliCommandProcessor, ICliExecutionContext } from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing/cli-test-harness';
import { CliEchoCommandProcessor } from '../lib/processors/cli-echo-command-processor';
import {
    CliFalseCommandProcessor,
    CliTestCommandProcessor,
    CliTrueCommandProcessor,
} from '../lib/processors/cli-test-command-processor';
import { ICliEnvironment, ICliEnvironment_TOKEN } from '../lib/services/cli-environment';
import { parseScript, splitWords } from '../lib/executor/cli-script-runner';

interface FakeNode {
    type: 'file' | 'directory';
    content?: string;
    permissions?: string;
}

/** A minimal in-memory file system with the calls the runner and `test` use. */
function fakeFs() {
    const nodes: Record<string, FakeNode> = {
        '/': { type: 'directory' },
        '/home': { type: 'directory' },
        '/home/u': { type: 'directory' },
        '/home/u/docs': { type: 'directory' },
        '/home/u/a.txt': { type: 'file', content: 'a' },
        '/home/u/b.txt': { type: 'file', content: 'b' },
    };
    const resolvePath = (p: string) => {
        const parts = (p.startsWith('/') ? p : `/home/u/${p}`).split('/');
        const out: string[] = [];
        for (const part of parts) {
            if (!part || part === '.') continue;
            if (part === '..') out.pop();
            else out.push(part);
        }
        return '/' + out.join('/');
    };
    return {
        nodes,
        getCurrentDirectory: () => '/home/u',
        resolvePath,
        getNode: (p: string) => nodes[p] ?? null,
        readFile: (p: string) => nodes[p]?.content ?? null,
        exists: (p: string) => p in nodes,
        isDirectory: (p: string) => nodes[p]?.type === 'directory',
        listDirectory: (p: string) =>
            Object.keys(nodes)
                .filter((k) => k !== p && k.startsWith(p === '/' ? '/' : `${p}/`) && !k.slice(p.length + 1).includes('/'))
                .map((k) => ({ name: k.slice(k.lastIndexOf('/') + 1), type: nodes[k].type })),
        addScript: (name: string, content: string) => {
            nodes[resolvePath(name)] = { type: 'file', content, permissions: 'rwxr-xr-x' };
        },
    };
}

/** `inc NAME`: adds one to a terminal variable (as a command would). */
class IncProcessor implements ICliCommandProcessor {
    command = 'inc';
    description = 'increment';
    acceptsRawInput = true;
    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        const env = context.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!;
        const name = (command.value ?? '').trim();
        env.set(name, String(parseInt(env.get(name) ?? '0', 10) + 1), 'session');
    }
}

/** `ctrlc`: behaves as if Ctrl+C was pressed while it ran. */
class CtrlCProcessor implements ICliCommandProcessor {
    command = 'ctrlc';
    description = 'abort';
    async processCommand(_c: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.onAbort.next();
    }
}

/** `fail`: exits with status 3 (`process.exit`, which also fires onAbort in the engine). */
class FailProcessor implements ICliCommandProcessor {
    command = 'fail';
    description = 'fail';
    async processCommand(_c: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.onAbort.next();
        context.process.exit(3, { silent: true });
    }
}

describe('script runner', () => {
    let harness: CliTestHarness;
    let fs: ReturnType<typeof fakeFs>;

    const run = async (script: string) => {
        fs.addScript('t.sh', script);
        return harness.execute('./t.sh');
    };
    const lines = (result: { stdout: string[] }) => result.stdout;

    beforeEach(() => {
        harness = new CliTestHarness();
        fs = fakeFs();
        harness.registerService('cli-file-system-service', fs);
        harness.registerProcessors([
            new CliEchoCommandProcessor(),
            new CliTestCommandProcessor(),
            new CliTrueCommandProcessor(),
            new CliFalseCommandProcessor(),
            new IncProcessor(),
            new CtrlCProcessor(),
            new FailProcessor(),
        ]);
    });

    describe('values are data, never code', () => {
        it('does not run a substitution or operator found in a variable', async () => {
            const result = await run(
                'NAME=\'$(inc hits)\'\nOTHER=\'a; inc hits\'\necho "$NAME"\necho $OTHER\necho $NAME\n',
            );
            expect(lines(result)).toEqual(['$(inc hits)', 'a; inc hits', '$(inc hits)']);
            const env = harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!;
            expect(env.get('hits')).toBeUndefined();
        });

        it('runs a $(...) written in the for list itself', async () => {
            const result = await run('for w in $(echo a b) c; do echo [$w]; done\n');
            expect(lines(result)).toEqual(['[a]', '[b]', '[c]']);
        });

        it('splits an unquoted variable into for words, without running it', async () => {
            const result = await run('LIST="x $(inc hits) y"\nfor w in $LIST; do echo $w; done\n');
            expect(lines(result)).toEqual(['x', '$(inc', 'hits)', 'y']);
            const env = harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!;
            expect(env.get('hits')).toBeUndefined();
        });
    });

    describe('plain scripts (as before)', () => {
        it('runs lines, skips comments and blank lines', async () => {
            const result = await run('#!/bin/sh\n# comment\n\necho one\necho two # trailing\n');
            expect(lines(result)).toEqual(['one', 'two']);
        });

        it('substitutes script variables and terminal variables', async () => {
            const result = await run('NAME=Ana\necho Hello $NAME from $HOME\n');
            expect(lines(result)).toEqual(['Hello Ana from /home/user']);
        });

        it('stops on the first failure (set -e) and continues with set +e', async () => {
            let result = await run('echo before\nfalse\necho after\n');
            expect(lines(result)).toEqual(['before']);
            expect(result.stderr.some((l) => l.includes('script aborted at line 2'))).toBe(true);
            expect(result.exitCode).toBe(1);

            result = await run('set +e\nfalse\necho after\n');
            expect(lines(result)).toEqual(['after']);
        });

        it('runs ;-separated commands and exit', async () => {
            const result = await run('echo a; echo b\nexit 4\necho never\n');
            expect(lines(result)).toEqual(['a', 'b']);
            expect(result.exitCode).toBe(4);
        });
    });

    describe('if', () => {
        it('takes the then branch on success and else on failure (multi-line)', async () => {
            const result = await run(
                'if true\nthen\n    echo yes\nelse\n    echo no\nfi\n' +
                'if false; then\n  echo yes\nelse\n  echo no\nfi\n',
            );
            expect(lines(result)).toEqual(['yes', 'no']);
        });

        it('supports elif and single-line form', async () => {
            const result = await run(
                'X=b\nif [ $X = a ]; then echo A; elif [ $X = b ]; then echo B; else echo C; fi\n',
            );
            expect(lines(result)).toEqual(['B']);
        });

        it('negates a condition with !', async () => {
            const result = await run('if ! false; then echo negated; fi\n');
            expect(lines(result)).toEqual(['negated']);
        });

        it('does not stop on a failing condition under set -e', async () => {
            const result = await run('if false; then echo x; fi\necho after\n');
            expect(lines(result)).toEqual(['after']);
            expect(result.stderr).toEqual([]);
        });

        it('tests files through the file system service', async () => {
            const result = await run(
                'if [ -f a.txt ]; then echo file; fi\n' +
                'if [ -d docs ]; then echo dir; fi\n' +
                'if [ -e missing ]; then echo bad; else echo missing; fi\n' +
                'if test -f docs; then echo bad; else echo notfile; fi\n',
            );
            expect(lines(result)).toEqual(['file', 'dir', 'missing', 'notfile']);
        });

        it('nests blocks', async () => {
            const result = await run(
                'for a in 1 2; do\n  if [ $a -eq 2 ]; then\n    if true; then echo two; fi\n  else\n    echo one\n  fi\ndone\n',
            );
            expect(lines(result)).toEqual(['one', 'two']);
        });
    });

    describe('for', () => {
        it('iterates over words and sets the variable for the terminal', async () => {
            const result = await run('for x in a "b c" d; do echo item $x; done\n');
            expect(lines(result)).toEqual(['item a', 'item b c', 'item d']);
            const env = harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!;
            expect(env.get('x')).toBe('d');
        });

        it('expands variables and wildcards in the word list', async () => {
            const result = await run('LIST="1 2"\nfor f in *.txt $LIST; do\n  echo $f\ndone\n');
            expect(lines(result)).toEqual(['a.txt', 'b.txt', '1', '2']);
        });

        it('expands braces in the word list', async () => {
            const result = await run('for n in {1..3} x{a,b}; do echo $n; done\n');
            expect(lines(result)).toEqual(['1', '2', '3', 'xa', 'xb']);
        });

        it('supports break and continue', async () => {
            const result = await run(
                'for i in 1 2 3 4 5; do\n  if [ $i -eq 2 ]; then continue; fi\n  if [ $i -eq 4 ]; then break; fi\n  echo $i\ndone\n',
            );
            expect(lines(result)).toEqual(['1', '3']);
        });

        it('break 2 leaves the outer loop', async () => {
            const result = await run(
                'for a in 1 2; do\n  for b in x y; do\n    echo $a$b\n    break 2\n  done\ndone\necho end\n',
            );
            expect(lines(result)).toEqual(['1x', 'end']);
        });
    });

    describe('while / until', () => {
        it('loops while the condition succeeds', async () => {
            const result = await run('while [ "$N" -lt 3 ]; do\n  echo n=$N\n  inc N\ndone\n');
            // N is unset at first: an empty string is not an integer
            expect(result.stderr.some((l) => l.includes('integer expression expected'))).toBe(true);
        });

        it('counts with a terminal variable', async () => {
            harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!.set('N', '0', 'session');
            const result = await run('while [ $N -lt 3 ]; do echo n=$N; inc N; done\necho done\n');
            expect(lines(result)).toEqual(['n=0', 'n=1', 'n=2', 'done']);
        });

        it('until loops while the condition fails', async () => {
            harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!.set('N', '0', 'session');
            const result = await run('until [ $N = 2 ]; do inc N; done\necho N=$N\n');
            expect(lines(result)).toEqual(['N=2']);
        });

        it('while true with break', async () => {
            harness.services.get<ICliEnvironment>(ICliEnvironment_TOKEN)!.set('N', '0', 'session');
            const result = await run('while true; do\n  inc N\n  if [ $N -ge 5 ]; then break; fi\ndone\necho $N\n');
            expect(lines(result)).toEqual(['5']);
        });

        it('stops an endless loop after the iteration cap', async () => {
            const result = await run('while true; do :; done\necho after\n');
            expect(lines(result)).toEqual([]);
            expect(result.stderr.some((l) => l.includes('line 1: while: stopped after 10000 iterations'))).toBe(true);
            expect(result.exitCode).toBe(1);
            // 10000 iterations of the default cap: well over Jasmine's 5 s on a slow CI runner
        }, 30000);
    });

    describe('syntax errors', () => {
        it('reports a missing fi with the line number and runs nothing', async () => {
            const result = await run('echo start\nif true; then\n  echo x\n\n');
            expect(lines(result)).toEqual([]);
            expect(result.stderr).toEqual([
                "[error] ./t.sh: line 4: syntax error: expected 'fi' to close 'if' on line 2",
            ]);
            expect(result.exitCode).toBe(2);
        });

        it('reports an unexpected keyword', async () => {
            const result = await run('echo a\ndone\n');
            expect(result.stderr[0]).toContain("line 2: syntax error: unexpected 'done'");
        });

        it('reports a missing done', () => {
            expect(() => parseScript('for i in 1 2; do\necho $i')).toThrowError(
                "line 2: syntax error: expected 'done' to close 'for' on line 1",
            );
            expect(() => parseScript('while true\necho x')).toThrowError(/expected 'do'/);
        });

        it('rejects an empty condition', () => {
            expect(() => parseScript('if then echo; fi')).toThrowError(/empty 'if' condition/);
        });
    });

    describe('Ctrl+C', () => {
        it('stops the script', async () => {
            const result = await run('echo one\nctrlc\necho two\n');
            expect(lines(result)).toEqual(['one']);
            expect(result.exitCode).toBe(130);
        });

        it('stops a loop', async () => {
            const result = await run('for i in 1 2 3; do echo $i; ctrlc; done\n');
            expect(lines(result)).toEqual(['1']);
        });

        it('a command that exits with a failure is not taken for Ctrl+C', async () => {
            const result = await run('if fail; then echo bad; else echo handled; fi\necho after\n');
            expect(lines(result)).toEqual(['handled', 'after']);
        });
    });

    describe('test / [', () => {
        const status = async (cmd: string) => (await harness.execute(cmd)).exitCode ?? 0;

        it('compares strings and integers', async () => {
            expect(await status('test -z ""')).toBe(0);
            expect(await status('test -n ""')).toBe(1);
            expect(await status('[ abc = abc ]')).toBe(0);
            expect(await status('[ abc != abc ]')).toBe(1);
            expect(await status('[ 2 -lt 10 ]')).toBe(0);
            expect(await status('[ 10 -le 2 ]')).toBe(1);
            expect(await status('[ 3 -eq 3 -a 1 -ne 2 ]')).toBe(0);
            expect(await status('[ 1 -gt 2 -o 5 -ge 5 ]')).toBe(0);
            expect(await status('[ ! -n "" ]')).toBe(0);
            expect(await status('[ x ]')).toBe(0);
            expect(await status('[ ]')).toBe(1);
        });

        it('reports errors with status 2', async () => {
            let result = await harness.execute('[ a -eq 1 ]');
            expect(result.exitCode).toBe(2);
            expect(result.stderr[0]).toContain('integer expression expected');

            result = await harness.execute('[ a = a');
            expect(result.exitCode).toBe(2);
            expect(result.stderr[0]).toContain("missing ']'");
        });

        it('works with && and ||', async () => {
            const result = await harness.execute('[ -f a.txt ] && echo yes || echo no');
            expect(result.output).toContain('yes');
        });

        it('is false for paths without a file system', async () => {
            const bare = new CliTestHarness();
            bare.registerProcessor(new CliTestCommandProcessor());
            expect((await bare.execute('[ -e / ]')).exitCode).toBe(1);
        });
    });

    it('splitWords removes quotes and keeps empty words', () => {
        expect(splitWords(`a "b c" '' d\\ e "x\\"y"`)).toEqual(['a', 'b c', '', 'd e', 'x"y']);
    });
});
