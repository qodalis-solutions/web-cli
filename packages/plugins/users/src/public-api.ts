/*
 * Public API Surface of users
 */

export * from './lib/processors';
export * from './lib/services';
export * from './lib/models/users-module-config';

import {
    ICliModule,
    ICliKeyValueStore,
    ICliUsersStoreService,
    ICliGroupsStoreService,
    ICliAuthService,
    ICliUser,
    ICliUserSessionService,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliGroupsStoreService_TOKEN,
    ICliAuthService_TOKEN,
} from '@qodalis/cli-core';

import { CliWhoamiCommandProcessor } from './lib/processors/cli-whoami-command-processor';
import { CliAddUserCommandProcessor } from './lib/processors/cli-add-user-command-processor';
import { CliListUsersCommandProcessor } from './lib/processors/cli-list-users-command-processor';
import { CliSwitchUserCommandProcessor } from './lib/processors/cli-switch-user-command-processor';
import { CliUserdelCommandProcessor } from './lib/processors/cli-userdel-command-processor';
import { CliUsermodCommandProcessor } from './lib/processors/cli-usermod-command-processor';
import { CliPasswdCommandProcessor } from './lib/processors/cli-passwd-command-processor';
import { CliLoginCommandProcessor } from './lib/processors/cli-login-command-processor';
import { CliLogoutCommandProcessor } from './lib/processors/cli-logout-command-processor';
import { CliIdCommandProcessor } from './lib/processors/cli-id-command-processor';
import { CliGroupsCommandProcessor } from './lib/processors/cli-groups-command-processor';
import { CliGroupaddCommandProcessor } from './lib/processors/cli-groupadd-command-processor';
import { CliGroupdelCommandProcessor } from './lib/processors/cli-groupdel-command-processor';
import { CliWhoCommandProcessor } from './lib/processors/cli-who-command-processor';

import { CliDefaultUsersStoreService } from './lib/services/cli-default-users-store.service';
import { CliDefaultUserSessionService } from './lib/services/cli-default-user-session.service';
import { CliDefaultGroupsStoreService } from './lib/services/cli-default-groups-store.service';
import { CliDefaultAuthService } from './lib/services/cli-default-auth.service';
import {
    CliUsersModuleConfig,
    CliUsersModuleConfig_TOKEN,
} from './lib/models/users-module-config';
import { firstValueFrom } from 'rxjs';

import { LIBRARY_VERSION, API_VERSION } from './lib/version';

interface ICliUsersModule extends ICliModule {
    configure(config: CliUsersModuleConfig): ICliModule;
}

