import { ICliKeyValueStore } from '@qodalis/cli-core';
import { CliCommandHistory } from '../lib/services/cli-command-history';
import { CommandLineMode, CommandLineModeHost } from '../lib/input/command-line-mode';
import { CliLineBuffer } from '../lib/input/cli-line-buffer';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

class MockKeyValueStore implements ICliKeyValueStore {
    private data = new Map<string, any>();

    async get<T = any>(key: string): Promise<T | undefined> {
        return this.data.get(key) as T | undefined;
    }

    async set(key: string, value: any): Promise<void> {
        this.data.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.data.delete(key);
    }

    async clear(): Promise<void> {
        this.data.clear();
    }
}

function createMockHost(
    history: CliCommandHistory,
    lineBuffer: CliLineBuffer,
): CommandLineModeHost {
    return {
        terminal: {
            write: () => {},
            writeln: () => {},
            cols: 80,
            rows: 24,
            buffer: {
                active: {
                    cursorX: 0,
                    cursorY: 0,
                    baseY: 0,
                    getLine: () =>
                        ({ isWrapped: false, translateToString: () => '' }) as any,
                },
            },
        } as any,
        lineBuffer,
        lineRenderer: {
            clearLine: () => {},
            refreshLine: () => {},
            getPromptString: () => '$ ',
        } as any,
        completionEngine: {
            resetState: () => {},
            complete: async () => ({ action: 'none' }),
            completeSingle: async () => null,
        } as any,
        commandHistory: history,
        getPromptOptions: () => ({}) as any,
        getPromptLength: () => 2,
        setPromptLength: () => {},
        getExecutionContext: () => ({}) as any,
        isProgressRunning: () => false,
        isRawModeActive: () => false,
        abort: () => {},
        showPrompt: () => {},
    };
}

const UP = '\u001B[A';
const DOWN = '\u001B[B';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandLineMode history navigation', () => {
    let store: MockKeyValueStore;
    let history: CliCommandHistory;
    let lineBuffer: CliLineBuffer;
    let host: CommandLineModeHost;
    let mode: CommandLineMode;

    beforeEach(async () => {
        store = new MockKeyValueStore();
        history = new CliCommandHistory(store);
        await history.addCommand('first');
        await history.addCommand('second');
        await history.addCommand('third');
        await history.addCommand('fourth');

        lineBuffer = new CliLineBuffer();
        host = createMockHost(history, lineBuffer);
        mode = new CommandLineMode(host);
        mode.activate();
        // Wait for async initialize
        await history.initialize();
    });

    it('should navigate to the last command on first Up press', async () => {
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');
    });

    it('should walk through full history with repeated Up presses', async () => {
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('third');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('second');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('first');
    });

    it('should stop at the oldest command', async () => {
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        // At first command
        expect(lineBuffer.text).toBe('first');

        // One more Up should stay at first
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('first');
    });

    it('should navigate forward with Down after going Up', async () => {
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('second');

        await mode.handleInput(DOWN);
        expect(lineBuffer.text).toBe('third');

        await mode.handleInput(DOWN);
        expect(lineBuffer.text).toBe('fourth');
    });

    it('should clear the buffer when pressing Down past the last command', async () => {
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');

        await mode.handleInput(DOWN);
        expect(lineBuffer.text).toBe('');
    });

    it('should do prefix search when user types text then presses Up', async () => {
        // Type "fi" into the buffer
        await mode.handleInput('f');
        await mode.handleInput('i');
        expect(lineBuffer.text).toBe('fi');

        // Up should find "first" (the only command starting with "fi")
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('first');
    });

    it('should not enter prefix search when buffer text came from history', async () => {
        // Navigate up to "fourth"
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');

        // Navigate up again — should NOT enter prefix search with "fourth"
        // but rather continue walking backward through history
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('third');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('second');
    });

    it('should handle Up-Down-Up cycle correctly', async () => {
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('third');

        await mode.handleInput(DOWN);
        expect(lineBuffer.text).toBe('fourth');

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('third');
    });

    it('should reset history position when user types new text', async () => {
        await mode.handleInput(UP);
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('third');

        // User types something — this clears history search and resets index
        await mode.handleInput('x');
        // Buffer now has "thirdx" (inserted at cursor)
        // Clear and type fresh to simulate new prompt
        lineBuffer.clear();
        await mode.handleInput('a');
        lineBuffer.clear();

        // Up should start from the end again
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('fourth');
    });
});

