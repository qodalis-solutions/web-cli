import { CliTestHarness } from '../lib/testing';
import { CliFontSizeCommandProcessor } from '../lib/processors';
import { ICliCommandChildProcessor } from '@qodalis/cli-core';

/**
 * Wire parent links on sub-processors so the state store manager can find
 * the root processor (and thus the correct state store) when executing
 * subcommands through the harness.
 */
function wireParents(processor: CliFontSizeCommandProcessor): void {
    for (const sub of processor.processors ?? []) {
        (sub as ICliCommandChildProcessor).parent = processor;
    }
}

describe('CliFontSizeCommandProcessor', () => {
    let harness: CliTestHarness;
    let processor: CliFontSizeCommandProcessor;

    beforeEach(() => {
        harness = new CliTestHarness();
        processor = new CliFontSizeCommandProcessor();
        wireParents(processor);
        harness.registerProcessor(processor);
    });

    it('should report current font size when called with no subcommand', async () => {
        const result = await harness.execute('font-size');
        expect(result.output).toContain('20px');
        expect(result.exitCode).toBe(0);
    });

    it('should increase font size by 2', async () => {
        const result = await harness.execute('font-size increase');
        // Default is 20, increase by 2 → 22
        expect(result.output).toContain('22px');
        expect(result.exitCode).toBe(0);
    });

    it('should decrease font size by 2', async () => {
        const result = await harness.execute('font-size decrease');
        // Default is 20, decrease by 2 → 18
        expect(result.output).toContain('18px');
        expect(result.exitCode).toBe(0);
    });

    it('should set font size to an exact value', async () => {
        const result = await harness.execute('font-size set 14');
        expect(result.output).toContain('14px');
        expect(result.exitCode).toBe(0);
    });

    it('should reset font size to 20', async () => {
        const result = await harness.execute('font-size reset');
        expect(result.output).toContain('20px');
        expect(result.exitCode).toBe(0);
    });

    it('should not go below minimum (8px) on decrease', async () => {
        // Set to 8 via state, then decrease — clamp keeps it at 8
        await harness.execute('font-size set 8');
        const result = await harness.execute('font-size decrease');
        expect(result.output).toContain('8px');
    });

    it('should not go above maximum (40px) on increase', async () => {
        // Set to 40 via state, then increase — clamp keeps it at 40
        await harness.execute('font-size set 40');
        const result = await harness.execute('font-size increase');
        expect(result.output).toContain('40px');
    });

    it('should reject font size below minimum', async () => {
        const result = await harness.execute('font-size set 4');
        expect(result.stderr.some((l) => l.includes('between 8 and 40'))).toBe(true);
    });

    it('should reject font size above maximum', async () => {
        const result = await harness.execute('font-size set 99');
        expect(result.stderr.some((l) => l.includes('between 8 and 40'))).toBe(true);
    });

    it('should reject non-numeric font size', async () => {
        const result = await harness.execute('font-size set abc');
        expect(result.stderr.some((l) => l.includes('between 8 and 40'))).toBe(true);
    });
});
