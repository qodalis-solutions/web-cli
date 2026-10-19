import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliTrCommandProcessor } from '../lib/processors/cli-tr-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/tr-test.txt', 'Hello World\nfoo bar baz\n');
    fs.createFile('/home/user/spaces.txt', 'too   many   spaces\n');
    return fs;
}

// ---------------------------------------------------------------------------
// tr command tests
// ---------------------------------------------------------------------------

describe('CliTrCommandProcessor', () => {
    let processor: CliTrCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTrCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tr"', () => {
        expect(processor.command).toBe('tr');
    });

    it('should translate basic characters', async () => {
        // cat file | tr 'abc' 'ABC' → replaces a→A, b→B, c→C
        const cmd = makeCommand("tr 'abc' 'ABC'", {}, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        expect(output).toContain('foo BAr BAz');
    });

    it('should translate using ranges (a-z to A-Z)', async () => {
        const cmd = makeCommand("tr 'a-z' 'A-Z'", {}, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO WORLD');
        expect(output).toContain('FOO BAR BAZ');
    });

    it('should translate using character classes', async () => {
        const cmd = makeCommand("tr '[:lower:]' '[:upper:]'", {}, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO WORLD');
        expect(output).toContain('FOO BAR BAZ');
    });

    it('should delete characters with -d flag', async () => {
        // cat file | tr -d 'aeiou' → remove lowercase vowels
        const cmd = makeCommand("tr -d 'aeiou'", { d: true }, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hll Wrld');
        expect(output).toContain('f br bz');
    });

    it('should squeeze repeated characters with -s flag', async () => {
        // cat file | tr -s ' ' → collapse multiple spaces
        const cmd = makeCommand("tr -s ' '", { s: true }, fs.readFile('/home/user/spaces.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('too many spaces');
        expect(output).not.toContain('too   many');
    });

    it('should handle delete+squeeze with -d -s flags', async () => {
        // cat file | tr -ds 'aeiou' ' ' → delete vowels, then squeeze spaces
        const cmd = makeCommand("tr -ds 'aeiou' ' '", { d: true, s: true }, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // 'Hello World' -> delete vowels -> 'Hll Wrld' -> squeeze spaces -> 'Hll Wrld'
        expect(output).toContain('Hll Wrld');
        // 'foo bar baz' -> delete vowels -> 'f br bz' -> squeeze spaces -> 'f br bz'
        expect(output).toContain('f br bz');
    });

    it('should repeat last char of SET2 when shorter than SET1', async () => {
        // tr 'abc' 'x' → a→x, b→x, c→x
        const cmd = makeCommand("tr 'abc' 'x'", {}, fs.readFile('/home/user/tr-test.txt'));
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // 'foo bar baz' -> 'foo xxr xxz'
        expect(output).toContain('foo xxr xxz');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('tr');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });

    it('should error without piped input instead of reading a file', async () => {
        const exit = spyOn(ctx.process, 'exit');
        const cmd = makeCommand("tr 'a' 'b'");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('reads only piped input'))).toBe(true);
        expect(writer.written.some(l => l.includes('cat file | tr a-z A-Z'))).toBe(true);
        expect(exit).toHaveBeenCalledWith(1, { silent: true });
    });

    it('should reject a file operand as an extra operand', async () => {
        const exit = spyOn(ctx.process, 'exit');
        const cmd = makeCommand("tr 'a-z' 'A-Z' /home/user/tr-test.txt");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes("tr: extra operand '/home/user/tr-test.txt'"))).toBe(true);
        expect(writer.written.some(l => l.includes('HELLO'))).toBe(false);
        expect(exit).toHaveBeenCalledWith(1, { silent: true });
    });

    it('should reject an extra operand after -d SET1', async () => {
        const cmd = makeCommand("tr -d 'a' x", { d: true }, 'abc');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes("tr: extra operand 'x'"))).toBe(true);
    });

    it('should exit 1 on missing operand', async () => {
        const exit = spyOn(ctx.process, 'exit');
        await processor.processCommand(makeCommand('tr'), ctx);
        expect(exit).toHaveBeenCalledWith(1, { silent: true });
    });
});

// ---------------------------------------------------------------------------
// tr piped input tests
// ---------------------------------------------------------------------------

describe('CliTrCommandProcessor (piped input)', () => {
    let processor: CliTrCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTrCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should translate piped input', async () => {
        const cmd = makeCommand("tr 'a-z' 'A-Z'", {}, 'hello');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO');
    });

    it('should delete characters from piped input', async () => {
        const cmd = makeCommand("tr -d 'l'", { d: true }, 'hello');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('heo');
    });

    it('should squeeze characters from piped input', async () => {
        const cmd = makeCommand("tr -s ' '", { s: true }, 'too   many   spaces');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('too many spaces');
    });
});
