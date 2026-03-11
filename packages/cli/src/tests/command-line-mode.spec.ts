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
