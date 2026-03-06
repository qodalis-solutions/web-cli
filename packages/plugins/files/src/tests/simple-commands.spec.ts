import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { createStubWriter, createMockContext, makeCommand } from './helpers';
import { CliTacCommandProcessor } from '../lib/processors/cli-tac-command-processor';
import { CliBasenameCommandProcessor } from '../lib/processors/cli-basename-command-processor';
import { CliDirnameCommandProcessor } from '../lib/processors/cli-dirname-command-processor';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/welcome.txt', 'Welcome to Qodalis CLI filesystem!\n');
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\nLine 12\n');
    fs.createFile('/home/user/docs/notes.txt', 'Hello World\nhello again\nGoodbye\nHELLO final\n');
    fs.createFile('/home/user/hello.sh', '#!/bin/bash\necho "Hello World"\nexit 0\n');
    return fs;
}

// ---------------------------------------------------------------------------
// tac command tests
// ---------------------------------------------------------------------------

describe('CliTacCommandProcessor', () => {
    let processor: CliTacCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTacCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tac"', () => {
        expect(processor.command).toBe('tac');
    });

    it('should reverse file lines', async () => {
        const cmd = makeCommand('tac /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('exit 0');
        // The reversed output should have exit 0 before echo and shebang
        const lines = writer.written[0].split('\n');
        expect(lines[0]).toBe('exit 0');
        expect(lines[1]).toBe('echo "Hello World"');
        expect(lines[2]).toBe('#!/bin/bash');
    });

    it('should reverse notes file', async () => {
        const cmd = makeCommand('tac /home/user/docs/notes.txt');
        await processor.processCommand(cmd, ctx);
        const lines = writer.written[0].split('\n');
        expect(lines[0]).toBe('HELLO final');
        expect(lines[1]).toBe('Goodbye');
        expect(lines[2]).toBe('hello again');
        expect(lines[3]).toBe('Hello World');
    });

    it('should show headers for multiple files', async () => {
        const cmd = makeCommand('tac /home/user/hello.sh /home/user/docs/notes.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('==> /home/user/hello.sh <==');
        expect(output).toContain('==> /home/user/docs/notes.txt <==');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('tac');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('tac /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });

    it('should error on directory', async () => {
        const cmd = makeCommand('tac /home/user/docs');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('Is a directory'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// basename command tests
// ---------------------------------------------------------------------------

describe('CliBasenameCommandProcessor', () => {
    let processor: CliBasenameCommandProcessor;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliBasenameCommandProcessor();
        const fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "basename"', () => {
        expect(processor.command).toBe('basename');
    });

    it('should strip directory from path', async () => {
        const cmd = makeCommand('basename /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('readme.md');
    });

    it('should strip suffix when provided', async () => {
        const cmd = makeCommand('basename /home/user/docs/readme.md .md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('readme');
    });

    it('should not strip suffix that equals the name', async () => {
        const cmd = makeCommand('basename /home/user/docs/readme.md readme.md');
        await processor.processCommand(cmd, ctx);
        // When suffix equals the entire name, it should not strip
        expect(writer.written[0]).toBe('readme.md');
    });

    it('should handle root path', async () => {
        const cmd = makeCommand('basename /');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('/');
    });

    it('should handle bare filename', async () => {
        const cmd = makeCommand('basename file.txt');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('file.txt');
    });

    it('should handle trailing slashes', async () => {
        const cmd = makeCommand('basename /home/user/docs/');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('docs');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('basename');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// dirname command tests
// ---------------------------------------------------------------------------

describe('CliDirnameCommandProcessor', () => {
    let processor: CliDirnameCommandProcessor;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliDirnameCommandProcessor();
        const fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "dirname"', () => {
        expect(processor.command).toBe('dirname');
    });

    it('should strip last component from path', async () => {
        const cmd = makeCommand('dirname /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('/home/user/docs');
    });

    it('should return / for root-level paths', async () => {
        const cmd = makeCommand('dirname /home');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('/');
    });

    it('should return / for root path', async () => {
        const cmd = makeCommand('dirname /');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('/');
    });

    it('should return . for bare filenames', async () => {
        const cmd = makeCommand('dirname file.txt');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('.');
    });

    it('should handle trailing slashes', async () => {
        const cmd = makeCommand('dirname /home/user/docs/');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('/home/user');
    });

    it('should handle relative paths with directories', async () => {
        const cmd = makeCommand('dirname src/lib/file.ts');
        await processor.processCommand(cmd, ctx);
        expect(writer.written[0]).toBe('src/lib');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('dirname');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// tac command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliTacCommandProcessor (piped input)', () => {
    let processor: CliTacCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTacCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should reverse piped lines', async () => {
        const cmd = makeCommand('tac', {}, 'first\nsecond\nthird');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['third', 'second', 'first']);
    });
});
