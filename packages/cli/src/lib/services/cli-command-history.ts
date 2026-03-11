import { ICliKeyValueStore } from '@qodalis/cli-core';

export class CliCommandHistory {
    private readonly storageKey = 'cli-command-history';
    private commandHistory: string[] = [];

    constructor(private readonly store: ICliKeyValueStore) {}

    public async addCommand(command: string): Promise<void> {
        const normalizedCommand = command.trim();
        if (!normalizedCommand) return;

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
        const savedOldHistory = localStorage.getItem('cliCommandHistory');
        if (savedOldHistory) {
            localStorage.removeItem('cliCommandHistory');
            await this.store.set(this.storageKey, JSON.parse(savedOldHistory));
        }

        const savedHistory = await this.store.get<string[]>(this.storageKey);

        if (savedHistory) {
            this.commandHistory = savedHistory;
        }
    }

    public async initialize(): Promise<void> {
        await this.loadHistory();
    }
}
