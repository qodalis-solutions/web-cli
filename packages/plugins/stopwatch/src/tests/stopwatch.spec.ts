import { parseDuration, formatDuration } from '../lib/stopwatch-utils';

describe('stopwatch-utils', () => {
    describe('parseDuration', () => {
        it('parses 30s → 30000ms', () => expect(parseDuration('30s')).toBe(30000));
        it('parses 5m → 300000ms', () => expect(parseDuration('5m')).toBe(300000));
        it('parses 1h → 3600000ms', () => expect(parseDuration('1h')).toBe(3600000));
        it('parses 2h30m → 9000000ms', () => expect(parseDuration('2h30m')).toBe(9000000));
        it('parses 2m30s → 150000ms', () => expect(parseDuration('2m30s')).toBe(150000));
        it('returns null for empty string', () => expect(parseDuration('')).toBeNull());
        it('returns null for alphabetic input', () => expect(parseDuration('abc')).toBeNull());
        it('returns null for durations < 10s', () => expect(parseDuration('5s')).toBeNull());
        it('parses plain number as seconds (>= 10)', () => expect(parseDuration('60')).toBe(60000));
        it('returns null for plain number < 10s', () => expect(parseDuration('5')).toBeNull());
    });

    describe('formatDuration', () => {
        it('formats 0 → 00:00:00.000', () => expect(formatDuration(0)).toBe('00:00:00.000'));
        it('formats 1500 → 00:00:01.500', () => expect(formatDuration(1500)).toBe('00:00:01.500'));
        it('formats 3661000 → 01:01:01.000', () => expect(formatDuration(3661000)).toBe('01:01:01.000'));
        it('formats 60000 → 00:01:00.000', () => expect(formatDuration(60000)).toBe('00:01:00.000'));
    });
});