export const usersModule: ICliUsersModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-users',
    version: LIBRARY_VERSION,
    priority: Number.MAX_SAFE_INTEGER,
    description: 'Linux-style user and group management with authentication',
    processors: [
        new CliWhoamiCommandProcessor(),
        new CliAddUserCommandProcessor(),
        new CliListUsersCommandProcessor(),
        new CliSwitchUserCommandProcessor(),
        new CliUserdelCommandProcessor(),
        new CliUsermodCommandProcessor(),
        new CliPasswdCommandProcessor(),
        new CliLoginCommandProcessor(),
        new CliLogoutCommandProcessor(),
        new CliIdCommandProcessor(),
        new CliGroupsCommandProcessor(),
        new CliGroupaddCommandProcessor(),
        new CliGroupdelCommandProcessor(),
        new CliWhoCommandProcessor(),
    ],
    services: [
        {
            provide: ICliUsersStoreService_TOKEN,
            useValue: new CliDefaultUsersStoreService(),
        },
        {
            provide: ICliGroupsStoreService_TOKEN,
            useValue: new CliDefaultGroupsStoreService(),
        },
    ],

    configure(config: CliUsersModuleConfig): ICliModule {
        return { ...this, config };
    },

    async onInit(context) {
        const moduleConfig = (this.config || {}) as CliUsersModuleConfig;
        const kvStore = context.services.get<ICliKeyValueStore>(
            'cli-key-value-store',
        );

        // Register module config so processors can access it
        context.services.set([
            { provide: CliUsersModuleConfig_TOKEN, useValue: moduleConfig },
        ]);

        // Initialize users store
        const usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        await (usersStore as CliDefaultUsersStoreService).initialize(kvStore);

        // Initialize groups store (depends on users store)
        const groupsStore = context.services.get<ICliGroupsStoreService>(
            ICliGroupsStoreService_TOKEN,
        );
        await (groupsStore as CliDefaultGroupsStoreService).initialize(
            kvStore,
            usersStore,
        );

        // Initialize session service
        const sessionService = new CliDefaultUserSessionService();
        await sessionService.initialize(kvStore);
        context.services.set([
            { provide: ICliUserSessionService_TOKEN, useValue: sessionService },
        ]);

        // Initialize auth service (depends on users store and session service)
        const authService = new CliDefaultAuthService();
        await authService.initialize(kvStore, usersStore, sessionService);
        context.services.set([
            { provide: ICliAuthService_TOKEN, useValue: authService },
        ]);

        // Seed additional users from config
        if (moduleConfig.seedUsers) {
            for (const seedUser of moduleConfig.seedUsers) {
                try {
                    const created = await usersStore.createUser(seedUser);
                    const password = moduleConfig.defaultPassword || 'root';
                    await authService.setPassword(created.id, password);
                } catch {
                    // User may already exist from previous boot — skip
                }
            }
        }

        // Restore or auto-login, unless boot login is required
        if (moduleConfig.requirePasswordOnBoot) {
            // Force fresh login — do not restore previous session
            await sessionService.clearSession();
        } else {
            const restoredSession = await sessionService.restoreSession();
            if (!restoredSession) {
                const users = await firstValueFrom(usersStore.getUsers());
                const adminUser = users.find(u => u.groups.includes('admin'));
                if (adminUser) {
                    await sessionService.setUserSession({
                        user: adminUser,
                        loginTime: Date.now(),
                        lastActivity: Date.now(),
                    });
                }
            }
        }

        // Resolve display name formatter (default: user.name)
        const formatDisplayName =
            moduleConfig.userDisplayFormatter ??
            ((user: ICliUser) => user.name);

        // Subscribe session changes to execution context
        sessionService.getUserSession().subscribe((session) => {
            if (session) {
                context.userSession = {
                    ...session,
                    displayName: formatDisplayName(session.user),
                };

                // Sync filesystem home path with current user's homeDir
                if (session.user.homeDir) {
                    try {
                        const fs = context.services.get<any>(
                            'cli-file-system-service',
                        );
                        if (fs) {
                            fs.setHomePath(session.user.homeDir);
                        }
                    } catch {
                        // Files module not installed — skip
                    }
                }
            }
        });
    },

    async onSetup(context) {
        const usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        const authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
        const sessionService = context.services.get<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );

        // Step 1: Show intro
        context.writer.writeln('');
        context.writer.writeln('============================================');
        context.writer.writeln('  Welcome to Qodalis CLI User Setup');
        context.writer.writeln('============================================');
        context.writer.writeln('');
        context.writer.writeln('This system requires initial user configuration.');
        context.writer.writeln('');
        context.writer.writeln("A 'root' superuser will be created automatically.");
        context.writer.writeln('You will now create your personal user account.');
        context.writer.writeln('');

        // Step 2: Create root user silently
        const rootUser = await usersStore.createUser({
            name: 'root',
            email: 'root@localhost',
            groups: ['admin'],
            homeDir: '/home/root',
        });
        await authService.setPassword(rootUser.id, 'root');

        // Step 3: Prompt for custom user
        const usernameRegex = /^[a-z_][a-z0-9_-]{0,31}$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

        // Username
        let username: string;
        while (true) {
            const input = await context.reader.readLine('Username: ');
            if (input === null) return false;
            if (!usernameRegex.test(input)) {
                context.writer.writeError(
                    'Invalid username. Must match /^[a-z_][a-z0-9_-]{0,31}$/.',
                );
                continue;
            }
            username = input;
            break;
        }

        // Email
        let email: string;
        while (true) {
            const input = await context.reader.readLine('Email: ');
            if (input === null) return false;
            if (!emailRegex.test(input)) {
                context.writer.writeError(
                    'Invalid email address.',
                );
                continue;
            }
            email = input;
            break;
        }

        // Home directory
        const homeDirInput = await context.reader.readLine(
            `Home directory [/home/${username}]: `,
        );
        if (homeDirInput === null) return false;
        const homeDir = homeDirInput || `/home/${username}`;

        // Shell
        const shellInput = await context.reader.readLine(
            'Shell [/bin/bash]: ',
        );
        if (shellInput === null) return false;
        const shell = shellInput || '/bin/bash';

        // Groups
        const groupsInput = await context.reader.readLine(
            'Groups (comma-separated) []: ',
        );
        if (groupsInput === null) return false;
        const groups = groupsInput
            ? groupsInput.split(',').map((g) => g.trim()).filter(Boolean)
            : [];

        // Password
        let password: string;
        while (true) {
            const pw = await context.reader.readPassword('Password: ');
            if (pw === null) return false;
            if (!pw) {
                context.writer.writeError('Password cannot be empty.');
                continue;
            }

            const confirm = await context.reader.readPassword(
                'Confirm password: ',
            );
            if (confirm === null) return false;

            if (pw !== confirm) {
                context.writer.writeError(
                    'Passwords do not match. Please try again.',
                );
                continue;
            }
            password = pw;
            break;
        }

        // Step 4: Create user and auto-login
        const user = await usersStore.createUser({
            name: username,
            email,
            groups,
            homeDir,
            shell,
        });
        await authService.setPassword(user.id, password);
        await sessionService.setUserSession({
            user,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        context.writer.writeSuccess(
            `User '${username}' created successfully.`,
        );

        // Create home directories if the files module is installed
        try {
            const fs = context.services.get<any>('cli-file-system-service');
            if (fs) {
                if (!fs.exists(rootUser.homeDir)) {
                    fs.createDirectory(rootUser.homeDir, true);
                }
                if (!fs.exists(homeDir)) {
                    fs.createDirectory(homeDir, true);
                }
                // Create a welcome file in the new user's home
                fs.createFile(
                    `${homeDir}/welcome.txt`,
                    'Welcome to Qodalis CLI filesystem!\n',
                );
                fs.setHomePath(homeDir);
                fs.setCurrentDirectory(homeDir);
                await fs.persist();
            }
        } catch {
            // Files module not installed — skip
        }

        return true;
    },

    async onAfterBoot(context) {
        const moduleConfig = (this.config || {}) as CliUsersModuleConfig;
        if (!moduleConfig.requirePasswordOnBoot) return;

        const sessionService = context.services.get<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );
        const usersStore = context.services.get<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        const authService = context.services.get<ICliAuthService>(
            ICliAuthService_TOKEN,
        );

        while (!context.userSession) {
            const username = await context.reader.readLine('Username: ');
            if (username === null) continue;

            if (!username) {
                context.writer.writeError('Username required');
                continue;
            }

            if (moduleConfig.requirePassword) {
                const password =
                    await context.reader.readPassword('Password: ');
                if (password === null) continue;

                try {
                    await authService.login(username, password);
                } catch (e: any) {
                    context.writer.writeError(
                        e.message || 'Authentication failure',
                    );
                }
            } else {
                const user = await firstValueFrom(usersStore.getUser(username));
                if (!user) {
                    context.writer.writeError(`Unknown user: ${username}`);
                    continue;
                }
                if (user.disabled) {
                    context.writer.writeError('Account is disabled');
                    continue;
                }
                await sessionService.setUserSession({
                    user,
                    loginTime: Date.now(),
                    lastActivity: Date.now(),
                });
            }
        }
        context.showPrompt();
    },
};
