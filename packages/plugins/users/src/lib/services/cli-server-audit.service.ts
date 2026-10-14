import {
    ICliAuditService,
    ICliAuditEntry,
    ICliHttpClient,
} from '@qodalis/cli-core';

/**
 * Server-backed audit service used when the users module runs in server mode.
 *
 * The server records every auth/user event itself, so `log()` is a no-op.
 * Reads delegate to `GET /audit` and `clear()` to `DELETE /audit` (admin only).
 */
export class CliServerAuditService implements ICliAuditService {
    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    async log(_entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void> {
        // Server owns the audit log — events are recorded server-side.
    }

    async getEntries(options?: {
        limit?: number;
        event?: string;
        username?: string;
    }): Promise<ICliAuditEntry[]> {
        const params = new URLSearchParams();
        if (options?.event) params.set('event', options.event);
        if (options?.username) params.set('username', options.username);
        if (options?.limit && options.limit > 0) {
            params.set('limit', String(options.limit));
        }
        const qs = params.toString();
        const entries = await this.http.get<ICliAuditEntry[]>(
            `${this.baseUrl}/audit${qs ? '?' + qs : ''}`,
            { headers: this.getHeaders() },
        );
        return entries ?? [];
    }

    async clear(): Promise<void> {
        await this.http.delete(`${this.baseUrl}/audit`, {
            headers: this.getHeaders(),
        });
    }
}
