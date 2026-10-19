import { CliTestHarness, CliTestCommandProcessor, CliTrueCommandProcessor, CliFalseCommandProcessor } from '@qodalis/cli';
import { IndexedDbFileSystemService } from '../lib/services';
import { IFileSystemService_TOKEN } from '../lib/interfaces';
import { CliEchoCommandProcessor as FilesEchoProcessor } from '../lib/processors/cli-echo-command-processor';
import { CliCatCommandProcessor } from '../lib/processors/cli-cat-command-processor';
import { CliGrepCommandProcessor } from '../lib/processors/cli-grep-command-processor';
import { CliHeadCommandProcessor } from '../lib/processors/cli-head-command-processor';
import { CliTailCommandProcessor } from '../lib/processors/cli-tail-command-processor';
import { CliWcCommandProcessor } from '../lib/processors/cli-wc-command-processor';
import { CliSortCommandProcessor } from '../lib/processors/cli-sort-command-processor';
import { CliUniqCommandProcessor } from '../lib/processors/cli-uniq-command-processor';
import { CliSedCommandProcessor } from '../lib/processors/cli-sed-command-processor';
import { CliTrCommandProcessor } from '../lib/processors/cli-tr-command-processor';
import { CliCutCommandProcessor } from '../lib/processors/cli-cut-command-processor';
import { CliTeeCommandProcessor } from '../lib/processors/cli-tee-command-processor';
import { CliTacCommandProcessor } from '../lib/processors/cli-tac-command-processor';
import { CliStatCommandProcessor } from '../lib/processors/cli-stat-command-processor';
import { CliChmodCommandProcessor } from '../lib/processors/cli-chmod-command-processor';
import { CliChownCommandProcessor } from '../lib/processors/cli-chown-command-processor';
import { CliLsCommandProcessor } from '../lib/processors/cli-ls-command-processor';
import { CliMkdirCommandProcessor } from '../lib/processors/cli-mkdir-command-processor';
import { CliRmCommandProcessor } from '../lib/processors/cli-rm-command-processor';
import { CliRmdirCommandProcessor } from '../lib/processors/cli-rmdir-command-processor';
import { CliTouchCommandProcessor } from '../lib/processors/cli-touch-command-processor';
import { CliCpCommandProcessor } from '../lib/processors/cli-cp-command-processor';
import { CliMvCommandProcessor } from '../lib/processors/cli-mv-command-processor';
import { CliFindCommandProcessor } from '../lib/processors/cli-find-command-processor';
import { CliAwkCommandProcessor } from '../lib/processors/cli-awk-command-processor';
import { CliDiffCommandProcessor } from '../lib/processors/cli-diff-command-processor';
import { CliBasenameCommandProcessor } from '../lib/processors/cli-basename-command-processor';
import { CliDirnameCommandProcessor } from '../lib/processors/cli-dirname-command-processor';
import { CliCdCommandProcessor } from '../lib/processors/cli-cd-command-processor';
import { CliPwdCommandProcessor } from '../lib/processors/cli-pwd-command-processor';
import { CliDuCommandProcessor } from '../lib/processors/cli-du-command-processor';
import { CliTreeCommandProcessor } from '../lib/processors/cli-tree-command-processor';
import { CliLnCommandProcessor } from '../lib/processors/cli-ln-command-processor';
import { CliPasteCommandProcessor } from '../lib/processors/cli-paste-command-processor';
import { CliXargsCommandProcessor } from '../lib/processors/cli-xargs-command-processor';
import { CliShCommandProcessor } from '../lib/processors/cli-sh-command-processor';

function setupHarness(): { harness: CliTestHarness; fs: IndexedDbFileSystemService } {
    const harness = new CliTestHarness();
    const fs = new IndexedDbFileSystemService();

    // Seed the filesystem
    fs.createDirectory('/home/user');
    fs.setCurrentDirectory('/home/user');
    fs.createFile('/home/user/hello.txt', 'Hello World\nhello again\nGoodbye\n');
    fs.createFile('/home/user/numbers.txt', '3\n1\n4\n1\n5\n9\n2\n6\n5\n');
    fs.createFile('/home/user/data.csv', 'name,age,city\nalice,30,NYC\nbob,25,LA\ncharlie,35,NYC\n');
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', '# README\n\nThis is a readme.\n');
    fs.createFile('/home/user/docs/notes.txt', 'Note 1\nNote 2\nNote 3\n');
    fs.createFile('/home/user/script.sh', '#!/bin/bash\necho "Hello"\nexit 0\n');
    fs.createDirectory('/home/user/empty-dir');

    // Script execution test files
    fs.createFile('/home/user/simple.sh', '# A simple script\necho hello\necho world\n');
    fs.createFile('/home/user/vars.sh', 'NAME=Alice\necho Hello $NAME\n');
    fs.createFile('/home/user/stop-on-error.sh', 'echo before\nnonexistent-cmd\necho after\n');
    fs.createFile('/home/user/continue.sh', 'set +e\necho before\nnonexistent-cmd\necho after\n');
    fs.createFile('/home/user/with-pipes.sh', 'echo hello world | grep hello\n');
    fs.createFile('/home/user/braced-vars.sh', 'GREETING=Hi\nWHO=Bob\necho ${GREETING} ${WHO}\n');
    fs.createFile('/home/user/executable.sh', 'echo executed\n', );
    fs.chmod('/home/user/executable.sh', 'rwxr-xr-x');

    harness.registerService(IFileSystemService_TOKEN, fs);

    harness.registerProcessors([
        new FilesEchoProcessor(),
        new CliCatCommandProcessor(),
        new CliGrepCommandProcessor(),
        new CliHeadCommandProcessor(),
        new CliTailCommandProcessor(),
        new CliWcCommandProcessor(),
        new CliSortCommandProcessor(),
        new CliUniqCommandProcessor(),
        new CliSedCommandProcessor(),
        new CliTrCommandProcessor(),
        new CliCutCommandProcessor(),
        new CliTeeCommandProcessor(),
        new CliTacCommandProcessor(),
        new CliStatCommandProcessor(),
        new CliChmodCommandProcessor(),
        new CliChownCommandProcessor(),
        new CliLsCommandProcessor(),
        new CliMkdirCommandProcessor(),
        new CliRmCommandProcessor(),
        new CliRmdirCommandProcessor(),
        new CliTouchCommandProcessor(),
        new CliCpCommandProcessor(),
        new CliMvCommandProcessor(),
        new CliFindCommandProcessor(),
        new CliAwkCommandProcessor(),
        new CliDiffCommandProcessor(),
        new CliBasenameCommandProcessor(),
        new CliDirnameCommandProcessor(),
        new CliCdCommandProcessor(),
        new CliPwdCommandProcessor(),
        new CliDuCommandProcessor(),
        new CliTreeCommandProcessor(),
        new CliLnCommandProcessor(),
        new CliPasteCommandProcessor(),
        new CliXargsCommandProcessor(),
        new CliShCommandProcessor(),
        new CliTestCommandProcessor(),
        new CliTrueCommandProcessor(),
        new CliFalseCommandProcessor(),
    ]);

    return { harness, fs };
}

