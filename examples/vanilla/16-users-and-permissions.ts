/**
 * Example 16 — Users & Permissions (Vanilla JS)
 *
 * Demonstrates the @qodalis/cli-users plugin for user management,
 * authentication, sessions, and UNIX-like rwx permission checking.
 *
 * Features:
 *   - usersModule with seed users and password configuration
 *   - User session (context.userSession)
 *   - Built-in commands: login, logout, whoami, users, passwd
 *   - Permission checking via ICliPermissionService
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
    ICliPermissionService,
} from '@qodalis/cli-core';
import { ICliPermissionService_TOKEN } from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';

// ── Configure the users module ────────────────────────────────

// The users module is configurable — set password policy,
// session behavior, and seed initial users.
const configuredUsersModule = usersModule.configure({
    // Require password for login
    requirePassword: true,

    // Default password for all seeded users (default: 'root')
    defaultPassword: 'changeme',

    // Seed users created on first boot
    seedUsers: [
        {
            name: 'admin',
            email: 'admin@example.com',
            groups: ['admin'],
        },
        {
            name: 'viewer',
            email: 'viewer@example.com',
            groups: ['viewers'],
        },
    ],

    // Customize how usernames appear in the prompt
    userDisplayFormatter: (user) => user.name,
});

// ── Custom command that checks permissions ────────────────────

const secretsProcessor: ICliCommandProcessor = {
    command: 'secrets',
    description: 'View application secrets (admin only)',

    async processCommand(_command, context: ICliExecutionContext) {
        const session = context.userSession;

        // Check if user is logged in
        if (!session?.user) {
            context.writer.writeError('You must be logged in. Run: login');
            return;
        }

        // Check group membership (groups is string[])
        const isAdmin = session.user.groups?.includes('admin');

        if (!isAdmin) {
            context.writer.writeError(
                `Access denied. User "${session.user.name}" is not in the admin group.`,
            );
            return;
        }

        context.writer.writeSuccess('Secrets (admin access granted):');
        context.writer.writeKeyValue({
            'API Key': 'sk-live-abc123def456',
            'DB Password': 'super-secret-password',
            'JWT Secret': 'my-jwt-signing-key',
        });
    },
};

// ── Command using ICliPermissionService for rwx checks ────────

const filePermDemo: ICliCommandProcessor = {
    command: 'check-perms',
    description: 'Demonstrate UNIX-like permission checking',

    parameters: [
        {
            name: 'octal',
            description: 'Permission octal (e.g., "755")',
            required: false,
            type: 'string',
            defaultValue: '755',
        },
    ],

    async processCommand(command, context: ICliExecutionContext) {
        const permService = context.services.get<ICliPermissionService>(
            ICliPermissionService_TOKEN,
        );

        if (!permService) {
            context.writer.writeWarning(
                'Permission service not available. Ensure @qodalis/cli-users is loaded.',
            );
            return;
        }

        const octal = command.args['octal'] || '755';
        const permString = permService.parseOctal(octal);

        context.writer.writeln(`Octal ${octal} → "${permString}"`);
        context.writer.writeln(`Back to octal: ${permService.toOctal(permString)}`);
        context.writer.writeln('');

        // Simulate checking permissions for the current user
        const session = context.userSession;
        if (session?.user) {
            const ownership = {
                userId: 'owner-id',
                groupId: 'admin',
            };

            const canRead = permService.check(session.user, 'read', ownership, permString);
            const canWrite = permService.check(session.user, 'write', ownership, permString);
            const canExec = permService.check(session.user, 'execute', ownership, permString);

            context.writer.writeln(`Permissions for user "${session.user.name}":`);
            context.writer.writeKeyValue({
                Read: canRead ? '✓ allowed' : '✗ denied',
                Write: canWrite ? '✓ allowed' : '✗ denied',
                Execute: canExec ? '✓ allowed' : '✗ denied',
            });
        } else {
            context.writer.writeInfo('Log in to check user-specific permissions.');
        }
    },
};

// ── Module & Bootstrap ────────────────────────────────────────

const permissionsModule: ICliModule = {
    apiVersion: 2,
    name: 'permissions-demo',
    description: 'User and permission demos',
    processors: [secretsProcessor, filePermDemo],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

// Register both the users module AND our demo module
engine.registerModules([configuredUsersModule, permissionsModule]);

engine.start().then(() => {
    engine.focus();
    // After start, these built-in commands are available:
    //   login               — interactive login prompt
    //   logout              — end current session
    //   whoami              — show current user
    //   users list          — list all users
    //   users add           — create a user
    //   passwd              — change password
    //   groups list         — list all groups
});

window.addEventListener('beforeunload', () => engine.destroy());
