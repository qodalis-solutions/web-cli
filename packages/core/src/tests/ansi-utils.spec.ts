import { truncateToWidth, visibleLength } from '../lib/utils/ansi-utils';

describe('truncateToWidth', () => {
    it('returns text that already fits unchanged', () => {
        expect(truncateToWidth('hello', 5)).toBe('hello');
        expect(truncateToWidth('\x1b[31mhi\x1b[0m', 2)).toBe('\x1b[31mhi\x1b[0m');
    });

    it('cuts to the width with an ellipsis and a reset', () => {
        const out = truncateToWidth('abcdefghij', 6);
        expect(out).toBe('abcde…\x1b[0m');
        expect(visibleLength(out)).toBe(6);
    });

    it('keeps ANSI codes without counting them', () => {
        const out = truncateToWidth('\x1b[36m?\x1b[0m Groups: \x1b[2mlong help text here\x1b[0m', 12);
        expect(out.startsWith('\x1b[36m?\x1b[0m Groups:')).toBeTrue();
        expect(visibleLength(out)).toBe(12);
        expect(out.endsWith('\x1b[0m')).toBeTrue();
    });

    it('counts wide characters as two columns', () => {
        const out = truncateToWidth('日本語のテキスト', 7);
        expect(visibleLength(out)).toBeLessThanOrEqual(7);
        expect(out.startsWith('日本語')).toBeTrue();
    });

    it('returns an empty string for a width below 1', () => {
        expect(truncateToWidth('abc', 0)).toBe('');
    });
});
