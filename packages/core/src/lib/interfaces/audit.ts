/** A single audit log entry */
export interface ICliAuditEntry {
    /** When the event occurred */
    timestamp: number;
    /** Event type (e.g., 'login', 'logout', 'login_failed') */
    event: string;
    /** Username involved */
    username: string;
    /** Optional additional details */
    details?: string;
}

/** Service for persistent audit logging */
export interface ICliAuditService {
    /** Log an audit entry (timestamp is added automatically) */
    log(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void>;

    /** Retrieve audit entries with optional filtering */
    getEntries(options?: {
        limit?: number;
        event?: string;
        username?: string;
    }): Promise<ICliAuditEntry[]>;

    /** Clear all audit entries */
    clear(): Promise<void>;
}
