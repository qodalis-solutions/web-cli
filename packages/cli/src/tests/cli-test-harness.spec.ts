import { CliTestHarness } from '../lib/testing';
import {
    CliEchoCommandProcessor,
    CliBase64CommandProcessor,
    CliSeqCommandProcessor,
} from '../lib/processors';
import {
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';

// ---------------------------------------------------------------------------
// A minimal test processor to verify piped data flows correctly
// ---------------------------------------------------------------------------

class UpperProcessor implements ICliCommandProcessor {
    command = 'upper';
    description = 'Uppercase piped input';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const input = command.data ?? command.value ?? '';
        const result = String(input).toUpperCase();
        context.writer.writeln(result);
        context.process.output(result);
    }
}

class FailProcessor implements ICliCommandProcessor {
    command = 'fail';
    description = 'Always exits with code 1';
    author = DefaultLibraryAuthor;

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeError('Something went wrong');
        context.process.exit(1, { silent: true });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CliTestHarness', () => {
    let harness: CliTestHarness;

    beforeEach(() => {
        harness = new CliTestHarness();
        harness.registerProcessors([
            new CliEchoCommandProcessor(),
            new CliBase64CommandProcessor(),
            new CliSeqCommandProcessor(),
            new UpperProcessor(),
            new FailProcessor(),
        ]);
    });

    it('should execute a simple echo command', async () => {
        const result = await harness.execute('echo Hello World');
        expect(result.output).toContain('Hello World');
        expect(result.exitCode).toBe(0);
    });

    it('should pipe echo output into another command', async () => {
        const result = await harness.execute('echo hello world | upper');
        expect(result.output).toContain('HELLO WORLD');
    });

    it('should support && operator (run second only if first succeeds)', async () => {
        const result = await harness.execute('echo first && echo second');
        expect(result.output).toContain('first');
        expect(result.output).toContain('second');
    });

    it('should skip second command after && if first fails', async () => {
        const result = await harness.execute('fail && echo should-not-run');
        expect(result.output).not.toContain('should-not-run');
        expect(result.stderr.some(l => l.includes('Something went wrong'))).toBe(true);
    });

    it('should support || operator (run second only if first fails)', async () => {
        const result = await harness.execute('fail || echo fallback');
        expect(result.output).toContain('fallback');
    });

    it('should not run || branch when first succeeds', async () => {
        const result = await harness.execute('echo ok || echo should-not-run');
        expect(result.output).toContain('ok');
        expect(result.output).not.toContain('should-not-run');
    });

    it('should support ; operator (always run both)', async () => {
        const result = await harness.execute('echo one ; echo two');
        expect(result.output).toContain('one');
        expect(result.output).toContain('two');
    });

    it('should run ; after failure', async () => {
        const result = await harness.execute('fail ; echo still-runs');
        expect(result.output).toContain('still-runs');
    });

    it('should report error for unknown commands', async () => {
        const result = await harness.execute('nonexistent-command');
        expect(result.stderr.some(l => l.includes('Command not found'))).toBe(true);
    });

    it('should capture pipeline data from process.output()', async () => {
        const result = await harness.execute('echo test-data');
        expect(result.data).toBe('test-data');
    });

    it('should pass data through a multi-stage pipe', async () => {
        // echo -> upper -> should produce HELLO
        const result = await harness.execute('echo hello | upper');
        expect(result.data).toBe('HELLO');
    });
});
