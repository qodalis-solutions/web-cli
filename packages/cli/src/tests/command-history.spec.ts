import { ICliKeyValueStore } from '@qodalis/cli-core';
import { CliCommandHistory } from '../lib/services/cli-command-history';

class MockKeyValueStore implements ICliKeyValueStore {
    private data = new Map<string, any>();

    async get<T = any>(key: string): Promise<T | undefined> {
        return this.data.get(key) as T | undefined;
    }

    async set(key: string, value: any): Promise<void> {
        this.data.set(key, value);
    }

    async remove(key: string): Promise<void> {
        this.data.delete(key);
    }

    async clear(): Promise<void> {
        this.data.clear();
    }
}

describe('CliCommandHistory', () => {
    let history: CliCommandHistory;
    let store: MockKeyValueStore;

    beforeEach(() => {
        store = new MockKeyValueStore();
        history = new CliCommandHistory(store);
    });

    it('should start with empty history', () => {
        expect(history.getHistory()).toEqual([]);
        expect(history.getLastIndex()).toBe(0);
    });

    it('should add a command', async () => {
        await history.addCommand('echo hello');
        expect(history.getHistory()).toEqual(['echo hello']);
        expect(history.getLastIndex()).toBe(1);
    });

    it('should add multiple commands in order', async () => {
        await history.addCommand('first');
        await history.addCommand('second');
        await history.addCommand('third');
        expect(history.getHistory()).toEqual(['first', 'second', 'third']);
    });

    it('should deduplicate consecutive commands', async () => {
        await history.addCommand('echo hello');
        await history.addCommand('echo hello');
        expect(history.getHistory()).toEqual(['echo hello']);
    });

    it('should move duplicate to end (move-to-end deduplication)', async () => {
        await history.addCommand('a');
        await history.addCommand('b');
        await history.addCommand('a');
        // 'a' already existed; it should be removed from position 0 and appended
        expect(history.getHistory()).toEqual(['b', 'a']);
    });

    it('should ignore empty and whitespace-only commands', async () => {
        await history.addCommand('');
        await history.addCommand('   ');
        await history.addCommand('\t');
        expect(history.getHistory()).toEqual([]);
    });

    it('should trim command whitespace', async () => {
        await history.addCommand('  echo hello  ');
        expect(history.getHistory()).toEqual(['echo hello']);
    });

    it('should get command by index', async () => {
        await history.addCommand('first');
        await history.addCommand('second');
        expect(history.getCommand(0)).toBe('first');
        expect(history.getCommand(1)).toBe('second');
        expect(history.getCommand(2)).toBeUndefined();
    });

    it('should clear history', async () => {
        await history.addCommand('first');
        await history.addCommand('second');
        await history.clearHistory();
        expect(history.getHistory()).toEqual([]);
        expect(history.getLastIndex()).toBe(0);
    });

    it('should return a copy from getHistory (not the internal array)', async () => {
        await history.addCommand('test');
        const result = history.getHistory();
        result.push('injected');
        expect(history.getHistory().length).toBe(1);
    });

    it('should persist to store on add', async () => {
        await history.addCommand('cmd1');
        const stored = await store.get<string[]>('cli-command-history');
        expect(stored).toEqual(['cmd1']);
    });

    it('should persist to store on clear', async () => {
        await history.addCommand('cmd1');
        await history.clearHistory();
        const stored = await store.get<string[]>('cli-command-history');
        expect(stored).toEqual([]);
    });

    it('should set history from an array', async () => {
        await history.addCommand('existing');
        await history.setHistory(['alpha', 'beta', 'gamma']);
        expect(history.getHistory()).toEqual(['alpha', 'beta', 'gamma']);
        expect(history.getLastIndex()).toBe(3);
    });

    it('should persist after setHistory', async () => {
        await history.setHistory(['one', 'two']);
        const stored = await store.get<string[]>('cli-command-history');
        expect(stored).toEqual(['one', 'two']);
    });

    describe('search', () => {
        beforeEach(async () => {
            await history.addCommand('git commit -m "fix"');
            await history.addCommand('git push origin main');
            await history.addCommand('npm install');
            await history.addCommand('echo hello');
        });

        it('should return all history when query is empty', () => {
            const result = history.search('');
            expect(result.length).toBe(4);
        });

        it('should return matching commands (case-insensitive)', () => {
            const result = history.search('GIT');
            expect(result).toEqual(['git commit -m "fix"', 'git push origin main']);
        });

        it('should return empty array when no match', () => {
            const result = history.search('zzznomatch');
            expect(result).toEqual([]);
        });

        it('should match substring anywhere in command', () => {
            const result = history.search('hello');
            expect(result).toEqual(['echo hello']);
        });
    });

    describe('searchBackward', () => {
        beforeEach(async () => {
            await history.addCommand('git status');
            await history.addCommand('ls -la');
            await history.addCommand('git log');
            await history.addCommand('echo hi');
        });

        it('should find the most recent matching command before fromIndex', () => {
            // history: ['git status', 'ls -la', 'git log', 'echo hi']
            // search backward from index 4 (end) for prefix 'git'
            const idx = history.searchBackward('git', 4);
            expect(idx).toBe(2); // 'git log'
        });

        it('should find earlier match when starting from a mid-point', () => {
            const idx = history.searchBackward('git', 2);
            expect(idx).toBe(0); // 'git status'
        });

        it('should return -1 when no match found', () => {
            const idx = history.searchBackward('zzz', 4);
            expect(idx).toBe(-1);
        });
    });

    describe('searchForward', () => {
        beforeEach(async () => {
            await history.addCommand('git status');
            await history.addCommand('ls -la');
            await history.addCommand('git log');
            await history.addCommand('echo hi');
        });

        it('should find the next matching command after fromIndex', () => {
            // history: ['git status', 'ls -la', 'git log', 'echo hi']
            const idx = history.searchForward('git', 0);
            expect(idx).toBe(2); // 'git log'
        });

        it('should return -1 when no forward match found', () => {
            const idx = history.searchForward('git', 2);
            expect(idx).toBe(-1);
        });

        it('should return -1 when no match at all', () => {
            const idx = history.searchForward('zzz', 0);
            expect(idx).toBe(-1);
        });
    });
});
