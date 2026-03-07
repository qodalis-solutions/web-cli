import { CliTestHarness } from '../lib/testing';
import { CliCaptureCommandProcessor } from '../lib/processors';

/**
 * Build a fake terminal whose buffer contains the given lines.
 */
function fakeTerminal(lines: string[], theme?: { background: string; foreground: string }): any {
    return {
        options: { theme: theme ?? { background: '#0c0c0c', foreground: '#cccccc' } },
        buffer: {
            active: {
                length: lines.length,
                getLine: (i: number) => ({
                    translateToString: (_trim: boolean) => lines[i],
                }),
            },
        },
    };
}

/**
 * Wrap a processor's processCommand so the context receives a controlled terminal.
 */
function withTerminal(
    processor: CliCaptureCommandProcessor,
    terminal: any,
): void {
    const orig = processor.processCommand.bind(processor);
    processor.processCommand = async (cmd, ctx) => {
        (ctx as any).terminal = terminal;
        await orig(cmd, ctx);
    };
}

describe('CliCaptureCommandProcessor', () => {
    let harness: CliTestHarness;
    let processor: CliCaptureCommandProcessor;

    // Track what the download() method was called with
    let downloadedFilename: string | undefined;
    let downloadedContent: string | undefined;
    let downloadedMime: string | undefined;

    beforeEach(() => {
        harness = new CliTestHarness();
        processor = new CliCaptureCommandProcessor();
        harness.registerProcessor(processor);

        downloadedFilename = undefined;
        downloadedContent = undefined;
        downloadedMime = undefined;

        // Spy on the processor's own download method so we don't touch DOM globals
        spyOn<any>(processor, 'download').and.callFake(
            (filename: string, content: string, mimeType: string) => {
                downloadedFilename = filename;
                downloadedContent = content;
                downloadedMime = mimeType;
            },
        );
    });

    afterEach(() => {
        pkillLeftovers();
    });

    it('should error on unknown format', async () => {
        withTerminal(processor, fakeTerminal(['line']));
        const result = await harness.execute('capture --format=xml');
        expect(result.stderr.some((l) => l.includes('"html" or "txt"'))).toBe(true);
        expect(downloadedFilename).toBeUndefined();
    });

    it('should write error when terminal buffer is unavailable', async () => {
        // Leave the harness terminal as `{}` (no buffer)
        const result = await harness.execute('capture --format=txt');
        expect(result.stderr.some((l) => l.includes('not available'))).toBe(true);
        expect(downloadedFilename).toBeUndefined();
    });

    it('should download a .txt file when format is txt', async () => {
        withTerminal(processor, fakeTerminal(['line one', 'line two', 'line three']));
        const result = await harness.execute('capture --format=txt --filename=myfile');

        expect(result.exitCode).toBe(0);
        expect(downloadedFilename).toBe('myfile.txt');
        expect(downloadedMime).toBe('text/plain');
        expect(downloadedContent).toContain('line one');
        expect(downloadedContent).toContain('line two');
        expect(result.stdout.some((l) => l.includes('myfile.txt'))).toBe(true);
    });

    it('should download a .html file when format is html (default)', async () => {
        withTerminal(processor, fakeTerminal(['hello world', '<script>alert(1)</script>']));
        const result = await harness.execute('capture --filename=out');

        expect(result.exitCode).toBe(0);
        expect(downloadedFilename).toBe('out.html');
        expect(downloadedMime).toBe('text/html');
        // HTML entities should be escaped
        expect(downloadedContent).toContain('&lt;script&gt;');
        expect(downloadedContent).toContain('<!DOCTYPE html>');
        expect(result.stdout.some((l) => l.includes('out.html'))).toBe(true);
    });

    it('should respect the --lines parameter', async () => {
        withTerminal(processor, fakeTerminal(['a', 'b', 'c', 'd', 'e']));
        await harness.execute('capture --format=txt --lines=2 --filename=last2');

        // Only the last 2 lines: d and e
        expect(downloadedContent).toContain('d');
        expect(downloadedContent).toContain('e');
        expect(downloadedContent).not.toContain('a');
    });

    it('should use a default filename with timestamp when --filename is omitted', async () => {
        withTerminal(processor, fakeTerminal(['some output']));
        await harness.execute('capture --format=txt');

        expect(downloadedFilename).toMatch(/^terminal-\d+\.txt$/);
    });

    it('should use the terminal theme colors in html output', async () => {
        const theme = { background: '#1a1a2e', foreground: '#eaeaea' };
        withTerminal(processor, fakeTerminal(['content'], theme));
        await harness.execute('capture --format=html --filename=themed');

        expect(downloadedContent).toContain('#1a1a2e');
        expect(downloadedContent).toContain('#eaeaea');
    });
});

/** No-op — Karma cleans up after itself; this is just a placeholder for symmetry. */
function pkillLeftovers(): void {}
