import { unquoteRawArgument } from '../lib/utils/raw-argument';

describe('unquoteRawArgument', () => {
    it('removes one pair of quotes wrapping the whole text', () => {
        expect(unquoteRawArgument(`'{"a": 1}'`)).toBe('{"a": 1}');
        expect(unquoteRawArgument('"say \\"hi\\""')).toBe('say "hi"');
        expect(unquoteRawArgument("'a\\d+'")).toBe('a\\d+');
    });

    it('keeps everything else as typed', () => {
        expect(unquoteRawArgument('{"a": 1}')).toBe('{"a": 1}');
        expect(unquoteRawArgument('"a" "b"')).toBe('"a" "b"');
        expect(unquoteRawArgument("'a' b 'c'")).toBe("'a' b 'c'");
        expect(unquoteRawArgument('  1 + 2 ')).toBe('1 + 2');
        expect(unquoteRawArgument('"')).toBe('"');
    });
});
