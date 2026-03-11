import { JsFallbackAccelerator, ICliWasmAccelerator } from '../lib/wasm';

describe('ICliWasmAccelerator (JsFallback)', () => {
    let accel: ICliWasmAccelerator;

    beforeEach(() => {
        accel = new JsFallbackAccelerator();
    });

    describe('textSearch', () => {
        const text = 'hello world\nfoo bar baz\nHello Again';

        it('should find needle in first line', () => {
            expect(accel.textSearch(text, 'world', 0, -1, true, false))
                .toEqual([0, 6]);
        });

        it('should find needle starting after startCol', () => {
            expect(accel.textSearch(text, 'hello', 0, -1, true, false))
                .toEqual([0, 0]);
        });

        it('should skip past startCol in same row', () => {
            expect(accel.textSearch(text, 'hello', 0, 0, true, false))
                .toEqual([-1, -1]);
        });

        it('should find case-insensitively', () => {
            expect(accel.textSearch(text, 'hello', 0, 0, false, false))
                .toEqual([2, 0]);
        });

        it('should wrap around when wrap=true', () => {
            // From row 1, col 0: finds "Hello" at row 2 first (forward search)
            expect(accel.textSearch(text, 'hello', 1, 0, false, true))
                .toEqual([2, 0]);
        });

        it('should not wrap when wrap=false', () => {
            expect(accel.textSearch(text, 'hello', 2, 5, true, false))
                .toEqual([-1, -1]);
        });

        it('should return [-1,-1] when not found', () => {
            expect(accel.textSearch(text, 'xyz', 0, -1, true, true))
                .toEqual([-1, -1]);
        });

        it('should return [-1,-1] for empty needle', () => {
            expect(accel.textSearch(text, '', 0, 0, true, true))
                .toEqual([-1, -1]);
        });

        it('should find in second line', () => {
            expect(accel.textSearch(text, 'bar', 0, -1, true, false))
                .toEqual([1, 4]);
        });
    });

    describe('textReplaceAll', () => {
        it('should replace all occurrences', () => {
            const result = accel.textReplaceAll(
                'foo bar foo\nbaz foo', 'foo', 'X', true,
            );
            expect(result.count).toBe(3);
            expect(result.text).toBe('X bar X\nbaz X');
        });

        it('should handle case-insensitive replace', () => {
            const result = accel.textReplaceAll(
                'Foo foo FOO', 'foo', 'X', false,
            );
            expect(result.count).toBe(3);
            expect(result.text).toBe('X X X');
        });

        it('should handle replacement with different length', () => {
            const result = accel.textReplaceAll(
                'aa bb aa', 'aa', 'ccc', true,
            );
            expect(result.count).toBe(2);
            expect(result.text).toBe('ccc bb ccc');
        });

        it('should return 0 count for empty needle', () => {
            const result = accel.textReplaceAll('hello', '', 'X', true);
            expect(result.count).toBe(0);
            expect(result.text).toBe('hello');
        });

        it('should return 0 count when no matches', () => {
            const result = accel.textReplaceAll('hello', 'xyz', 'X', true);
            expect(result.count).toBe(0);
            expect(result.text).toBe('hello');
        });

        it('should handle multi-line text', () => {
            const result = accel.textReplaceAll(
                'line1 foo\nline2 foo\nline3', 'foo', 'bar', true,
            );
            expect(result.count).toBe(2);
            expect(result.text).toBe('line1 bar\nline2 bar\nline3');
        });
    });

    describe('prefixMatch', () => {
        const candidates = ['help', 'hello', 'history', 'hash', 'hex'];

        it('should match prefix case-insensitively', () => {
            expect(accel.prefixMatch(candidates, 'he'))
                .toEqual(['hello', 'help', 'hex']);
        });

        it('should match prefix case-insensitively with uppercase', () => {
            expect(accel.prefixMatch(candidates, 'HE'))
                .toEqual(['hello', 'help', 'hex']);
        });

        it('should return all sorted when prefix is empty', () => {
            expect(accel.prefixMatch(candidates, ''))
                .toEqual(['hash', 'hello', 'help', 'hex', 'history']);
        });

        it('should return empty for no matches', () => {
            expect(accel.prefixMatch(candidates, 'z'))
                .toEqual([]);
        });

        it('should return single match', () => {
            expect(accel.prefixMatch(candidates, 'his'))
                .toEqual(['history']);
        });

        it('should handle empty candidates', () => {
            expect(accel.prefixMatch([], 'foo'))
                .toEqual([]);
        });
    });

    describe('commonPrefix', () => {
        it('should find common prefix', () => {
            expect(accel.commonPrefix(['hello', 'help', 'hex']))
                .toBe('he');
        });

        it('should return full string for single item', () => {
            expect(accel.commonPrefix(['hello']))
                .toBe('hello');
        });

        it('should return full string when all are identical', () => {
            expect(accel.commonPrefix(['abc', 'abc', 'abc']))
                .toBe('abc');
        });

        it('should return empty for no common prefix', () => {
            expect(accel.commonPrefix(['abc', 'xyz']))
                .toBe('');
        });

        it('should return empty for empty array', () => {
            expect(accel.commonPrefix([]))
                .toBe('');
        });

        it('should handle two strings with partial overlap', () => {
            expect(accel.commonPrefix(['foobar', 'foobaz']))
                .toBe('fooba');
        });
    });
});
