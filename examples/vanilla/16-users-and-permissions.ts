/**
 * Example 16 — Users, Roles & Permissions (Vanilla JS, local mode)
 *
 * The users module adds authentication, groups (roles) with permissions,
 * sessions and an audit log. In local mode everything lives in the browser
 * (IndexedDB) — useful standalone, offline, or for demos. Server mode
 * (example 21) uses the same commands against a real system.
 *
 * Shows:
 *   - seeding users, password policy, idle session timeout
 *   - processors protected with `requiredPermissions` (any module can do this)
 *   - declaring the permissions a module uses (`permissions`) so they show in `perms --list`
 *   - checking permissions in code with `cliAuthorize` (works without the users module too)
 *
 * Try:
 *   whoami --info                           root has '*' through the admin group
 *   groupadd release --permissions=deploy:run
 *   adduser alice --email=alice@example.com --groups=release
 *   su alice                                (password prompt)
 *   deploy                                  allowed (deploy:run)
 *   rollback                                denied (needs deploy:rollback)
 *   su root ; groupmod release --grant=deploy:rollback ; su alice ; rollback
 *   perms --list ; audit
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import { cliAuthorize, ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';

const deploy: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Deploy the app (requires deploy:run)',
    metadata: { requiredPermissions: ['deploy:run'] },
    async processCommand(_command, context) {
        context.writer.writeSuccess(`Deployed by ${context.userSession?.user.name}`);
        // Finer-grained checks in code: true when allowed, or when no auth module is loaded
        if (cliAuthorize(context, 'deploy:rollback')) {
            context.writer.writeInfo('You may also roll back.');
        }
    },
};

const rollback: ICliCommandProcessor = {
    command: 'rollback',
    description: 'Roll back (requires deploy:rollback)',
    metadata: { requiredPermissions: ['deploy:rollback'] },
    async processCommand(_command, context) {
        context.writer.writeSuccess('Rolled back');
    },
};

const deployModule: ICliModule = {
    apiVersion: 2,
    name: 'deploy',
    processors: [deploy, rollback],
    permissions: [
        { name: 'deploy:run', description: 'Run deployments' },
        { name: 'deploy:rollback', description: 'Roll back deployments' },
    ],
};

const engine = new CliEngine(document.getElementById('terminal')!);
engine.registerModules([
    usersModule.configure({
        requirePassword: true,
        seedUsers: [{ name: 'root', email: 'root@localhost', groups: ['admin'] }],
        defaultPassword: 'root',
        passwordPolicy: { minLength: 6 },
        sessionTimeout: 30 * 60_000, // idle timeout
    }),
    deployModule,
]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
