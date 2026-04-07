import { ICliUser } from '@qodalis/cli-core';

export const CliUsersModuleConfig_TOKEN = 'cli-users-module-config';

export interface CliUsersModuleConfig {
    /** Hide the username from the terminal prompt (default: false) */
    hideUserName?: boolean;
    /** Default password for seeded users (default: 'root') */
    defaultPassword?: string;
    /** Users to seed on first boot (in addition to root) */
    seedUsers?: Array<Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>>;
    /** Require password for login and su commands (default: false) */
    requirePassword?: boolean;
    /** Require password on initial boot login (default: false — auto-login as root) */
    requirePasswordOnBoot?: boolean;
    /** Session timeout in ms (0 = no timeout, default: 0) */
    sessionTimeout?: number;
    /**
     * Custom formatter for the user display name in the prompt.
     * @default user.name
     * @example (user) => user.email
     * @example (user) => `${user.name}@cli`
     */
    userDisplayFormatter?: (user: ICliUser) => string;

    /** Password policy for new passwords and password changes */
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

    /** When set, delegates user management to this CLI server (must match a CliServerConfig.name) */
    server?: string;

    /** Brute force protection for login attempts */
    bruteForceProtection?: {
        /** Maximum failed attempts before lockout (default: 5) */
        maxAttempts?: number;
        /** Lockout duration in seconds (default: 60) */
        lockoutSeconds?: number;
    };
}
