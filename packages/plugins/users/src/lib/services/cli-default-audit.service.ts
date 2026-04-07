import {
    ICliAuditService,
    ICliAuditEntry,
    ICliKeyValueStore,
} from '@qodalis/cli-core';

const AUDIT_KEY = 'cli-audit-log';
const MAX_ENTRIES = 500;

export class CliDefaultAuditService implements ICliAuditService {
    private entries: ICliAuditEntry[] = [];
    private kvStore!: ICliKeyValueStore;

    async initialize(kvStore: ICliKeyValueStore): Promise<void> {
        this.kvStore = kvStore;
        this.entries = (await kvStore.get<ICliAuditEntry[]>(AUDIT_KEY)) || [];
    }

    async log(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void> {
        const full: ICliAuditEntry = {
            ...entry,
            timestamp: Date.now(),
        };

        this.entries.push(full);

        // Cap at MAX_ENTRIES (FIFO)
        if (this.entries.length > MAX_ENTRIES) {
            this.entries = this.entries.slice(-MAX_ENTRIES);
        }

        await this.persist();
    }

    async getEntries(options?: {
        limit?: number;
        event?: string;
        username?: string;
    }): Promise<ICliAuditEntry[]> {
        let result = [...this.entries];

        if (options?.event) {
            result = result.filter((e) => e.event === options.event);
        }
        if (options?.username) {
            result = result.filter((e) => e.username === options.username);
        }

        // Return newest first
        result.reverse();

        if (options?.limit && options.limit > 0) {
            result = result.slice(0, options.limit);
        }

        return result;
    }

    async clear(): Promise<void> {
        this.entries = [];
        await this.persist();
    }

    private async persist(): Promise<void> {
        await this.kvStore.set(AUDIT_KEY, this.entries);
    }
}
