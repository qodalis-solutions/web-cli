/** A single audit log entry */
export interface ICliAuditEntry {
    /** Entry id (server-assigned in server mode) */
    id?: string;
    /** When the event occurred */
    timestamp: number;
    /** Event type (e.g., 'login', 'logout', 'login_failed') */
    event: string;
    /** Username involved */
    username: string;
    /** Optional additional details */
    details?: string;
    /** Id of the user the entry is about, when known */
    userId?: string;
    /** The user who performed the action, when different from `username` */
    actor?: string;
    /** Id of the acting user, when different from the subject */
    actorId?: string;
    /** Extra data (e.g. remote address) */
    metadata?: Record<string, unknown>;
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
