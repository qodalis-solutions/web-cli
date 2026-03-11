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
import { CliStatCommandProcessor } from '../lib/processors/cli-stat-command-processor';
import { CliChmodCommandProcessor } from '../lib/processors/cli-chmod-command-processor';
import { CliDuCommandProcessor } from '../lib/processors/cli-du-command-processor';
import { CliLnCommandProcessor } from '../lib/processors/cli-ln-command-processor';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createStubWriter(): ICliTerminalWriter & { written: string[]; keyValues: Record<string, string>[] } {
    const written: string[] = [];
    const keyValues: Record<string, string>[] = [];
    return {
        written,
        keyValues,
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
        writeKeyValue(entries: any, _options?: any) {
            keyValues.push(entries);
            if (typeof entries === 'object' && !Array.isArray(entries)) {
                for (const [k, v] of Object.entries(entries)) {
                    written.push(`${k}: ${v}`);
                }
            }
        },
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
    const tokens = raw.split(/\s+/).filter(Boolean);
    const command = tokens[0];
    const parsedArgs: Record<string, any> = {};
    const valueParts: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith('--')) {
            const eqIdx = t.indexOf('=');
            if (eqIdx !== -1) {
                parsedArgs[t.slice(2, eqIdx)] = t.slice(eqIdx + 1);
            } else {
                parsedArgs[t.slice(2)] = true;
            }
        } else if (t.startsWith('-') && t.length > 1) {
            parsedArgs[t.slice(1)] = true;
        } else {
            valueParts.push(t);
        }
    }

    const value = valueParts.length > 0 ? valueParts.join(' ') : undefined;
    const mergedArgs = { ...parsedArgs, ...args };

    return {
        command,
        rawCommand: raw,
        value,
        chainCommands: [],
        args: mergedArgs,
    } as any;
}

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/welcome.txt', 'Welcome to Qodalis CLI filesystem!\n');
    fs.createDirectory('/home/user/docs');
    fs.createFile('/home/user/docs/readme.md', 'Line 1\nLine 2\nLine 3\n');
    fs.createFile('/home/user/docs/notes.txt', 'Hello World\nhello again\nGoodbye\n');
    fs.createFile('/home/user/hello.sh', '#!/bin/bash\necho "Hello World"\nexit 0\n');
    fs.createFile('/home/user/executable.sh', '#!/bin/bash\nexit 0\n');
    fs.createDirectory('/home/user/subdir');
    fs.createFile('/home/user/subdir/nested.txt', 'nested content\n');
    return fs;
}

// ---------------------------------------------------------------------------
// stat command tests
// ---------------------------------------------------------------------------

