import { CliTestHarness } from '../lib/testing';
import { joinShellWords } from '@qodalis/cli-core';
import { CliEchoCommandProcessor } from '../lib/processors/cli-echo-command-processor';

describe('echo', () => {
    it('joins shell words: quotes removed, inner spacing kept', () => {
        expect(joinShellWords('"a" "b"')).toBe('a b');
        expect(joinShellWords('"a   b"  c')).toBe('a   b c');
        expect(joinShellWords("it's fine")).toBe("it's fine");
        expect(joinShellWords('say "hi there"!')).toBe('say hi there!');
    });

    it('prints typed text as a shell does, through the engine', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessors([new CliEchoCommandProcessor()]);
        expect((await harness.execute('echo "a" "b"')).output).toBe('a b');
        expect((await harness.execute('echo "x --y"')).output).toBe('x --y');
        expect((await harness.execute('echo "one\\ntwo"')).output).toBe('one\ntwo');
    });
});

describe('echo with flag-like words and variables', () => {
    it('prints flag-like words instead of dropping them', async () => {
        const harness = new CliTestHarness();
        harness.registerProcessors([new CliEchoCommandProcessor()]);
        expect((await harness.execute('echo hello --world')).output).toBe('hello --world');
        expect((await harness.execute('echo -n -e "a\\tb"')).output).toBe('a\tb');
        expect((await harness.execute('print -x y')).output).toBe('-x y');
    });
});
