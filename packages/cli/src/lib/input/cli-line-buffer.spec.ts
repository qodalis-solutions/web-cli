import { applyEditingKey, CliKillRing, CliLineBuffer, isEscapeSequence } from './cli-line-buffer';

describe('CliLineBuffer', () => {
    let buffer: CliLineBuffer;

    beforeEach(() => {
        buffer = new CliLineBuffer();
    });

    it('should start empty', () => {
        expect(buffer.text).toBe('');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should insert text at cursor', () => {
        buffer.insert('hello');
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should insert text at mid-cursor position', () => {
        buffer.insert('hllo');
        buffer.cursorPosition = 1;
        buffer.insert('e');
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(2);
    });

    it('should handle backspace (deleteCharBefore)', () => {
        buffer.insert('hello');
        buffer.deleteCharBefore();
        expect(buffer.text).toBe('hell');
        expect(buffer.cursorPosition).toBe(4);
    });

    it('should not backspace at position 0', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 0;
        buffer.deleteCharBefore();
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should handle delete key (deleteCharAt)', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 1;
        buffer.deleteCharAt();
        expect(buffer.text).toBe('hllo');
        expect(buffer.cursorPosition).toBe(1);
    });

    it('should not delete at end of text', () => {
        buffer.insert('hello');
        buffer.deleteCharAt();
        expect(buffer.text).toBe('hello');
    });

    it('should move cursor left', () => {
        buffer.insert('hello');
        buffer.moveCursorLeft();
        expect(buffer.cursorPosition).toBe(4);
    });

    it('should not move cursor left past 0', () => {
        buffer.moveCursorLeft();
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should move cursor right', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 2;
        buffer.moveCursorRight();
        expect(buffer.cursorPosition).toBe(3);
    });

    it('should not move cursor right past text length', () => {
        buffer.insert('hello');
        buffer.moveCursorRight();
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should move to home', () => {
        buffer.insert('hello');
        buffer.moveHome();
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should move to end', () => {
        buffer.insert('hello');
        buffer.cursorPosition = 0;
        buffer.moveEnd();
        expect(buffer.cursorPosition).toBe(5);
    });

    it('should clear buffer', () => {
        buffer.insert('hello');
        buffer.clear();
        expect(buffer.text).toBe('');
        expect(buffer.cursorPosition).toBe(0);
    });

    it('should setText and move cursor to end', () => {
        buffer.setText('world');
        expect(buffer.text).toBe('world');
        expect(buffer.cursorPosition).toBe(5);
    });
});

describe('applyEditingKey (readline keys)', () => {
    let buffer: CliLineBuffer;
    let ring: CliKillRing;
    const at = (text: string, cursor: number) => {
        buffer.setText(text);
        buffer.cursorPosition = cursor;
    };

    beforeEach(() => {
        buffer = new CliLineBuffer();
        ring = { text: '' };
    });

    it('Ctrl+A / Home and Ctrl+E / End move to the start and end', () => {
        at('echo hello', 4);
        for (const key of ['\u0001', '\u001b[H', '\u001bOH', '\u001b[1~']) {
            buffer.cursorPosition = 4;
            expect(applyEditingKey(buffer, key, ring)).toBeTrue();
            expect(buffer.cursorPosition).toBe(0);
        }
        for (const key of ['\u0005', '\u001b[F', '\u001bOF', '\u001b[4~']) {
            buffer.cursorPosition = 4;
            expect(applyEditingKey(buffer, key, ring)).toBeTrue();
            expect(buffer.cursorPosition).toBe(10);
        }
        expect(buffer.text).toBe('echo hello');
    });

    it('Ctrl+U cuts before the cursor, Ctrl+Y pastes it back', () => {
        at('echo hello', 5);
        applyEditingKey(buffer, '\u0015', ring);
        expect(buffer.text).toBe('hello');
        expect(buffer.cursorPosition).toBe(0);
        buffer.moveEnd();
        applyEditingKey(buffer, '\u0019', ring);
        expect(buffer.text).toBe('helloecho ');
    });

    it('Ctrl+K cuts from the cursor to the end', () => {
        at('echo hello', 4);
        applyEditingKey(buffer, '\u000b', ring);
        expect(buffer.text).toBe('echo');
        expect(ring.text).toBe(' hello');
    });

    it('Ctrl+W and Alt+Backspace cut the previous word (and the spaces after it)', () => {
        at('git commit -m  ', 15);
        applyEditingKey(buffer, '\u0017', ring);
        expect(buffer.text).toBe('git commit ');
        expect(ring.text).toBe('-m  ');
        applyEditingKey(buffer, '\u001b\u007f', ring);
        expect(buffer.text).toBe('git ');
    });

    it('Delete and Ctrl+D remove the character under the cursor', () => {
        at('abc', 1);
        applyEditingKey(buffer, '\u001b[3~', ring);
        expect(buffer.text).toBe('ac');
        applyEditingKey(buffer, '\u0004', ring);
        expect(buffer.text).toBe('a');
    });

    it('an empty cut keeps the previous kill', () => {
        at('word', 4);
        applyEditingKey(buffer, '\u0015', ring);
        applyEditingKey(buffer, '\u0015', ring);
        expect(ring.text).toBe('word');
    });

    it('leaves other input alone', () => {
        at('x', 1);
        expect(applyEditingKey(buffer, 'a', ring)).toBeFalse();
        expect(applyEditingKey(buffer, '\u001b[A', ring)).toBeFalse();
        expect(buffer.text).toBe('x');
    });

    it('recognises key sequences that are not text', () => {
        expect(isEscapeSequence('\u001b[5~')).toBeTrue();
        expect(isEscapeSequence('\u001bOP')).toBeTrue();
        expect(isEscapeSequence('\u001b[1;5C')).toBeTrue();
        expect(isEscapeSequence('hello')).toBeFalse();
    });
});