describe('CommandLineMode type-ahead', () => {
    let lineBuffer: CliLineBuffer;
    let host: CommandLineModeHost;
    let mode: CommandLineMode;
    let submitted: string[];
    let finishCommand: () => void;
    let rawMode: boolean;
    let written: string;

    const type = async (text: string) => {
        for (const ch of text) {
            await mode.handleInput(ch);
        }
    };

    beforeEach(async () => {
        const history = new CliCommandHistory(new MockKeyValueStore());
        await history.initialize();
        lineBuffer = new CliLineBuffer();
        submitted = [];
        rawMode = false;
        written = '';
        host = createMockHost(history, lineBuffer);
        (host.terminal as any).write = (data: string) => (written += data);
        (host as any).isRawModeActive = () => rawMode;
        host.getExecutionContext = () =>
            ({
                setContextProcessor: () => {},
                // Each command runs until the test finishes it; the new
                // prompt then clears the line, as the real context does.
                submitCommand: (text: string) => {
                    submitted.push(text);
                    return new Promise<void>((resolve) => {
                        finishCommand = () => {
                            lineBuffer.clear();
                            resolve();
                        };
                    });
                },
            }) as any;
        mode = new CommandLineMode(host);
        mode.activate();
    });

    it('holds keys typed while a command runs and replays them at the next prompt', async () => {
        await type('first');
        const running = mode.handleInput('\r');
        written = '';
        await type('next');

        expect(lineBuffer.text).toBe('first');
        expect(written).toBe('');

        finishCommand();
        await running;

        expect(lineBuffer.text).toBe('next');
        expect(submitted).toEqual(['first']);
    });

    it('runs typed-ahead commands in order', async () => {
        await type('one');
        const running = mode.handleInput('\r');
        await type('two\rthree');

        finishCommand();
        await Promise.resolve();
        await new Promise((r) => setTimeout(r));
        expect(submitted).toEqual(['one', 'two']);

        finishCommand();
        await running;
        expect(lineBuffer.text).toBe('three');
    });

    it('drops typed-ahead keys when Ctrl+C is pressed', async () => {
        await type('slow');
        const running = mode.handleInput('\r');
        await type('oops');

        mode.handleKeyEvent(new KeyboardEvent('keydown', { code: 'KeyC', ctrlKey: true }));
        finishCommand();
        await running;

        expect(lineBuffer.text).toBe('');
        expect(submitted).toEqual(['slow']);
    });

    it('does not replay keys into the prompt when the command took over the terminal', async () => {
        await type('game');
        const running = mode.handleInput('\r');
        await type('xyz');

        rawMode = true;
        finishCommand();
        await running;

        expect(lineBuffer.text).toBe('');
    });
});

describe('CommandLineMode history after running commands', () => {
    it('recalls the command just run with Up, then the one before it', async () => {
        const history = new CliCommandHistory(new MockKeyValueStore());
        await history.initialize();
        const lineBuffer = new CliLineBuffer();
        const host = createMockHost(history, lineBuffer);
        host.getExecutionContext = () =>
            ({
                submitCommand: async (text: string) => {
                    await history.addCommand(text);
                    lineBuffer.clear();
                },
            }) as any;
        const mode = new CommandLineMode(host);
        mode.activate();

        for (const command of ['echo first', 'echo second']) {
            for (const ch of command) {
                await mode.handleInput(ch);
            }
            await mode.handleInput('\r');
        }

        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('echo second');
        await mode.handleInput(UP);
        expect(lineBuffer.text).toBe('echo first');
    });
});
