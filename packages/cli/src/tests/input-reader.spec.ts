import {
    CliInputReader,
    ActiveInputRequest,
    CliInputReaderHost,
} from '../lib/services/cli-input-reader';

class MockHost implements CliInputReaderHost {
    activeInputRequest: ActiveInputRequest | null = null;
    writtenText: string[] = [];

    get activeRequest(): ActiveInputRequest | null {
        return this.activeInputRequest;
    }

    setActiveInputRequest(request: ActiveInputRequest | null): void {
        this.activeInputRequest = request;
    }

    writeToTerminal(text: string): void {
        this.writtenText.push(text);
    }

    reset(): void {
        this.activeInputRequest = null;
        this.writtenText = [];
    }
}

describe('CliInputReader', () => {
    let host: MockHost;
    let reader: CliInputReader;

    beforeEach(() => {
        host = new MockHost();
        reader = new CliInputReader(host);
    });

    describe('readLine', () => {
        it('should set an active input request of type line', () => {
            reader.readLine('Name: ');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('line');
        });

        it('should write the prompt text to the terminal', () => {
            reader.readLine('Enter name: ');
            expect(host.writtenText).toContain('Enter name: ');
        });

        it('should initialize buffer as empty string', () => {
            reader.readLine('Name: ');
            expect(host.activeInputRequest!.buffer).toBe('');
            expect(host.activeInputRequest!.cursorPosition).toBe(0);
        });

        it('should reject if another request is already active', async () => {
            reader.readLine('First: ');
            await expectAsync(
                reader.readLine('Second: '),
            ).toBeRejectedWithError('Another input request is already active');
        });

        it('should resolve with value when resolve is called', async () => {
            const promise = reader.readLine('Name: ');
            host.activeInputRequest!.resolve('test');
            const result = await promise;
            expect(result).toBe('test');
        });

        it('should resolve with null when resolve is called with null', async () => {
            const promise = reader.readLine('Name: ');
            host.activeInputRequest!.resolve(null);
            const result = await promise;
            expect(result).toBeNull();
        });
    });

    describe('readPassword', () => {
        it('should set an active input request of type password', () => {
            reader.readPassword('Password: ');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('password');
        });

        it('should write the prompt text to the terminal', () => {
            reader.readPassword('Password: ');
            expect(host.writtenText).toContain('Password: ');
        });
    });

    describe('readConfirm', () => {
        it('should set an active input request of type confirm', () => {
            reader.readConfirm('Continue?');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('confirm');
        });

        it('should display (y/N) hint when default is false', () => {
            reader.readConfirm('Continue?', false);
            expect(host.writtenText[0]).toContain('(y/N)');
        });

        it('should display (Y/n) hint when default is true', () => {
            reader.readConfirm('Continue?', true);
            expect(host.writtenText[0]).toContain('(Y/n)');
        });

        it('should store defaultValue on the request', () => {
            reader.readConfirm('Continue?', true);
            expect(host.activeInputRequest!.defaultValue).toBe(true);
        });

        it('should default to false when no defaultValue provided', () => {
            reader.readConfirm('Continue?');
            expect(host.activeInputRequest!.defaultValue).toBe(false);
        });
    });

    describe('readSelect', () => {
        const options = [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
            { label: 'Option C', value: 'c' },
        ];

        it('should set an active input request of type select', () => {
            reader.readSelect('Pick one:', options);
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('select');
        });

        it('should store options and initialize selectedIndex to 0', () => {
            reader.readSelect('Pick one:', options);
            expect(host.activeInputRequest!.options).toBe(options);
            expect(host.activeInputRequest!.selectedIndex).toBe(0);
        });

        it('should reject with error for empty options', async () => {
            await expectAsync(
                reader.readSelect('Pick:', []),
            ).toBeRejectedWithError('readSelect requires at least one option');
        });

        it('should write the prompt and render options', () => {
            reader.readSelect('Pick one:', options);
            expect(host.writtenText[0]).toContain('Pick one:');
            // Options are rendered after prompt
            expect(host.writtenText.length).toBeGreaterThan(1);
        });

        it('should store onChange callback on the request', () => {
            const onChange = jasmine.createSpy('onChange');
            reader.readSelect('Pick one:', options, onChange);
            expect(host.activeInputRequest!.onChange).toBe(onChange);
        });

        it('should call onChange with initial selection value on creation', () => {
            const onChange = jasmine.createSpy('onChange');
            reader.readSelect('Pick one:', options, onChange);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('a');
        });

        it('should not fail when onChange is not provided', () => {
            expect(() => reader.readSelect('Pick one:', options)).not.toThrow();
            expect(host.activeInputRequest!.onChange).toBeUndefined();
        });

        it('should resolve with selected value when resolve is called', async () => {
            const promise = reader.readSelect('Pick one:', options);
            host.activeInputRequest!.resolve('b');
            const result = await promise;
            expect(result).toBe('b');
        });

        it('should resolve with null when aborted', async () => {
            const promise = reader.readSelect('Pick one:', options);
            host.activeInputRequest!.resolve(null);
            const result = await promise;
            expect(result).toBeNull();
        });
    });

    describe('readSelectInline', () => {
        const options = [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
            { label: 'Option C', value: 'c' },
        ];

        it('should set an active input request of type select-inline', () => {
            reader.readSelectInline('Pick one:', options);
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('select-inline');
        });

        it('should store options and initialize selectedIndex to 0', () => {
            reader.readSelectInline('Pick one:', options);
            expect(host.activeInputRequest!.options).toBe(options);
            expect(host.activeInputRequest!.selectedIndex).toBe(0);
        });

        it('should reject with error for empty options', async () => {
            await expectAsync(
                reader.readSelectInline('Pick:', []),
            ).toBeRejectedWithError(
                'readSelectInline requires at least one option',
            );
        });

        it('should write prompt and inline options on one line', () => {
            reader.readSelectInline('Pick one:', options);
            // Should write prompt + inline options (single write containing prompt)
            const allText = host.writtenText.join('');
            expect(allText).toContain('Pick one:');
            expect(allText).toContain('Option A');
        });

        it('should fire onChange with initial value', () => {
            const onChange = jasmine.createSpy('onChange');
            reader.readSelectInline('Pick one:', options, onChange);
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('a');
        });

        it('should store onChange callback on the request', () => {
            const onChange = jasmine.createSpy('onChange');
            reader.readSelectInline('Pick one:', options, onChange);
            expect(host.activeInputRequest!.onChange).toBe(onChange);
        });
    });

    describe('readMultiSelect', () => {
        const options = [
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b', checked: true },
            { label: 'Option C', value: 'c' },
        ];

        it('should set an active input request of type multi-select', () => {
            reader.readMultiSelect('Select items:', options);
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('multi-select');
        });

        it('should store options and initialize selectedIndex to 0', () => {
            reader.readMultiSelect('Select items:', options);
            expect(host.activeInputRequest!.options).toBe(options);
            expect(host.activeInputRequest!.selectedIndex).toBe(0);
        });

        it('should initialize checkedIndices from options with checked: true', () => {
            reader.readMultiSelect('Select items:', options);
            const checked = host.activeInputRequest!.checkedIndices!;
            expect(checked.has(0)).toBe(false);
            expect(checked.has(1)).toBe(true);
            expect(checked.has(2)).toBe(false);
        });

        it('should reject with error for empty options', async () => {
            await expectAsync(
                reader.readMultiSelect('Select:', []),
            ).toBeRejectedWithError(
                'readMultiSelect requires at least one option',
            );
        });

        it('should write prompt and render checkbox options', () => {
            reader.readMultiSelect('Select items:', options);
            const allText = host.writtenText.join('');
            expect(allText).toContain('Select items:');
            expect(allText).toContain('Option A');
        });
    });

    describe('readNumber', () => {
        it('should set an active input request of type number', () => {
            reader.readNumber('Enter count');
            expect(host.activeInputRequest).not.toBeNull();
            expect(host.activeInputRequest!.type).toBe('number');
        });

        it('should write prompt with bounds hint when min/max provided', () => {
            reader.readNumber('Enter count', { min: 5, max: 100 });
            const allText = host.writtenText.join('');
            expect(allText).toContain('5-100');
        });

        it('should store numberOptions on request', () => {
            const opts = { min: 1, max: 10, default: 5 };
            reader.readNumber('Enter count', opts);
            expect(host.activeInputRequest!.numberOptions).toBe(opts);
        });

        it('should include default hint in prompt', () => {
            reader.readNumber('Enter count', { default: 10 });
            const allText = host.writtenText.join('');
            expect(allText).toContain('default: 10');
        });
    });
});
