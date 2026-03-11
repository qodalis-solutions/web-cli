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

    /** Creates a new group */
    createGroup(name: string, description?: string): Promise<ICliGroup>;

    /** Deletes a group by id */
    deleteGroup(id: string): Promise<void>;

    /** Gets all users that belong to a group */
    getGroupMembers(groupId: string): Observable<ICliUser[]>;
}

/**
 * Represents a service that handles authentication in the CLI
 */
export interface ICliAuthService {
    /** Authenticates a user and returns a session */
    login(username: string, password: string): Promise<ICliUserSession>;

    /** Ends the current session */
    logout(): Promise<void>;

    /** Sets or updates a user's password */
    setPassword(userId: string, password: string): Promise<void>;

    /** Verifies a password against stored credentials */
    verifyPassword(userId: string, password: string): Promise<boolean>;

    /** Hashes a password with a salt using Web Crypto SHA-256 */
    hashPassword(password: string, salt: string): Promise<string>;
}
