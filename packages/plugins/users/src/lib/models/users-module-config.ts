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
}
