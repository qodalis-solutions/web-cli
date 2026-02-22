import { Injectable } from '@angular/core';
import { CliKeyValueStore } from '../storage/cli-key-value-store';

@Injectable({
    providedIn: 'root',
})
export class CliCommandHistoryService {
    private readonly storageKey = 'cli-command-history';
    private commandHistory: string[] = [];

    constructor(private readonly store: CliKeyValueStore) {}

    public async addCommand(command: string): Promise<void> {
        const normalizedCommand = command.trim();
        if (normalizedCommand) {
            if (this.commandHistory.length > 0) {
                const lastCommand =
                    this.commandHistory[this.commandHistory.length - 1];
                if (lastCommand === normalizedCommand) {
                    return;
                }
            }
            this.commandHistory.push(normalizedCommand);
            await this.saveHistory();
        }
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

    public getCommand(index: number): string | undefined {
        return this.commandHistory[index];
    }

    private async saveHistory(): Promise<void> {
        //save only last 500 commands
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
