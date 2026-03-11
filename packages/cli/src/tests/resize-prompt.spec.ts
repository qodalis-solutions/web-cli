import { Terminal } from '@xterm/xterm';
import {
    CliProvider,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import {
    CliExecutionContext,
    CliExecutionContextDeps,
} from '../lib/context/cli-execution-context';
import { CliCommandHistory } from '../lib/services/cli-command-history';
import { CliStateStoreManager } from '../lib/state/cli-state-store-manager';
import { CliCommandProcessorRegistry } from '../lib/registry';
import { CliCommandExecutor } from '../lib/executor';
import { CliTerminalLineRenderer } from '../lib/input/cli-terminal-line-renderer';

// ---------------------------------------------------------------------------
// Shared Test Fixtures
// ---------------------------------------------------------------------------

type ResizeCallback = (data: { cols: number; rows: number }) => void;

class MockTerminal {
    cols = 80;
    rows = 24;
    written: string[] = [];
    buffer = {
        active: {
            cursorX: 0,
            cursorY: 0,
            baseY: 0,
            getLine: (_y: number) =>
                ({ isWrapped: false, translateToString: () => '' }) as any,
        },
    };

    private resizeCallbacks: ResizeCallback[] = [];

    write(data: string, callback?: () => void): void {
        this.written.push(data);
        if (callback) callback();
    }

    writeln(data: string): void {
        this.written.push(data + '\n');
    }

    onResize(callback: ResizeCallback): { dispose: () => void } {
        this.resizeCallbacks.push(callback);
        return {
            dispose: () => {
                const idx = this.resizeCallbacks.indexOf(callback);
                if (idx >= 0) this.resizeCallbacks.splice(idx, 1);
            },
        };
    }

    onData(_callback: (data: string) => void): { dispose: () => void } {
        return { dispose: () => {} };
    }

    onKey(_callback: Function): { dispose: () => void } {
        return { dispose: () => {} };
    }

    attachCustomKeyEventHandler(_handler: Function): void {}

    fireResize(cols: number, rows?: number): void {
        this.cols = cols;
        if (rows !== undefined) this.rows = rows;
        for (const cb of this.resizeCallbacks) {
            cb({ cols: this.cols, rows: this.rows });
        }
    }
}

class MockServiceProvider implements ICliServiceProvider {
    get<T>(_token: any): T {
        throw new Error('Service not found');
    }
    set(_def: CliProvider | CliProvider[]): void {}
}

const mockStore = {
    get: async () => null,
    set: async () => {},
    remove: async () => {},
    clear: async () => {},
    initialize: async () => {},
};

function createDeps(): CliExecutionContextDeps {
    const services = new MockServiceProvider();
    const logger = {
        log() {},
        info() {},
        warn() {},
        error() {},
        debug() {},
        setCliLogLevel() {},
    } as any;
    const commandHistory = new CliCommandHistory(mockStore as any);
    const registry = new CliCommandProcessorRegistry();
    const stateStoreManager = new CliStateStoreManager(services, registry);
    const translator = {
        t: (_key: string, defaultValue: string) => defaultValue,
        setLocale() {},
        getLocale: () => 'en',
        getAvailableLocales: () => ['en'],
        registerLocale() {},
    } as any;
    return { services, logger, commandHistory, stateStoreManager, translator };
}

/** Concatenate written terminal output after startIndex, stripping ANSI. */
function stripAnsi(terminal: MockTerminal, startIndex: number): string {
    return terminal.written
        .slice(startIndex)
        .join('')
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        .replace(/\r/g, '');
}

// ---------------------------------------------------------------------------
// handleTerminalResize — unit tests
// ---------------------------------------------------------------------------

describe('CliExecutionContext handleTerminalResize', () => {
    let terminal: MockTerminal;
    let context: CliExecutionContext;

    beforeEach(() => {
        terminal = new MockTerminal();
        const deps = createDeps();
        const registry = new CliCommandProcessorRegistry();
        const executor = new CliCommandExecutor(registry);
        context = new CliExecutionContext(
            deps,
            terminal as any,
            executor,
        );
        context.initializeTerminalListeners();
    });

    it('should call refreshCurrentLine on handleTerminalResize', () => {
        context.promptLength = 10;
        spyOn(context, 'refreshCurrentLine');

        context.handleTerminalResize();

        expect(context.refreshCurrentLine).toHaveBeenCalledTimes(1);
    });

    it('should write prompt content to terminal', () => {
        context.promptLength = 10;
        const before = terminal.written.length;

        context.handleTerminalResize();

        expect(terminal.written.length).toBeGreaterThan(before);
        const output = terminal.written.slice(before).join('');
        // Should contain clear-to-end-of-screen and prompt content
        expect(output).toContain('\x1b[J');
        expect(output).toContain('$');
    });

    it('should be a no-op during progress', () => {
        spyOn(context, 'isProgressRunning').and.returnValue(true);
        spyOn(context, 'refreshCurrentLine');

        context.handleTerminalResize();

        expect(context.refreshCurrentLine).not.toHaveBeenCalled();
    });

    it('should be a no-op during raw mode', () => {
        context.contextProcessor = {
            command: 'nano',
            description: 'editor',
            onData: () => {},
        } as any;
        spyOn(context, 'refreshCurrentLine');

        context.handleTerminalResize();

        expect(context.refreshCurrentLine).not.toHaveBeenCalled();
    });

    it('should be a no-op during active input request', () => {
        (context as any)._activeInputRequest = {
            type: 'line',
            buffer: '',
            cursorPosition: 0,
            resolve: () => {},
        };
        spyOn(context, 'refreshCurrentLine');

        context.handleTerminalResize();

        expect(context.refreshCurrentLine).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// handleTerminalResize with custom path — mock integration
// ---------------------------------------------------------------------------

describe('CliExecutionContext resize with custom path', () => {
    let terminal: MockTerminal;
    let context: CliExecutionContext;

    beforeEach(() => {
        terminal = new MockTerminal();
        terminal.cols = 80;
        const deps = createDeps();
        const registry = new CliCommandProcessorRegistry();
        const executor = new CliCommandExecutor(registry);
        context = new CliExecutionContext(
            deps,
            terminal as any,
            executor,
        );
        context.userSession = { displayName: 'root' } as any;
        context.promptPathProvider = () => '/home/user';
        context.promptLength = 18;
        context.initializeTerminalListeners();
    });

    /** Simulate what CliEngine.safeFit() does: fit → redraw on col change. */
    function simulateSafeFit(cols: number): void {
        terminal.cols = cols;
        context.handleTerminalResize();
    }

    it('should rewrite the full prompt including custom path after resize', () => {
        const before = terminal.written.length;
        simulateSafeFit(40);

        const output = stripAnsi(terminal, before);
        expect(output).toContain('root');
        expect(output).toContain('/home/user');
        expect(output).toContain('$');
    });

    it('should preserve the full path after shrink then grow', () => {
        simulateSafeFit(15);

        const before = terminal.written.length;
        simulateSafeFit(80);

        const output = stripAnsi(terminal, before);
        expect(output).toContain('root');
        expect(output).toContain('/home/user');
        expect(output).toContain('$');
    });

    it('should include typed text after the prompt on resize', () => {
        context.lineBuffer.setText('ls -la');

        const before = terminal.written.length;
        simulateSafeFit(40);

        const output = stripAnsi(terminal, before);
        expect(output).toContain('/home/user');
        expect(output).toContain('ls -la');
    });

    it('should produce a clean prompt after multiple resize cycles', () => {
        simulateSafeFit(10);
        simulateSafeFit(5);
        simulateSafeFit(50);
        simulateSafeFit(80);

        const all = stripAnsi(terminal, 0);
        const lastDollar = all.lastIndexOf('$');
        const lastPath = all.lastIndexOf('/home/user');
        expect(lastDollar).toBeGreaterThan(-1);
        expect(lastPath).toBeGreaterThan(-1);
        expect(lastPath).toBeLessThan(lastDollar);
    });
});

// ---------------------------------------------------------------------------
// Real xterm.js Terminal resize integration tests
// ---------------------------------------------------------------------------

describe('Real xterm.js Terminal resize', () => {
    let container: HTMLElement;
    let terminal: Terminal;

    const promptAnsi =
        '\x1b[32mroot\x1b[0m:\x1b[34m/home/user\x1b[0m$ ';

    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '480px';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        document.body.appendChild(container);

        terminal = new Terminal({
            cols: 80,
            rows: 24,
            allowProposedApi: true,
        });
        terminal.open(container);
    });

    afterEach(() => {
        terminal.dispose();
        container.remove();
    });

    function readLine(row: number): string {
        const line = terminal.buffer.active.getLine(row);
        return line ? line.translateToString(true) : '';
    }

    function readAllContent(): string {
        let content = '';
        for (let i = 0; i <= terminal.buffer.active.cursorY; i++) {
            content += readLine(i);
        }
        return content;
    }

    it('should fix prompt after shrink-grow using refreshLine', (done) => {
        terminal.write(promptAnsi, () => {
            const promptLength = terminal.buffer.active.cursorX;
            expect(promptLength).toBeGreaterThan(0);

            // Shrink then grow — xterm reflow may corrupt the prompt
            terminal.resize(10, 24);
            terminal.resize(80, 24);

            // Apply fix: refreshLine clears and redraws
            const writer = {
                wrapInColor: (text: string) => text,
            } as any;
            const renderer = new CliTerminalLineRenderer(
                terminal,
                writer,
            );
            renderer.refreshLine('', 0, promptLength, promptAnsi);

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('root');
                expect(content).toContain('/home/user');
                expect(content).toContain('$');
                // No reflow corruption (space inserted mid-path)
                expect(content).not.toMatch(/\/ho\s+me/);
                done();
            });
        });
    });

    it('should fix prompt with user input after shrink-grow', (done) => {
        const userInput = 'ls -la';
        terminal.write(promptAnsi + userInput, () => {
            const cursorX = terminal.buffer.active.cursorX;
            const promptLength = cursorX - userInput.length;

            terminal.resize(10, 24);
            terminal.resize(80, 24);

            const writer = {
                wrapInColor: (text: string) => text,
            } as any;
            const renderer = new CliTerminalLineRenderer(
                terminal,
                writer,
            );
            renderer.refreshLine(
                userInput,
                userInput.length,
                promptLength,
                promptAnsi,
            );

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('/home/user');
                expect(content).toContain('ls -la');
                expect(content).not.toMatch(/\/ho\s+me/);
                done();
            });
        });
    });

    it('should fix prompt after multiple resize cycles', (done) => {
        terminal.write(promptAnsi, () => {
            const promptLength = terminal.buffer.active.cursorX;

            // Simulate multiple zoom steps
            terminal.resize(10, 24);
            terminal.resize(80, 24);
            terminal.resize(5, 24);
            terminal.resize(40, 24);
            terminal.resize(80, 24);

            const writer = {
                wrapInColor: (text: string) => text,
            } as any;
            const renderer = new CliTerminalLineRenderer(
                terminal,
                writer,
            );
            renderer.refreshLine('', 0, promptLength, promptAnsi);

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('root');
                expect(content).toContain('/home/user');
                expect(content).toContain('$');
                expect(content).not.toMatch(/\/ho\s+me/);
                done();
            });
        });
    });

    it('should fix prompt after shrink only', (done) => {
        terminal.write(promptAnsi, () => {
            const promptLength = terminal.buffer.active.cursorX;

            // Shrink to narrow terminal
            terminal.resize(10, 24);

            const writer = {
                wrapInColor: (text: string) => text,
            } as any;
            const renderer = new CliTerminalLineRenderer(
                terminal,
                writer,
            );
            renderer.refreshLine('', 0, promptLength, promptAnsi);

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('root');
                expect(content).toContain('/home/user');
                expect(content).toContain('$');
                done();
            });
        });
    });

    it('should produce clean prompt via full handleTerminalResize flow', (done) => {
        // Set up CliExecutionContext with real Terminal
        const deps = createDeps();
        const registry = new CliCommandProcessorRegistry();
        const executor = new CliCommandExecutor(registry);
        const context = new CliExecutionContext(
            deps,
            terminal as any,
            executor,
        );
        context.userSession = { displayName: 'root' } as any;
        context.promptPathProvider = () => '/home/user';
        context.initializeTerminalListeners();

        // Show the prompt — renderPrompt now calculates visible length
        // from the prompt string, so promptLength is correct immediately.
        context.showPrompt();

        terminal.write('', () => {
            expect(context.promptLength).toBeGreaterThan(0);

            // Resize to trigger reflow corruption
            terminal.resize(10, 24);
            terminal.resize(80, 24);

            // Apply the fix via the public API
            context.handleTerminalResize();

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('root');
                expect(content).toContain('/home/user');
                expect(content).toContain('$');
                expect(content).not.toMatch(/\/ho\s+me/);
                done();
            });
        });
    });

    it('should preserve typed text via handleTerminalResize after resize', (done) => {
        const deps = createDeps();
        const registry = new CliCommandProcessorRegistry();
        const executor = new CliCommandExecutor(registry);
        const context = new CliExecutionContext(
            deps,
            terminal as any,
            executor,
        );
        context.userSession = { displayName: 'root' } as any;
        context.promptPathProvider = () => '/home/user';
        context.initializeTerminalListeners();

        context.showPrompt();

        terminal.write('', () => {
            // Simulate user typing
            context.lineBuffer.setText('echo hello');

            terminal.resize(10, 24);
            terminal.resize(80, 24);

            context.handleTerminalResize();

            terminal.write('', () => {
                const content = readAllContent();
                expect(content).toContain('/home/user');
                expect(content).toContain('echo hello');
                expect(content).not.toMatch(/\/ho\s+me/);
                done();
            });
        });
    });
});
