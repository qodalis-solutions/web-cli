/**
 * Example 19 — Custom Users & Permissions Services (Vanilla JS)
 *
 * Demonstrates how to replace the default user/permission services with
 * custom implementations. Use this pattern to integrate with your own
 * authentication backend, LDAP, OAuth providers, or role-based access
 * control systems.
 *
 * Features:
 *   - Custom ICliAuthService (e.g., API-backed login)
 *   - Custom ICliPermissionService (role-based access control)
 *   - Custom ICliUsersStoreService (external user directory)
 *   - Overriding default services via module DI
 *   - Permission-guarded commands
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
    ICliAuthService,
    ICliUser,
    ICliUserSession,
    ICliOwnership,
} from '@qodalis/cli-core';
import {
    ICliPermissionService_TOKEN,
    ICliAuthService_TOKEN,
} from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';

// ── 1. Custom Permission Service (Role-Based Access Control) ─────
//
// Instead of Linux-style rwx permissions, implement role-based checks.
// Each command declares which roles can access it.

interface RolePermission {
    command: string;
    allowedRoles: string[];
}

class RoleBasedPermissionService implements ICliPermissionService {
    // Define which roles can access which commands
    private rolePermissions: RolePermission[] = [
        { command: 'deploy', allowedRoles: ['admin', 'devops'] },
        { command: 'db-migrate', allowedRoles: ['admin', 'dba'] },
        { command: 'logs', allowedRoles: ['admin', 'devops', 'developer'] },
        { command: 'config', allowedRoles: ['admin'] },
    ];

    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean {
        // Admins always have access
        if (user.groups.includes('admin')) return true;

        // Look up role-based permission for the resource
        // The ownership.gid field carries the command name in our scheme
        const rule = this.rolePermissions.find(
            (r) => r.command === ownership.gid,
        );

        if (!rule) {
            // No rule defined — fall back to standard rwx check
            return this.checkRwx(user, action, ownership, permissions);
        }

        // Check if user belongs to any allowed role
        return rule.allowedRoles.some((role) => user.groups.includes(role));
    }

    // Standard rwx fallback for resources without role rules
    private checkRwx(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean {
        let offset: number;
        if (user.id === ownership.uid) {
            offset = 0;
        } else if (user.groups.includes(ownership.gid)) {
            offset = 3;
        } else {
            offset = 6;
        }

        const charIndex =
            action === 'read' ? offset :
            action === 'write' ? offset + 1 :
            offset + 2;

        return permissions.charAt(charIndex) !== '-';
    }

    parseOctal(octal: string): string {
        if (!/^[0-7]{3}$/.test(octal)) {
            throw new Error(`Invalid octal mode: ${octal}`);
        }
        const digitToRwx = (d: number) =>
            ((d & 4) ? 'r' : '-') +
            ((d & 2) ? 'w' : '-') +
            ((d & 1) ? 'x' : '-');
        return (
            digitToRwx(parseInt(octal[0], 10)) +
            digitToRwx(parseInt(octal[1], 10)) +
            digitToRwx(parseInt(octal[2], 10))
        );
    }

    toOctal(permissions: string): string {
        if (permissions.length !== 9) {
            throw new Error(`Invalid permission string: ${permissions}`);
        }
        const rwxToDigit = (rwx: string) => {
            let val = 0;
            if (rwx[0] === 'r') val += 4;
            if (rwx[1] === 'w') val += 2;
            if (rwx[2] === 'x') val += 1;
            return val;
        };
        return (
            String(rwxToDigit(permissions.substring(0, 3))) +
            String(rwxToDigit(permissions.substring(3, 6))) +
            String(rwxToDigit(permissions.substring(6, 9)))
        );
    }
}

// ── 2. Custom Auth Service (API-Backed) ──────────────────────────
//
// Replace the default IndexedDB-based auth with API calls to your
// backend. This example shows the pattern — replace fetch URLs with
// your actual auth endpoints.

class ApiAuthService implements ICliAuthService {
    private apiBase = '/api/auth';

    async login(username: string, password: string): Promise<ICliUserSession> {
        // In a real app, call your authentication API
        const response = await fetch(`${this.apiBase}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Authentication failed');
        }

        const data = await response.json();

        // Map your API response to ICliUserSession
        return {
            user: {
                id: data.userId,
                name: data.username,
                email: data.email,
                groups: data.roles, // Map API roles to CLI groups
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            loginTime: Date.now(),
            lastActivity: Date.now(),
            // Store tokens in session data for later use
            data: {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            },
        };
    }

    async logout(): Promise<void> {
        await fetch(`${this.apiBase}/logout`, { method: 'POST' });
    }

    async setPassword(userId: string, password: string): Promise<void> {
        await fetch(`${this.apiBase}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password }),
        });
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const response = await fetch(`${this.apiBase}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, password }),
        });
        const data = await response.json();
        return data.valid;
    }

    async hashPassword(password: string, salt: string): Promise<string> {
        // Use Web Crypto for consistent hashing
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

// ── 3. Permission-guarded commands ───────────────────────────────
//
// Commands that check the custom permission service before executing.

const deployProcessor: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Deploy application (requires admin or devops role)',
    valueRequired: true,

    async processCommand(command, context: ICliExecutionContext) {
        const permService = context.services.get<ICliPermissionService>(
            ICliPermissionService_TOKEN,
        );
        const session = context.userSession;

        if (!session?.user) {
            context.writer.writeError('You must be logged in. Run: login');
            return;
        }

        // Check role-based permission using our custom service
        const ownership: ICliOwnership = { uid: 'system', gid: 'deploy' };
        const canExecute = permService?.check(
            session.user, 'execute', ownership, 'rwxr-xr-x',
        );

        if (!canExecute) {
            context.writer.writeError(
                `Access denied. User "${session.user.name}" ` +
                `needs admin or devops role.`,
            );
            context.writer.writeInfo(
                `Your roles: ${session.user.groups.join(', ') || '(none)'}`,
            );
            return;
        }

        context.writer.writeSuccess(`Deploying to: ${command.value}`);
    },
};

const dbMigrateProcessor: ICliCommandProcessor = {
    command: 'db-migrate',
    description: 'Run database migrations (requires admin or dba role)',

    async processCommand(_command, context: ICliExecutionContext) {
        const permService = context.services.get<ICliPermissionService>(
            ICliPermissionService_TOKEN,
        );
        const session = context.userSession;

        if (!session?.user) {
            context.writer.writeError('You must be logged in. Run: login');
            return;
        }

        const ownership: ICliOwnership = { uid: 'system', gid: 'db-migrate' };
        const canExecute = permService?.check(
            session.user, 'execute', ownership, 'rwxr-xr-x',
        );

        if (!canExecute) {
            context.writer.writeError(
                `Access denied. User "${session.user.name}" ` +
                `needs admin or dba role.`,
            );
            return;
        }

        context.writer.writeSuccess('Running database migrations...');
    },
};

// ── 4. Command to inspect current user roles ─────────────────────

const rolesProcessor: ICliCommandProcessor = {
    command: 'my-roles',
    description: 'Show current user roles and access levels',

    async processCommand(_command, context: ICliExecutionContext) {
        const session = context.userSession;

        if (!session?.user) {
            context.writer.writeWarning('Not logged in.');
            return;
        }

        const permService = context.services.get<ICliPermissionService>(
            ICliPermissionService_TOKEN,
        );

        context.writer.writeln(`User: ${session.user.name}`);
        context.writer.writeln(`Groups: ${session.user.groups.join(', ') || '(none)'}`);
        context.writer.writeln('');

        // Check access to various commands using our role-based service
        const commands = ['deploy', 'db-migrate', 'logs', 'config'];
        const results: Record<string, string> = {};

        for (const cmd of commands) {
            const ownership: ICliOwnership = { uid: 'system', gid: cmd };
            const allowed = permService?.check(
                session.user, 'execute', ownership, 'rwxr-xr-x',
            );
            results[cmd] = allowed ? 'allowed' : 'denied';
        }

        context.writer.writeKeyValue(results);
    },
};

// ── 5. Register custom services via module ───────────────────────
//
// Override default services by registering your implementations
// with the same DI tokens. Services registered later take precedence.

// First, configure the users module with seed users
const configuredUsersModule = usersModule.configure({
    requirePassword: true,
    defaultPassword: 'demo',
    seedUsers: [
        { name: 'admin', email: 'admin@example.com', groups: ['admin'] },
        { name: 'dev', email: 'dev@example.com', groups: ['developer'] },
        { name: 'ops', email: 'ops@example.com', groups: ['devops'] },
        { name: 'dba', email: 'dba@example.com', groups: ['dba'] },
    ],
});

// Module that overrides default services with custom implementations
const customServicesModule: ICliModule = {
    apiVersion: 2,
    name: 'custom-services',
    description: 'Custom permission and auth services',
    // Higher priority = initialized after users module, so overrides take effect
    priority: 100,
    processors: [deployProcessor, dbMigrateProcessor, rolesProcessor],

    services: [
        // Override the default permission service with role-based RBAC
        {
            provide: ICliPermissionService_TOKEN,
            useValue: new RoleBasedPermissionService(),
        },

        // Override auth with API-backed service (uncomment to use):
        // {
        //     provide: ICliAuthService_TOKEN,
        //     useValue: new ApiAuthService(),
        // },
    ],
};

// ── Bootstrap ────────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

// Register users module first, then custom overrides
engine.registerModules([configuredUsersModule, customServicesModule]);

engine.start().then(() => {
    engine.focus();
    // Try these commands:
    //   login             — log in (password: "demo" for all users)
    //   my-roles          — see your roles and access levels
    //   deploy staging    — deploy (admin/devops only)
    //   db-migrate        — run migrations (admin/dba only)
    //   logout            — switch to a different user
});

window.addEventListener('beforeunload', () => engine.destroy());
