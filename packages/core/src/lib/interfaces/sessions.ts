import { ICliSessionsService_TOKEN } from '../tokens';

export { ICliSessionsService_TOKEN };

/** A sign-in session as listed by {@link ICliSessionsService}. Never carries a token. */
export interface ICliSessionInfo {
    id: string;
    userId: string;
    userName: string;
    createdAt: number;
    lastActivity: number;
    /** When the session expires if idle; undefined when there is no timeout */
    expiresAt?: number;
    /** True for the caller's own session */
    current?: boolean;
    metadata?: { userAgent?: string; remoteAddress?: string; [key: string]: unknown };
}

/**
 * Lists and revokes sign-in sessions. Implemented locally (sessions of this
 * browser) and by servers (all sessions). Used by `sessions` / `session-kick`.
 */
export interface ICliSessionsService {
    /** All sessions visible to the caller */
    list(): Promise<ICliSessionInfo[]>;
    /** Revoke a session by id */
    revoke(sessionId: string, reason?: string): Promise<void>;
    /** Revoke every session of a user (optionally keeping one) */
    revokeUser(userId: string, options?: { exceptSessionId?: string; reason?: string }): Promise<void>;
}
