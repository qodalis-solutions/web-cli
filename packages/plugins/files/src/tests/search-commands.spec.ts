import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { createStubWriter, createMockContext, makeCommand } from './helpers';
import { CliHeadCommandProcessor } from '../lib/processors/cli-head-command-processor';
import { CliTailCommandProcessor } from '../lib/processors/cli-tail-command-processor';
import { CliWcCommandProcessor } from '../lib/processors/cli-wc-command-processor';
import { CliFindCommandProcessor } from '../lib/processors/cli-find-command-processor';
import { CliGrepCommandProcessor } from '../lib/processors/cli-grep-command-processor';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    // Create test structure under /home/user:
    //   /home/user/docs/
    //   /home/user/docs/readme.md
    //   /home/user/docs/notes.txt
    //   /home/user/hello.sh
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/welcome.txt', 'Welcome to Qodalis CLI filesystem!\n');
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10\nLine 11\nLine 12\n');
    fs.createFile('/home/user/docs/notes.txt', 'Hello World\nhello again\nGoodbye\nHELLO final\n');
    fs.createFile('/home/user/hello.sh', '#!/bin/bash\necho "Hello World"\nexit 0\n');
    return fs;
}

// ---------------------------------------------------------------------------
// head command tests
// ---------------------------------------------------------------------------

