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
    ICliPermissionService_TOKEN,
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
import { CliDefaultPermissionService } from './lib/services/cli-default-permission.service';
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

    translations: {
        es: { 'cli.users.description': 'Gestión de usuarios y grupos con autenticación' },
        fr: { 'cli.users.description': 'Gestion des utilisateurs et groupes avec authentification' },
        de: { 'cli.users.description': 'Benutzer- und Gruppenverwaltung mit Authentifizierung' },
        pt: { 'cli.users.description': 'Gerenciamento de usuários e grupos com autenticação' },
        it: { 'cli.users.description': 'Gestione utenti e gruppi con autenticazione' },
        ja: { 'cli.users.description': '認証付きユーザーとグループの管理' },
        ko: { 'cli.users.description': '인증 기반 사용자 및 그룹 관리' },
        zh: { 'cli.users.description': '带身份认证的用户和组管理' },
        ru: { 'cli.users.description': 'Управление пользователями и группами с аутентификацией' },
        ro: { 'cli.users.description': 'Gestionare utilizatori și grupuri cu autentificare' },
    },

    configure(config: CliUsersModuleConfig): ICliModule {
        return { ...this, config };
    },

    async onInit(context) {
        const moduleConfig = (this.config || {}) as CliUsersModuleConfig;
        const kvStore = context.services.get<ICliKeyValueStore>(
            'cli-key-value-store',
        );

        // Register module config and permission service
        context.services.set([
            { provide: CliUsersModuleConfig_TOKEN, useValue: moduleConfig },
            { provide: ICliPermissionService_TOKEN, useValue: new CliDefaultPermissionService() },
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
        let previousUserId: string | null = null;
        sessionService.getUserSession().subscribe((session) => {
            if (session) {
                context.userSession = {
                    ...session,
                    displayName: formatDisplayName(session.user),
                };

                // Sync filesystem with current user
                try {
                    const fs = context.services.get<any>(
                        'cli-file-system-service',
                    );
                    if (fs) {
                        if (session.user.homeDir) {
                            // Create home directory if it doesn't exist
                            if (!fs.exists(session.user.homeDir)) {
                                fs.createDirectory(session.user.homeDir, true);
                            }
                            fs.setHomePath(session.user.homeDir);
                            // When user changes, move to their home directory
                            if (previousUserId !== session.user.id) {
                                fs.setCurrentDirectory(session.user.homeDir);
                            }
                        }
                        fs.setCurrentUser(session.user.id, session.user.groups);
                    }
                } catch {
                    // Files module not installed — skip
                }
                previousUserId = session.user.id;
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

        // Create root user silently (skip if already exists)
        let rootUser: ICliUser;
        const existingRoot = await firstValueFrom(usersStore.getUser('root'));
        if (existingRoot) {
            rootUser = existingRoot;
        } else {
            rootUser = await usersStore.createUser({
                name: 'root',
                email: 'root@localhost',
                groups: ['admin'],
                homeDir: '/',
            });
            await authService.setPassword(rootUser.id, 'root');
        }

        // Set up filesystem for root
        try {
            const fs = context.services.get<any>('cli-file-system-service');
            if (fs) {
                fs.setHomePath('/');
                fs.setCurrentDirectory('/');
                await fs.persist();
            }
        } catch {
            // Files module not installed — skip
        }

        // Log in as root initially
        await sessionService.setUserSession({
            user: rootUser,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        // Prompt for user creation
        context.writer.writeln('');
        context.writer.writeInfo('Welcome! Let\'s create your user account.');
        context.writer.writeln('');

        let newUser: ICliUser | null = null;

        while (!newUser) {
            const username = await context.reader.readLine('Username: ');
            if (username === null || !username.trim()) {
                context.writer.writeError('Username is required.');
                continue;
            }

            const name = username.trim();

            if (name === 'root') {
                context.writer.writeError('Cannot create a user named "root".');
                continue;
            }

            const email = await context.reader.readLine('Email: ');
            if (email === null || !email.trim()) {
                context.writer.writeError('Email is required.');
                continue;
            }

            const password = await context.reader.readPassword('Password: ');
            if (password === null) {
                context.writer.writeError('Password is required.');
                continue;
            }

            const confirmPassword = await context.reader.readPassword('Confirm password: ');
            if (confirmPassword === null) {
                context.writer.writeError('Password confirmation is required.');
                continue;
            }

            if (password !== confirmPassword) {
                context.writer.writeError('Passwords do not match.');
                continue;
            }

            const defaultHome = `/home/${name}`;
            const homeInput = await context.reader.readLine(`Home directory (${defaultHome}): `);
            const homeDir = homeInput?.trim() || defaultHome;

            try {
                newUser = await usersStore.createUser({
                    name,
                    email: email.trim(),
                    groups: ['admin'],
                    homeDir,
                });
                await authService.setPassword(newUser.id, password);
            } catch (e) {
                context.writer.writeError(e?.toString() || 'Failed to create user.');
                continue;
            }
        }

        // Log in as the new user
        await sessionService.setUserSession({
            user: newUser,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        });

        // Flag for onAfterBoot to create home dir (fs service not available yet)
        (this as any)._pendingHomeSetup = newUser;

        return true;
    },

    async onAfterBoot(context) {
        // Create home dir for newly created user (deferred from onSetup
        // because the files module hasn't booted yet at that point)
        const pendingUser = (this as any)._pendingHomeSetup as ICliUser | undefined;
        if (pendingUser) {
            delete (this as any)._pendingHomeSetup;
            try {
                const fs = context.services.get<any>('cli-file-system-service');
                if (fs && pendingUser.homeDir) {
                    if (!fs.exists(pendingUser.homeDir)) {
                        fs.createDirectory(pendingUser.homeDir, true);
                    }
                    fs.setHomePath(pendingUser.homeDir);
                    fs.setCurrentDirectory(pendingUser.homeDir);
                    fs.setCurrentUser(pendingUser.id, pendingUser.groups);
                    await fs.persist();
                }
            } catch {
                // Files module not installed — skip
            }
            context.writer.write('\x1b[2J\x1b[H');
            context.writer.writeSuccess(`User "${pendingUser.name}" created and logged in.`);
            context.showPrompt();
        }

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
