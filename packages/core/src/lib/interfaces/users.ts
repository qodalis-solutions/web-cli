import {
    ICliUserSession,
    ICliUser,
    ICliGroup,
    CliAddUser,
    CliUpdateUser,
} from '../models';
import { Observable } from 'rxjs';

/**
 * Represents a service that manages user sessions in the CLI
 */
export interface ICliUserSessionService {
    /** Gets the current user session as a reactive stream */
    getUserSession(): Observable<ICliUserSession | undefined>;

    /** Sets the current user session */
    setUserSession(session: ICliUserSession): Promise<void>;

    /** Clears the current session (logout) */
    clearSession(): Promise<void>;

    /** Persists the current session to storage */
    persistSession(): Promise<void>;

    /** Restores a session from storage (called on boot) */
    restoreSession(): Promise<ICliUserSession | undefined>;
}

/**
 * Represents a service that manages users in the CLI
 */
export interface ICliUsersStoreService {
    /** Gets users with optional filtering and pagination */
    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]>;

    /** Creates a new user */
    createUser(user: CliAddUser): Promise<ICliUser>;

    /** Gets a user by id, name, or email */
    getUser(id: string): Observable<ICliUser | undefined>;

    /** Updates an existing user */
    updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser>;

    /** Deletes a user by id */
    deleteUser(id: string): Promise<void>;
}

/**
 * Represents a service that manages groups in the CLI
 */
export interface ICliGroupsStoreService {
    /** Gets all groups */
    getGroups(): Observable<ICliGroup[]>;

    /** Gets a group by id or name */
    getGroup(id: string): Observable<ICliGroup | undefined>;

    /** Creates a new group (role), optionally with permissions */
    createGroup(name: string, description?: string, permissions?: string[]): Promise<ICliGroup>;

    /** Updates a group's description and/or permissions (by id or name) */
    updateGroup(id: string, updates: { description?: string; permissions?: string[] }): Promise<ICliGroup>;

    /** Adds a user (id or name) to a group (id or name) */
    addMember(groupId: string, userId: string): Promise<void>;

    /** Removes a user (id or name) from a group (id or name) */
    removeMember(groupId: string, userId: string): Promise<void>;

    /** Deletes a group by id */
    deleteGroup(id: string): Promise<void>;

    /** Gets all users that belong to a group */
    getGroupMembers(groupId: string): Observable<ICliUser[]>;
}

/**
 * Represents a service that handles authentication in the CLI
 */
export interface ICliAuthService {
    /**
     * Authenticates a user and returns a session. `password` may be omitted
     * only when the implementation allows passwordless sign-in.
     */
    login(username: string, password?: string): Promise<ICliUserSession>;

    /**
     * Ends the current session. After `switchUser` the session it suspended is
     * resumed (Unix `exit` after `su`); otherwise the CLI is left signed out.
     */
    logout(): Promise<void>;

    /**
     * Switch to another user (`su`). Requires the target's password unless
     * the caller may skip it (implementation-defined, e.g. `users:update`).
     * Goes through the same lockout, events and audit as `login`.
     * Implementations may suspend the current session instead of ending it,
     * so that `logout` returns to it (like nested Unix shells).
     */
    switchUser?(username: string, password?: string): Promise<ICliUserSession>;

    /**
     * Sets or updates a user's password.
     * @param currentPassword The user's current password, when changing one's own
     * password. Server-backed implementations forward it so the server can
     * re-check it; local implementations may ignore it.
     */
    setPassword(userId: string, password: string, currentPassword?: string): Promise<void>;

    /** Verifies a password against stored credentials */
    verifyPassword(userId: string, password: string): Promise<boolean>;

    /** Hashes a password with a salt using Web Crypto SHA-256 */
    hashPassword(password: string, salt: string): Promise<string>;

    /** Validate password against policy. Returns error message or null if valid. */
    validatePassword?(password: string): string | null;
}
