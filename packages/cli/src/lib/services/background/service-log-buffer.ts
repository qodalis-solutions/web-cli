import { ICliServiceLogEntry } from '@qodalis/cli-core';

/**
 * Circular buffer for background service log entries.
 */
export class ServiceLogBuffer {
    private entries: ICliServiceLogEntry[] = [];

    constructor(private maxSize = 1000) {}

    add(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        this.entries.push({ timestamp: new Date(), level, message });
        if (this.entries.length > this.maxSize) {
            this.entries.shift();
        }
    }

    get(limit?: number): ICliServiceLogEntry[] {
        if (limit === undefined) {
            return [...this.entries];
        }
        return this.entries.slice(-limit);
    }

    clear(): void {
        this.entries = [];
    }
}
