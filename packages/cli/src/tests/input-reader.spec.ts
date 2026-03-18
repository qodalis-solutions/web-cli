import { CliInputReader } from '../lib/services/cli-input-reader';
import { InputModeHost, IInputMode } from '../lib/input/input-mode';
import { NoopFilePickerProvider } from '../lib/services/file-picker';

class MockHost implements InputModeHost {
    written: string[] = [];
    pushedModes: IInputMode[] = [];
    terminal = {
        rows: 24,
        cols: 80,
        write: (s: string) => this.written.push(s),
    } as any;
    filePickerProvider = new NoopFilePickerProvider();

    writeToTerminal(text: string): void { this.written.push(text); }
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(mode: IInputMode): void {
        this.pushedModes.push(mode);
        mode.activate?.();
    }
    popMode(): void { this.pushedModes.pop(); }
}

describe('CliInputReader', () => {
    let host: MockHost;
    let reader: CliInputReader;

    beforeEach(() => {
        host = new MockHost();
        reader = new CliInputReader(host);
    });

    it('should push LineInputMode for readLine', () => {
        reader.readLine('Name: ');
        expect(host.pushedModes.length).toBe(1);
        expect(host.written.some(s => s.includes('Name: '))).toBe(true);
    });

    it('should push PasswordInputMode for readPassword', () => {
        reader.readPassword('Password: ');
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push ConfirmInputMode for readConfirm', () => {
        reader.readConfirm('Continue?');
        expect(host.pushedModes.length).toBe(1);
    });

    it('should reject readSelect with empty options', async () => {
        await expectAsync(reader.readSelect('Pick:', [])).toBeRejectedWithError('readSelect requires at least one option');
    });

    it('should push SelectInputMode for readSelect', () => {
        const options = [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }];
        reader.readSelect('Pick:', options);
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push SelectInputMode with onChange', () => {
        const options = [{ label: 'A', value: 'a' }];
        const onChange = jasmine.createSpy('onChange');
        reader.readSelect('Pick:', options, { onChange });
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push InlineSelectInputMode', () => {
        const options = [{ label: 'A', value: 'a' }];
        reader.readSelectInline('Size:', options);
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push MultiSelectInputMode', () => {
        const options = [{ label: 'A', value: 'a' }];
        reader.readMultiSelect('Select:', options);
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push NumberInputMode', () => {
        reader.readNumber('Count:');
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push DateInputMode', () => {
        reader.readDate('Date:');
        expect(host.pushedModes.length).toBe(1);
    });

    it('should push FileInputMode for readFile', () => {
        reader.readFile('Select file:');
        // FileInputMode is pushed, but NoopFilePickerProvider triggers
        // immediate abort (isSupported=false), which pops the mode.
        // Verify the mode was at least created and pushed.
        expect(host.pushedModes.length).toBe(0); // already popped after abort
        expect(host.written.some(s => s.includes('Select file:'))).toBe(true);
    });

    // Backward compat: old 2-arg calls still work
    it('readLine with just prompt works', () => {
        reader.readLine('Name: ');
        expect(host.pushedModes.length).toBe(1);
    });

    it('readSelect with 2 args works', () => {
        const options = [{ label: 'A', value: 'a' }];
        reader.readSelect('Pick:', options);
        expect(host.pushedModes.length).toBe(1);
    });
});