describe('CliStatCommandProcessor', () => {
    let processor: CliStatCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ReturnType<typeof createStubWriter>;
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliStatCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "stat"', () => {
        expect(processor.command).toBe('stat');
    });

    it('should show file metadata', async () => {
        const cmd = makeCommand('stat /home/user/welcome.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('/home/user/welcome.txt');
        expect(output).toContain('file');
        expect(writer.keyValues.length).toBe(1);
        expect(writer.keyValues[0]['Type']).toBe('file');
    });

    it('should show directory metadata', async () => {
        const cmd = makeCommand('stat /home/user/docs');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('/home/user/docs');
        expect(writer.keyValues[0]['Type']).toBe('directory');
    });

    it('should error on nonexistent path', async () => {
        const cmd = makeCommand('stat /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('stat');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// chmod command tests
// ---------------------------------------------------------------------------

describe('CliChmodCommandProcessor', () => {
    let processor: CliChmodCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ReturnType<typeof createStubWriter>;
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliChmodCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "chmod"', () => {
        expect(processor.command).toBe('chmod');
    });

    it('should set permissions with octal 755', async () => {
        const cmd = makeCommand('chmod 755 /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/hello.sh');
        expect(node!.permissions).toBe('rwxr-xr-x');
    });

    it('should set permissions with octal 644', async () => {
        const cmd = makeCommand('chmod 644 /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/hello.sh');
        expect(node!.permissions).toBe('rw-r--r--');
    });

    it('should set permissions with symbolic u+x', async () => {
        // Start from default rw-r--r--
        const cmd = makeCommand('chmod u+x /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/hello.sh');
        expect(node!.permissions).toBe('rwxr--r--');
    });

    it('should remove permissions with symbolic go-w', async () => {
        // First set to 777
        const setup = makeCommand('chmod 777 /home/user/hello.sh');
        await processor.processCommand(setup, ctx);
        // Now remove write from group and others
        const cmd = makeCommand('chmod go-w /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/hello.sh');
        expect(node!.permissions).toBe('rwxr-xr-x');
    });

    it('should set permissions with symbolic a+r', async () => {
        // Start with 000
        const setup = makeCommand('chmod 000 /home/user/hello.sh');
        await processor.processCommand(setup, ctx);
        const cmd = makeCommand('chmod a+r /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/hello.sh');
        expect(node!.permissions).toBe('r--r--r--');
    });

    it('should apply -R recursive flag', async () => {
        const cmd = makeCommand('chmod -R 755 /home/user/subdir');
        await processor.processCommand(cmd, ctx);
        const dir = fs.getNode('/home/user/subdir');
        const nested = fs.getNode('/home/user/subdir/nested.txt');
        expect(dir!.permissions).toBe('rwxr-xr-x');
        expect(nested!.permissions).toBe('rwxr-xr-x');
    });

    it('should error on invalid mode', async () => {
        const cmd = makeCommand('chmod xyz /home/user/hello.sh');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('invalid mode'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('chmod 755 /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('chmod');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// du command tests
// ---------------------------------------------------------------------------

describe('CliDuCommandProcessor', () => {
    let processor: CliDuCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ReturnType<typeof createStubWriter>;
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliDuCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "du"', () => {
        expect(processor.command).toBe('du');
    });

    it('should show default output for directory', async () => {
        const cmd = makeCommand('du /home/user/docs');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('/home/user/docs');
    });

    it('should show summary with -s', async () => {
        const cmd = makeCommand('du -s /home/user/docs');
        await processor.processCommand(cmd, ctx);
        // With -s, only one entry for the root path
        const lines = writer.written.filter(l => l.includes('/home/user/docs'));
        expect(lines.length).toBe(1);
    });

    it('should show human-readable with -h', async () => {
        const cmd = makeCommand('du -h /home/user/docs');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // Human-readable should contain B/K/M/G suffix
        expect(output).toMatch(/\d+(\.\d+)?[BKMG]/);
    });

    it('should respect -d max-depth', async () => {
        const cmd = makeCommand('du /home/user', { d: '0' });
        await processor.processCommand(cmd, ctx);
        // With depth 0, only show the root directory itself
        const lines = writer.written.filter(l => l.includes('\t'));
        expect(lines.length).toBe(1);
        expect(lines[0]).toContain('/home/user');
    });

    it('should error on nonexistent path', async () => {
        const cmd = makeCommand('du /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
        expect(writer.written.some(l => l.includes('No such file or directory'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('du');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ln command tests
// ---------------------------------------------------------------------------

describe('CliLnCommandProcessor', () => {
    let processor: CliLnCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ReturnType<typeof createStubWriter>;
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliLnCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "ln"', () => {
        expect(processor.command).toBe('ln');
    });

    it('should create symlink with -s', async () => {
        const cmd = makeCommand('ln -s /home/user/hello.sh /home/user/link.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/link.sh');
        expect(node).not.toBeNull();
        expect(node!.linkTarget).toBe('/home/user/hello.sh');
    });

    it('should error without -s flag', async () => {
        const cmd = makeCommand('ln /home/user/hello.sh /home/user/link.sh');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('hard links not supported'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('ln -s');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing operand'))).toBe(true);
    });

    it('should allow dangling symlink', async () => {
        const cmd = makeCommand('ln -s /nonexistent/target /home/user/dangling.sh');
        await processor.processCommand(cmd, ctx);
        const node = fs.getNode('/home/user/dangling.sh');
        expect(node).not.toBeNull();
        expect(node!.linkTarget).toBe('/nonexistent/target');
    });
});
