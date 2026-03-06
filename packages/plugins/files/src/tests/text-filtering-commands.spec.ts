import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliSortCommandProcessor } from '../lib/processors/cli-sort-command-processor';
import { CliUniqCommandProcessor } from '../lib/processors/cli-uniq-command-processor';
import { CliCutCommandProcessor } from '../lib/processors/cli-cut-command-processor';
import { CliPasteCommandProcessor } from '../lib/processors/cli-paste-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

function setupTestFs(): IndexedDbFileSystemService {
    const fs = new IndexedDbFileSystemService();
    fs.createDirectory('/home/user');
    fs.createFile('/home/user/numbers.txt', '3\n1\n4\n1\n5\n9\n2\n6\n');
    fs.createFile('/home/user/dupes.txt', 'apple\napple\nbanana\nbanana\nbanana\ncherry\n');
    fs.createFile('/home/user/csv.txt', 'name,age,city\nalice,30,paris\nbob,25,london\ncharlie,35,tokyo\n');
    fs.createFile('/home/user/tabs.txt', 'col1\tcol2\tcol3\nval1\tval2\tval3\n');
    fs.createFile('/home/user/alpha.txt', 'banana\napple\ncherry\ndate\n');
    fs.createFile('/home/user/casemix.txt', 'Hello\nhello\nHELLO\nworld\nWorld\n');
    fs.createFile('/home/user/file1.txt', 'a\nb\nc\n');
    fs.createFile('/home/user/file2.txt', '1\n2\n3\n4\n');
    return fs;
}

// ---------------------------------------------------------------------------
// sort command tests
// ---------------------------------------------------------------------------

