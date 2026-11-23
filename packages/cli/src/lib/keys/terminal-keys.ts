import type { Terminal } from '@xterm/xterm';

/**
 * Keys a phone keyboard lacks (Esc, Tab, Ctrl, the arrows), sent to a
 * terminal the way a hardware keyboard would send them: the panel's Send key
 * menu, and hosts with their own key bars.
 */

/** A keydown, as a hardware keyboard sends it. */
export interface CliKeyPress {
    key: string;
    code: string;
    keyCode: number;
    ctrlKey?: boolean;
    shiftKey?: boolean;
}

export const CLI_KEY_PRESSES = {
    escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
    tab: { key: 'Tab', code: 'Tab', keyCode: 9 },
    shiftTab: { key: 'Tab', code: 'Tab', keyCode: 9, shiftKey: true },
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
    home: { key: 'Home', code: 'Home', keyCode: 36 },
    end: { key: 'End', code: 'End', keyCode: 35 },
    pageUp: { key: 'PageUp', code: 'PageUp', keyCode: 33 },
    pageDown: { key: 'PageDown', code: 'PageDown', keyCode: 34 },
    delete: { key: 'Delete', code: 'Delete', keyCode: 46 },
} as const satisfies Record<string, CliKeyPress>;

/** The keydown for Ctrl+<letter>, or undefined when `char` is not a letter. */
export function ctrlLetterPress(char: string): CliKeyPress | undefined {
    if (!/^[a-z]$/i.test(char)) return undefined;
    const upper = char.toUpperCase();
    return { key: char.toLowerCase(), code: `Key${upper}`, keyCode: upper.charCodeAt(0), ctrlKey: true };
}

/** A combination of the Send key menu. */
export interface CliSendKey {
    /** `'Ctrl+C'`, `'Esc'` */
    label: string;
    /** What it does at the prompt: `'Stop the command'` */
    description: string;
    /** The keydown it sends; absent on "Ctrl + next key", which turns the sticky Ctrl on. */
    press?: CliKeyPress;
}

const ctrl = (letter: string, description: string): CliSendKey => ({
    label: `Ctrl+${letter.toUpperCase()}`,
    description,
    press: ctrlLetterPress(letter),
});

/** The Send key menu: the shortcuts of the CLI's prompt, then the keys phones lack. */
export const CLI_SEND_KEYS: readonly CliSendKey[] = [
    ctrl('c', 'Stop the command'),
    ctrl('l', 'Clear the screen'),
    ctrl('a', 'Start of the line'),
    ctrl('e', 'End of the line'),
    ctrl('u', 'Delete to the start'),
    ctrl('k', 'Delete to the end'),
    ctrl('w', 'Delete the word before'),
    ctrl('y', 'Paste what was deleted'),
    ctrl('d', 'Delete the next character'),
    { label: 'Esc', description: 'Cancel', press: CLI_KEY_PRESSES.escape },
    { label: 'Tab', description: 'Complete', press: CLI_KEY_PRESSES.tab },
    { label: 'Shift+Tab', description: 'Previous completion', press: CLI_KEY_PRESSES.shiftTab },
    { label: '↑', description: 'Previous command', press: CLI_KEY_PRESSES.up },
    { label: '↓', description: 'Next command', press: CLI_KEY_PRESSES.down },
    { label: 'Ctrl + key', description: 'Hold Ctrl for the next key you type' },
];

/** Dispatch a keydown on the terminal's input, as a hardware keyboard would. */
export function sendTerminalKeyPress(terminal: Terminal, press: CliKeyPress): void {
    const target = terminal.textarea;
    if (!target) return;
    const event = new KeyboardEvent('keydown', {
        key: press.key,
        code: press.code,
        ctrlKey: !!press.ctrlKey,
        shiftKey: !!press.shiftKey,
        bubbles: true,
        cancelable: true,
    });
    // xterm still maps keys by the legacy keyCode, which KeyboardEventInit cannot set
    Object.defineProperty(event, 'keyCode', { get: () => press.keyCode });
    Object.defineProperty(event, 'which', { get: () => press.keyCode });
    target.dispatchEvent(event);
}

