import { CliTestHarness } from '../lib/testing';
import { CliSnippetCommandProcessor } from '../lib/processors';
import { ICliCommandChildProcessor } from '@qodalis/cli-core';

/**
 * Wire parent links on sub-processors so the state store manager can find
 * the root processor (and thus the correct state store) when executing
 * subcommands through the harness.
 */
function wireParents(processor: CliSnippetCommandProcessor): void {
    for (const sub of processor.processors ?? []) {
        (sub as ICliCommandChildProcessor).parent = processor;
    }
}

describe('CliSnippetCommandProcessor', () => {
    let harness: CliTestHarness;
    let processor: CliSnippetCommandProcessor;

    beforeEach(() => {
        harness = new CliTestHarness();
        processor = new CliSnippetCommandProcessor();
        wireParents(processor);
        harness.registerProcessor(processor);
    });

    it('should show "No snippets" when list is empty', async () => {
        const result = await harness.execute('snippet list');
        expect(result.output).toContain('No snippets saved yet');
        expect(result.exitCode).toBe(0);
    });

    it('should save a snippet and show it in list', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        const result = await harness.execute('snippet list');
        expect(result.output).toContain('greet');
        expect(result.output).toContain('echo Hello {{name}}');
        expect(result.exitCode).toBe(0);
    });

    it('should show the template for a saved snippet', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        const result = await harness.execute('snippet show greet');
        expect(result.output).toContain('greet');
        expect(result.output).toContain('{{name}}');
        expect(result.exitCode).toBe(0);
    });

    it('should delete a snippet and then list shows "No snippets"', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        await harness.execute('snippet delete greet');
        const result = await harness.execute('snippet list');
        expect(result.output).toContain('No snippets saved yet');
        expect(result.exitCode).toBe(0);
    });

    it('should show error with missing variable names when running snippet with unresolved vars', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        const result = await harness.execute('snippet run greet');
        expect(result.stderr.some((l) => l.includes('Missing variables') && l.includes('name'))).toBe(true);
    });

    it('should show error when saving snippet without template', async () => {
        const result = await harness.execute('snippet save greet');
        expect(result.stderr.some((l) => l.includes('Usage:'))).toBe(true);
    });

    it('should show error when showing a non-existent snippet', async () => {
        const result = await harness.execute('snippet show nonexistent');
        expect(result.stderr.some((l) => l.includes('not found'))).toBe(true);
    });

    it('should show error when deleting a non-existent snippet', async () => {
        const result = await harness.execute('snippet delete nonexistent');
        expect(result.stderr.some((l) => l.includes('not found'))).toBe(true);
    });

    it('should report snippet count when called with no subcommand', async () => {
        const result = await harness.execute('snippet');
        expect(result.output).toContain('snippet(s) saved');
        expect(result.exitCode).toBe(0);
    });

    it('snippet run resolves variables and executes command', async () => {
        await harness.execute('snippet save greet "echo Hello {{name}}"');
        // run with variable — echo is a built-in, its output should appear
        const result = await harness.execute('snippet run greet name=World');
        expect(result.output).toContain('World');
    });
});
