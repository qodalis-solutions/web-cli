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
import { CliAwkCommandProcessor } from '../lib/processors/cli-awk-command-processor';

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
    fs.createFile('/home/user/data.txt', 'Alice 30 Paris\nBob 25 London\nCharlie 35 Tokyo\n');
    fs.createFile('/home/user/csv-data.txt', 'name,age,city\nalice,30,paris\nbob,25,london\ncharlie,35,tokyo\n');
    fs.createFile('/home/user/numbers.txt', '10\n20\n30\n40\n50\n');
    return fs;
}

// ---------------------------------------------------------------------------
// awk command tests
// ---------------------------------------------------------------------------

describe('CliAwkCommandProcessor', () => {
    let processor: CliAwkCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliAwkCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "awk"', () => {
        expect(processor.command).toBe('awk');
    });

    // Field printing
    it('should print specific field', async () => {
        const cmd = makeCommand("awk '{print $2}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('30');
        expect(output).toContain('25');
        expect(output).toContain('35');
    });

    it('should print multiple fields', async () => {
        const cmd = makeCommand("awk '{print $1, $3}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('Alice Paris');
        expect(output).toContain('Bob London');
        expect(output).toContain('Charlie Tokyo');
    });

    it('should print whole line with $0', async () => {
        const cmd = makeCommand("awk '{print $0}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('Alice 30 Paris');
        expect(output).toContain('Bob 25 London');
        expect(output).toContain('Charlie 35 Tokyo');
    });

    it('should use custom separator', async () => {
        const cmd = makeCommand("awk -F ',' '{print $2}' /home/user/csv-data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('age');
        expect(output).toContain('30');
        expect(output).toContain('25');
        expect(output).toContain('35');
    });

    // Built-in variables
    it('should support NR', async () => {
        const cmd = makeCommand("awk '{print NR, $0}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('1 Alice 30 Paris');
        expect(output).toContain('2 Bob 25 London');
        expect(output).toContain('3 Charlie 35 Tokyo');
    });

    it('should support NF', async () => {
        const cmd = makeCommand("awk '{print NF}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('3');
        expect(output.filter(l => l === '3').length).toBe(3);
    });

    // BEGIN/END
    it('should execute BEGIN block', async () => {
        const cmd = makeCommand("awk 'BEGIN{print \"header\"} {print $1}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output[0]).toBe('header');
        expect(output).toContain('Alice');
        expect(output).toContain('Bob');
        expect(output).toContain('Charlie');
    });

    it('should execute END block', async () => {
        const cmd = makeCommand("awk '{sum+=$2} END{print sum}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('90');
    });

    // Pattern matching
    it('should filter by regex', async () => {
        const cmd = makeCommand("awk '/Bob/ {print $0}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('Bob 25 London');
        expect(output.length).toBe(1);
    });

    it('should filter by comparison', async () => {
        const cmd = makeCommand("awk '$2 > 25 {print $1}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('Alice');
        expect(output).toContain('Charlie');
        expect(output).not.toContain('Bob');
    });

    // String concatenation
    it('should concatenate with no comma', async () => {
        const cmd = makeCommand("awk '{print $1 \"-\" $2}' /home/user/data.txt");
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('Alice-30');
        expect(output).toContain('Bob-25');
        expect(output).toContain('Charlie-35');
    });

    // Errors
    it('should error on missing program', async () => {
        const cmd = makeCommand('awk');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing program'))).toBe(true);
    });

    it('should error on missing file', async () => {
        const cmd = makeCommand("awk '{print $1}' /nonexistent");
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });
});
