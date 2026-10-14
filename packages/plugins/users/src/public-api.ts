/*
 * Public API Surface of users
 */

export * from './lib/processors';
export * from './lib/services';
export * from './lib/models/users-module-config';

import {
    ICliModule,
    ICliConfigurableModule,
    ICliKeyValueStore,
    ICliUsersStoreService,
    ICliGroupsStoreService,
    ICliAuthService,
    ICliUser,
    ICliUserSessionService,
    ICliUserEventService,
    ICliAuditService,
    ICliExecutionContext,
    ICliServerAuthTokenProvider,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliGroupsStoreService_TOKEN,
    ICliAuthService_TOKEN,
    ICliPermissionService_TOKEN,
    ICliUserEventService_TOKEN,
    ICliAuditService_TOKEN,
} from '@qodalis/cli-core';
import {
    ICliServerAuthTokenProvider_TOKEN,
} from '@qodalis/cli-core';
import { CliKeyValueStore_TOKEN } from '@qodalis/cli';

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
import { CliLastCommandProcessor } from './lib/processors/cli-last-command-processor';

import { CliDefaultUsersStoreService } from './lib/services/cli-default-users-store.service';
import { CliDefaultUserSessionService } from './lib/services/cli-default-user-session.service';
import { CliDefaultGroupsStoreService } from './lib/services/cli-default-groups-store.service';
import { CliDefaultAuthService } from './lib/services/cli-default-auth.service';
import { CliDefaultPermissionService } from './lib/services/cli-default-permission.service';
import { CliDefaultUserEventService } from './lib/services/cli-default-user-event.service';
import { CliDefaultAuditService } from './lib/services/cli-default-audit.service';
import { CliServerUsersStoreService } from './lib/services/cli-server-users-store.service';
import { CliServerUserSessionService } from './lib/services/cli-server-user-session.service';
import { CliServerGroupsStoreService } from './lib/services/cli-server-groups-store.service';
import { CliServerAuthService } from './lib/services/cli-server-auth.service';
import { CliServerAuditService } from './lib/services/cli-server-audit.service';
import { withUnauthorizedHandler } from './lib/utils/server-http';
import { CliSessionsCommandProcessor } from './lib/processors/cli-sessions-command-processor';
import { CliSessionKickCommandProcessor } from './lib/processors/cli-session-kick-command-processor';
import {
    CliUsersModuleConfig,
    CliUsersModuleConfig_TOKEN,
} from './lib/models/users-module-config';
import { firstValueFrom } from 'rxjs';

import { LIBRARY_VERSION, API_VERSION } from './lib/version';

