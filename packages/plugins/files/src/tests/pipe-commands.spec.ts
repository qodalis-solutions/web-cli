import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliDiffCommandProcessor } from '../lib/processors/cli-diff-command-processor';
import { CliTeeCommandProcessor } from '../lib/processors/cli-tee-command-processor';
import { CliXargsCommandProcessor } from '../lib/processors/cli-xargs-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/file1.txt', 'line one\nline two\nline three\n');
    fs.createFile('/home/user/file2.txt', 'line one\nline TWO\nline four\n');
    fs.createFile('/home/user/identical.txt', 'line one\nline two\nline three\n');
    fs.createFile('/home/user/input.txt', 'file1.txt\nfile2.txt\nfile3.txt\n');
    fs.createFile('/home/user/args.txt', 'hello\nworld\nfoo\n');
    return fs;
}

// ---------------------------------------------------------------------------
// diff command tests
// ---------------------------------------------------------------------------

describe('CliDiffCommandProcessor', () => {
    let processor: CliDiffCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliDiffCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "diff"', () => {
        expect(processor.command).toBe('diff');
    });

    it('should produce no output for identical files', async () => {
        const cmd = makeCommand('diff /home/user/file1.txt /home/user/identical.txt');
        await processor.processCommand(cmd, ctx);
        // Identical files produce no output
        expect(writer.written.length).toBe(0);
    });

    it('should show differences in default format', async () => {
        const cmd = makeCommand('diff /home/user/file1.txt /home/user/file2.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // file1 has "line two" and "line three", file2 has "line TWO" and "line four"
        expect(output).toContain('< line two');
        expect(output).toContain('< line three');
        expect(output).toContain('> line TWO');
        expect(output).toContain('> line four');
    });

    it('should show unified format with -u', async () => {
        const cmd = makeCommand('diff -u /home/user/file1.txt /home/user/file2.txt', { u: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('--- /home/user/file1.txt');
        expect(output).toContain('+++ /home/user/file2.txt');
        expect(output).toContain('@@');
        expect(output).toContain('-line two');
        expect(output).toContain('+line TWO');
    });

    it('should ignore case with -i', async () => {
        const cmd = makeCommand('diff -i /home/user/file1.txt /home/user/file2.txt', { i: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // With ignore case, "line two" == "line TWO", so only three/four differ
        expect(output).not.toContain('line two');
        expect(output).not.toContain('line TWO');
        expect(output).toContain('< line three');
        expect(output).toContain('> line four');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('diff /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('diff /home/user/file1.txt /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// tee command tests
// ---------------------------------------------------------------------------

describe('CliTeeCommandProcessor', () => {
    let processor: CliTeeCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTeeCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tee"', () => {
        expect(processor.command).toBe('tee');
    });

    it('should write to output file and stdout', async () => {
        const cmd = makeCommand('tee /home/user/output.txt /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // stdout should have the content
        expect(output).toContain('line one');
        // output file should have the content
        const fileContent = fs.readFile('/home/user/output.txt');
        expect(fileContent).toContain('line one');
    });

    it('should append with -a', async () => {
        // First write something to output
        fs.createFile('/home/user/out.txt', 'existing\n');
        const cmd = makeCommand('tee -a /home/user/out.txt /home/user/args.txt', { a: true });
        await processor.processCommand(cmd, ctx);
        const fileContent = fs.readFile('/home/user/out.txt');
        expect(fileContent).toContain('existing');
        expect(fileContent).toContain('hello');
    });

    it('should write to multiple output files', async () => {
        const cmd = makeCommand('tee /home/user/out1.txt /home/user/out2.txt /home/user/args.txt');
        await processor.processCommand(cmd, ctx);
        const content1 = fs.readFile('/home/user/out1.txt');
        const content2 = fs.readFile('/home/user/out2.txt');
        expect(content1).toContain('hello');
        expect(content2).toContain('hello');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('tee');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// xargs command tests
// ---------------------------------------------------------------------------

describe('CliXargsCommandProcessor', () => {
    let processor: CliXargsCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliXargsCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "xargs"', () => {
        expect(processor.command).toBe('xargs');
    });

    it('should output constructed commands', async () => {
        const cmd = makeCommand('xargs echo /home/user/args.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo hello world foo');
    });

    it('should support -I {} replace mode', async () => {
        const cmd = makeCommand('xargs -I {} cat {} /home/user/args.txt', {
            I: '{}',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('cat hello');
        expect(output).toContain('cat world');
        expect(output).toContain('cat foo');
    });

    it('should support -n for grouping args', async () => {
        const cmd = makeCommand('xargs -n 2 echo /home/user/args.txt', {
            n: '2',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo hello world');
        expect(output).toContain('echo foo');
    });

    it('should error on missing command', async () => {
        const cmd = makeCommand('xargs');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing command'))).toBe(true);
    });

    it('should error on missing input file', async () => {
        const cmd = makeCommand('xargs echo');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing input file'))).toBe(true);
    });

    it('should error on nonexistent input file', async () => {
        const cmd = makeCommand('xargs echo /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// tee command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliTeeCommandProcessor (piped input)', () => {
    let processor: CliTeeCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTeeCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should write piped data to stdout and output files', async () => {
        const cmd = makeCommand('tee /home/user/out.txt', {}, 'piped content');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('piped content');
        expect(fs.readFile('/home/user/out.txt')).toBe('piped content');
    });

    it('should append piped data with -a', async () => {
        fs.createFile('/home/user/existing.txt', 'old\n');
        const cmd = makeCommand('tee -a /home/user/existing.txt', { a: true }, 'new');
        await processor.processCommand(cmd, ctx);
        const content = fs.readFile('/home/user/existing.txt');
        expect(content).toContain('old');
        expect(content).toContain('new');
    });

    it('should write piped data to multiple output files', async () => {
        const cmd = makeCommand('tee /home/user/a.txt /home/user/b.txt', {}, 'hello pipes');
        await processor.processCommand(cmd, ctx);
        expect(fs.readFile('/home/user/a.txt')).toBe('hello pipes');
        expect(fs.readFile('/home/user/b.txt')).toBe('hello pipes');
    });
});

// ---------------------------------------------------------------------------
// xargs command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliXargsCommandProcessor (piped input)', () => {
    let processor: CliXargsCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliXargsCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should build commands from piped data', async () => {
        const cmd = makeCommand('xargs echo', {}, 'hello\nworld\nfoo');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo hello world foo');
    });

    it('should support -I replace with piped data', async () => {
        const cmd = makeCommand('xargs -I {} cat {}', { I: '{}' }, 'a\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('cat a');
        expect(output).toContain('cat b');
    });

    it('should support -n grouping with piped data', async () => {
        const cmd = makeCommand('xargs -n 2 echo', { n: '2' }, 'a\nb\nc');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo a b');
        expect(output).toContain('echo c');
    });
});
