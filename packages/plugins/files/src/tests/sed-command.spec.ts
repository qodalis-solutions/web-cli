import { Subject } from 'rxjs';
import {
    CliProcessCommand,
    CliForegroundColor,
    CliBackgroundColor,
    ICliExecutionContext,
    ICliTerminalWriter,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { IFileSystemService_TOKEN } from '../lib/interfaces';
import { CliSedCommandProcessor } from '../lib/processors/cli-sed-command-processor';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createStubWriter(): ICliTerminalWriter & { written: string[] } {
    const written: string[] = [];
    return {
        written,
        write(text: string) { written.push(text); },
        writeln(text?: string) { written.push(text ?? ''); },
        writeSuccess(msg: string) { written.push(`[success] ${msg}`); },
        writeInfo(msg: string) { written.push(`[info] ${msg}`); },
        writeWarning(msg: string) { written.push(`[warn] ${msg}`); },
        writeError(msg: string) { written.push(`[error] ${msg}`); },
        wrapInColor(text: string, _color: CliForegroundColor) { return text; },
        wrapInBackgroundColor(text: string, _color: CliBackgroundColor) { return text; },
        writeJson(json: any) { written.push(JSON.stringify(json)); },
        writeToFile(_fn: string, _content: string) {},
        writeObjectsAsTable(objects: any[]) { written.push(JSON.stringify(objects)); },
        writeTable(_h: string[], _r: string[][]) {},
        writeDivider() {},
        writeList(_items: string[], _options?: any) {},
        writeKeyValue(_entries: any, _options?: any) {},
        writeColumns(_items: string[], _options?: any) {},
    };
}

function createMockContext(
    writer: ICliTerminalWriter,
    fs: IndexedDbFileSystemService,
): ICliExecutionContext {
    const services: ICliServiceProvider = {
        get<T>(token: any): T {
            if (token === IFileSystemService_TOKEN) return fs as any;
            throw new Error(`Unknown service: ${token}`);
        },
        set() {},
    };

    return {
        writer,
        services,
        spinner: { show() {}, hide() {} },
        progressBar: { show() {}, update() {}, hide() {} },
        onAbort: new Subject<void>(),
        terminal: {} as any,
        reader: {} as any,
        executor: {} as any,
        clipboard: {} as any,
        options: undefined,
        logger: { log() {}, info() {}, warn() {}, error() {}, debug() {}, setCliLogLevel() {} },
        process: { output() {}, exit() {} } as any,
        state: {} as any,
        showPrompt: jasmine.createSpy('showPrompt'),
        setContextProcessor: jasmine.createSpy('setContextProcessor'),
        setCurrentLine: jasmine.createSpy('setCurrentLine'),
        clearLine: jasmine.createSpy('clearLine'),
        clearCurrentLine: jasmine.createSpy('clearCurrentLine'),
        refreshCurrentLine: jasmine.createSpy('refreshCurrentLine'),
        enterFullScreenMode: jasmine.createSpy('enterFullScreenMode'),
        exitFullScreenMode: jasmine.createSpy('exitFullScreenMode'),
    } as any;
}

function makeCommand(
    raw: string,
    args: Record<string, any> = {},
): CliProcessCommand {
    const tokens = raw.split(/\s+/);
    return {
        command: tokens[0],
        rawCommand: tokens.slice(1).join(' '),
        chainCommands: [],
        args,
    } as any;
}

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
        const cmd = makeCommand("sed -e 's/Hello/Hi/' -e 's/World/Earth/' /home/user/sed-test.txt");
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