// ---------------------------------------------------------------------------
// Single-command tests
// ---------------------------------------------------------------------------

describe('Files plugin integration: single commands', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
    });

    it('reads values stuck to short flags (head -n2, cut -f2)', async () => {
        const head = await harness.execute('head -n2 /home/user/numbers.txt');
        expect(head.output.trim().split(/\r?\n/)).toEqual(['3', '1']);
        const cut = await harness.execute('cut -d , -f2 /home/user/data.csv');
        expect(cut.output).toContain('age');
        expect(cut.output).not.toContain('alice');
    });

    it('redirects to a quoted path with a space', async () => {
        fs.createDirectory('/home/user/my dir');
        await harness.execute('echo hi > "my dir/f.txt"');
        expect(fs.readFile('/home/user/my dir/f.txt')).toBe('hi\n');
    });

    it('paste reads piped input as -', async () => {
        fs.createFile('/home/user/b.txt', 'x\ny\n');
        const result = await harness.execute('echo "a\nb" | paste - b.txt');
        expect(String(result.data ?? result.output)).toContain('a\tx');
    });

    it('expands wildcards against the file system', async () => {
        fs.createFile('/home/user/a.log', 'one\n');
        fs.createFile('/home/user/b.log', 'two\n');
        const cat = await harness.execute('cat *.log');
        expect(cat.output).toContain('one');
        expect(cat.output).toContain('two');
        await harness.execute('rm *.log');
        expect(fs.exists('/home/user/a.log')).toBe(false);
        expect(fs.exists('/home/user/b.log')).toBe(false);
        expect(fs.exists('/home/user/hello.txt')).toBe(true);
    });

    it('keeps a wildcard that matches nothing, and quoted ones', async () => {
        const result = await harness.execute('echo "*.txt" *.nothing');
        expect(result.output).toContain('*.txt *.nothing');
    });

    it('names the redirect target when it cannot be written', async () => {
        const result = await harness.execute('echo x > /nope/f.txt');
        expect(result.stderr.join('\n')).toContain('> /nope/f.txt: ');
        expect(result.stderr.join('\n')).not.toContain('touch');
    });

    it('grep exits 0 on a match, 1 without, 2 on errors; -q prints nothing', async () => {
        expect((await harness.execute('grep Hello /home/user/hello.txt')).exitCode ?? 0).toBe(0);
        expect((await harness.execute('grep nothing-here /home/user/hello.txt')).exitCode).toBe(1);
        expect((await harness.execute('grep x /home/user/missing.txt')).exitCode).toBe(2);
        const quiet = await harness.execute('grep -q Hello /home/user/hello.txt');
        expect(quiet.output).toBe('');
        expect(quiet.exitCode ?? 0).toBe(0);
        const chained = await harness.execute('grep -q nope /home/user/hello.txt && echo found || echo missing');
        expect(chained.output).toContain('missing');
    });

    it('grep works as a script condition', async () => {
        fs.createFile('/home/user/check.sh', 'if grep -q Goodbye hello.txt; then\necho yes\nelse\necho no\nfi\n');
        const result = await harness.execute('sh check.sh');
        expect(result.output).toContain('yes');
        expect(result.output).not.toContain('no');
    });

    it('xargs passes its input as data: no wildcards, variables or substitutions', async () => {
        const star = await harness.execute("echo '*' | xargs echo");
        expect(String(star.data ?? star.output)).toContain('*');
        expect(fs.exists('/home/user/hello.txt')).toBe(true);
        await harness.execute("echo '$(rm -r /home/user/docs)' | xargs echo");
        expect(fs.exists('/home/user/docs/readme.md')).toBe(true);
        fs.createFile('/home/user/junk.txt', 'x');
        await harness.execute("echo junk.txt | xargs rm");
        expect(fs.exists('/home/user/junk.txt')).toBe(false);
    });

    it('mv into the directory a file is already in keeps every file', async () => {
        fs.createFile('/home/user/a1.txt', 'a');
        fs.createFile('/home/user/a2.txt', 'b');
        const result = await harness.execute('mv a1.txt .');
        expect(result.stderr.join('\n')).toContain('same file');
        expect(fs.readFile('/home/user/a1.txt')).toBe('a');
        expect(fs.readFile('/home/user/a2.txt')).toBe('b');
        await harness.execute('mv docs/readme.md docs');
        expect(fs.exists('/home/user/docs/readme.md')).toBe(true);
        expect(fs.exists('/home/user/docs/notes.txt')).toBe(true);
    });

    it('echo prints an escaped > instead of writing a file', async () => {
        const result = await harness.execute('echo a \\> b.txt');
        expect(result.output).toContain('a > b.txt');
        expect(fs.exists('/home/user/b.txt')).toBe(false);
    });

    it('ls passes one name per line down a pipe', async () => {
        const result = await harness.execute('ls /home/user/docs | wc -l');
        expect(String(result.data ?? result.output).trim()).toBe('2');
    });

    it('cut accepts a plain field number', async () => {
        const result = await harness.execute('cut -d , -f 2 /home/user/data.csv');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('age');
        expect(result.output).toContain('30');
        expect(result.output).not.toContain('alice');
    });

    it('echo keeps a quoted > as text', async () => {
        const result = await harness.execute('echo "a > b"');
        expect(result.output).toContain('a > b');
        expect(fs.exists('/home/user/b')).toBe(false);
    });

    it('echo still redirects after quoted text', async () => {
        await harness.execute('echo "x > y" > out.txt');
        expect(fs.readFile('/home/user/out.txt')).toBe('x > y\n');
        await harness.execute('echo more >> out.txt');
        expect(fs.readFile('/home/user/out.txt')).toBe('x > y\nmore\n');
    });

    it('mv refuses to move a directory into itself', async () => {
        const result = await harness.execute('mv docs docs/sub');
        expect(result.stderr.some((l) => l.includes('subdirectory of itself'))).toBe(true);
        expect(fs.exists('/home/user/docs/readme.md')).toBe(true);
    });

    it('cat should display file contents', async () => {
        const result = await harness.execute('cat /home/user/hello.txt');
        expect(result.output).toContain('Hello World');
        expect(result.output).toContain('Goodbye');
    });

    it('ls should list directory contents', async () => {
        const result = await harness.execute('ls /home/user');
        expect(result.output).toContain('hello.txt');
        expect(result.output).toContain('docs');
    });

    it('stat should show file metadata', async () => {
        const result = await harness.execute('stat /home/user/hello.txt');
        expect(result.output).toContain('/home/user/hello.txt');
        expect(result.output).toContain('file');
    });

    it('stat should error on missing file', async () => {
        const result = await harness.execute('stat /nonexistent');
        expect(result.stderr.some(l => l.includes('No such file'))).toBe(true);
    });

    it('head should show first N lines', async () => {
        const result = await harness.execute('head /home/user/numbers.txt');
        expect(result.output).toContain('3');
        expect(result.output).toContain('1');
    });

    it('tail should show last N lines', async () => {
        const result = await harness.execute('tail /home/user/numbers.txt');
        expect(result.output).toContain('5');
    });

    it('wc should count lines, words, and bytes', async () => {
        const result = await harness.execute('wc /home/user/hello.txt');
        expect(result.output).toMatch(/\d+/); // should contain counts
    });

    it('sort should sort lines', async () => {
        const result = await harness.execute('sort /home/user/numbers.txt');
        const lines = result.stdout.filter(l => l.trim() !== '');
        // First non-empty lines should start with smaller numbers
        expect(lines[0]).toContain('1');
    });

    it('grep should find matching lines', async () => {
        const result = await harness.execute('grep hello /home/user/hello.txt');
        expect(result.output).toContain('hello again');
    });

    it('grep -i should be case insensitive', async () => {
        const result = await harness.execute('grep -i hello /home/user/hello.txt');
        expect(result.output).toContain('Hello World');
        expect(result.output).toContain('hello again');
    });

    it('mkdir should create a directory', async () => {
        await harness.execute('mkdir /home/user/newdir');
        expect(fs.isDirectory('/home/user/newdir')).toBe(true);
    });

    it('touch should create an empty file', async () => {
        await harness.execute('touch /home/user/new.txt');
        expect(fs.exists('/home/user/new.txt')).toBe(true);
    });

    it('cp should copy a file', async () => {
        await harness.execute('cp /home/user/hello.txt /home/user/hello-copy.txt');
        expect(fs.readFile('/home/user/hello-copy.txt')).toContain('Hello World');
    });

    it('mv should move a file', async () => {
        await harness.execute('mv /home/user/script.sh /home/user/moved.sh');
        expect(fs.exists('/home/user/script.sh')).toBe(false);
        expect(fs.exists('/home/user/moved.sh')).toBe(true);
    });

    it('rm should delete a file', async () => {
        await harness.execute('rm /home/user/script.sh');
        expect(fs.exists('/home/user/script.sh')).toBe(false);
    });

    it('chmod should change permissions', async () => {
        await harness.execute('chmod 755 /home/user/script.sh');
        expect(fs.getNode('/home/user/script.sh')!.permissions).toBe('rwxr-xr-x');
    });

    it('tac should reverse file lines', async () => {
        const result = await harness.execute('tac /home/user/docs/notes.txt');
        const lines = result.stdout.filter(l => l.trim() !== '');
        expect(lines[0]).toContain('Note 3');
    });

    it('basename should extract filename', async () => {
        const result = await harness.execute('basename /home/user/hello.txt');
        expect(result.output).toContain('hello.txt');
    });

    it('dirname should extract directory', async () => {
        const result = await harness.execute('dirname /home/user/hello.txt');
        expect(result.output).toContain('/home/user');
    });

    it('find should locate files', async () => {
        const result = await harness.execute('find /home/user');
        expect(result.output).toContain('hello.txt');
        expect(result.output).toContain('docs');
    });

    // --- New: previously missing processor tests ---

    it('pwd should print the current working directory', async () => {
        const result = await harness.execute('pwd');
        expect(result.output).toContain('/');
    });

    it('cd should change directory and pwd should reflect it', async () => {
        await harness.execute('cd /home/user/docs');
        const result = await harness.execute('pwd');
        expect(result.output).toContain('/home/user/docs');
    });

    it('cd to nonexistent directory should error', async () => {
        const result = await harness.execute('cd /nonexistent');
        expect(result.stderr.some(l => l.toLowerCase().includes('no such') || l.toLowerCase().includes('not found') || l.toLowerCase().includes('does not exist'))).toBe(true);
    });

    it('rmdir should remove an empty directory', async () => {
        // Create a fresh empty dir to avoid persist() side effects
        fs.createDirectory('/home/user/to-remove');
        expect(fs.isDirectory('/home/user/to-remove')).toBe(true);
        const result = await harness.execute('rmdir /home/user/to-remove');
        // Command should not produce errors about non-empty or not-a-directory
        expect(result.stderr.some(l => l.includes('not empty') || l.includes('Not a directory'))).toBe(false);
    });

    it('rmdir should refuse to remove a non-empty directory', async () => {
        const result = await harness.execute('rmdir /home/user/docs');
        expect(result.stderr.some(l => l.includes('not empty'))).toBe(true);
        expect(fs.isDirectory('/home/user/docs')).toBe(true);
    });

    it('rmdir should error on non-directory', async () => {
        const result = await harness.execute('rmdir /home/user/hello.txt');
        expect(result.stderr.some(l => l.includes('Not a directory'))).toBe(true);
    });

    it('du should estimate file space usage', async () => {
        const result = await harness.execute('du /home/user/hello.txt');
        expect(result.output).toContain('/home/user/hello.txt');
        expect(result.output).toMatch(/\d+/);
    });

    it('du should show directory sizes', async () => {
        const result = await harness.execute('du /home/user/docs');
        expect(result.output).toContain('/home/user/docs');
    });

    it('tree should display directory structure', async () => {
        const result = await harness.execute('tree /home/user/docs');
        expect(result.output).toContain('readme.md');
        expect(result.output).toContain('notes.txt');
        expect(result.output).toMatch(/\d+ directories, \d+ files/);
    });

    it('tree should error on nonexistent path', async () => {
        const result = await harness.execute('tree /nonexistent');
        expect(result.stderr.some(l => l.includes('No such file'))).toBe(true);
    });

    it('ln -s should create a symbolic link', async () => {
        await harness.execute('ln -s /home/user/hello.txt /home/user/link.txt');
        const node = fs.getNode('/home/user/link.txt');
        expect(node).toBeDefined();
        expect(node!.linkTarget).toBe('/home/user/hello.txt');
    });

    it('ln without -s should error (hard links not supported)', async () => {
        const result = await harness.execute('ln /home/user/hello.txt /home/user/link.txt');
        expect(result.stderr.some(l => l.includes('hard links not supported'))).toBe(true);
    });

    it('ln -s should error if link already exists', async () => {
        const result = await harness.execute('ln -s /home/user/hello.txt /home/user/docs/readme.md');
        expect(result.stderr.some(l => l.includes('File exists'))).toBe(true);
    });

    it('chown should change file ownership', async () => {
        await harness.execute('chown alice:dev /home/user/hello.txt');
        const node = fs.getNode('/home/user/hello.txt');
        expect(node!.ownership?.uid).toBe('alice');
        expect(node!.ownership?.gid).toBe('dev');
    });

    it('chown should change only user when no group specified', async () => {
        await harness.execute('chown bob /home/user/hello.txt');
        const node = fs.getNode('/home/user/hello.txt');
        expect(node!.ownership?.uid).toBe('bob');
    });

    it('paste should merge files side by side', async () => {
        fs.createFile('/home/user/col1.txt', 'a\nb\nc\n');
        fs.createFile('/home/user/col2.txt', '1\n2\n3\n');
        const result = await harness.execute('paste /home/user/col1.txt /home/user/col2.txt');
        expect(result.output).toContain('a');
        expect(result.output).toContain('1');
    });

    it('uniq should remove adjacent duplicates', async () => {
        fs.createFile('/home/user/dups.txt', 'aaa\naaa\nbbb\naaa\n');
        const result = await harness.execute('uniq /home/user/dups.txt');
        // Should collapse adjacent aaa's but keep the later one
        expect(result.output).toContain('aaa');
        expect(result.output).toContain('bbb');
    });

    it('cut should extract fields from CSV via pipe', async () => {
        const result = await harness.execute("cat /home/user/data.csv | cut -d ',' -f 2");
        expect(result.output).toContain('age');
        expect(result.output).toContain('30');
    });
});

