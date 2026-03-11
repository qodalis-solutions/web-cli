import { groupBy } from '../lib/utils/arrays';
import { getGreetingBasedOnTime } from '../lib/utils/greetings';

// ---------------------------------------------------------------------------
// groupBy
// ---------------------------------------------------------------------------
describe('groupBy', () => {
    it('should group items by key', () => {
        const items = [
            { name: 'a', category: 'x' },
            { name: 'b', category: 'y' },
            { name: 'c', category: 'x' },
        ];
        const result = groupBy(items, (i) => i.category);
        expect(result.get('x')?.length).toBe(2);
        expect(result.get('y')?.length).toBe(1);
    });

    it('should handle empty array', () => {
        const result = groupBy([], () => 'key');
        expect(result.size).toBe(0);
    });

    it('should handle single element', () => {
        const result = groupBy([{ v: 1 }], () => 'only');
        expect(result.get('only')?.length).toBe(1);
    });

    it('should group by numeric keys', () => {
        const result = groupBy([1, 2, 3, 4, 5], (n) => n % 2);
        expect(result.get(0)?.length).toBe(2); // 2, 4
        expect(result.get(1)?.length).toBe(3); // 1, 3, 5
    });

    it('should preserve order within groups', () => {
        const items = ['alpha', 'apex', 'beta', 'atom'];
        const result = groupBy(items, (s) => s[0]);
        expect(result.get('a')).toEqual(['alpha', 'apex', 'atom']);
        expect(result.get('b')).toEqual(['beta']);
    });
});

// ---------------------------------------------------------------------------
// getGreetingBasedOnTime
// ---------------------------------------------------------------------------
describe('getGreetingBasedOnTime', () => {
    it('should return morning greeting for 5am-11am', () => {
        for (const hour of [5, 8, 11]) {
            const date = new Date(2024, 0, 1, hour);
            expect(getGreetingBasedOnTime(date)).toContain('morning');
        }
    });

    it('should return afternoon greeting for 12pm-5pm', () => {
        for (const hour of [12, 14, 17]) {
            const date = new Date(2024, 0, 1, hour);
            expect(getGreetingBasedOnTime(date)).toContain('afternoon');
        }
    });

    it('should return evening greeting for 6pm-9pm', () => {
        for (const hour of [18, 20, 21]) {
            const date = new Date(2024, 0, 1, hour);
            expect(getGreetingBasedOnTime(date)).toContain('evening');
        }
    });

    it('should return night greeting for 10pm-4am', () => {
        for (const hour of [22, 23, 0, 3, 4]) {
            const date = new Date(2024, 0, 1, hour);
            expect(getGreetingBasedOnTime(date)).toContain('night');
        }
    });

    it('should use current time when no date provided', () => {
        // Just verify it returns a non-empty string
        const result = getGreetingBasedOnTime();
        expect(result.length).toBeGreaterThan(0);
    });
});
