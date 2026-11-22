import { Terminal } from '@xterm/xterm';
import {
    CliTerminalLineRenderer,
    shortenPromptPath,
    shortenPromptUserName,
} from '../lib/input/cli-terminal-line-renderer';

describe('shortenPromptPath', () => {
    const home = '/home/nicolae.lupei.1996@gmail.com';

    it('keeps the path on a wide terminal', () => {
        expect(shortenPromptPath(home, home, 80)).toBe(home);
    });

    it('writes the home directory as ~ on a phone', () => {
        expect(shortenPromptPath(home, home, 40)).toBe('~');
        expect(shortenPromptPath(`${home}/projects`, home, 40)).toBe(
            '~/projects',
        );
        expect(shortenPromptPath(`${home}/projects`, `${home}/`, 40)).toBe(
            '~/projects',
        );
    });

    it('keeps paths outside the home directory', () => {
        expect(shortenPromptPath('/etc', home, 40)).toBe('/etc');
        expect(shortenPromptPath(`${home}-other`, home, 40)).toBe(
            `${home}-other`,
        );
        expect(shortenPromptPath('/', undefined, 40)).toBe('/');
        expect(shortenPromptPath('/etc', '/', 40)).toBe('/etc');
    });
});

describe('shortenPromptUserName', () => {
    it('keeps any name on a wide terminal', () => {
        expect(shortenPromptUserName('nicolae.lupei.1996@gmail.com', 80)).toBe(
            'nicolae.lupei.1996@gmail.com',
        );
    });

    it('keeps a short name on a phone', () => {
        expect(shortenPromptUserName('root', 40)).toBe('root');
        expect(shortenPromptUserName('ana@gmail.com', 40)).toBe(
            'ana@gmail.com',
        );
    });

    it('shortens a long email on a phone', () => {
        expect(shortenPromptUserName('nicolae.lupei.1996@gmail.com', 40)).toBe(
            'nicolae***@gmail.com',
        );
    });

    it('drops a long domain', () => {
        expect(
            shortenPromptUserName(
                'nicolae.lupei@departament.example-company.com',
                40,
            ),
        ).toBe('nicolae***@***');
    });

    it('shortens a long plain name on a phone', () => {
        expect(shortenPromptUserName('administrator-account-01', 40)).toBe(
            'administrator***',
        );
    });
});

// A real xterm.js terminal, 20 columns wide (a phone), so commands wrap
describe('CliTerminalLineRenderer on a narrow terminal', () => {
    const COLS = 20;
    const prompt = '\x1b[32muser\x1b[0m:\x1b[34m/\x1b[0m$ ';
    const promptLength = 'user:/$ '.length;
    let container: HTMLElement;
    let terminal: Terminal;
    let renderer: CliTerminalLineRenderer;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        terminal = new Terminal({ cols: COLS, rows: 10 });
        terminal.open(container);
        renderer = new CliTerminalLineRenderer(terminal, {
            wrapInColor: (text: string) => text,
        } as any);
    });

    afterEach(() => {
        terminal.dispose();
        container.remove();
    });

    const flush = () =>
        new Promise<void>((resolve) => terminal.write('', resolve));

    /** Rows of the screen, trailing spaces removed. */
    const screen = () => {
        const rows: string[] = [];
        for (let i = 0; i < terminal.rows; i++) {
            rows.push(
                terminal.buffer.active
                    .getLine(terminal.buffer.active.baseY + i)!
                    .translateToString(true),
            );
        }
        while (rows.length && !rows[rows.length - 1]) rows.pop();
        return rows;
    };

    const cursor = () => ({
        x: terminal.buffer.active.cursorX,
        y: terminal.buffer.active.cursorY,
    });

    /** Type `text` one character at a time, as the command line does. */
    const type = (line: string, text: string) => {
        for (const ch of text) {
            line += ch;
            renderer.refreshLine(line, line.length, promptLength, prompt);
        }
        return line;
    };

    beforeEach(async () => {
        terminal.write('output above\r\n');
        renderer.renderPrompt({ userName: 'user', pathProvider: () => '/' });
        await flush();
    });

    it('types a command over several rows without repeating it', async () => {
        const command = 'echo the quick brown fox jumps';
        type('', command);
        await flush();

        const text = 'user:/$ ' + command;
        expect(screen()).toEqual([
            'output above',
            text.slice(0, 20),
            text.slice(20, 40),
        ]);
        expect(cursor()).toEqual({ x: text.length % COLS, y: 2 });
    });

    it('keeps the line in place when it ends exactly at the right edge', async () => {
        // 8 + 12 = 20 columns: the row is full, then one more character
        const line = type('', 'echo 1234567');
        await flush();
        expect(cursor()).toEqual({ x: 0, y: 2 });

        type(line, '8');
        await flush();
        expect(screen()).toEqual(['output above', 'user:/$ echo 1234567', '8']);
        expect(cursor()).toEqual({ x: 1, y: 2 });
    });

    it('edits in the middle of a wrapped command', async () => {
        const line = type('', 'echo the quick brown fox');
        // Cursor back into the first row, then insert a character there
        const edited = 'echo XYZ the quick brown fox';
        renderer.refreshLine(line, 5, promptLength, prompt);
        renderer.refreshLine(edited, 9, promptLength, prompt);
        await flush();

        const text = 'user:/$ ' + edited;
        expect(screen()).toEqual([
            'output above',
            text.slice(0, 20),
            text.slice(20, 40),
        ]);
        expect(cursor()).toEqual({ x: promptLength + 9, y: 1 });
    });

    it('moves the cursor across rows', async () => {
        const line = type('', 'echo the quick brown fox');
        renderer.refreshLine(line, 2, promptLength, prompt);
        await flush();
        expect(cursor()).toEqual({ x: promptLength + 2, y: 1 });

        renderer.refreshLine(line, line.length, promptLength, prompt);
        await flush();
        expect(cursor()).toEqual({
            x: (promptLength + line.length) % COLS,
            y: 2,
        });
    });

    it('leaves the cursor at the end of the input after ghost text that wraps', async () => {
        const line = type('', 'echo abc');
        renderer.renderGhostText('defghijklmnop', promptLength + line.length);
        await flush();
        expect(cursor()).toEqual({ x: promptLength + line.length, y: 1 });

        // The next character clears the ghost text
        type(line, 'd');
        await flush();
        expect(screen()).toEqual(['output above', 'user:/$ echo abcd']);
    });
});
