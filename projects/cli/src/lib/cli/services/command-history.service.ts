import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class CommandHistoryService {
    private readonly storageKey = 'cliCommandHistory';
    private commandHistory: string[] = [];

    constructor() {
        this.loadHistory();
    }

    public addCommand(command: string): void {
        const normalizedCommand = command.trim();
        if (normalizedCommand) {
            if (this.commandHistory.length > 0) {
                const lastCommand =
                    this.commandHistory[this.commandHistory.length - 1];
                if (lastCommand === normalizedCommand) {
                    return;
                }
            }
            this.commandHistory.push(command);
            this.saveHistory();
        }
    }

    public getLastIndex(): number {
        return this.commandHistory.length;
    }

    public getHistory(): string[] {
        return [...this.commandHistory];
    }

    public clearHistory(): void {
        this.commandHistory = [];
        this.saveHistory();
    }

    public getCommand(index: number): string | undefined {
        return this.commandHistory[index];
    }

    private saveHistory(): void {
        localStorage.setItem(
            this.storageKey,
            JSON.stringify(this.commandHistory)
        );
    }

    private loadHistory(): void {
        const savedHistory = localStorage.getItem(this.storageKey);
        if (savedHistory) {
            this.commandHistory = JSON.parse(savedHistory);
        }
    }
}
