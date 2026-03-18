import { Terminal } from '@xterm/xterm';
import { ICliFilePickerProvider } from '@qodalis/cli-core';

/**
 * State machine interface for terminal input routing.
 * Each mode handles its own key events and data.
 */
export interface IInputMode {
    /**
     * Handle raw terminal data (characters, escape sequences, control chars).
     * Called by terminal.onData.
     */
    handleInput(data: string): Promise<void>;

    /**
     * Handle keyboard events before they reach onData.
     * Called by terminal.attachCustomKeyEventHandler for 'keydown' events.
     * Return false to prevent the key from reaching onData.
     * Return true to let the key pass through to onData.
     */
    handleKeyEvent(event: KeyboardEvent): boolean;

    /**
     * Called when this mode becomes the active input mode.
     */
    activate?(): void;

    /**
     * Called when this mode is no longer the active input mode.
     */
    deactivate?(): void;

    /** Called when the terminal is resized while this mode is active. */
    onResize?(cols: number, rows: number): void;
}

/**
 * Host interface for input modes. Provides access to terminal I/O,
 * dimensions, and mode stack management.
 */
export interface InputModeHost {
    /** Write raw text/ANSI to the terminal */
    writeToTerminal(text: string): void;
    /** Get terminal row count for scroll window sizing */
    getTerminalRows(): number;
    /** Get terminal column count for overflow calculations */
    getTerminalCols(): number;
    /** Push a mode onto the input mode stack */
    pushMode(mode: IInputMode): void;
    /** Pop the current mode from the input mode stack */
    popMode(): void;
    /** The xterm.js Terminal instance (for direct write when needed) */
    readonly terminal: Terminal;
    /** File picker provider for the current environment */
    readonly filePickerProvider: ICliFilePickerProvider;
}
