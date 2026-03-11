import { CliLineBuffer } from './cli-line-buffer';

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
