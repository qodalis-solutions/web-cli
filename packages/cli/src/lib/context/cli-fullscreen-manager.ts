import { Terminal } from '@xterm/xterm';
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliFullScreenOptions,
} from '@qodalis/cli-core';
import { CliBackgroundServiceRegistry } from '../services/background';

/**
 * Manages full-screen terminal mode (alternate screen buffer).
 * Used by interactive commands like nano, htop, etc.
 */
export class CliFullScreenManager {
    private resizeDisposable: { dispose(): void } | null = null;

    constructor(
        private readonly terminal: Terminal,
        private readonly backgroundServices: CliBackgroundServiceRegistry,
    ) {}

    /**
     * Enter full-screen mode using the alternate screen buffer.
     */
    enter(
        processor: ICliCommandProcessor,
        setContextProcessor: (p: ICliCommandProcessor | undefined, silent?: boolean, fullScreen?: boolean) => void,
        context: ICliExecutionContext,
        options?: CliFullScreenOptions,
    ): void {
        this.terminal.write('\x1b[?1049h'); // alternate screen buffer
        this.terminal.write('\x1b[H'); // move cursor to row 1, col 1
        if (options?.showCursor) {
            this.terminal.write('\x1b[?25h'); // show cursor
        } else {
            this.terminal.write('\x1b[?25l'); // hide cursor
        }
        this.backgroundServices.setFullScreen(true);
        setContextProcessor(processor, true, true);

        // Subscribe to terminal resize events and forward to the processor
        if (processor.onResize) {
            this.resizeDisposable = this.terminal.onResize(
                ({ cols, rows }) => {
                    processor.onResize!(cols, rows, context);
                },
            );
        }
    }

    /**
     * Exit full-screen mode and return to the main buffer.
     */
    exit(
        contextProcessor: ICliCommandProcessor | undefined,
        setContextProcessor: (p: ICliCommandProcessor | undefined) => void,
        clearTimers: () => void,
        showPrompt: () => void,
        context: ICliExecutionContext,
    ): void {
        const processor = contextProcessor;

        this.backgroundServices.setFullScreen(false);

        // Clean up managed timers
        clearTimers();

        // Dispose resize subscription
        this.resizeDisposable?.dispose();
        this.resizeDisposable = null;

        // Notify processor of disposal
        if (processor?.onDispose) {
            processor.onDispose(context);
        }

        this.terminal.write('\x1b[?25h'); // show cursor
        this.terminal.write('\x1b[?1049l'); // leave alternate screen buffer
        setContextProcessor(undefined);
        showPrompt();
    }

    /**
     * Dispose resize subscription.
     */
    dispose(): void {
        this.resizeDisposable?.dispose();
        this.resizeDisposable = null;
    }
}