describe('CliSortCommandProcessor', () => {
    let processor: CliSortCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliSortCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "sort"', () => {
        expect(processor.command).toBe('sort');
    });

    it('should sort lines alphabetically by default', async () => {
        const cmd = makeCommand('sort /home/user/alpha.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['apple', 'banana', 'cherry', 'date']);
    });

    it('should sort in reverse with -r', async () => {
        const cmd = makeCommand('sort -r /home/user/alpha.txt', { r: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['date', 'cherry', 'banana', 'apple']);
    });

    it('should sort numerically with -n', async () => {
        const cmd = makeCommand('sort -n /home/user/numbers.txt', { n: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['1', '1', '2', '3', '4', '5', '6', '9']);
    });

    it('should deduplicate with -u', async () => {
        const cmd = makeCommand('sort -n -u /home/user/numbers.txt', { n: true, u: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['1', '2', '3', '4', '5', '6', '9']);
    });

    it('should sort by key field with -k', async () => {
        const cmd = makeCommand('sort -t , -k 2 /home/user/csv.txt', { t: ',', k: '2' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        // Sorting by age field (string sort): 25 < 30 < 35 < "age"
        expect(output).toContain('bob,25,london');
        // "age" sorts after digits in locale compare
    });

    it('should sort by numeric key with -k and -n', async () => {
        const cmd = makeCommand('sort -t , -k 2 -n /home/user/csv.txt', { t: ',', k: '2', n: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        // "age" parses as NaN -> 0, so header comes first
        expect(lines[0]).toBe('name,age,city');
        expect(lines[1]).toBe('bob,25,london');
        expect(lines[2]).toBe('alice,30,paris');
        expect(lines[3]).toBe('charlie,35,tokyo');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('sort');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('sort /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// uniq command tests
// ---------------------------------------------------------------------------

describe('CliUniqCommandProcessor', () => {
    let processor: CliUniqCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliUniqCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "uniq"', () => {
        expect(processor.command).toBe('uniq');
    });

    it('should collapse adjacent duplicates by default', async () => {
        const cmd = makeCommand('uniq /home/user/dupes.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should prefix count with -c', async () => {
        const cmd = makeCommand('uniq -c /home/user/dupes.txt', { c: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('2 apple');
        expect(output).toContain('3 banana');
        expect(output).toContain('1 cherry');
    });

    it('should show only duplicates with -d', async () => {
        const cmd = makeCommand('uniq -d /home/user/dupes.txt', { d: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['apple', 'banana']);
    });

    it('should show only unique lines with -u', async () => {
        const cmd = makeCommand('uniq -u /home/user/dupes.txt', { u: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['cherry']);
    });

    it('should ignore case with -i', async () => {
        const cmd = makeCommand('uniq -i /home/user/casemix.txt', { i: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        // Hello/hello/HELLO collapse, world/World collapse
        expect(lines.length).toBe(2);
        expect(lines[0]).toBe('Hello');
        expect(lines[1]).toBe('world');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('uniq');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('uniq /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// cut command tests
// ---------------------------------------------------------------------------

describe('CliCutCommandProcessor', () => {
    let processor: CliCutCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliCutCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "cut"', () => {
        expect(processor.command).toBe('cut');
    });

    it('should extract field 2 with comma delimiter', async () => {
        const cmd = makeCommand('cut -d , -f 2 /home/user/csv.txt', { d: ',', f: '2' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['age', '30', '25', '35']);
    });

    it('should extract fields 1 and 3', async () => {
        const cmd = makeCommand('cut -d , -f 1,3 /home/user/csv.txt', { d: ',', f: '1,3' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('name,city');
        expect(lines[1]).toBe('alice,paris');
    });

    it('should extract characters 1-5', async () => {
        const cmd = makeCommand('cut -c 1-5 /home/user/csv.txt', { c: '1-5' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('name,');
        expect(lines[1]).toBe('alice');
    });

    it('should extract single character position', async () => {
        const cmd = makeCommand('cut -c 3 /home/user/csv.txt', { c: '3' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('m'); // 'name,...' -> 3rd char is 'm'
        expect(lines[1]).toBe('i'); // 'alice,...' -> 3rd char is 'i'
    });

    it('should use tab as default delimiter for fields', async () => {
        const cmd = makeCommand('cut -f 2 /home/user/tabs.txt', { f: '2' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('col2');
        expect(lines[1]).toBe('val2');
    });

    it('should error when neither -f nor -c given', async () => {
        const cmd = makeCommand('cut /home/user/csv.txt');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('you must specify'))).toBe(true);
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('cut -f 1', { f: '1' });
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('cut -f 1 /nonexistent', { f: '1' });
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// paste command tests
// ---------------------------------------------------------------------------

describe('CliPasteCommandProcessor', () => {
    let processor: CliPasteCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliPasteCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should have command "paste"', () => {
        expect(processor.command).toBe('paste');
    });

    it('should merge two files side by side with tab', async () => {
        const cmd = makeCommand('paste /home/user/file1.txt /home/user/file2.txt');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('a\t1');
        expect(lines[1]).toBe('b\t2');
        expect(lines[2]).toBe('c\t3');
        // file1 has 3 lines, file2 has 4 => pad file1 with empty
        expect(lines[3]).toBe('\t4');
    });

    it('should use custom delimiter with -d', async () => {
        const cmd = makeCommand('paste -d , /home/user/file1.txt /home/user/file2.txt', { d: ',' });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('a,1');
        expect(lines[1]).toBe('b,2');
    });

    it('should support serial mode with -s', async () => {
        const cmd = makeCommand('paste -s /home/user/file1.txt /home/user/file2.txt', { s: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('a\tb\tc');
        expect(lines[1]).toBe('1\t2\t3\t4');
    });

    it('should support serial mode with single file', async () => {
        const cmd = makeCommand('paste -s /home/user/file1.txt', { s: true });
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines[0]).toBe('a\tb\tc');
    });

    it('should error on missing operand', async () => {
        const cmd = makeCommand('paste');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error when only one file given without -s', async () => {
        const cmd = makeCommand('paste /home/user/file1.txt');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('missing file operand'))).toBe(true);
    });

    it('should error on nonexistent file', async () => {
        const cmd = makeCommand('paste /home/user/file1.txt /nonexistent');
        await processor.processCommand(cmd, ctx);
        expect(writer.written.some(l => l.includes('[error]'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// sort command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliSortCommandProcessor (piped input)', () => {
    let processor: CliSortCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliSortCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should sort piped text', async () => {
        const cmd = makeCommand('sort', {}, 'banana\napple\ncherry');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should sort piped text numerically with -n', async () => {
        const cmd = makeCommand('sort -n', { n: true }, '3\n1\n2');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['1', '2', '3']);
    });

    it('should sort piped text in reverse with -r', async () => {
        const cmd = makeCommand('sort -r', { r: true }, 'a\nc\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['c', 'b', 'a']);
    });
});

// ---------------------------------------------------------------------------
// uniq command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliUniqCommandProcessor (piped input)', () => {
    let processor: CliUniqCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliUniqCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should deduplicate piped text', async () => {
        const cmd = makeCommand('uniq', {}, 'a\na\nb\nc\nc');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('should count duplicates with -c on piped input', async () => {
        const cmd = makeCommand('uniq -c', { c: true }, 'a\na\nb');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('2 a');
        expect(output).toContain('1 b');
    });
});

// ---------------------------------------------------------------------------
// cut command tests (piped input)
// ---------------------------------------------------------------------------

describe('CliCutCommandProcessor (piped input)', () => {
    let processor: CliCutCommandProcessor;
    let fs: IndexedDbFileSystemService;
    let writer: ICliTerminalWriter & { written: string[] };
    let ctx: ICliExecutionContext;

    beforeEach(() => {
        processor = new CliCutCommandProcessor();
        fs = setupTestFs();
        writer = createStubWriter();
        ctx = createMockContext(writer, fs);
    });

    it('should cut fields from piped text', async () => {
        const cmd = makeCommand('cut -d , -f 2', { d: ',', f: '2' }, 'a,b,c\n1,2,3');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        const lines = output.split('\n').filter(Boolean);
        expect(lines).toEqual(['b', '2']);
    });
});
