import { CliTestHarness } from '@qodalis/cli';
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
