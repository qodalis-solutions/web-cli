import { parseInterval, formatInterval } from '../lib/cron-utils';

describe('cron-utils', () => {
    describe('parseInterval', () => {
        it('parses 30s → 30000ms', () => expect(parseInterval('30s')).toBe(30000));
        it('parses 5m → 300000ms', () => expect(parseInterval('5m')).toBe(300000));
        it('parses 1h → 3600000ms', () => expect(parseInterval('1h')).toBe(3600000));
        it('parses 2h30m → 9000000ms', () => expect(parseInterval('2h30m')).toBe(9000000));
        it('returns null for empty string', () => expect(parseInterval('')).toBeNull());
        it('returns null for alphabetic input', () => expect(parseInterval('abc')).toBeNull());
        it('returns null for less than 10s (5s)', () => expect(parseInterval('5s')).toBeNull());
        it('returns null for less than 10s plain (5)', () => expect(parseInterval('5')).toBeNull());
        it('parses exactly 10s boundary', () => expect(parseInterval('10s')).toBe(10000));
        it('parses plain 60 as 60000ms', () => expect(parseInterval('60')).toBe(60000));
    });

    describe('formatInterval', () => {
        it('formats 30000ms → "30s"', () => expect(formatInterval(30000)).toBe('30s'));
        it('formats 300000ms → "5m"', () => expect(formatInterval(300000)).toBe('5m'));
        it('formats 3600000ms → "1h"', () => expect(formatInterval(3600000)).toBe('1h'));
        it('formats 9000000ms → "2h 30m"', () => expect(formatInterval(9000000)).toBe('2h 30m'));
        it('formats 0ms → "0s"', () => expect(formatInterval(0)).toBe('0s'));
    });
});
