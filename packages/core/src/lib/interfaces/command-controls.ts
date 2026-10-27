/**
 * A key a full-screen command reads while it runs (an editor, a game).
 * Hosts on touch screens show these as buttons, since on-screen keyboards
 * lack Ctrl, Esc and the arrows; help screens can list them.
 */
export interface ICliCommandKey {
    /** Short button text: `'Save'`, `'↑'`, `'FLAG'` */
    label: string;
    /**
     * What the key sends to the command's `onData`, as a terminal would:
     * `'\x13'` (Ctrl+S), `'\x1b[A'` (Up), `' '` (Space), `'f'`
     */
    data: string;
    /** The usual key, for help: `'Ctrl+S'`, `'Space'`, `'F'` */
    key?: string;
    /** What the key does: `'Save the file'`; also the button's accessible name */
    description?: string;
    /** Repeats while held down (arrows, Delete) */
    repeat?: boolean;
}

/** The controls of a full-screen command, for hosts that show on-screen keys. */
export interface ICliCommandControls {
    /** The keys the command reads, most used first */
    keys: ICliCommandKey[];
    /**
     * The command also reads typed text (an editor, a word game): touch hosts
     * keep the on-screen keyboard open next to the keys. Otherwise they may
     * close it so the command gets the whole screen.
     */
    textInput?: boolean;
    /** `data` of the key a tap on the screen sends (e.g. rotate, reveal), if any */
    tap?: string;
    /** Swipes on the screen send the arrow keys (games on a board) */
    swipe?: boolean;
}

/** Terminal input for the keys commands commonly declare. */
export const CliKeyData = {
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
    home: '\x1b[H',
    end: '\x1b[F',
    pageUp: '\x1b[5~',
    pageDown: '\x1b[6~',
    delete: '\x1b[3~',
    escape: '\x1b',
    enter: '\r',
    backspace: '\x7f',
    space: ' ',
    /** Ctrl+<letter>: `ctrl('s')` is `'\x13'` */
    ctrl: (letter: string): string =>
        String.fromCharCode(letter.toUpperCase().charCodeAt(0) - 64),
} as const;