/**
 * Deliver a key: key presses go through xterm's keydown path, so the CLI's
 * own shortcut handling (Ctrl+C, Esc, Ctrl+L) sees them; text is typed as input.
 */
export function sendTerminalKey(terminal: Terminal, key: { press?: CliKeyPress; text?: string }): void {
    if (key.text !== undefined) terminal.input(key.text, true);
    else if (key.press) sendTerminalKeyPress(terminal, key.press);
}

export type CliModifierState = 'off' | 'once';

/** A sticky modifier: turned on, it applies to the next key only. */
export class CliStickyModifier {
    private current: CliModifierState = 'off';

    constructor(private readonly onChange: (state: CliModifierState) => void = () => undefined) {}

    get state(): CliModifierState {
        return this.current;
    }

    get active(): boolean {
        return this.current !== 'off';
    }

    /** Turn it on for the next key. */
    arm(): void {
        this.set('once');
    }

    /** Whether the modifier applies to this key; it is used up. */
    consume(): boolean {
        const active = this.active;
        this.set('off');
        return active;
    }

    reset(): void {
        this.set('off');
    }

    private set(state: CliModifierState): void {
        if (state === this.current) return;
        this.current = state;
        this.onChange(state);
    }
}

/**
 * While `modifier` is on, a letter typed on the on-screen keyboard becomes
 * Ctrl+<letter> (Ctrl+A/E line start and end, Ctrl+U/K/W delete, Ctrl+L clear).
 * Keyboards send letters as a keydown or, without a key code, as an input
 * event; both are caught on the window, before xterm's own listeners see them.
 * `terminalOf` returns the terminal whose input `target` is (undefined for any
 * other element). Returns the function that stops listening.
 */
export function applyStickyCtrlToKeyboard(
    modifier: CliStickyModifier,
    terminalOf: (target: EventTarget | null) => Terminal | undefined,
): () => void {
    if (typeof window === 'undefined') return () => undefined;
    // The keypress and input events that follow a cancelled keydown would still type the letter
    let swallow: string | undefined;
    const block = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const intercept = (terminal: Terminal, char: string | null | undefined, event: Event): boolean => {
        const press = modifier.active && char && char.length === 1 ? ctrlLetterPress(char) : undefined;
        if (!press) return false;
        modifier.consume();
        block(event);
        sendTerminalKeyPress(terminal, press);
        return true;
    };
    const onKeydown = (e: Event) => {
        const event = e as KeyboardEvent;
        const terminal = terminalOf(event.target);
        if (!terminal) return;
        swallow = undefined;
        // Our own Ctrl+<letter> keydown passes through
        if (!event.ctrlKey && !event.altKey && !event.metaKey && intercept(terminal, event.key, event)) swallow = event.key;
    };
    const onKeypress = (e: Event) => {
        if (swallow !== undefined && terminalOf(e.target) && (e as KeyboardEvent).key === swallow) block(e);
    };
    const onBeforeInput = (e: Event) => {
        const event = e as InputEvent;
        const terminal = terminalOf(event.target);
        if (!terminal) return;
        if (swallow !== undefined && event.data === swallow) {
            swallow = undefined;
            block(event);
        } else if (event.inputType === 'insertText') {
            intercept(terminal, event.data, event);
        }
    };
    const onInput = (e: Event) => {
        const data = (e as InputEvent).data;
        if (swallow !== undefined && terminalOf(e.target) && data === swallow) {
            swallow = undefined;
            block(e);
        }
    };
    const listeners: [string, (e: Event) => void][] = [
        ['keydown', onKeydown],
        ['keypress', onKeypress],
        ['beforeinput', onBeforeInput],
        ['input', onInput],
    ];
    for (const [type, listener] of listeners) window.addEventListener(type, listener, true);
    return () => {
        for (const [type, listener] of listeners) window.removeEventListener(type, listener, true);
    };
}
