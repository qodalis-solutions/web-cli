import { ICliExecutionContext } from '@qodalis/cli-core';
import { CliVersionCommandProcessor } from '../lib/processors/system/cli-version-command-processor';
import { getCliNameArt } from '../lib/constants';

/** Runs `version` and returns everything it wrote. */
async function runVersion(options?: Record<string, unknown>): Promise<string> {
    const written: string[] = [];
    const context = {
        options,
        terminal: { cols: 80 },
        services: { get: () => undefined },
        writer: {
            writeln: (text = '') => written.push(text),
            writeBox: (lines: string[]) => written.push(...lines),
            wrapInColor: (text: string) => text,
        },
    } as unknown as ICliExecutionContext;

    await new CliVersionCommandProcessor().processCommand({} as never, context);
    return written.join('\n');
}

describe('version command', () => {
    it('shows the Qodalis CLI art and docs link', async () => {
        const output = await runVersion();

        expect(output).toContain(getCliNameArt(80));
        expect(output).toContain('https://cli.qodalis.com/docs/');
        expect(output).not.toContain('App');
    });

    it("keeps the Qodalis brand with an application's branding, and adds its name", async () => {
        const output = await runVersion({
            branding: {
                name: 'RateBell CLI',
                art: 'RATEBELL',
                docsUrl: 'https://ratebell.app',
            },
        });

        expect(output).toContain(getCliNameArt(80));
        expect(output).toContain('https://cli.qodalis.com/docs/');
        expect(output).toContain('RateBell CLI');
    });
});
