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
import { CliTrCommandProcessor } from '../lib/processors/cli-tr-command-processor';

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
        // tr 'abc' 'ABC' file → replaces a→A, b→B, c→C
        const cmd = makeCommand("tr 'abc' 'ABC' /home/user/tr-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hello WorlC');
        expect(output).toContain('foo BAr BAz');
    });

    it('should translate using ranges (a-z to A-Z)', async () => {
        const cmd = makeCommand("tr 'a-z' 'A-Z' /home/user/tr-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO WORLD');
        expect(output).toContain('FOO BAR BAZ');
    });

    it('should translate using character classes', async () => {
        const cmd = makeCommand("tr '[:lower:]' '[:upper:]' /home/user/tr-test.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('HELLO WORLD');
        expect(output).toContain('FOO BAR BAZ');
    });

    it('should delete characters with -d flag', async () => {
        // tr -d 'aeiou' file → remove lowercase vowels
        const cmd = makeCommand("tr -d 'aeiou' /home/user/tr-test.txt", { d: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('Hll Wrld');
        expect(output).toContain('f br bz');
    });

    it('should squeeze repeated characters with -s flag', async () => {
        // tr -s ' ' file → collapse multiple spaces
        const cmd = makeCommand("tr -s ' ' /home/user/spaces.txt", { s: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('too many spaces');
        expect(output).not.toContain('too   many');
    });

    it('should handle delete+squeeze with -d -s flags', async () => {
        // tr -d -s 'aeiou' ' ' file → delete vowels, then squeeze spaces
        const cmd = makeCommand("tr -ds 'aeiou' ' ' /home/user/tr-test.txt", { d: true, s: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // 'Hello World' -> delete vowels -> 'Hll Wrld' -> squeeze spaces -> 'Hll Wrld'
        expect(output).toContain('Hll Wrld');
        // 'foo bar baz' -> delete vowels -> 'f br bz' -> squeeze spaces -> 'f br bz'
        expect(output).toContain('f br bz');
    });

    it('should repeat last char of SET2 when shorter than SET1', async () => {
        // tr 'abc' 'x' → a→x, b→x, c→x
        const cmd = makeCommand("tr 'abc' 'x' /home/user/tr-test.txt");
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

    it('should error on missing file operand (translate mode)', async () => {
        const cmd = makeCommand("tr 'a' 'b'");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand("tr 'a' 'b' /nonexistent");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });
});