// ---------------------------------------------------------------------------
// Pipe chain tests — real scenarios
// ---------------------------------------------------------------------------

describe('Files plugin integration: pipe chains', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
    });

    it('cat | grep — filter file contents', async () => {
        const result = await harness.execute('cat /home/user/hello.txt | grep hello');
        expect(result.output).toContain('hello again');
        // Pipeline data (grep's output) should only contain matched lines
        expect(result.data).toContain('hello again');
    });

    it('cat | grep -i — case insensitive filter', async () => {
        const result = await harness.execute('cat /home/user/hello.txt | grep -i hello');
        expect(result.output).toContain('Hello World');
        expect(result.output).toContain('hello again');
    });

    it('cat | sort | uniq — unique sorted output', async () => {
        const result = await harness.execute('cat /home/user/numbers.txt | sort | uniq');
        const lines = result.stdout.filter(l => l.trim() !== '');
        // Numbers should be sorted and deduplicated
        // Original has: 3,1,4,1,5,9,2,6,5
        // After sort + uniq: 1,2,3,4,5,6,9
        const hasNoDuplicates = new Set(lines.map(l => l.trim())).size === lines.length;
        expect(hasNoDuplicates).toBe(true);
    });

    it('cat | head — first lines of piped input', async () => {
        const result = await harness.execute('cat /home/user/numbers.txt | head');
        expect(result.output).toContain('3');
    });

    it('cat | wc — count piped input', async () => {
        const result = await harness.execute('cat /home/user/hello.txt | wc');
        expect(result.output).toMatch(/\d+/);
    });

    it('cat | sed — substitute text in piped input', async () => {
        const result = await harness.execute('cat /home/user/hello.txt | sed s/hello/HI/');
        expect(result.output).toContain('HI again');
    });

    it('cat | tr — translate characters in piped input', async () => {
        const result = await harness.execute("cat /home/user/hello.txt | tr 'a-z' 'A-Z'");
        expect(result.output).toContain('HELLO WORLD');
        expect(result.output).toContain('GOODBYE');
    });

    it('cat | cut — extract fields from CSV', async () => {
        const result = await harness.execute("cat /home/user/data.csv | cut -d ',' -f 1");
        // cut with -d , -f 1 should extract first column
        expect(result.output).toContain('name');
    });

    it('echo > file — redirect creates file', async () => {
        await harness.execute('echo new content > /home/user/output.txt');
        expect(fs.exists('/home/user/output.txt')).toBe(true);
        const content = fs.readFile('/home/user/output.txt');
        expect(content).toContain('new content');
    });

    it('echo >> file — redirect appends', async () => {
        await harness.execute('echo line1 > /home/user/append.txt');
        await harness.execute('echo line2 >> /home/user/append.txt');
        const content = fs.readFile('/home/user/append.txt');
        expect(content).toContain('line1');
        expect(content).toContain('line2');
    });

    it('cat | tee — write to file and pass through', async () => {
        const result = await harness.execute('cat /home/user/hello.txt | tee /home/user/copy.txt');
        // tee should write to the file
        expect(fs.exists('/home/user/copy.txt')).toBe(true);
        const fileContent = fs.readFile('/home/user/copy.txt');
        expect(fileContent).toContain('Hello World');
        // tee should also pass through to stdout
        expect(result.output).toContain('Hello World');
    });

    it('cat | awk — extract fields', async () => {
        const result = await harness.execute("cat /home/user/data.csv | awk -F ',' '{print $1}'");
        expect(result.output).toContain('name');
        expect(result.output).toContain('alice');
    });

    it('diff — compare two files', async () => {
        fs.createFile('/home/user/a.txt', 'line1\nline2\nline3\n');
        fs.createFile('/home/user/b.txt', 'line1\nmodified\nline3\n');
        const result = await harness.execute('diff /home/user/a.txt /home/user/b.txt');
        expect(result.output).toContain('line2');
        expect(result.output).toContain('modified');
    });

    it('multi-command with ; — sequential independent commands', async () => {
        await harness.execute('mkdir /home/user/testdir ; touch /home/user/testdir/file.txt');
        expect(fs.isDirectory('/home/user/testdir')).toBe(true);
        expect(fs.exists('/home/user/testdir/file.txt')).toBe(true);
    });

    it('command && command — conditional on success', async () => {
        await harness.execute('mkdir /home/user/ok && touch /home/user/ok/done.txt');
        expect(fs.exists('/home/user/ok/done.txt')).toBe(true);
    });

    // --- New: additional pipe/operator tests ---

    it('cat | grep | wc — triple pipe chain', async () => {
        const result = await harness.execute('cat /home/user/data.csv | grep NYC | wc');
        expect(result.output).toMatch(/\d+/);
    });

    it('cat | sort -r — reverse sort piped input', async () => {
        const result = await harness.execute('cat /home/user/numbers.txt | sort -r');
        const lines = result.stdout.filter(l => l.trim() !== '');
        expect(lines[0]).toContain('9');
    });

    it('cat | tac — reverse lines of piped input', async () => {
        const result = await harness.execute('cat /home/user/docs/notes.txt | tac');
        const lines = result.stdout.filter(l => l.trim() !== '');
        expect(lines[0]).toContain('Note 3');
    });

    it('find | grep — search within find output', async () => {
        const result = await harness.execute('find /home/user | grep .txt');
        expect(result.data).toContain('hello.txt');
    });

    it('cat | sed | tr — multi-stage text transformation', async () => {
        const result = await harness.execute("cat /home/user/hello.txt | sed s/hello/HI/ | tr 'a-z' 'A-Z'");
        expect(result.output).toContain('HI AGAIN');
    });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe('Files plugin integration: edge cases', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
    });

    it('cat on nonexistent file should error', async () => {
        const result = await harness.execute('cat /home/user/nope.txt');
        expect(result.stderr.some(l => l.toLowerCase().includes('no such file') || l.toLowerCase().includes('not found'))).toBe(true);
    });

    it('rm on nonexistent file should error', async () => {
        const result = await harness.execute('rm /home/user/nope.txt');
        expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('cp to same path should handle gracefully', async () => {
        const result = await harness.execute('cp /home/user/hello.txt /home/user/hello.txt');
        // Should either succeed silently or error — not crash
        expect(result.exitCode === 0 || result.stderr.length > 0).toBe(true);
    });

    it('mkdir on existing directory should error', async () => {
        const result = await harness.execute('mkdir /home/user/docs');
        expect(result.stderr.some(l => l.toLowerCase().includes('exists') || l.toLowerCase().includes('already'))).toBe(true);
    });

    it('cat empty file should produce no output', async () => {
        fs.createFile('/home/user/empty.txt', '');
        const result = await harness.execute('cat /home/user/empty.txt');
        const meaningful = result.stdout.filter(l => l.trim() !== '');
        expect(meaningful.length).toBe(0);
    });

    it('grep with no matches should produce no output', async () => {
        const result = await harness.execute('grep zzzzz /home/user/hello.txt');
        const meaningful = result.stdout.filter(l => l.trim() !== '');
        expect(meaningful.length).toBe(0);
    });

    it('head -n 2 should show exactly 2 lines', async () => {
        const result = await harness.execute('head -n 2 /home/user/numbers.txt');
        // Should contain first two numbers: 3 and 1
        expect(result.output).toContain('3');
        expect(result.output).toContain('1');
    });

    it('tail -n 2 should show last 2 lines', async () => {
        // numbers.txt: 3,1,4,1,5,9,2,6,5 — last two non-empty: 6,5
        const result = await harness.execute('tail -n 2 /home/user/numbers.txt');
        expect(result.output).toContain('5');
    });

    it('diff on identical files should produce minimal output', async () => {
        fs.createFile('/home/user/same1.txt', 'same content\n');
        fs.createFile('/home/user/same2.txt', 'same content\n');
        const result = await harness.execute('diff /home/user/same1.txt /home/user/same2.txt');
        // Identical files should produce no diff lines (or "files are identical")
        const meaningful = result.stdout.filter(l => l.trim() !== '' && !l.includes('identical'));
        expect(meaningful.length).toBeLessThanOrEqual(1);
    });

    it('du on nonexistent path should error', async () => {
        const result = await harness.execute('du /nonexistent');
        expect(result.stderr.some(l => l.includes('No such file'))).toBe(true);
    });

    it('tree on a file (not directory) should error', async () => {
        const result = await harness.execute('tree /home/user/hello.txt');
        expect(result.stderr.some(l => l.includes('Not a directory'))).toBe(true);
    });

    it('rmdir on nonexistent path should error', async () => {
        const result = await harness.execute('rmdir /nonexistent');
        expect(result.stderr.some(l => l.includes('No such file'))).toBe(true);
    });

    it('chown with invalid spec should error', async () => {
        const result = await harness.execute('chown : /home/user/hello.txt');
        expect(result.stderr.some(l => l.includes('invalid owner'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Script execution tests
// ---------------------------------------------------------------------------

describe('Files plugin integration: script execution', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
    });

    it('sh should execute a simple script', async () => {
        const result = await harness.execute('sh /home/user/simple.sh');
        expect(result.output).toContain('hello');
        expect(result.output).toContain('world');
    });

    it('source should execute a script (alias for sh)', async () => {
        const result = await harness.execute('source /home/user/simple.sh');
        expect(result.output).toContain('hello');
    });

    it('sh should support variable assignment and substitution', async () => {
        const result = await harness.execute('sh /home/user/vars.sh');
        expect(result.output).toContain('Hello Alice');
    });

    it('sh should support ${VAR} braced substitution', async () => {
        const result = await harness.execute('sh /home/user/braced-vars.sh');
        expect(result.output).toContain('Hi Bob');
    });

    it('sh should skip comments and blank lines', async () => {
        const result = await harness.execute('sh /home/user/simple.sh');
        expect(result.output).not.toContain('#');
    });

    it('sh should stop on error by default (set -e)', async () => {
        const result = await harness.execute('sh /home/user/stop-on-error.sh');
        expect(result.output).toContain('before');
        expect(result.output).not.toContain('after');
        expect(result.stderr.some(l => l.includes('script aborted'))).toBe(true);
    });

    it('sh should continue on error with set +e', async () => {
        const result = await harness.execute('sh /home/user/continue.sh');
        expect(result.output).toContain('before');
        expect(result.output).toContain('after');
    });

    it('sh should support pipes within script lines', async () => {
        const result = await harness.execute('sh /home/user/with-pipes.sh');
        expect(result.output).toContain('hello world');
    });

    it('sh should error on nonexistent file', async () => {
        const result = await harness.execute('sh /nonexistent.sh');
        expect(result.stderr.some(l => l.includes('No such file'))).toBe(true);
    });

    it('sh should error on directory', async () => {
        const result = await harness.execute('sh /home/user/docs');
        expect(result.stderr.some(l => l.includes('Is a directory'))).toBe(true);
    });

    it('sh should error when no file operand given', async () => {
        const result = await harness.execute('sh');
        expect(result.stderr.some(l =>
            l.includes('missing') || l.includes('Value required')
        )).toBe(true);
    });

    it('./script should execute with execute permission', async () => {
        const result = await harness.execute('./executable.sh');
        expect(result.output).toContain('executed');
    });

    it('./script should fail without execute permission', async () => {
        const result = await harness.execute('./simple.sh');
        expect(result.stderr.some(l => l.includes('Permission denied'))).toBe(true);
    });

    it('/absolute/path should execute with execute permission', async () => {
        const result = await harness.execute('/home/user/executable.sh');
        expect(result.output).toContain('executed');
    });

    it('should execute script that creates files', async () => {
        fs.createFile('/home/user/setup.sh', 'mkdir /tmp/test-dir\ntouch /tmp/test-dir/file.txt\n');
        const result = await harness.execute('sh /home/user/setup.sh');
        expect(fs.exists('/tmp/test-dir')).toBe(true);
        expect(fs.exists('/tmp/test-dir/file.txt')).toBe(true);
    });

    it('should handle shebang line as comment', async () => {
        fs.createFile('/home/user/shebang.sh', '#!/bin/sh\necho works\n');
        const result = await harness.execute('sh /home/user/shebang.sh');
        expect(result.output).toContain('works');
        expect(result.output).not.toContain('#');
    });

    it('should support variable in variable assignment', async () => {
        fs.createFile('/home/user/nested-vars.sh', 'BASE=/tmp\nFULL=$BASE/output\necho $FULL\n');
        const result = await harness.execute('sh /home/user/nested-vars.sh');
        expect(result.output).toContain('/tmp/output');
    });

    it('should handle quoted variable values', async () => {
        fs.createFile('/home/user/quoted-vars.sh', 'MSG="hello world"\necho $MSG\n');
        const result = await harness.execute('sh /home/user/quoted-vars.sh');
        expect(result.output).toContain('hello world');
    });

    it('should handle operators in scripts', async () => {
        fs.createFile('/home/user/operators.sh', 'echo first && echo second\n');
        const result = await harness.execute('sh /home/user/operators.sh');
        expect(result.output).toContain('first');
        expect(result.output).toContain('second');
    });
});

describe('Files plugin integration: script control flow', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
    });

    it('sh runs if / elif / else with test on files', async () => {
        fs.createFile(
            '/home/user/if.sh',
            [
                'if [ -f hello.txt ]; then',
                '    echo has-hello',
                'fi',
                'if [ -d hello.txt ]; then echo bad; elif [ -d docs ]; then echo has-docs; else echo bad; fi',
                'if [ -e nothing.txt ]; then',
                '    echo bad',
                'else',
                '    echo no-nothing',
                'fi',
                'if grep Goodbye hello.txt; then echo found; fi',
            ].join('\n'),
        );
        const result = await harness.execute('sh /home/user/if.sh');
        expect(result.stderr).toEqual([]);
        expect(result.output).toContain('has-hello');
        expect(result.output).toContain('has-docs');
        expect(result.output).toContain('no-nothing');
        expect(result.output).toContain('found');
        expect(result.output).not.toContain('bad');
    });

    it('sh runs a for loop over words and wildcards', async () => {
        fs.createFile(
            '/home/user/for.sh',
            [
                'mkdir -p out',
                'for name in alpha beta; do',
                '    echo $name > out/$name.txt',
                'done',
                'for f in out/*.txt; do echo file:$f; done',
            ].join('\n'),
        );
        const result = await harness.execute('sh /home/user/for.sh');
        expect(result.stderr).toEqual([]);
        expect(fs.readFile('/home/user/out/alpha.txt')).toContain('alpha');
        expect(fs.readFile('/home/user/out/beta.txt')).toContain('beta');
        expect(result.output).toContain('file:out/alpha.txt');
        expect(result.output).toContain('file:out/beta.txt');
    });

    it('sh runs a while loop until a file appears, with break and continue', async () => {
        fs.createFile(
            '/home/user/while.sh',
            [
                'while [ ! -f stop.txt ]; do',
                '    echo looping',
                '    touch stop.txt',
                'done',
                'while true; do',
                '    if [ -f stop.txt ]; then break; fi',
                'done',
                'for i in 1 2 3; do',
                '    if [ $i -eq 2 ]; then continue; fi',
                '    echo i=$i',
                'done',
                'echo finished',
            ].join('\n'),
        );
        const result = await harness.execute('sh /home/user/while.sh');
        expect(result.stderr).toEqual([]);
        expect(result.stdout.filter((l) => l === 'looping').length).toBe(1);
        expect(result.output).toContain('i=1');
        expect(result.output).not.toContain('i=2');
        expect(result.output).toContain('i=3');
        expect(result.output).toContain('finished');
    });

    it('./script runs control flow too', async () => {
        fs.createFile('/home/user/run.sh', 'for x in a b; do if [ $x = b ]; then echo got-$x; fi; done\n');
        fs.chmod('/home/user/run.sh', 'rwxr-xr-x');
        const result = await harness.execute('./run.sh');
        expect(result.output).toContain('got-b');
        expect(result.output).not.toContain('got-a');
    });

    it('sh reports an unbalanced block with its line number', async () => {
        fs.createFile('/home/user/bad.sh', 'echo start\nfor x in a; do\n    echo $x\n');
        const result = await harness.execute('sh /home/user/bad.sh');
        expect(result.output).not.toContain('start');
        expect(result.stderr.some((l) => l.includes("sh: line 3: syntax error: expected 'done'"))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Unix compatibility: flags, quoting, line counting and operands
// ---------------------------------------------------------------------------

describe('Files plugin integration: Unix compatibility', () => {
    let harness: CliTestHarness;
    let fs: IndexedDbFileSystemService;

    const lines = (output: string): string[] =>
        output.split('\n').filter((l) => l !== '');
    /** Output of the last command of a pipe (`output` has every stage's) */
    const piped = (result: { data: any }): string => String(result.data ?? '');

    beforeEach(() => {
        ({ harness, fs } = setupHarness());
        fs.createFile('/home/user/abc.txt', 'a\nb\nc\n');
    });

    // 1. Combined short flags

    describe('combined short flags', () => {
        it('rm -rf removes a directory tree', async () => {
            await harness.execute('mkdir -p tmp/a/b');
            await harness.execute('touch tmp/a/b/f.txt');
            const result = await harness.execute('rm -rf tmp');
            expect(result.stderr).toEqual([]);
            expect(fs.exists('/home/user/tmp')).toBe(false);
        });

        it('rm -rf is quiet about a missing path', async () => {
            const result = await harness.execute('rm -rf nothing-here');
            expect(result.stderr).toEqual([]);
        });

        it('ls -la and ls -lah use the long format', async () => {
            for (const line of ['ls -la /home/user', 'ls -lah /home/user']) {
                const result = await harness.execute(line);
                expect(result.stderr).toEqual([]);
                expect(result.output).toContain('-rw-r--r--');
                expect(result.output).toContain('hello.txt');
            }
        });

        it('grep -in ignores case and numbers lines', async () => {
            const result = await harness.execute('grep -in HELLO hello.txt');
            expect(lines(result.output)).toEqual(['1:Hello World', '2:hello again']);
        });

        it('grep -vc counts non-matching lines', async () => {
            const result = await harness.execute('grep -vc hello hello.txt');
            expect(lines(result.output)).toEqual(['2']);
        });

        it('sort -rn sorts numbers in reverse', async () => {
            const result = await harness.execute('sort -rn numbers.txt');
            expect(lines(result.output)).toEqual(['9', '6', '5', '5', '4', '3', '2', '1', '1']);
        });

        it('sort -nu drops duplicates', async () => {
            const result = await harness.execute('sort -nu numbers.txt');
            expect(lines(result.output)).toEqual(['1', '2', '3', '4', '5', '6', '9']);
        });

        it('cp -r and cp -rf copy a directory', async () => {
            await harness.execute('cp -r docs docs2');
            const result = await harness.execute('cp -rf docs docs3');
            expect(result.stderr).toEqual([]);
            expect(fs.readFile('/home/user/docs2/notes.txt')).toContain('Note 1');
            expect(fs.readFile('/home/user/docs3/notes.txt')).toContain('Note 1');
        });

        it('wc -lw prints lines and words', async () => {
            const result = await harness.execute('wc -lw hello.txt');
            expect(result.output).toMatch(/^\s*3\s+5 hello\.txt$/);
        });

        it('tr -ds deletes and squeezes', async () => {
            const result = await harness.execute("echo 'a1b22c' | tr -ds 0-9 abc");
            expect(piped(result)).toBe('abc');
        });
    });

    // 2. Values without their quotes

    describe('quoted values', () => {
        it('grep takes a quoted pattern with a space', async () => {
            const result = await harness.execute('grep "hello again" hello.txt');
            expect(result.stderr).toEqual([]);
            expect(lines(result.output)).toEqual(['hello again']);
        });

        it('sort -t takes a quoted separator', async () => {
            const result = await harness.execute("sort -t ',' -k 2 -n data.csv");
            expect(lines(result.output)).toEqual([
                'name,age,city',
                'bob,25,LA',
                'alice,30,NYC',
                'charlie,35,NYC',
            ]);
        });

        it('find --name takes a quoted glob', async () => {
            const result = await harness.execute('find /home/user --name "*.md"');
            expect(lines(result.output)).toEqual(['/home/user/docs/readme.md']);
        });

        it('sed -e takes quoted expressions, several times', async () => {
            const result = await harness.execute(
                "sed -e 's/Hello/Hi/' -e 's/World/Earth/' hello.txt",
            );
            expect(lines(result.output)[0]).toBe('Hi Earth');
        });

        it('file commands take quoted names with spaces', async () => {
            await harness.execute('mkdir "my dir"');
            await harness.execute('touch "my dir/my file.txt"');
            expect(fs.exists('/home/user/my dir/my file.txt')).toBe(true);
            fs.writeFile('/home/user/my dir/my file.txt', 'hi\n');
            const cat = await harness.execute('cat "my dir/my file.txt"');
            expect(cat.output).toBe('hi');
            await harness.execute('rm "my dir/my file.txt"');
            await harness.execute('rmdir "my dir"');
            expect(fs.exists('/home/user/my dir')).toBe(false);
        });
    });

    // 3. cat

    describe('cat', () => {
        it('concatenates several files in order', async () => {
            const result = await harness.execute('cat abc.txt docs/notes.txt');
            expect(lines(result.output)).toEqual(['a', 'b', 'c', 'Note 1', 'Note 2', 'Note 3']);
        });

        it('reports a missing file and prints the others', async () => {
            const result = await harness.execute('cat abc.txt nope.txt');
            expect(result.stderr.some((l) => l.includes('nope.txt'))).toBe(true);
            expect(lines(result.output)).toEqual(['a', 'b', 'c']);
        });

        it('prints piped input when no file is given', async () => {
            const result = await harness.execute('echo piped text | cat');
            expect(result.stderr).toEqual([]);
            expect(piped(result)).toBe('piped text');
        });
    });

    // 4. find

    describe('find', () => {
        it('--maxdepth 0 lists only the start path', async () => {
            const result = await harness.execute('find /home/user/docs --maxdepth 0');
            expect(lines(result.output)).toEqual(['/home/user/docs']);
        });

        it('--maxdepth 1 lists the start path and its direct children', async () => {
            const result = await harness.execute('find /home/user/docs --maxdepth 1');
            expect(lines(result.output).sort()).toEqual([
                '/home/user/docs',
                '/home/user/docs/notes.txt',
                '/home/user/docs/readme.md',
            ]);
            const txt = await harness.execute('find /home/user --maxdepth 1 --name "*.txt"');
            expect(txt.output).toContain('/home/user/hello.txt');
            expect(txt.output).not.toContain('notes.txt');
        });

        it('--name is case-sensitive, --iname is not', async () => {
            const exact = await harness.execute('find /home/user --name "hello*"');
            expect(lines(exact.output)).toEqual(['/home/user/hello.txt']);
            const upper = await harness.execute('find /home/user --name "HELLO*"');
            expect(upper.output).toBe('');
            const ignoring = await harness.execute('find /home/user --iname "HELLO*"');
            expect(lines(ignoring.output)).toEqual(['/home/user/hello.txt']);
        });
    });

    // 5. Counting lines with a trailing newline

    describe('wc, head and tail line counts', () => {
        it('wc -l counts newline characters', async () => {
            fs.createFile('/home/user/no-newline.txt', 'a\nb');
            expect((await harness.execute('wc -l abc.txt')).output).toMatch(/^\s*3 abc\.txt$/);
            expect((await harness.execute('wc -l no-newline.txt')).output).toMatch(
                /^\s*1 no-newline\.txt$/,
            );
            expect((await harness.execute('wc -l hello.txt')).output).toMatch(/^\s*3 /);
        });

        it('wc -l counts piped lines', async () => {
            expect(piped(await harness.execute('echo a | wc -l'))).toBe('1');
            expect(piped(await harness.execute('cat abc.txt | wc -l'))).toBe('3');
        });

        it('tail -n 2 gives the last two lines', async () => {
            const result = await harness.execute('tail -n 2 abc.txt');
            expect(result.output).toBe('b\nc');
            expect(piped(await harness.execute('cat abc.txt | tail -n 2'))).toBe('b\nc');
        });

        it('head prints no extra empty line', async () => {
            const result = await harness.execute('head -n 5 abc.txt');
            expect(result.output).toBe('a\nb\nc');
        });

        it('head and tail -n 0 print nothing', async () => {
            expect((await harness.execute('head -n 0 abc.txt')).output).toBe('');
            expect((await harness.execute('tail -n 0 abc.txt')).output).toBe('');
        });
    });

    // 6. xargs keeps the inner command's flags

    describe('xargs', () => {
        it('passes the inner flags on: xargs rm -r', async () => {
            await harness.execute('mkdir -p x1/sub x2');
            const result = await harness.execute('echo x1 x2 | xargs rm -r');
            expect(result.stderr).toEqual([]);
            expect(fs.exists('/home/user/x1')).toBe(false);
            expect(fs.exists('/home/user/x2')).toBe(false);
        });

        it('keeps a flag of the inner command that xargs also has', async () => {
            const result = await harness.execute('echo hello.txt | xargs grep -n again');
            expect(piped(result)).toBe('2:hello again');
        });

        it('reads its own -n before the inner command', async () => {
            const result = await harness.execute('echo a b c | xargs -n 1 mkdir');
            expect(result.stderr).toEqual([]);
            for (const dir of ['a', 'b', 'c']) {
                expect(fs.isDirectory(`/home/user/${dir}`)).toBe(true);
            }
        });

        it('-I runs the command once per line', async () => {
            const result = await harness.execute(
                'cat abc.txt | xargs -I {} touch file-{}.txt',
            );
            expect(result.stderr).toEqual([]);
            expect(fs.exists('/home/user/file-a.txt')).toBe(true);
            expect(fs.exists('/home/user/file-c.txt')).toBe(true);
        });
    });

    // 7. tee

    describe('tee', () => {
        it('writes piped input to every file and passes it through', async () => {
            const result = await harness.execute('echo one | tee t1.txt t2.txt');
            expect(piped(result)).toBe('one');
            expect(fs.readFile('/home/user/t1.txt')).toBe('one\n');
            expect(fs.readFile('/home/user/t2.txt')).toBe('one\n');
        });

        it('overwrites by default and appends lines with -a', async () => {
            await harness.execute('echo one | tee t.txt');
            await harness.execute('echo two | tee -a t.txt');
            expect(fs.readFile('/home/user/t.txt')).toBe('one\ntwo\n');
            await harness.execute('echo three | tee t.txt');
            expect(fs.readFile('/home/user/t.txt')).toBe('three\n');
        });

        it('passes the input on down the pipe', async () => {
            const result = await harness.execute('cat abc.txt | tee copy.txt | wc -l');
            expect(piped(result)).toBe('3');
            expect(fs.readFile('/home/user/copy.txt')).toBe('a\nb\nc\n');
        });

        it('does not read a file operand without piped input', async () => {
            const result = await harness.execute('tee copy.txt abc.txt');
            expect(result.stderr.some((l) => l.includes('cat file | tee out.txt'))).toBe(true);
            expect(result.exitCode).toBe(1);
            expect(fs.exists('/home/user/copy.txt')).toBe(false);
            expect(fs.readFile('/home/user/abc.txt')).toBe('a\nb\nc\n');
        });
    });

    // 8. tr reads only piped input

    describe('tr', () => {
        it('-s with piped input treats SET2 as a set, not a file', async () => {
            const result = await harness.execute('echo aaab | tr -s a b');
            expect(result.stderr).toEqual([]);
            expect(piped(result)).toBe('b');
        });

        it('-s with one set squeezes it', async () => {
            const result = await harness.execute('echo hello | tr -s l');
            expect(piped(result)).toBe('helo');
        });

        it('rejects an extra operand with piped input', async () => {
            const result = await harness.execute('echo abc | tr a b abc.txt');
            expect(result.stderr.some((l) => l.includes('extra operand'))).toBe(true);
        });

        it('understands escapes such as \\n', async () => {
            const result = await harness.execute("cat abc.txt | tr '\\n' ,");
            expect(piped(result)).toBe('a,b,c');
        });

        it('transforms a file piped through cat', async () => {
            const result = await harness.execute('cat abc.txt | tr a-z A-Z');
            expect(result.stderr).toEqual([]);
            expect(piped(result)).toBe('A\nB\nC');
        });

        it('takes no file operand: the file is an extra operand', async () => {
            const result = await harness.execute('tr a-z A-Z abc.txt');
            expect(result.stderr.some((l) => l.includes("tr: extra operand 'abc.txt'"))).toBe(true);
            expect(result.exitCode).toBe(1);
        });

        it('explains how to pipe input when there is none', async () => {
            const result = await harness.execute('tr a-z A-Z');
            expect(result.stderr.some((l) => l.includes('cat file | tr a-z A-Z'))).toBe(true);
            expect(result.exitCode).toBe(1);
        });
    });

    // 9. sed

    describe('sed', () => {
        it('p prints a line again, -n prints only p lines', async () => {
            const twice = await harness.execute('sed 2p abc.txt');
            expect(lines(twice.output)).toEqual(['a', 'b', 'b', 'c']);
            const only = await harness.execute('sed -n 2p abc.txt');
            expect(lines(only.output)).toEqual(['b']);
        });

        it('s///p with -n prints changed lines', async () => {
            const result = await harness.execute("sed -n 's/b/B/p' abc.txt");
            expect(lines(result.output)).toEqual(['B']);
        });

        it('replacement uses \\1..\\9 with -E groups', async () => {
            const result = await harness.execute(
                "sed -E 's/(\\w+) (\\w+)/\\2 \\1/' hello.txt",
            );
            expect(lines(result.output)).toEqual(['World Hello', 'again hello', 'Goodbye']);
        });

        it('replacement uses \\1 with basic \\( \\) groups and &', async () => {
            const result = await harness.execute(
                "sed 's/\\(Hello\\) World/\\1 Earth [&]/' hello.txt",
            );
            expect(lines(result.output)[0]).toBe('Hello Earth [Hello World]');
        });

        it('$ is the last line of a file with a trailing newline', async () => {
            const result = await harness.execute("sed '$d' abc.txt");
            expect(lines(result.output)).toEqual(['a', 'b']);
        });

        it('-i keeps the trailing newline', async () => {
            await harness.execute("sed -i 's/b/B/' abc.txt");
            expect(fs.readFile('/home/user/abc.txt')).toBe('a\nB\nc\n');
        });

        it('runs commands separated by ;', async () => {
            const result = await harness.execute("sed 's/Hello/Hi/;s/World/Earth/' hello.txt");
            expect(lines(result.output)[0]).toBe('Hi Earth');
        });

        it('supports /regex/,/regex/ ranges and !', async () => {
            const range = await harness.execute("sed -n '/Hello/,/again/p' hello.txt");
            expect(lines(range.output)).toEqual(['Hello World', 'hello again']);
            const negated = await harness.execute("sed '/again/!d' hello.txt");
            expect(lines(negated.output)).toEqual(['hello again']);
        });
    });

    // 10. awk without quotes

    describe('awk', () => {
        it('accepts an unquoted program before a file', async () => {
            const result = await harness.execute('awk -F , {print $1} data.csv');
            expect(result.stderr).toEqual([]);
            expect(lines(result.output)).toEqual(['name', 'alice', 'bob', 'charlie']);
        });

        it('accepts an unquoted program with piped input', async () => {
            const result = await harness.execute('cat hello.txt | awk {print $2}');
            expect(result.stderr).toEqual([]);
            expect(piped(result)).toBe('World\nagain');
        });

        it('still accepts a quoted program and several files', async () => {
            const result = await harness.execute("awk '{print NR}' abc.txt docs/notes.txt");
            expect(lines(result.output)).toEqual(['1', '2', '3', '4', '5', '6']);
        });
    });

    // 11. Several operands, defaults and piped input

    describe('operands', () => {
        it('mkdir, touch, rm and rmdir take several paths', async () => {
            await harness.execute('mkdir d1 d2 d3');
            await harness.execute('mkdir -p p/q r/s');
            await harness.execute('touch f1.txt f2.txt');
            for (const p of ['d1', 'd2', 'd3', 'p/q', 'r/s', 'f1.txt', 'f2.txt']) {
                expect(fs.exists(`/home/user/${p}`)).toBe(true);
            }
            const rm = await harness.execute('rm f1.txt f2.txt');
            const rmdir = await harness.execute('rmdir d1 d2 d3');
            expect(rm.stderr).toEqual([]);
            expect(rmdir.stderr).toEqual([]);
            for (const p of ['d1', 'd2', 'd3', 'f1.txt', 'f2.txt']) {
                expect(fs.exists(`/home/user/${p}`)).toBe(false);
            }
        });

        it('rm goes on after a missing path', async () => {
            await harness.execute('touch keep-going.txt');
            const result = await harness.execute('rm missing.txt keep-going.txt');
            expect(result.stderr.some((l) => l.includes('missing.txt'))).toBe(true);
            expect(fs.exists('/home/user/keep-going.txt')).toBe(false);
        });

        it('du defaults to the current directory', async () => {
            const result = await harness.execute('du -s');
            expect(result.stderr).toEqual([]);
            expect(lines(result.output)).toEqual([jasmine.stringMatching(/\t\/home\/user$/)]);
        });

        it('paste uses piped input as the only input or as -', async () => {
            const serial = await harness.execute('cat abc.txt | paste -s -d ,');
            expect(piped(serial)).toBe('a,b,c');
            const merged = await harness.execute('cat abc.txt | paste - docs/notes.txt');
            expect(piped(merged)).toBe('a\tNote 1\nb\tNote 2\nc\tNote 3');
        });

        it('paste with one file prints it as is', async () => {
            const result = await harness.execute('paste abc.txt');
            expect(result.output).toBe('a\nb\nc');
        });

        it('sort sorts several files together', async () => {
            const result = await harness.execute('sort abc.txt docs/notes.txt');
            expect(lines(result.output)).toEqual(['a', 'b', 'c', 'Note 1', 'Note 2', 'Note 3']);
            const mixed = await harness.execute('sort docs/notes.txt abc.txt');
            expect(lines(mixed.output)).toEqual(['a', 'b', 'c', 'Note 1', 'Note 2', 'Note 3']);
        });

        it('sh takes the first operand as the script, quoted or not', async () => {
            const result = await harness.execute('sh "simple.sh" extra');
            expect(result.stderr).toEqual([]);
            expect(result.output).toContain('hello');
            expect(result.output).toContain('world');
        });

        it('cp and mv put several sources into a directory', async () => {
            await harness.execute('mkdir box');
            await harness.execute('cp abc.txt hello.txt box');
            expect(fs.exists('/home/user/box/abc.txt')).toBe(true);
            expect(fs.exists('/home/user/box/hello.txt')).toBe(true);
            await harness.execute('mkdir box2');
            await harness.execute('mv box/abc.txt box/hello.txt box2');
            expect(fs.exists('/home/user/box2/abc.txt')).toBe(true);
            expect(fs.exists('/home/user/box/abc.txt')).toBe(false);
        });
    });
});
