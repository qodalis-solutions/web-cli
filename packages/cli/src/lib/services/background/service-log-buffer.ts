import { ICliServiceLogEntry, CliServiceLogLevel } from '@qodalis/cli-core';

/**
 * Circular buffer for background service log entries.
 * Uses a ring buffer internally so `add()` is always O(1).
 */
export class ServiceLogBuffer {
    private buffer: (ICliServiceLogEntry | undefined)[];
    private head = 0;
    private size = 0;

    constructor(private readonly maxSize = 1000) {
        this.buffer = new Array(maxSize);
    }

    add(message: string, level: CliServiceLogLevel = 'info'): void {
        const entry: ICliServiceLogEntry = { timestamp: new Date(), level, message };
        this.buffer[this.head] = entry;
        this.head = (this.head + 1) % this.maxSize;
        if (this.size < this.maxSize) {
            this.size++;
        }
    }

    get(limit?: number): ICliServiceLogEntry[] {
        const count = limit !== undefined ? Math.min(limit, this.size) : this.size;
        const result: ICliServiceLogEntry[] = new Array(count);

        // Start index: oldest entry in the requested range
        const start = (this.head - count + this.maxSize) % this.maxSize;
        for (let i = 0; i < count; i++) {
            result[i] = this.buffer[(start + i) % this.maxSize]!;
        }

        return result;
    }

    clear(): void {
        this.buffer = new Array(this.maxSize);
        this.head = 0;
        this.size = 0;
    }
}
