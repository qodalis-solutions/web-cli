import { ICliKeyValueStore } from '@qodalis/cli-core';

/** History when nobody is signed in (and always without the users module) */
const SHARED_KEY = 'cli-command-history';
/** Set once the shared history was handed to the first signed-in user */
const MIGRATED_KEY = 'cli-command-history:migrated';

/**
 * Command history, kept per user like a shell's `~/.bash_history`: each
 * signed-in user (by id) has their own, and the shared one is used while
 * nobody is signed in.
 */
export class CliCommandHistory {
    private commandHistory: string[] = [];
    /** Id of the user whose history is loaded; undefined: nobody signed in */
    private userId: string | undefined;
    private loading: Promise<void> = Promise.resolve();
    /** Counts user switches (a load for an older one is dropped) */
    private switches = 0;
    private _generation = 0;

    constructor(private readonly store: ICliKeyValueStore) {}

    /** Changes whenever the history is replaced: switched or loaded (positions into it are stale) */
    public get generation(): number {
        return this._generation;
    }

    private get storageKey(): string {
        return this.userId === undefined ? SHARED_KEY : `${SHARED_KEY}:user:${this.userId}`;
    }

    /**
     * Switch to the history of `userId` (undefined: nobody signed in).
     * Resolves once it is loaded; a no-op for the user already loaded.
     */
    public useUser(userId: string | undefined): Promise<void> {
        if (userId === this.userId) return this.loading;
        this.userId = userId;
        this.commandHistory = [];
        this.switches++;
        this._generation++;
        this.loading = this.loadHistory();
        return this.loading;
    }

    public async addCommand(command: string): Promise<void> {
        const normalizedCommand = command.trim();
        if (!normalizedCommand) return;
        await this.loading;

        // Move-to-end deduplication: remove any existing occurrence, then append.
        // This matches zsh/fish behavior — the most-recently used command is always last.
        const existingIndex = this.commandHistory.indexOf(normalizedCommand);
        if (existingIndex !== -1) {
            this.commandHistory.splice(existingIndex, 1);
        }

        this.commandHistory.push(normalizedCommand);
        await this.saveHistory();
    }

    public getLastIndex(): number {
        return this.commandHistory.length;
    }

    public getHistory(): string[] {
        return [...this.commandHistory];
    }

    public async clearHistory(): Promise<void> {
        this.commandHistory = [];
        await this.saveHistory();
    }

    public async setHistory(commands: string[]): Promise<void> {
        this.commandHistory = [...commands];
        await this.saveHistory();
    }

    public getCommand(index: number): string | undefined {
        return this.commandHistory[index];
    }

    /**
     * Search history for commands containing the query string (case-insensitive).
     * Returns matching commands in chronological order (oldest first).
     */
    public search(query: string): string[] {
        if (!query) return [...this.commandHistory];
        const lower = query.toLowerCase();
        return this.commandHistory.filter((cmd) =>
            cmd.toLowerCase().includes(lower),
        );
    }

    /**
     * Find the index of the most recent command that starts with the given prefix,
     * searching backward from `fromIndex` (exclusive).
     * Returns -1 if no match found.
     */
    public searchBackward(prefix: string, fromIndex: number): number {
        for (let i = fromIndex - 1; i >= 0; i--) {
            if (this.commandHistory[i].startsWith(prefix)) {
                return i;
            }
        }
        return -1;
    }

    /**
     * Find the index of the next command that starts with the given prefix,
     * searching forward from `fromIndex` (exclusive).
     * Returns -1 if no match found.
     */
    public searchForward(prefix: string, fromIndex: number): number {
        for (let i = fromIndex + 1; i < this.commandHistory.length; i++) {
            if (this.commandHistory[i].startsWith(prefix)) {
                return i;
            }
        }
        return -1;
    }

    private async saveHistory(): Promise<void> {
        // Save only the last 500 commands
        const trimmedHistory = this.commandHistory.slice(-500);
        return await this.store.set(this.storageKey, trimmedHistory);
    }

    private async loadHistory(): Promise<void> {
        const key = this.storageKey;
        const switches = this.switches;

        const savedOldHistory =
            typeof localStorage !== 'undefined'
                ? localStorage.getItem('cliCommandHistory')
                : null;
        if (savedOldHistory) {
            localStorage.removeItem('cliCommandHistory');
            await this.store.set(SHARED_KEY, JSON.parse(savedOldHistory));
        }

        let savedHistory = await this.store.get<string[]>(key);

        // Before histories were per user, the shared one held the owner's
        // commands: the first user to sign in takes it over
        if (!savedHistory && key !== SHARED_KEY && !(await this.store.get<boolean>(MIGRATED_KEY))) {
            await this.store.set(MIGRATED_KEY, true);
            const shared = await this.store.get<string[]>(SHARED_KEY);
            if (shared?.length) {
                await this.store.set(key, shared);
                await this.store.remove(SHARED_KEY);
                savedHistory = shared;
            }
        }

        // Another user's history was asked for meanwhile
        if (switches !== this.switches) return;
        if (savedHistory) {
            this.commandHistory = savedHistory;
            this._generation++;
        }
    }

    public async initialize(): Promise<void> {
        this.loading = this.loadHistory();
        await this.loading;
    }
}
