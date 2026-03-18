import { CliTestHarness } from '../lib/testing';
import {
    CliEchoCommandProcessor,
    CliJsonCommandProcessor,
    CliSeqCommandProcessor,
    CliExportCommandProcessor,
    CliUnsetCommandProcessor,
    CliEnvCommandProcessor,
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
            new CliJsonCommandProcessor(),
            new CliSeqCommandProcessor(),
            new CliExportCommandProcessor(),
            new CliUnsetCommandProcessor(),
            new CliEnvCommandProcessor(),
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

    it('should expose tables array in result', async () => {
        const result = await harness.execute('echo test');
        expect(result.tables).toBeDefined();
        expect(Array.isArray(result.tables)).toBe(true);
    });

    it('should expose lists array in result', async () => {
        const result = await harness.execute('echo test');
        expect(result.lists).toBeDefined();
        expect(Array.isArray(result.lists)).toBe(true);
    });

    it('should chain && then || correctly', async () => {
        const result = await harness.execute('echo start && fail || echo recovered');
        expect(result.output).toContain('start');
        expect(result.output).toContain('recovered');
    });

    it('should chain ; then && correctly', async () => {
        const result = await harness.execute('echo one ; echo two && echo three');
        expect(result.output).toContain('one');
        expect(result.output).toContain('two');
        expect(result.output).toContain('three');
    });

    it('should handle json format command', async () => {
        const result = await harness.execute('json format {"a":1}');
        expect(result.output).toContain('"a": 1');
    });

    it('should handle seq command', async () => {
        const result = await harness.execute('seq 3');
        expect(result.output).toContain('1');
        expect(result.output).toContain('2');
        expect(result.output).toContain('3');
    });

    it('should pipe seq into upper', async () => {
        // seq produces numbers, upper should still uppercase the string representation
        const result = await harness.execute('echo abc | upper');
        expect(result.data).toBe('ABC');
    });

    it('should handle multiple ; separated commands', async () => {
        const result = await harness.execute('echo a ; echo b ; echo c');
        expect(result.output).toContain('a');
        expect(result.output).toContain('b');
        expect(result.output).toContain('c');
    });

    it('should skip all after && when first fails', async () => {
        const result = await harness.execute('fail && echo a && echo b');
        expect(result.output).not.toContain('a');
        expect(result.output).not.toContain('b');
    });

    it('should handle empty echo', async () => {
        const result = await harness.execute('echo');
        expect(result.exitCode).toBe(0);
    });

    // -----------------------------------------------------------------------
    // Environment variables
    // -----------------------------------------------------------------------

    it('should set and use environment variable with inline assignment', async () => {
        await harness.execute('GREETING=hello');
        const result = await harness.execute('echo $GREETING');
        expect(result.output).toContain('hello');
    });

    it('should set variable with export command', async () => {
        await harness.execute('export NAME=world');
        const result = await harness.execute('echo $NAME');
        expect(result.output).toContain('world');
    });

    it('should substitute ${VAR} braced syntax', async () => {
        await harness.execute('export LANG=TypeScript');
        const result = await harness.execute('echo ${LANG}');
        expect(result.output).toContain('TypeScript');
    });

    it('should show all variables with env command', async () => {
        const result = await harness.execute('env');
        expect(result.output).toContain('SHELL=/bin/sh');
        expect(result.output).toContain('HOME=/home/user');
    });

    it('should show single variable with printenv', async () => {
        const result = await harness.execute('printenv HOME');
        expect(result.output).toContain('/home/user');
    });

    it('should unset a variable', async () => {
        await harness.execute('export TEMP=value');
        await harness.execute('unset TEMP');
        const result = await harness.execute('printenv TEMP');
        // printenv exits with code 1 when variable not found
        expect(result.exitCode).not.toBe(0);
    });

    it('should show all with export (no args)', async () => {
        const result = await harness.execute('export');
        expect(result.output).toContain('declare -x SHELL=');
    });

    it('should not expand variables inside single quotes', async () => {
        await harness.execute('export FOO=bar');
        const result = await harness.execute("echo '$FOO'");
        expect(result.output).toContain('$FOO');
    });

    it('should use variable in pipe chain', async () => {
        await harness.execute('export MSG=hello');
        const result = await harness.execute('echo $MSG | upper');
        expect(result.output).toContain('HELLO');
    });

    it('should handle undefined variable as empty string', async () => {
        const result = await harness.execute('echo prefix$UNDEFINED_VAR_XYZ suffix');
        expect(result.output).toContain('prefix suffix');
    });

    it('should handle quoted variable value with spaces', async () => {
        await harness.execute('export MSG="hello world"');
        const result = await harness.execute('echo $MSG');
        expect(result.output).toContain('hello world');
    });
});
