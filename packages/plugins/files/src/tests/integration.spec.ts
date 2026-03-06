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
import { CliLsCommandProcessor } from '../lib/processors/cli-ls-command-processor';
import { CliMkdirCommandProcessor } from '../lib/processors/cli-mkdir-command-processor';
import { CliRmCommandProcessor } from '../lib/processors/cli-rm-command-processor';
import { CliTouchCommandProcessor } from '../lib/processors/cli-touch-command-processor';
import { CliCpCommandProcessor } from '../lib/processors/cli-cp-command-processor';
import { CliMvCommandProcessor } from '../lib/processors/cli-mv-command-processor';
import { CliFindCommandProcessor } from '../lib/processors/cli-find-command-processor';
import { CliAwkCommandProcessor } from '../lib/processors/cli-awk-command-processor';
import { CliDiffCommandProcessor } from '../lib/processors/cli-diff-command-processor';
import { CliBasenameCommandProcessor } from '../lib/processors/cli-basename-command-processor';
import { CliDirnameCommandProcessor } from '../lib/processors/cli-dirname-command-processor';

function setupHarness(): { harness: CliTestHarness; fs: IndexedDbFileSystemService } {
    const harness = new CliTestHarness();
    const fs = new IndexedDbFileSystemService();

    // Seed the filesystem
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/hello.txt', 'Hello World\nhello again\nGoodbye\n');
    fs.createFile('/home/user/numbers.txt', '3\n1\n4\n1\n5\n9\n2\n6\n5\n');
    fs.createFile('/home/user/data.csv', 'name,age,city\nalice,30,NYC\nbob,25,LA\ncharlie,35,NYC\n');
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', '# README\n\nThis is a readme.\n');
    fs.createFile('/home/user/docs/notes.txt', 'Note 1\nNote 2\nNote 3\n');
    fs.createFile('/home/user/script.sh', '#!/bin/bash\necho "Hello"\nexit 0\n');

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
        new CliLsCommandProcessor(),
        new CliMkdirCommandProcessor(),
        new CliRmCommandProcessor(),
        new CliTouchCommandProcessor(),
        new CliCpCommandProcessor(),
        new CliMvCommandProcessor(),
        new CliFindCommandProcessor(),
        new CliAwkCommandProcessor(),
        new CliDiffCommandProcessor(),
        new CliBasenameCommandProcessor(),
        new CliDirnameCommandProcessor(),
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
});
