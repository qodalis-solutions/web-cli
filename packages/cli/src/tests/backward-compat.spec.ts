import { CliInputReader } from '../lib/services/cli-input-reader';
import { InputModeHost, IInputMode } from '../lib/input/input-mode';
import { NoopFilePickerProvider } from '../lib/services/file-picker';

class MockHost implements InputModeHost {
    pushedModes: IInputMode[] = [];
    terminal = { rows: 24, cols: 80, write: () => {} } as any;
    filePickerProvider = new NoopFilePickerProvider();
    writeToTerminal(): void {}
    getTerminalRows(): number { return 24; }
    getTerminalCols(): number { return 80; }
    pushMode(mode: IInputMode): void { this.pushedModes.push(mode); }
    popMode(): void { this.pushedModes.pop(); }
}

describe('Backward Compatibility', () => {
    let host: MockHost;
    let reader: CliInputReader;

    beforeEach(() => {
        host = new MockHost();
        reader = new CliInputReader(host);
    });

    it('readLine with just prompt (no options)', () => {
        reader.readLine('Name: ');
        expect(host.pushedModes.length).toBe(1);
    });

    it('readSelect with 2 args (no selectOptions)', () => {
        reader.readSelect('Pick:', [{ label: 'A', value: 'a' }]);
        expect(host.pushedModes.length).toBe(1);
    });

    it('readMultiSelect with 2 args', () => {
        reader.readMultiSelect('Select:', [{ label: 'A', value: 'a' }]);
        expect(host.pushedModes.length).toBe(1);
    });

    it('readNumber with just prompt', () => {
        reader.readNumber('Count:');
        expect(host.pushedModes.length).toBe(1);
    });

    it('readConfirm with just prompt', () => {
        reader.readConfirm('Continue?');
        expect(host.pushedModes.length).toBe(1);
    });
});
