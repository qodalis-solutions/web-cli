import { ServiceLogBuffer } from '../lib/services/background/service-log-buffer';

describe('ServiceLogBuffer', () => {
    let buffer: ServiceLogBuffer;

    beforeEach(() => {
        buffer = new ServiceLogBuffer(5);
    });

    it('should start empty', () => {
        expect(buffer.get()).toEqual([]);
    });

    it('should add and retrieve a single entry', () => {
        buffer.add('hello');
        const entries = buffer.get();
        expect(entries.length).toBe(1);
        expect(entries[0].message).toBe('hello');
        expect(entries[0].level).toBe('info');
        expect(entries[0].timestamp).toBeInstanceOf(Date);
    });

    it('should default level to info', () => {
        buffer.add('msg');
        expect(buffer.get()[0].level).toBe('info');
    });

    it('should respect explicit log levels', () => {
        buffer.add('warn msg', 'warn');
        buffer.add('error msg', 'error');
        buffer.add('info msg', 'info');

        const entries = buffer.get();
        expect(entries[0].level).toBe('warn');
        expect(entries[1].level).toBe('error');
        expect(entries[2].level).toBe('info');
    });

    it('should return entries in insertion order', () => {
        buffer.add('first');
        buffer.add('second');
        buffer.add('third');

        const messages = buffer.get().map((e) => e.message);
        expect(messages).toEqual(['first', 'second', 'third']);
    });

    it('should not exceed maxSize', () => {
        for (let i = 0; i < 10; i++) {
            buffer.add(`msg-${i}`);
        }
        expect(buffer.get().length).toBe(5);
    });

    it('should keep the most recent entries when overflowing', () => {
        for (let i = 0; i < 8; i++) {
            buffer.add(`msg-${i}`);
        }
        const messages = buffer.get().map((e) => e.message);
        // Buffer size 5, so keeps msg-3 through msg-7
        expect(messages).toEqual(['msg-3', 'msg-4', 'msg-5', 'msg-6', 'msg-7']);
    });

    it('should wrap around correctly after multiple overflows', () => {
        // Fill 3x the buffer size
        for (let i = 0; i < 15; i++) {
            buffer.add(`msg-${i}`);
        }
        const messages = buffer.get().map((e) => e.message);
        expect(messages).toEqual([
            'msg-10',
            'msg-11',
            'msg-12',
            'msg-13',
            'msg-14',
        ]);
    });

    it('should return limited entries with get(limit)', () => {
        buffer.add('a');
        buffer.add('b');
        buffer.add('c');
        buffer.add('d');

        const messages = buffer.get(2).map((e) => e.message);
        // Should return the 2 most recent
        expect(messages).toEqual(['c', 'd']);
    });

    it('should return all entries when limit exceeds size', () => {
        buffer.add('a');
        buffer.add('b');

        const entries = buffer.get(100);
        expect(entries.length).toBe(2);
        expect(entries.map((e) => e.message)).toEqual(['a', 'b']);
    });

    it('should return limited entries after overflow', () => {
        for (let i = 0; i < 8; i++) {
            buffer.add(`msg-${i}`);
        }
        // Buffer has [msg-3, msg-4, msg-5, msg-6, msg-7], get last 3
        const messages = buffer.get(3).map((e) => e.message);
        expect(messages).toEqual(['msg-5', 'msg-6', 'msg-7']);
    });

    it('should clear all entries', () => {
        buffer.add('a');
        buffer.add('b');
        buffer.add('c');

        buffer.clear();
        expect(buffer.get()).toEqual([]);
    });

    it('should accept new entries after clear', () => {
        buffer.add('old');
        buffer.clear();
        buffer.add('new');

        const messages = buffer.get().map((e) => e.message);
        expect(messages).toEqual(['new']);
    });

    it('should work with maxSize of 1', () => {
        const tiny = new ServiceLogBuffer(1);
        tiny.add('first');
        tiny.add('second');
        tiny.add('third');

        const entries = tiny.get();
        expect(entries.length).toBe(1);
        expect(entries[0].message).toBe('third');
    });

    it('should use default maxSize of 1000', () => {
        const defaultBuffer = new ServiceLogBuffer();
        for (let i = 0; i < 1001; i++) {
            defaultBuffer.add(`msg-${i}`);
        }
        const entries = defaultBuffer.get();
        expect(entries.length).toBe(1000);
        expect(entries[0].message).toBe('msg-1');
        expect(entries[999].message).toBe('msg-1000');
    });

    it('should handle get(0) returning empty array', () => {
        buffer.add('a');
        buffer.add('b');
        expect(buffer.get(0)).toEqual([]);
    });

    it('should assign unique timestamps to entries added at different times', (done) => {
        buffer.add('first');
        setTimeout(() => {
            buffer.add('second');
            const entries = buffer.get();
            expect(entries[1].timestamp.getTime()).toBeGreaterThanOrEqual(
                entries[0].timestamp.getTime(),
            );
            done();
        }, 10);
    });
});
