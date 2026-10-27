import { CliKeyData } from '../lib/interfaces/command-controls';

describe('CliKeyData', () => {
    it('ctrl() gives the control character of a letter', () => {
        expect(CliKeyData.ctrl('a')).toBe('\x01');
        expect(CliKeyData.ctrl('s')).toBe('\x13');
        expect(CliKeyData.ctrl('X')).toBe('\x18');
    });

    it('arrows are the sequences xterm sends in normal cursor mode', () => {
        expect([
            CliKeyData.up,
            CliKeyData.down,
            CliKeyData.right,
            CliKeyData.left,
        ]).toEqual(['\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D']);
    });
});
