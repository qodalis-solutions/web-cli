/**
 * Represents a user in the CLI
 */
export interface ICliUser {
    /** Unique user identifier */
    id: string;
    /** Login name (unique) */
    name: string;
    /** Email address (unique) */
    email: string;
    /** Group IDs this user belongs to */
    groups: string[];
    /** Virtual home directory path, e.g. /home/root */
    homeDir?: string;
    /** Account creation timestamp */
    createdAt: number;
    /** Last modification timestamp */
    updatedAt: number;
    /** Whether the account is locked */
    disabled?: boolean;
}

/**
 * Represents user credentials (shadow pattern — stored separately from ICliUser)
 */
export interface ICliUserCredentials {
    /** The user ID this credential belongs to */
    userId: string;
    /** SHA-256 hash of salt + password */
    passwordHash: string;
    /** Random salt for this user */
    salt: string;
    /** Timestamp of last password change */
    lastChanged: number;
}

/**
 * Represents a group in the CLI
 */
export interface ICliGroup {
    /** Unique group identifier */
    id: string;
    /** Group name (unique) */
    name: string;
    /** Optional group description */
    description?: string;
    /** Group creation timestamp */
    createdAt: number;
}

/**
 * Represents an active user session
 */
export interface ICliUserSession {
    /** The user associated with this session */
    user: ICliUser;
    /** Pre-computed display name for the prompt (set by users module) */
    displayName?: string;
    /** Timestamp when the session started */
    loginTime: number;
    /** Timestamp of last activity */
    lastActivity: number;
    /** Extensible data (tokens, metadata, etc.) */
    data?: Record<string, any>;
}

/** Fields required to create a new user */
export type CliAddUser = Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>;

/** Fields that can be updated on a user */
export type CliUpdateUser = Partial<Omit<ICliUser, 'id' | 'createdAt'>>;
