import { ICliFilePickerProvider, CliFileResult } from '@qodalis/cli-core';
import { InputModeHost } from '../../lib/input/input-mode';
import { FileInputMode } from '../../lib/input/modes/file-input-mode';

function makeFile(name: string, size: number): CliFileResult {
    return { name, content: 'data', size, type: 'text/plain' };
}

class MockFilePickerProvider implements ICliFilePickerProvider {
    isSupported = true;
    filesToReturn: CliFileResult[] | null = null;
    directoryToReturn: CliFileResult | null = null;

    async pickFiles(): Promise<CliFileResult[] | null> {
        return this.filesToReturn;
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        return this.directoryToReturn;
    }
}

class MockHost implements InputModeHost {
    written: string[] = [];
    modePushed = false;
    modePopped = false;
    filePickerProvider: MockFilePickerProvider = new MockFilePickerProvider();
    terminal = { rows: 24, cols: 80, write: (s: string) => this.written.push(s) } as any;

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(): void { this.modePushed = true; }
    popMode(): void { this.modePopped = true; }
}

describe('FileInputMode', () => {
    let host: MockHost;
    let resolved: CliFileResult[] | null | undefined;

    function makeMode(promptText: string, options?: any): FileInputMode {
        resolved = undefined;
        return new FileInputMode(host as any, (val) => { resolved = val; }, promptText, options);
    }

    beforeEach(() => {
        host = new MockHost();
    });

    it('should resolve with single file when provider returns one result', async () => {
        const file = makeFile('document.txt', 1024);
        host.filePickerProvider.filesToReturn = [file];

        const mode = makeMode('Upload file');
        mode.activate();

        // Wait for the async pick to complete
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(resolved).toEqual([file]);
        expect(host.modePopped).toBe(true);
    });

    it('should resolve with multiple files when provider returns array', async () => {
        const files = [makeFile('a.txt', 100), makeFile('b.txt', 200)];
        host.filePickerProvider.filesToReturn = files;

        const mode = makeMode('Upload files', { multiple: true });
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(resolved).toEqual(files);
        expect(host.modePopped).toBe(true);
    });

    it('should resolve null when provider returns null (cancelled)', async () => {
        host.filePickerProvider.filesToReturn = null;

        const mode = makeMode('Upload file');
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
    });

    it('should abort with warning when provider is not supported', async () => {
        host.filePickerProvider.isSupported = false;

        const mode = makeMode('Upload file');
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(resolved).toBeNull();
        expect(host.modePopped).toBe(true);
        expect(host.written.some(s => s.includes('not available'))).toBe(true);
    });

    it('should show accept hint in prompt when accept option is provided', async () => {
        host.filePickerProvider.filesToReturn = null;

        const mode = makeMode('Pick image', { accept: 'image/*' });
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(host.written.some(s => s.includes('image/*'))).toBe(true);
    });

    it('should show prompt text on activate', () => {
        host.filePickerProvider.filesToReturn = null;

        const mode = makeMode('Select a file');
        mode.activate();

        expect(host.written.some(s => s.includes('Select a file'))).toBe(true);
    });

    it('should display file names and sizes after selection', async () => {
        const file = makeFile('report.pdf', 2048);
        host.filePickerProvider.filesToReturn = [file];

        const mode = makeMode('Choose file');
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        const allWritten = host.written.join('');
        expect(allWritten).toContain('report.pdf');
        expect(allWritten).toContain('2.0 KB');
    });

    it('should show total count when multiple files selected', async () => {
        const files = [makeFile('a.txt', 512), makeFile('b.txt', 512)];
        host.filePickerProvider.filesToReturn = files;

        const mode = makeMode('Upload', { multiple: true });
        mode.activate();

        await new Promise(resolve => setTimeout(resolve, 0));

        const allWritten = host.written.join('');
        expect(allWritten).toContain('2 files selected');
    });

    it('should not call handleInput (no-op)', async () => {
        host.filePickerProvider.filesToReturn = null;

        const mode = makeMode('Upload');
        mode.activate();
        await mode.handleInput('x'); // should be no-op
        // no errors thrown
        expect(true).toBe(true);
    });
});
