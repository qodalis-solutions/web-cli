# Cli extension

The `@qodalis/cli-users` package is a CLI extension that provides Linux-style user and group management with authentication for the Qodalis CLI. It includes a full user lifecycle, group management, session persistence via IndexedDB, and a permission model based on admin group membership.

# Features

    Full user lifecycle: adduser, userdel, usermod, listusers.
    Group management: groupadd, groupdel, groups.
    Authentication: login, logout, passwd with Web Crypto SHA-256 password hashing.
    Session management: persistent sessions via IndexedDB, su for user switching.
    Identity commands: whoami, id, w/who.
    Permission model: admin group for privileged operations.
    Configurable: seed users, default passwords, session timeout via configure().
    Extensible: swap any service (auth, users store, groups store, session) via DI tokens.

# Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `whoami` | `me` | Show current user |
| `id` | — | Show user identity and groups |
| `adduser` | `useradd` | Create a new user (admin) |
| `userdel` | `deluser` | Delete a user (admin) |
| `usermod` | — | Modify a user account (admin) |
| `passwd` | — | Change user password |
| `su` | `switch-user` | Switch user session |
| `login` | — | Log in with credentials |
| `logout` | `exit-session` | End current session |
| `groups` | — | Show group memberships |
| `groupadd` | `addgroup` | Create a group (admin) |
| `groupdel` | `delgroup` | Delete a group (admin) |
| `w` | `who` | Show session info |
| `listusers` | `users` | List all users |
| `last` | — | Show login/logout history from the audit log |
| `sessions` | — | List active sessions on the server (server mode, admin) |
| `session-kick` | — | Force-logout a session by id (server mode, admin) |

# Installation

```bash
packages add @qodalis/cli-users
```

This command downloads and registers the extension for use within the CLI environment.

# Usage

```bash
whoami
# root

whoami --info
# Displays detailed user info including email and groups

adduser john --email=john@example.com
# Created user john

passwd
# Change password for current user

su john
# Switch to user john

login
# Log in with username and password

logout
# End current session

groups
# Show groups for current user

groupadd devs --description="Development team"
# Created group devs

usermod john --add-groups=devs
# Added john to group devs

id john
# uid=john gid=devs groups=devs

w
# Show current session info
```

# Configuration

Use `configure()` to customize the module before loading:

```typescript
import { usersModule } from '@qodalis/cli-users';

usersModule.configure({
    seedUsers: [
        { name: 'admin', email: 'admin@company.com', groups: ['admin'] },
    ],
    defaultPassword: 'changeme',
    requirePassword: true,
    // Auto-logout after 30 minutes without activity (ms)
    sessionTimeout: 30 * 60 * 1000,
    passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigit: true,
        requireSpecialChar: false,
    },
    bruteForceProtection: {
        maxAttempts: 5,   // failed logins before lockout (default: 5)
        lockoutSeconds: 60,
    },
});
```

| Option | Description |
|--------|-------------|
| `seedUsers` | Users created on first boot (client mode) |
| `defaultPassword` | Password assigned to seeded users |
| `requirePassword` | Ask for a password on `login` / `su` |
| `sessionTimeout` | Idle timeout in ms; expired sessions are cleared and a `logout` event is emitted |
| `passwordPolicy` | Rules enforced by `passwd`, `adduser` and the setup wizard |
| `bruteForceProtection` | In-memory lockout after repeated failed logins |
| `userDisplayFormatter` | Customize the name shown in the prompt |
| `server` | Delegate everything to a CLI server — see **Server mode** |

# Server mode

Set `server` to the `name` of a `CliServerConfig` entry and the module stops using
the browser store. Users, authentication, sessions, groups and the audit log are
served by a Qodalis CLI server with the users plugin installed
([Node.js](https://github.com/qodalis-solutions/cli-server-node),
[.NET](https://github.com/qodalis-solutions/cli-server-dotnet),
[Python](https://github.com/qodalis-solutions/cli-server-python)).

```typescript
const engine = new CliEngine({
    options: {
        servers: [{ name: 'node', url: 'http://localhost:8047' }],
    },
});

engine.registerModule(
    usersModule.configure({ server: 'node', requirePassword: true }),
);
```

What changes in server mode:

- `login` calls `POST /api/v1/qcli/sessions`; the returned bearer token is stored
  locally and attached to every request to that server through
  `ICliServerAuthTokenProvider`, so proxied server commands run as the signed-in user.
- The session is restored on reload from `GET /api/v1/qcli/sessions/current`.
- No seed user or setup wizard — the server seeds its own admin (on the demo servers: `root` / `admin` for node and python, `root` / `root` for .NET).
- `last` reads the server audit log (`GET /api/v1/qcli/audit`).
- Two extra admin commands: `sessions` (list active sessions) and `session-kick <id>`.
- If the server answers `401` (token expired or revoked) or broadcasts a
  `session-kicked` event for this session, the module clears the local session,
  emits a `logout` event with the reason and prints a warning.

# Events and audit

`ICliUserEventService` (`cli-user-event-service`) emits `login`, `logout`, `login_failed`,
`user_created`, `user_deleted`, `user_updated` and `password_changed` events in both modes.
`ICliAuditService` (`cli-audit-service`) records them — in IndexedDB (client mode, last 500 entries)
or on the server (server mode).

```typescript
const events = context.services.get<ICliUserEventService>(ICliUserEventService_TOKEN);
events?.events$.subscribe((e) => console.log(e.type, e.user.name, e.details));
```

# Access control (command guards)

The module contributes two [global command guards](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-guards).
They enforce access metadata declared on **any** processor, from any module:

| Metadata | Guard | Effect |
|---|---|---|
| `requireAuth: true` | `users:require-auth` | Blocks the command with `<command>: login required` when nobody is signed in |
| `requiredGroups: ['ops', ...]` | `users:required-groups` | Requires sign-in and membership in at least one listed group, otherwise `<command>: permission denied (requires group: ops)` |

```typescript
const deployProcessor: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Deploy the app',
    metadata: { requireAuth: true, requiredGroups: ['ops'] },
    async processCommand(command, context) { /* ... */ },
};
```

The built-in admin commands (`adduser`, `userdel`, `usermod`, `groupadd`, `groupdel`, `sessions`,
`session-kick`) declare `requiredGroups: ['admin']`. Commands that act on the signed-in user (`id`,
`groups`, `passwd`, `logout`, `last`, `listusers`) declare `requireAuth: true`.

The users module is optional. Without it these flags are informational and every command runs.
The guards are exported (`usersGuards`, `requireAuthGuard`, `requiredGroupsGuard`) so a custom
module can reuse them. Client-side guards are not a security boundary: in server mode the server
still authorizes every request.

# Extensibility

You can swap any built-in service by overriding the module's services array:

```typescript
import { usersModule } from '@qodalis/cli-users';

// Server-backed authentication
const customModule = {
    ...usersModule,
    services: [
        ...usersModule.services,
        { provide: 'cli-auth-service', useValue: new MyServerAuthService() },
    ],
};
```

# Default behavior

By default the module seeds a `root` user (root@localhost, admin group, password: `root`) and an `admin` group. On first boot it auto-logs in as root. Sessions persist across page reloads via IndexedDB.
