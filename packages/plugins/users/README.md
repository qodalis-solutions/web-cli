# @qodalis/cli-users

Users, groups (roles), permissions, sessions and audit for the Qodalis CLI.

The module turns the CLI into an **authenticated, interactive front end for a system**:
people sign in, the system decides what they may do, and every command, guard and
extension follows those rules. It is optional: without it the CLI works unchanged.

## How it fits a system

| Mode | Where users live | Authority | Typical use |
|---|---|---|---|
| **Server** (`server: 'node'`) | A Qodalis CLI server users plugin (node, python, .NET), backed by in-memory stores or your own stores / auth adapter | The server | Production: the CLI is a console for your backend |
| **Embedded** (`server` + `hostAuth`) | Your application; the CLI reuses its token | The server | CLI inside an app whose users are already signed in |
| **Custom backend** (`backend`) | Your own API, through `ICliUsersBackend` | Your API | Integrate a system without a CLI server |
| **Local** (default) | The browser (IndexedDB) | The browser | Standalone, offline, demos |

All modes expose the **same commands, services and behaviour**. They share one contract
(`ICliUsersBackend`, mirrored by the servers' HTTP API), so a feature works everywhere.

## Installation

```bash
packages add @qodalis/cli-users
```

## Quick start

```typescript
import { usersModule } from '@qodalis/cli-users';

// Server mode: `node` must match an entry in options.servers
engine.registerModules([usersModule.configure({ server: 'node' })]);

// Local mode
engine.registerModules([usersModule.configure({ requirePassword: true })]);
```

## Roles and permissions

Groups are roles. Each group grants a list of permissions; a user's effective
permissions are the union of their groups' permissions.

- Permission strings are `resource:action`, with `*` wildcards: `users:*`, `*`.
- Built-in groups: `admin` (`*`, cannot be changed or deleted) and `users` (default for new accounts, grants `commands:execute` so members can run server commands).
- Built-in permissions: `users:read|create|update|delete`, `groups:read|create|update|delete`,
  `sessions:read|revoke`, `audit:read|clear`.
- Any module can declare its own (`ICliModule.permissions`) and protect commands with them.

```bash
groupadd release --permissions=deploy:run
groupmod release --grant=deploy:rollback
groupmod release --add-member=alice
perms alice          # effective permissions and the groups granting them
perms --list         # every permission declared by loaded modules
```

### Protecting your commands

```typescript
const deploy: ICliCommandProcessor = {
    command: 'deploy',
    metadata: {
        requireAuth: true,                   // signed in
        requiredGroups: ['ops', 'release'],  // member of any
        requiredPermissions: ['deploy:run'], // holds all
    },
    async processCommand(command, context) { /* ... */ },
};

export const deployModule: ICliModule = {
    apiVersion: 2,
    name: 'deploy',
    processors: [deploy],
    permissions: [{ name: 'deploy:run', description: 'Run deployments' }],
};
```

The checks are enforced by core guards that activate when an authorization service is
registered (this module registers one). In code, use the generic helpers from
`@qodalis/cli-core`; they allow everything when no auth module is loaded:

```typescript
import { cliAuthorize, cliCanAccess } from '@qodalis/cli-core';

if (!cliAuthorize(context, 'deploy:rollback')) { /* hide the option */ }
```

The files module uses the same layer for rwx checks on the virtual file system
(`files:admin` bypasses, `files:chown` allows chmod/chown on others' files).

## Commands

| Command | Access | Description |
|---|---|---|
| `whoami [--info]` | — | Signed-in user; `--info` adds groups and permissions |
| `id [user]` | login | Identity, groups, permissions |
| `groups [user] [--all]` | login | Membership; `--all` lists groups with permissions |
| `perms [user] [--list]` | login | Effective permissions / declared permissions |
| `login [user]` | — | Sign in (name or email) |
| `logout` | login | Sign out (the CLI stays signed out) |
| `su <user>` | — | Switch user (same lockout and audit as login) |
| `passwd [user]` | login | Own password (asks for the current one) or reset (`users:update`) |
| `adduser <name> --email=..` | `users:create` | Create a user (`--groups`, `--home`, `--disabled`, `--no-password`) |
| `usermod <user> ..` | `users:update` | `--name`, `--email`, `--groups`, `--add-groups`, `--remove-groups`, `--home`, `--disable`, `--enable` |
| `userdel <user>` | `users:delete` | Delete a user, their password and sessions |
| `listusers [--query --skip --take]` | `users:read` | List users |
| `groupadd <name> [--permissions]` | `groups:create` | Create a group (role) |
| `groupmod <group> ..` | `groups:update` | `--grant`, `--revoke`, `--set`, `--description`, `--add-member`, `--remove-member` |
| `groupdel <name>` | `groups:delete` | Delete a group (members are removed from it) |
| `w` | login | Who is signed in |
| `sessions` | `sessions:read` | Active sessions |
| `session-kick <id>` | login | End a session (own, or any with `sessions:revoke`) |
| `last [user]` | `audit:read` | Sign-in history |
| `audit [--user --event -n]`, `audit clear` | `audit:read` / `audit:clear` | Security audit log |

## Rules (identical in every mode)

- Names and emails are unique (case-insensitive); groups must exist.
- You cannot delete or disable yourself; the last enabled administrator cannot be
  deleted, disabled or removed from `admin`; built-in groups cannot be deleted.
- Deleting a group removes it from its members; deleting a user removes their
  password and sessions; disabling a user ends their sessions; a password change ends
  the user's other sessions.
- Changes to a user's groups apply to their live sessions immediately.
- Lockout after 5 failed sign-ins (5 minutes), by name or email.
- Passwords: PBKDF2-HMAC-SHA256 (100k iterations), constant-time comparison.
- Every security-relevant action is audited with the acting user.

## Configuration

```typescript
usersModule.configure({
    // where users live (pick one; default: local)
    server: 'node',
    backend: myBackend,
    hostAuth: { getToken, loginHint, logout },

    persistToken: true,            // keep the session across reloads (false = memory only)
    requirePassword: true,         // local: false allows passwordless login/su
    requirePasswordOnBoot: false,  // ask for credentials at startup
    sessionTimeout: 30 * 60_000,   // local idle timeout (servers have their own)
    passwordPolicy: { minLength: 8, requireDigit: true },
    bruteForceProtection: { maxAttempts: 5, lockoutSeconds: 300 }, // local
    seedUsers: [{ name: 'ops', email: 'ops@example.com', groups: ['admin'] }], // local
    defaultPassword: 'change-me',  // local seed password
    hideUserName: false,
    userDisplayFormatter: (user) => user.name,
});
```

## Services for extensions

| Token | Interface |
|---|---|
| `ICliUsersStoreService_TOKEN` | users |
| `ICliGroupsStoreService_TOKEN` | groups / roles and membership |
| `ICliAuthService_TOKEN` | login, logout, switch user, passwords |
| `ICliUserSessionService_TOKEN` | current session (observable) |
| `ICliSessionsService_TOKEN` | list / revoke sessions |
| `ICliAuditService_TOKEN` | audit trail |
| `ICliUserEventService_TOKEN` | `login`, `logout`, `user_*`, `group_*`, `session_revoked`, ... |
| `ICliAuthorizationService_TOKEN` | principal, `can`, `canAccess` (generic, core) |

Calls run as the signed-in user; the backend enforces permissions and rejects with
`CliUsersError` (`status` 400/401/403/404/409/429/501).

## Security notes

- In server, embedded and custom-backend modes the backend is the security boundary;
  client-side guards only improve the experience.
- Local mode stores everything in the browser: it models access between CLI users but
  cannot protect data from whoever controls the browser.
- Use `persistToken: false` on shared machines.
- Change default passwords (`root` / `root` locally and on servers) before exposing a system.

## Examples

- `examples/vanilla/16-users-and-permissions.ts` — roles, permissions, protected commands
- `examples/vanilla/19-custom-users-permissions.ts` — integrate your own system (custom backend)
- `examples/vanilla/20-user-group-management.ts` — use the services from your own commands
- `examples/vanilla/21-server-session-management.ts` — server mode and embedded `hostAuth`
- `examples/vanilla/22-command-guards.ts` — global guards
