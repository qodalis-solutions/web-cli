import { ICliUser } from '@qodalis/cli-core';
import type { ICliUsersBackend } from '../backend/users-backend';

export const CliUsersModuleConfig_TOKEN = 'cli-users-module-config';

export interface CliUsersModuleConfig {
    /** Hide the username from the terminal prompt (default: false) */
    hideUserName?: boolean;
    /**
     * Prompt label while nobody is signed in, shown dimmed: `anonymous:/$`
     * (default: 'anonymous'). Set to '' to show no label.
     */
    anonymousName?: string;
    /** Default password for seeded users (default: 'root') */
    defaultPassword?: string;
    /** Users to seed on first boot (local mode). Without them, first boot asks you to create the administrator. */
    seedUsers?: Array<Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>>;
    /**
     * Require a password for `login` and `su` (default: true). Setting it to
     * false (local mode only) enables a passwordless development mode in which
     * anyone at the keyboard can sign in as any user, and the first
     * administrator is signed in automatically at boot. Never use it for real
     * data. Server mode always requires passwords.
     */
    requirePassword?: boolean;
    /**
     * Ask for credentials at boot (default: false — the CLI starts signed out,
     * or with the restored session, and users run `login`).
     */
    requirePasswordOnBoot?: boolean;
    /** Idle session timeout in ms, local mode (0 = no timeout, default: 0). The server has its own setting. */
    sessionTimeout?: number;
    /**
     * Custom formatter for the user display name in the prompt.
     * @default user.name
     * @example (user) => user.email
     * @example (user) => `${user.name}@cli`
     */
    userDisplayFormatter?: (user: ICliUser) => string;

    /** Password policy for new passwords and password changes (default: minimum 8 characters) */
    passwordPolicy?: {
        /** Minimum password length (default: 0, no minimum) */
        minLength?: number;
        /** Require at least one uppercase letter */
        requireUppercase?: boolean;
        /** Require at least one digit */
        requireDigit?: boolean;
        /** Require at least one special character (!@#$%^&*...) */
        requireSpecialChar?: boolean;
    };

    /**
     * Server mode: the CLI becomes a front end for this server's users system
     * (must match a `CliServerConfig.name` in `options.servers`). The server is
     * the authority for authentication, permissions and audit.
     */
    server?: string;

    /**
     * Custom backend: connect the CLI to your own system's users API by
     * implementing {@link ICliUsersBackend} (the same contract the CLI servers
     * implement). Every command, guard and service then works against it.
     * Takes precedence over `server`.
     */
    backend?: ICliUsersBackend;

    /**
     * Host-managed authentication (server mode). Use when the CLI is embedded in
     * an application whose users are already signed in: the CLI reuses the
     * host's bearer token instead of asking for credentials, and `login`,
     * `logout`, `su` and own-password changes are handled by the host.
     */
    hostAuth?: {
        /** Current bearer token of the signed-in host user (undefined = signed out) */
        getToken: () => string | undefined | Promise<string | undefined>;
        /** Shown by `login` when signed out, e.g. "Sign in at https://app.example.com/login" */
        loginHint?: string;
        /** Called by `logout`; omit to tell users to log out in the host application */
        logout?: () => void | Promise<void>;
    };

    /**
     * Keep the session token across page reloads (stored in IndexedDB).
     * Set to false for shared machines or stricter deployments: the token then
     * lives in memory only and users sign in again after a reload. Default true.
     */
    persistToken?: boolean;

    /** Brute force protection for login attempts (local mode; servers enforce their own) */
    bruteForceProtection?: {
        /** Maximum failed attempts before lockout (default: 5, 0 disables) */
        maxAttempts?: number;
        /** Lockout duration in seconds (default: 300) */
        lockoutSeconds?: number;
    };

    /** PBKDF2 iterations for local password hashes (default: 100000) */
    passwordHashIterations?: number;
}
