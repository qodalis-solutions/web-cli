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
}
