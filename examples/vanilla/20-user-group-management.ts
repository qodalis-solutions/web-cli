/**
 * Example 20 — Programmatic User & Group Management (Vanilla JS)
 *
 * Demonstrates using the user/group/session service APIs to build
 * custom admin commands that manage users, groups, and sessions
 * programmatically — beyond what the built-in commands provide.
 *
 * Features:
 *   - ICliUsersStoreService — CRUD operations (getUsers, createUser, updateUser, deleteUser)
 *   - ICliGroupsStoreService — group CRUD and membership queries
 *   - ICliUserSessionService — session Observable, programmatic login, persist/restore
 *   - ICliUserSession.data — custom metadata storage (tokens, preferences)
 *   - Advanced config: requirePasswordOnBoot, sessionTimeout, hideUserName
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
    ICliUsersStoreService,
    ICliGroupsStoreService,
    ICliUserSessionService,
    ICliAuthService,
} from '@qodalis/cli-core';
import {
    ICliUsersStoreService_TOKEN,
    ICliGroupsStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliAuthService_TOKEN,
} from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';
import { firstValueFrom } from 'rxjs';

// ── 1. Programmatic user CRUD ────────────────────────────────────

const userAdminProcessor: ICliCommandProcessor = {
    command: 'user-admin',
    description: 'Programmatic user management (list, create, update, disable)',

    processors: [
        // ── List users with filtering ────────────────────────
        {
            command: 'list',
            description: 'List users with optional search query',
            parameters: [
                { name: 'query', description: 'Search by name or email', required: false, type: 'string' },
                { name: 'skip', description: 'Skip N users', required: false, type: 'number' },
                { name: 'take', description: 'Limit results', required: false, type: 'number' },
            ],

            async processCommand(command, context: ICliExecutionContext) {
                const usersStore = context.services.get<ICliUsersStoreService>(
                    ICliUsersStoreService_TOKEN,
                );
                if (!usersStore) {
                    context.writer.writeError('Users store not available');
                    return;
                }

                const users = await firstValueFrom(
                    usersStore.getUsers({
                        query: command.args['query'] as string,
                        skip: Number(command.args['skip']) || 0,
                        take: Number(command.args['take']) || 50,
                    }),
                );

                if (users.length === 0) {
                    context.writer.writeInfo('No users found');
                    return;
                }

                context.writer.writeln(`Found ${users.length} user(s):`);
                context.writer.writeln('');

                for (const user of users) {
                    context.writer.writeKeyValue({
                        Name: user.name,
                        Email: user.email,
                        Groups: user.groups.join(', ') || '(none)',
                        Home: user.homeDir || '(none)',
                        Status: user.disabled ? 'disabled' : 'active',
                        Created: new Date(user.createdAt).toLocaleString(),
                    });
                    context.writer.writeln('');
                }
            },
        },

        // ── Create user programmatically ─────────────────────
        {
            command: 'create',
            description: 'Create a new user with groups',
            parameters: [
                { name: 'name', description: 'Username', required: true, type: 'string' },
                { name: 'email', description: 'Email address', required: true, type: 'string' },
                { name: 'groups', description: 'Comma-separated groups', required: false, type: 'string' },
            ],

            async processCommand(command, context: ICliExecutionContext) {
                const usersStore = context.services.get<ICliUsersStoreService>(
                    ICliUsersStoreService_TOKEN,
                );
                const authService = context.services.get<ICliAuthService>(
                    ICliAuthService_TOKEN,
                );

                if (!usersStore || !authService) {
                    context.writer.writeError('Services not available');
                    return;
                }

                const name = command.args['name'] as string;
                const email = command.args['email'] as string;
                const groups = command.args['groups']
                    ? (command.args['groups'] as string).split(',')
                    : [];

                try {
                    const user = await usersStore.createUser({
                        name,
                        email,
                        groups,
                    });

                    // Set a default password
                    await authService.setPassword(user.id, 'welcome123');

                    context.writer.writeSuccess(`User "${user.name}" created (id: ${user.id})`);
                    context.writer.writeInfo('Default password: welcome123');
                } catch (err: any) {
                    context.writer.writeError(`Failed: ${err.message}`);
                }
            },
        },

        // ── Update user ──────────────────────────────────────
        {
            command: 'update',
            description: 'Update user properties',
            parameters: [
                { name: 'user', description: 'Username to update', required: true, type: 'string' },
                { name: 'email', description: 'New email', required: false, type: 'string' },
                { name: 'add-groups', description: 'Groups to add (comma-separated)', required: false, type: 'string' },
                { name: 'disable', description: 'Disable the account', required: false, type: 'boolean' },
                { name: 'enable', description: 'Enable the account', required: false, type: 'boolean' },
            ],

            async processCommand(command, context: ICliExecutionContext) {
                const usersStore = context.services.get<ICliUsersStoreService>(
                    ICliUsersStoreService_TOKEN,
                );
                if (!usersStore) return;

                const username = command.args['user'] as string;

                // Look up user by name
                const user = await firstValueFrom(usersStore.getUser(username));
                if (!user) {
                    context.writer.writeError(`User "${username}" not found`);
                    return;
                }

                // Build update object (only include changed fields)
                const updates: Record<string, any> = {};

                if (command.args['email']) {
                    updates['email'] = command.args['email'];
                }
                if (command.args['add-groups']) {
                    const newGroups = (command.args['add-groups'] as string).split(',');
                    updates['groups'] = [...new Set([...user.groups, ...newGroups])];
                }
                if (command.args['disable']) {
                    updates['disabled'] = true;
                }
                if (command.args['enable']) {
                    updates['disabled'] = false;
                }

                const updated = await usersStore.updateUser(user.id, updates);
                context.writer.writeSuccess(`User "${updated.name}" updated`);
                context.writer.writeKeyValue({
                    Email: updated.email,
                    Groups: updated.groups.join(', ') || '(none)',
                    Status: updated.disabled ? 'disabled' : 'active',
                });
            },
        },

        // ── Delete user ──────────────────────────────────────
        {
            command: 'delete',
            description: 'Delete a user permanently',

            async processCommand(command, context: ICliExecutionContext) {
                const usersStore = context.services.get<ICliUsersStoreService>(
                    ICliUsersStoreService_TOKEN,
                );
                if (!usersStore) return;

                const username = command.value;
                if (!username) {
                    context.writer.writeError('Usage: user-admin delete <username>');
                    return;
                }

                const user = await firstValueFrom(usersStore.getUser(username));
                if (!user) {
                    context.writer.writeError(`User "${username}" not found`);
                    return;
                }

                const confirmed = await context.reader.readConfirm(
                    `Delete user "${user.name}" (${user.email})?`,
                );
                if (!confirmed) {
                    context.writer.writeWarning('Cancelled');
                    return;
                }

                await usersStore.deleteUser(user.id);
                context.writer.writeSuccess(`User "${user.name}" deleted`);
            },
        },
    ],
};

// ── 2. Programmatic group management ─────────────────────────────

const groupAdminProcessor: ICliCommandProcessor = {
    command: 'group-admin',
    description: 'Programmatic group management',

    processors: [
        // ── List all groups ──────────────────────────────────
        {
            command: 'list',
            description: 'List all groups and their members',

            async processCommand(_command, context: ICliExecutionContext) {
                const groupsStore = context.services.get<ICliGroupsStoreService>(
                    ICliGroupsStoreService_TOKEN,
                );
                if (!groupsStore) {
                    context.writer.writeError('Groups store not available');
                    return;
                }

                const groups = await firstValueFrom(groupsStore.getGroups());

                for (const group of groups) {
                    // Get members of each group
                    const members = await firstValueFrom(
                        groupsStore.getGroupMembers(group.id),
                    );

                    context.writer.writeKeyValue({
                        Group: group.name,
                        Description: group.description || '(none)',
                        Members: members.map((m) => m.name).join(', ') || '(empty)',
                        Created: new Date(group.createdAt).toLocaleString(),
                    });
                    context.writer.writeln('');
                }
            },
        },

        // ── Create group ─────────────────────────────────────
        {
            command: 'create',
            description: 'Create a new group',
            parameters: [
                { name: 'description', description: 'Group description', required: false, type: 'string' },
            ],

            async processCommand(command, context: ICliExecutionContext) {
                const groupsStore = context.services.get<ICliGroupsStoreService>(
                    ICliGroupsStoreService_TOKEN,
                );
                if (!groupsStore) return;

                const name = command.value;
                if (!name) {
                    context.writer.writeError('Usage: group-admin create <name>');
                    return;
                }

                const description = command.args['description'] as string;
                const group = await groupsStore.createGroup(name, description);
                context.writer.writeSuccess(`Group "${group.name}" created (id: ${group.id})`);
            },
        },

        // ── Delete group ─────────────────────────────────────
        {
            command: 'delete',
            description: 'Delete a group',

            async processCommand(command, context: ICliExecutionContext) {
                const groupsStore = context.services.get<ICliGroupsStoreService>(
                    ICliGroupsStoreService_TOKEN,
                );
                if (!groupsStore) return;

                const name = command.value;
                if (!name) {
                    context.writer.writeError('Usage: group-admin delete <name>');
                    return;
                }

                const group = await firstValueFrom(groupsStore.getGroup(name));
                if (!group) {
                    context.writer.writeError(`Group "${name}" not found`);
                    return;
                }

                await groupsStore.deleteGroup(group.id);
                context.writer.writeSuccess(`Group "${name}" deleted`);
            },
        },
    ],
};

// ── 3. Session management with custom data ───────────────────────

const sessionProcessor: ICliCommandProcessor = {
    command: 'session',
    description: 'Inspect and manage the active user session',

    processors: [
        // ── Show session info ────────────────────────────────
        {
            command: 'info',
            description: 'Show current session details including custom data',

            async processCommand(_command, context: ICliExecutionContext) {
                const sessionService = context.services.get<ICliUserSessionService>(
                    ICliUserSessionService_TOKEN,
                );
                if (!sessionService) {
                    context.writer.writeError('Session service not available');
                    return;
                }

                // Get current session from Observable
                const session = await firstValueFrom(
                    sessionService.getUserSession(),
                );

                if (!session) {
                    context.writer.writeWarning('No active session');
                    return;
                }

                context.writer.writeKeyValue({
                    User: session.user.name,
                    Email: session.user.email,
                    Groups: session.user.groups.join(', '),
                    'Login time': new Date(session.loginTime).toLocaleString(),
                    'Last activity': new Date(session.lastActivity).toLocaleString(),
                    'Display name': session.displayName || '(default)',
                    'Custom data': session.data
                        ? JSON.stringify(session.data, null, 2)
                        : '(none)',
                });
            },
        },

        // ── Store custom data in session ─────────────────────
        {
            command: 'set-data',
            description: 'Store custom key-value data in the session',
            parameters: [
                { name: 'key', description: 'Data key', required: true, type: 'string' },
                { name: 'value', description: 'Data value', required: true, type: 'string' },
            ],

            async processCommand(command, context: ICliExecutionContext) {
                const sessionService = context.services.get<ICliUserSessionService>(
                    ICliUserSessionService_TOKEN,
                );
                if (!sessionService) return;

                const session = await firstValueFrom(
                    sessionService.getUserSession(),
                );
                if (!session) {
                    context.writer.writeWarning('No active session');
                    return;
                }

                const key = command.args['key'] as string;
                const value = command.args['value'] as string;

                // Update session with custom data
                await sessionService.setUserSession({
                    ...session,
                    lastActivity: Date.now(),
                    data: {
                        ...session.data,
                        [key]: value,
                    },
                });

                // Persist to survive page reload
                await sessionService.persistSession();

                context.writer.writeSuccess(`Session data: ${key} = ${value}`);
            },
        },

        // ── Persist session manually ─────────────────────────
        {
            command: 'persist',
            description: 'Save the current session to storage',

            async processCommand(_command, context: ICliExecutionContext) {
                const sessionService = context.services.get<ICliUserSessionService>(
                    ICliUserSessionService_TOKEN,
                );
                if (!sessionService) return;

                await sessionService.persistSession();
                context.writer.writeSuccess('Session persisted to storage');
            },
        },

        // ── Watch session changes ────────────────────────────
        {
            command: 'watch',
            description: 'Subscribe to session changes (press Ctrl+C to stop)',

            async processCommand(_command, context: ICliExecutionContext) {
                const sessionService = context.services.get<ICliUserSessionService>(
                    ICliUserSessionService_TOKEN,
                );
                if (!sessionService) return;

                context.writer.writeInfo('Watching session changes... (Ctrl+C to stop)');

                const subscription = sessionService.getUserSession().subscribe(
                    (session) => {
                        if (session) {
                            context.writer.writeln(
                                `[session] user=${session.user.name} ` +
                                `activity=${new Date(session.lastActivity).toLocaleTimeString()}`,
                            );
                        } else {
                            context.writer.writeln('[session] No active session');
                        }
                    },
                );

                // Clean up when command is aborted
                context.process.onAbort(() => {
                    subscription.unsubscribe();
                    context.writer.writeln('');
                    context.writer.writeInfo('Stopped watching');
                });

                // Keep the command alive until aborted
                await new Promise<void>((resolve) => {
                    context.process.onAbort(() => resolve());
                });
            },
        },
    ],
};

// ── Module & Bootstrap ───────────────────────────────────────────

// Configure the users module with advanced options
const configuredUsersModule = usersModule.configure({
    // Require login on every page load (no auto-login as root)
    requirePasswordOnBoot: true,

    // Default password for seed users
    defaultPassword: 'demo',

    // Hide the username from the terminal prompt
    // hideUserName: true,

    // Auto-expire sessions after 30 minutes of inactivity
    // sessionTimeout: 30 * 60 * 1000,

    // Seed users with different group memberships
    seedUsers: [
        { name: 'admin', email: 'admin@example.com', groups: ['admin'] },
        { name: 'dev', email: 'dev@example.com', groups: ['developer'] },
        { name: 'viewer', email: 'viewer@example.com', groups: ['viewers'] },
    ],

    // Show email in prompt instead of username
    userDisplayFormatter: (user) => `${user.name}@cli`,
});

const managementModule: ICliModule = {
    apiVersion: 2,
    name: 'management-demo',
    description: 'User and group management demos',
    processors: [userAdminProcessor, groupAdminProcessor, sessionProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([configuredUsersModule, managementModule]);

engine.start().then(() => {
    engine.focus();

    // Try these commands after logging in (password: "demo"):
    //
    // ── User management ──
    //   user-admin list                          — list all users
    //   user-admin list --query=admin            — search users
    //   user-admin create --name=bob --email=bob@example.com --groups=developer
    //   user-admin update --user=bob --add-groups=devops
    //   user-admin update --user=bob --disable   — lock account
    //   user-admin delete bob                    — remove user
    //
    // ── Group management ──
    //   group-admin list                         — show groups + members
    //   group-admin create devops --description="DevOps team"
    //   group-admin delete devops
    //
    // ── Session management ──
    //   session info                             — show session details
    //   session set-data --key=theme --value=dark  — store custom data
    //   session persist                          — save to storage
    //   session watch                            — live session stream
    //
    // ── Built-in commands (from @qodalis/cli-users) ──
    //   login / logout / whoami / su / id / groups / who
    //   adduser / userdel / usermod / passwd
    //   groupadd / groupdel
});

window.addEventListener('beforeunload', () => engine.destroy());