interface ICliUsersModule extends ICliConfigurableModule<CliUsersModuleConfig> {
    /** Temporary storage for user created during onSetup, consumed by onAfterBoot */
    _pendingHomeSetup?: ICliUser;
    /** Session timeout interval handle, cleaned up in onDestroy */
    _sessionTimeoutInterval?: ReturnType<typeof setInterval>;
    /** Unsubscribes from server-push session events (server mode), cleaned up in onDestroy */
    _serverEventsUnsubscribe?: () => void;
    /** Initializes server-backed services when moduleConfig.server is set */
    _initServerMode(
        context: ICliExecutionContext,
        moduleConfig: CliUsersModuleConfig,
        kvStore: ICliKeyValueStore,
    ): Promise<void>;
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
        new CliLastCommandProcessor(),
    ],
    services: [
        {
            provide: ICliUsersStoreService_TOKEN,
            useClass: CliDefaultUsersStoreService,
        },
        {
            provide: ICliGroupsStoreService_TOKEN,
            useClass: CliDefaultGroupsStoreService,
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
        const kvStore = context.services.getRequired<ICliKeyValueStore>(
            CliKeyValueStore_TOKEN,
        );

        // Register module config and permission service
        context.services.set([
            { provide: CliUsersModuleConfig_TOKEN, useValue: moduleConfig },
            { provide: ICliPermissionService_TOKEN, useClass: CliDefaultPermissionService },
        ]);

        if (moduleConfig.server) {
            await this._initServerMode(context, moduleConfig, kvStore);
            return;
        }

        // Initialize user event service
        const eventService = new CliDefaultUserEventService();
        context.services.set([
            { provide: ICliUserEventService_TOKEN, useValue: eventService },
        ]);

        // Initialize audit service and subscribe to events
        const auditService = new CliDefaultAuditService();
        await auditService.initialize(kvStore);
        context.services.set([
            { provide: ICliAuditService_TOKEN, useValue: auditService },
        ]);

        // Auto-log all user events to audit
        eventService.events$.subscribe((event) => {
            auditService.log({
                event: event.type,
                username: event.user.name,
                details: event.details,
            });
        });

        // Initialize users store
        const usersStore = context.services.getRequired<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        await (usersStore as CliDefaultUsersStoreService).initialize(kvStore);

        // Initialize groups store (depends on users store)
        const groupsStore = context.services.getRequired<ICliGroupsStoreService>(
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

        // Initialize auth service (depends on users store, session service, events, and config)
        const authService = new CliDefaultAuthService();
        await authService.initialize(kvStore, usersStore, sessionService, eventService, moduleConfig);
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

            // Check session timeout on restore
            if (restoredSession && moduleConfig.sessionTimeout && moduleConfig.sessionTimeout > 0) {
                if (sessionService.isExpired(moduleConfig.sessionTimeout)) {
                    await sessionService.clearSession();
                    context.writer?.writeWarning?.('Session expired. Please log in again.');
                }
            }

            const currentSession = await firstValueFrom(sessionService.getUserSession());
            if (!currentSession) {
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

        // Session timeout enforcement interval
        if (moduleConfig.sessionTimeout && moduleConfig.sessionTimeout > 0) {
            this._sessionTimeoutInterval = setInterval(() => {
                if (sessionService.isExpired(moduleConfig.sessionTimeout!)) {
                    const session = context.userSession;
                    if (session?.user) {
                        eventService.emit({
                            type: 'logout',
                            user: session.user,
                            timestamp: Date.now(),
                            details: 'Session expired',
                        });
                    }
                    sessionService.clearSession();
                    // Fall back to admin
                    firstValueFrom(usersStore.getUsers()).then((users) => {
                        const admin = users.find(u => u.groups.includes('admin'));
                        if (admin) {
                            sessionService.setUserSession({
                                user: admin,
                                loginTime: Date.now(),
                                lastActivity: Date.now(),
                            });
                        }
                    });
                }
            }, 60_000); // Check every 60 seconds
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
                    const fs = context.services.getRequired<any>(
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
        const moduleConfig = (this.config || {}) as CliUsersModuleConfig;
        if (moduleConfig.server) {
            return true; // Skip setup wizard in server mode
        }

        const usersStore = context.services.getRequired<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        const authService = context.services.getRequired<ICliAuthService>(
            ICliAuthService_TOKEN,
        );
        const sessionService = context.services.getRequired<ICliUserSessionService>(
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
            const fs = context.services.getRequired<any>('cli-file-system-service');
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

            // Validate password policy
            if (authService.validatePassword) {
                const policyError = authService.validatePassword(password);
                if (policyError) {
                    context.writer.writeError(policyError);
                    continue;
                }
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

        // Emit user_created event
        const eventService = context.services.get<ICliUserEventService>(
            ICliUserEventService_TOKEN,
        );
        eventService?.emit({
            type: 'user_created',
            user: newUser,
            timestamp: Date.now(),
            details: 'Created during initial setup',
        });

        // Flag for onAfterBoot to create home dir (fs service not available yet)
        this._pendingHomeSetup = newUser;

        return true;
    },

    async onAfterBoot(context) {
        // Create home dir for newly created user (deferred from onSetup
        // because the files module hasn't booted yet at that point)
        const pendingUser = this._pendingHomeSetup as ICliUser | undefined;
        if (pendingUser) {
            delete this._pendingHomeSetup;
            try {
                const fs = context.services.getRequired<any>('cli-file-system-service');
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

        const sessionService = context.services.getRequired<ICliUserSessionService>(
            ICliUserSessionService_TOKEN,
        );
        const usersStore = context.services.getRequired<ICliUsersStoreService>(
            ICliUsersStoreService_TOKEN,
        );
        const authService = context.services.getRequired<ICliAuthService>(
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

    async _initServerMode(context, moduleConfig, kvStore) {
        const serverName = moduleConfig.server!;
        const serverConfig = context.options?.servers?.find(
            (s: any) => s.name === serverName,
        );
        if (!serverConfig) {
            throw new Error(
                `@qodalis/cli-users: server "${serverName}" not found in options.servers`,
            );
        }

        const baseUrl = serverConfig.url.replace(/\/+$/, '') + '/api/v1/qcli';

        // Token holder — shared between auth service and token provider
        let currentToken: string | undefined;
        const onTokenChange = (token: string | undefined) => {
            currentToken = token;
        };
        const getHeaders = (): Record<string, string> =>
            currentToken ? { Authorization: `Bearer ${currentToken}` } : {};

        // Register auth token provider so other plugins/server requests
        // automatically include the token for this server
        const tokenProvider: ICliServerAuthTokenProvider = {
            getHeaders(name: string): Record<string, string> {
                if (name === serverName && currentToken) {
                    return { Authorization: `Bearer ${currentToken}` };
                }
                return {};
            },
        };
        context.services.set({
            provide: ICliServerAuthTokenProvider_TOKEN,
            useValue: tokenProvider,
            multi: true,
        });

        // Initialize user event service (shared between modes)
        const eventService = new CliDefaultUserEventService();
        context.services.set([
            { provide: ICliUserEventService_TOKEN, useValue: eventService },
        ]);

        // Drops the local session when the server reports the token as
        // expired/revoked (401) or when an admin kicks this session.
        // Bound after the session service exists; see below.
        let terminateSession: (reason: string) => Promise<void> = async () => {};

        // Any 401 from the server (except credential checks) means the
        // stored token is no longer valid.
        const http = withUnauthorizedHandler(context.http, {
            onUnauthorized: () => terminateSession('Session expired or revoked by the server'),
            ignore: (url) => url.endsWith('/auth/login') || url.endsWith('/auth/verify'),
        });

        // Create server-backed session service
        const sessionService = new CliServerUserSessionService(baseUrl, http, kvStore);
        context.services.set([
            { provide: ICliUserSessionService_TOKEN, useValue: sessionService },
        ]);

        // Create server-backed auth service
        const authService = new CliServerAuthService(
            baseUrl, http, kvStore, sessionService, onTokenChange, eventService,
        );
        await authService.initialize();
        context.services.set([
            { provide: ICliAuthService_TOKEN, useValue: authService },
        ]);

        // Audit log lives on the server in this mode
        const auditService = new CliServerAuditService(baseUrl, http, getHeaders);
        context.services.set([
            { provide: ICliAuditService_TOKEN, useValue: auditService },
        ]);

        // Create server-backed users store
        const usersStore = new CliServerUsersStoreService(baseUrl, http, getHeaders);
        context.services.set([
            { provide: ICliUsersStoreService_TOKEN, useValue: usersStore },
        ]);

        // Create server-backed groups store
        const groupsStore = new CliServerGroupsStoreService(baseUrl, http, getHeaders);
        context.services.set([
            { provide: ICliGroupsStoreService_TOKEN, useValue: groupsStore },
        ]);

        // Add server-mode processors
        this.processors = [
            ...(this.processors || []),
            new CliSessionsCommandProcessor(baseUrl, getHeaders),
            new CliSessionKickCommandProcessor(baseUrl, getHeaders),
        ];

        terminateSession = async (reason: string) => {
            if (!currentToken) {
                return; // nothing to drop
            }
            const session = await firstValueFrom(sessionService.getUserSession());
            await authService.forgetToken();
            await sessionService.clearSession();
            if (session?.user) {
                eventService.emit({
                    type: 'logout',
                    user: session.user,
                    timestamp: Date.now(),
                    details: reason,
                });
            }
            context.writer?.writeWarning?.(`${reason}. Please log in again.`);
        };

        // Auto-logout when an admin kicks this session (server broadcasts
        // `session-kicked` over the events WebSocket, relayed by the
        // server connection as a background service event).
        this._serverEventsUnsubscribe = context.backgroundServices?.on(
            (event) => {
                const payload = (event.data as { data?: { sessionId?: string } } | undefined)?.data;
                const kickedId = payload?.sessionId;
                if (kickedId && kickedId === sessionService.getSessionId()) {
                    void terminateSession('Session terminated by an administrator');
                }
            },
            { source: `server-events:${serverName}`, type: 'session-kicked' },
        );

        // Try to restore an existing session from stored token
        await sessionService.restoreSession();

        // Resolve display name formatter (default: user.name)
        const formatDisplayName =
            moduleConfig.userDisplayFormatter ??
            ((user: ICliUser) => user.name);

        // Subscribe session changes to execution context
        let previousUserId: string | null = null;
        sessionService.getUserSession().subscribe((session) => {
            if (!session) {
                context.userSession = undefined;
                previousUserId = null;
                return;
            }

            context.userSession = {
                ...session,
                displayName: formatDisplayName(session.user),
            };

            // Sync filesystem with current user
            try {
                const fs = context.services.getRequired<any>(
                    'cli-file-system-service',
                );
                if (fs) {
                    if (session.user.homeDir) {
                        if (!fs.exists(session.user.homeDir)) {
                            fs.createDirectory(session.user.homeDir, true);
                        }
                        fs.setHomePath(session.user.homeDir);
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
        });
    },

    async onDestroy() {
        // Clean up session timeout interval
        if (this._sessionTimeoutInterval) {
            clearInterval(this._sessionTimeoutInterval);
            delete this._sessionTimeoutInterval;
        }
        // Stop listening for server session events
        if (this._serverEventsUnsubscribe) {
            this._serverEventsUnsubscribe();
            delete this._serverEventsUnsubscribe;
        }
    },
};