describe('CliHeadCommandProcessor', () => {
    let processor: CliHeadCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliHeadCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "head"', () => {
        expect(processor.command).toBe('head');
    });

    it('should display first 10 lines by default', async () => {
        const cmd = makeCommand('head /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 1');
        expect(output).toContain('Line 10');
        expect(output).not.toContain('Line 11');
    });

    it('should respect -n flag', async () => {
        const cmd = makeCommand('head -n 3 /home/user/docs/readme.md', { n: '3' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 1');
        expect(output).toContain('Line 3');
        expect(output).not.toContain('Line 4');
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand('head /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('head');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// tail command tests
// ---------------------------------------------------------------------------

describe('CliTailCommandProcessor', () => {
    let processor: CliTailCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTailCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "tail"', () => {
        expect(processor.command).toBe('tail');
    });

    it('should display last 10 lines by default', async () => {
        const cmd = makeCommand('tail /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // The file has 12 lines of content + trailing newline = 13 entries when split.
        // tail -10 gives the last 10 of those entries.
        expect(output).toContain('Line 12');
    });

    it('should respect -n flag', async () => {
        const cmd = makeCommand('tail -n 2 /home/user/docs/readme.md', { n: '2' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // Last 2 entries from split are: 'Line 12' and '' (trailing newline)
        expect(output).toContain('Line 12');
        expect(output).not.toContain('Line 10');
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand('tail /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// wc command tests
// ---------------------------------------------------------------------------

describe('CliWcCommandProcessor', () => {
    let processor: CliWcCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliWcCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "wc"', () => {
        expect(processor.command).toBe('wc');
    });

    it('should show lines, words, chars by default', async () => {
        const cmd = makeCommand('wc /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('/home/user/hello.sh');
    });

    it('should support -l flag for lines only', async () => {
        const cmd = makeCommand('wc -l /home/user/hello.sh', { l: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('/home/user/hello.sh');
    });

    it('should show totals for multiple files', async () => {
        const cmd = makeCommand('wc /home/user/hello.sh /home/user/docs/notes.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('total');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('wc');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// find command tests
// ---------------------------------------------------------------------------

describe('CliFindCommandProcessor', () => {
    let processor: CliFindCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliFindCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "find"', () => {
        expect(processor.command).toBe('find');
    });

    it('should find files by -name glob', async () => {
        const cmd = makeCommand('find /home/user -name *.txt', {
            name: '*.txt',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('notes.txt');
        expect(output).toContain('welcome.txt');
        expect(output).not.toContain('readme.md');
    });

    it('should filter by -type d', async () => {
        const cmd = makeCommand('find /home/user -type d', {
            type: 'd',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('docs');
        expect(output).not.toContain('.txt');
        expect(output).not.toContain('.md');
        expect(output).not.toContain('.sh');
    });

    it('should respect -maxdepth', async () => {
        const cmd = makeCommand('find /home/user -maxdepth 0 -name *.txt', {
            name: '*.txt',
            maxdepth: '0',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // maxdepth 0 = only direct children of /home/user, no recursion into docs/
        expect(output).toContain('welcome.txt');
        expect(output).not.toContain('notes.txt');
    });

    it('should default to cwd when no path given', async () => {
        fs.setCurrentDirectory('/home/user');
        const cmd = makeCommand('find', {
            name: '*.sh',
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello.sh');
    });

    it('should error on non-existent path', async () => {
        const cmd = makeCommand('find /nope');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// grep command tests
// ---------------------------------------------------------------------------

describe('CliGrepCommandProcessor', () => {
    let processor: CliGrepCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliGrepCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "grep"', () => {
        expect(processor.command).toBe('grep');
    });

    it('should find matching lines in a file', async () => {
        const cmd = makeCommand('grep Hello /home/user/docs/notes.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        expect(output).not.toContain('Goodbye');
    });

    it('should support case-insensitive search with -i', async () => {
        const cmd = makeCommand('grep -i hello /home/user/docs/notes.txt', {
            i: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
        expect(output).toContain('hello again');
        expect(output).toContain('HELLO final');
    });

    it('should support -v for invert match', async () => {
        const cmd = makeCommand('grep -v Hello /home/user/docs/notes.txt', {
            v: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello again');
        expect(output).toContain('Goodbye');
        expect(output).not.toContain('Hello World');
    });

    it('should support -c for count only', async () => {
        const cmd = makeCommand('grep -c Hello /home/user/docs/notes.txt', {
            c: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('1');
    });

    it('should support -l for files-with-matches', async () => {
        const cmd = makeCommand('grep -r -l Hello /home/user', {
            r: true,
            l: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('notes.txt');
    });

    it('should support -n for line numbers', async () => {
        const cmd = makeCommand('grep -n Hello /home/user/docs/notes.txt', {
            n: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('1');
        expect(output).toContain('Hello World');
    });

    it('should search recursively with -r', async () => {
        const cmd = makeCommand('grep -r echo /home/user', {
            r: true,
        });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('echo');
    });

    it('should error when directory given without -r', async () => {
        const cmd = makeCommand('grep Hello /home/user');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('Is a directory'))).toBe(true);
    });

    it('should error on missing pattern', async () => {
        const cmd = makeCommand('grep');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing pattern'))).toBe(true);
    });

    it('should error on non-existent file', async () => {
        const cmd = makeCommand('grep foo /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });

    it('should support regex patterns', async () => {
        const cmd = makeCommand('grep ^Line.*3$ /home/user/docs/readme.md');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Line 3');
        expect(output).not.toContain('Line 1');
    });
});

// ---------------------------------------------------------------------------
// grep command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliGrepCommandProcessor (piped input)', () => {
    let processor: CliGrepCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliGrepCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should search piped text when no file paths given', async () => {
        const cmd = makeCommand('grep hello', {}, 'hello world\ngoodbye world\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello world');
        expect(output).toContain('hello again');
        expect(output).not.toContain('goodbye');
    });

    it('should apply -i flag on piped input', async () => {
        const cmd = makeCommand('grep -i HELLO', { i: true }, 'Hello World\ngoodbye');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello World');
    });

    it('should apply -v invert on piped input', async () => {
        const cmd = makeCommand('grep -v hello', { v: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('world');
        expect(output).not.toContain('hello');
    });

    it('should apply -c count on piped input', async () => {
        const cmd = makeCommand('grep -c hello', { c: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('2');
    });

    it('should apply -n line numbers on piped input', async () => {
        const cmd = makeCommand('grep -n hello', { n: true }, 'hello\nworld\nhello again');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('1');
        expect(output).toContain('3');
    });

    it('should still require a pattern even with piped input', async () => {
        const cmd = makeCommand('grep', {}, 'some data');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(w => w.includes('missing pattern'))).toBeTrue();
    });
});

// ---------------------------------------------------------------------------
// head command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliHeadCommandProcessor (piped input)', () => {
    let processor: CliHeadCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliHeadCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should display first N lines of piped input', async () => {
        const input = 'line1\nline2\nline3\nline4\nline5';
        const cmd = makeCommand('head', { n: 3 }, input);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line1');
        expect(output).toContain('line3');
        expect(output).not.toContain('line4');
    });

    it('should default to 10 lines for piped input', async () => {
        const lines = Array.from({ length: 15 }, (_, i) => `line${i + 1}`).join('\n');
        const cmd = makeCommand('head', {}, lines);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line10');
        expect(output).not.toContain('line11');
    });
});

// ---------------------------------------------------------------------------
// tail command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliTailCommandProcessor (piped input)', () => {
    let processor: CliTailCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliTailCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should display last N lines of piped input', async () => {
        const input = 'line1\nline2\nline3\nline4\nline5';
        const cmd = makeCommand('tail', { n: 2 }, input);
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('line4');
        expect(output).toContain('line5');
        expect(output).not.toContain('line3');
    });
});

// ---------------------------------------------------------------------------
// wc command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliWcCommandProcessor (piped input)', () => {
    let processor: CliWcCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliWcCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should count lines/words/chars of piped text', async () => {
        const cmd = makeCommand('wc', {}, 'hello world\nfoo bar baz');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('2'); // 2 lines
        expect(output).toContain('5'); // 5 words
    });

    it('should count only lines with -l on piped input', async () => {
        const cmd = makeCommand('wc -l', { l: true }, 'a\nb\nc');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('');
        expect(output).toContain('3');
    });
});
