import {
    ICliExecutionContext,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { IndexedDbFileSystemService } from '../lib/services';
import { CliAwkCommandProcessor } from '../lib/processors/cli-awk-command-processor';
import { createStubWriter, createMockContext, makeCommand } from './helpers';

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

// ---------------------------------------------------------------------------
// awk piped input tests
// ---------------------------------------------------------------------------

describe('CliAwkCommandProcessor (piped input)', () => {
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

    it('should process piped input', async () => {
        const cmd = makeCommand("awk '{print $1}'", {}, 'hello world\nfoo bar');
        await processor.processCommand(cmd, ctx);
        const output = writer.written.join('\n');
        expect(output).toContain('hello');
        expect(output).toContain('foo');
    });

    it('should process piped input with field separator', async () => {
        const cmd = makeCommand("awk -F ',' '{print $2}'", {}, 'a,b,c\nd,e,f');
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output).toContain('b');
        expect(output).toContain('e');
    });

    it('should process piped input with BEGIN/END', async () => {
        const cmd = makeCommand("awk 'BEGIN{print \"start\"} {print $0} END{print \"done\"}'", {}, 'line1\nline2');
        await processor.processCommand(cmd, ctx);
        const output = writer.written;
        expect(output[0]).toBe('start');
        expect(output).toContain('line1');
        expect(output).toContain('line2');
        expect(output[output.length - 1]).toBe('done');
    });
});
