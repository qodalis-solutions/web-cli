import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliSedCommandProcessor } from '../lib/processors/cli-sed-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile(
        '/home/user/sed-test.txt',
        'Hello World\nhello world\nGoodbye World\nfoo bar baz\nline five\n',
    );
    return fs;
}

// ---------------------------------------------------------------------------
// sed command tests
// ---------------------------------------------------------------------------

describe('CliSedCommandProcessor', () => {
    let processor: CliSedCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliSedCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "sed"', () => {
        expect(processor.command).toBe('sed');
    });

    // -----------------------------------------------------------------------
    // Substitution
    // -----------------------------------------------------------------------

    it('should substitute first occurrence', async () => {
        const cmd = makeCommand("sed 's/Hello/Hi/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hi World');
        expect(output).not.toContain('Hello World');
        // 'hello world' should remain unchanged (case-sensitive)
        expect(output).toContain('hello world');
    });

    it('should substitute all occurrences with g flag', async () => {
        const cmd = makeCommand("sed 's/o/0/g' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hell0 W0rld');
        expect(output).toContain('hell0 w0rld');
        expect(output).toContain('G00dbye W0rld');
        expect(output).toContain('f00 bar baz');
    });

    it('should support case-insensitive with i flag', async () => {
        const cmd = makeCommand("sed 's/hello/Hi/i' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hi World');
        expect(output).toContain('Hi world');
    });

    it('should support alternate delimiters', async () => {
        const cmd = makeCommand("sed 's|World|Earth|' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello Earth');
        expect(output).toContain('Goodbye Earth');
    });

    // -----------------------------------------------------------------------
    // In-place editing
    // -----------------------------------------------------------------------

    it('should modify file in-place with -i', async () => {
        const cmd = makeCommand("sed -i 's/Hello/Hi/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const content = fs.readFile('/home/user/sed-test.txt');
        expect(content).toContain('Hi World');
        expect(content).not.toContain('Hello World');
    });

    it('should not modify file without -i', async () => {
        const cmd = makeCommand("sed 's/Hello/Hi/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const content = fs.readFile('/home/user/sed-test.txt');
        expect(content).toContain('Hello World');
    });

    // -----------------------------------------------------------------------
    // Line addressing
    // -----------------------------------------------------------------------

    it('should apply to specific line', async () => {
        const cmd = makeCommand("sed '2s/hello/HELLO/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO world');
        // Line 1 should be unchanged
        expect(output).toContain('Hello World');
    });

    it('should apply to line range', async () => {
        const cmd = makeCommand("sed '1,3s/World/Earth/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello Earth');
        expect(output).toContain('Goodbye Earth');
        // Line 4 should be unchanged
        expect(output).toContain('foo bar baz');
    });

    it('should apply to last line with $', async () => {
        // The file has trailing newline, so last "line" is empty.
        // 'line five' is second to last. Let's use a file without trailing newline.
        fs.createFile('/home/user/no-trailing.txt', 'line one\nline two\nline three');
        const cmd = makeCommand("sed '$s/three/THREE/' /home/user/no-trailing.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line THREE');
        expect(output).toContain('line one');
        expect(output).toContain('line two');
    });

    // -----------------------------------------------------------------------
    // Delete
    // -----------------------------------------------------------------------

    it('should delete specific line', async () => {
        const cmd = makeCommand("sed '2d' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).not.toContain('hello world');
        expect(output).toContain('Hello World');
        expect(output).toContain('Goodbye World');
    });

    it('should delete matching lines', async () => {
        const cmd = makeCommand("sed '/Goodbye/d' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).not.toContain('Goodbye');
        expect(output).toContain('Hello World');
    });

    // -----------------------------------------------------------------------
    // Print with -n
    // -----------------------------------------------------------------------

    it('should print matching lines with -n and p', async () => {
        const cmd = makeCommand("sed -n '/Hello/p' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        // Should NOT contain lines that don't match
        expect(output).not.toContain('Goodbye');
        expect(output).not.toContain('foo bar');
        expect(output).not.toContain('hello world');
    });

    // -----------------------------------------------------------------------
    // Multiple expressions
    // -----------------------------------------------------------------------

    it('should support -e for multiple expressions', async () => {
        const cmd = makeCommand("sed /home/user/sed-test.txt", { e: ["s/Hello/Hi/", "s/World/Earth/"] });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hi Earth');
        expect(output).toContain('Goodbye Earth');
    });

    // -----------------------------------------------------------------------
    // & in replacement
    // -----------------------------------------------------------------------

    it('should support & as matched text in replacement', async () => {
        const cmd = makeCommand("sed 's/Hello/[&]/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('[Hello]');
    });

    // -----------------------------------------------------------------------
    // Error cases
    // -----------------------------------------------------------------------

    it('should error on missing expression', async () => {
        const cmd = makeCommand('sed');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing expression'))).toBe(true);
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand("sed 's/a/b/'");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on invalid regex', async () => {
        const cmd = makeCommand("sed 's/[invalid/replacement/' /home/user/sed-test.txt");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// sed piped input tests
// ---------------------------------------------------------------------------

describe('CliSedCommandProcessor (piped input)', () => {
    let processor: CliSedCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliSedCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should process piped input with substitution', async () => {
        const cmd = makeCommand("sed 's/hello/world/g'", {}, 'hello there\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('world there');
        expect(output).toContain('world again');
    });

    it('should process piped input with deletion', async () => {
        const cmd = makeCommand("sed '2d'", {}, 'line1\nline2\nline3');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line1');
        expect(output).toContain('line3');
        expect(output).not.toContain('line2');
    });

    it('should process piped input with -n and print', async () => {
        const cmd = makeCommand("sed -n '/foo/p'", {}, 'foo bar\nbaz qux\nfoo end');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('foo bar');
        expect(output).toContain('foo end');
        expect(output).not.toContain('baz qux');
    });

    it('should ignore in-place flag when piped', async () => {
        const cmd = makeCommand("sed -i 's/hello/world/'", {}, 'hello there');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('world there');
    });
});
