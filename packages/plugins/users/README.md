# @qodalis/cli-users

Users, groups (roles), permissions, sessions, API tokens and audit for the Qodalis CLI, stored locally or on a server.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-users.svg)](https://www.npmjs.com/package/@qodalis/cli-users)
[![license](https://img.shields.io/npm/l/@qodalis/cli-users.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-users
```

Or install it at runtime in a running terminal:

```bash
pkg add users
```

## Usage

Register `usersModule` with your terminal.

```typescript
import { usersModule } from '@qodalis/cli-users';

// Angular (template)
// <cli [modules]="[usersModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(usersModule)];

// React
<Cli modules={[usersModule]} />

// Vue
<Cli :modules="[usersModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(usersModule);
```

Configure where users live with `usersModule.configure()`:

```typescript
// Server mode: 'node' must match a name in options.servers
usersModule.configure({ server: 'node' });

// Local mode (default): users are stored in the browser
usersModule.configure({ requirePassword: true });
```

The module is optional: without it the CLI works unchanged and every command is allowed.

## Modes

| Mode | Where users live | Authority | Typical use |
|---|---|---|---|
| Server (`server: 'node'`) | The users plugin of a Qodalis CLI server (Node, .NET, Python) | The server | The CLI as a console for your backend |
| Embedded (`server` + `hostAuth`) | Your application; the CLI reuses its bearer token | The server | CLI inside an app whose users are already signed in |
| Custom backend (`backend`) | Your own API, through `ICliUsersBackend` | Your API | Integrate a system without a CLI server |
| Local (default) | The browser (IndexedDB) | The browser | Standalone, offline, demos |

All modes expose the same commands, services and rules: they share one contract (`ICliUsersBackend`, mirrored by the servers' HTTP API).

### First sign-in

| Mode | Initial account |
|---|---|
| Local | None. On first boot the terminal asks you to create the administrator (name, email, password, home directory). |
| Local with `seedUsers` | The seeded accounts, with `defaultPassword` (`root` when unset, and then they must choose a new password at first sign-in). |
| Server | `root` (group `admin`). Without the server's `defaultAdminPassword`, the server generates a random password, prints it once in its log and requires a change at first sign-in. |

```typescript
// Demo accounts in local mode (sign in with `login alice`)
usersModule.configure({
    seedUsers: [{ name: 'alice', email: 'alice@example.com', groups: ['admin'] }],
    defaultPassword: 'change-me-please',
});
```

## Commands

| Command | Aliases | Access | Description |
|---|---|---|---|
| `whoami` | `me` | | Signed-in user |
| `id [user]` | | login (`users:read` for others) | Identity, groups and permissions |
| `groups [user]` | | login | Group membership, or every group with `--all` |
| `perms [user]` | `permissions` | login | Effective permissions and the groups granting them |
| `login [user]` | | | Sign in by name or email; replaces every session |
| `logout` | `exit` | | Sign out; after `su`, return to the previous user |
| `su <user>`, `su - <user>` | | | Switch user on top of the current session |
| `passwd [user]` | | login (`users:update` for others) | Change your password, or reset another user's |
| `adduser [name]` | `useradd` | `users:create` | Create a user; asks for missing fields |
| `usermod <user>` | | `users:update` | Change a user |
| `userdel <user>` | `deluser` | `users:delete` | Delete a user, their password and sessions (asks first) |
| `listusers` | `users` | `users:read` | List users |
| `groupadd <name>` | | `groups:create` | Create a group (role) |
| `groupmod <group>` | | `groups:update` | Change a group's permissions, description and members |
| `groupdel <name>` | | `groups:delete` | Delete a group (members are removed from it) |
| `w` | `who` | login | Who is signed in |
| `sessions` | | `sessions:read` | Active sessions |
| `session-kick <id>` | | login | End a session (own, or any with `sessions:revoke`) |
| `token create <name>` | | login, server mode | Create an API token, shown once |
| `token list` | `ls` | login, server mode | List your API tokens |
| `token revoke <id>` | `rm` | login, server mode | Revoke a token (own, or any with `tokens:revoke`) |
| `last [user]` | | `audit:read` | Sign-in history (logins, logouts, failures) |
| `audit` | | `audit:read` | Security audit log, newest first |
| `audit clear` | | `audit:clear` | Clear the audit log (asks first) |

`token` also answers to `tokens`.

| Flag | Short | Applies to | Default | Description |
|---|---|---|---|---|
| `--info` | `-i` | `whoami` | `false` | Add details, groups and permissions |
| `--all` | `-a` | `groups` | `false` | List every group with its permissions |
| `--list` | `-l` | `perms` | `false` | List every permission declared by loaded modules |
| `--command` | `-c` | `su` | | Run one command as the user, then switch back |
| `--email` | | `adduser`, `usermod` | | Email address |
| `--full-name` | | `adduser`, `usermod` | | Full name (`""` clears it in `usermod`) |
| `--groups` | | `adduser`, `usermod` | `users` | Groups, comma separated (`usermod`: replaces them) |
| `--home` | | `adduser`, `usermod` | `/home/<name>` | Home directory |
| `--disabled` | | `adduser` | `false` | Create the account disabled |
| `--no-password` | | `adduser` | `false` | Do not set a password now |
| `--name` | | `usermod` | | Rename the user |
| `--add-groups` | `-a` | `usermod` | | Add to groups |
| `--remove-groups` | `-r` | `usermod` | | Remove from groups |
| `--disable`, `--enable` | | `usermod` | | Disable (ends its sessions) or enable the account |
| `--force` | `-f` | `userdel` | `false` | Do not ask for confirmation |
| `--query` | `-q` | `listusers` | | Filter by name or email |
| `--skip`, `--take` | | `listusers` | | Page the list |
| `--description` | `-d` | `groupadd`, `groupmod` | | Group description |
| `--permissions` | `-p` | `groupadd` | | Permissions, comma separated |
| `--grant` | `-g` | `groupmod` | | Add permissions |
| `--revoke` | `-r` | `groupmod` | | Remove permissions |
| `--set` | | `groupmod` | | Replace permissions (`""` clears) |
| `--add-member`, `--remove-member` | | `groupmod` | | Add or remove users, comma separated |
| `--expires` | | `token create` | `90` | Days until expiry (1-365) or `never` (if the server allows it) |
| `--permissions` | | `token create` | all of yours | Limit the token to these permissions, comma separated |
| `--all` | `-a` | `token list` | `false` | Every user's tokens (`tokens:read`) |
| `--limit` | `-n` | `last`, `audit` | `20` / `50` | Number of entries |
| `--user`, `--event` | `-u`, `-e` | `audit` | | Only entries for this user or event |

```bash
adduser bob --email=bob@example.com --groups=users,ops
usermod bob --add-groups=release
groupadd release --permissions=deploy:run
groupmod release --grant=deploy:rollback
groupmod release --add-member=alice
perms alice
perms --list
listusers --query=jo --take=10
token create ci --expires=30 --permissions=commands:execute
token list --all
audit --user=alice --limit=20
```

### Switching users (`su`)

`su` works like nested Unix shells, in local mode and against every server:

```text
root:~$ su alice              # asks for alice's password; root's session stays open
alice:~$ su -c "perms" bob    # one command as bob, then back to alice (exits with its status)
alice:~$ exit                 # ends alice's session: back to root
root:~$ exit                  # no su session left: signs out
```

- Any number of levels. `login` replaces every session.
- `su` always asks for the target user's password unless the module is passwordless (`requirePassword: false`), also for administrators.
- With host-managed sign-in (`hostAuth`), `login`, `logout`, `su` and own-password changes are handled by the host.

## Roles and permissions

Groups are roles. A user's effective permissions are the union of their groups' permissions.

- Permissions are `resource:action` strings with `*` wildcards (`users:*`, `*`).
- Built-in groups: `admin` (`*`, cannot be changed or deleted) and `users` (default for new accounts, grants `commands:execute` so members can run server commands).
- Built-in permissions: `users:read|create|update|delete`, `groups:read|create|update|delete`, `sessions:read|revoke`, `tokens:read|revoke`, `audit:read|clear`, plus `commands:execute`. The CLI engine declares `system:packages`, `system:services`, `system:eval` and `shell:execute`.
- Any module can declare its own permissions (`ICliModule.permissions`) and protect commands with them:

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
```

In code, use `cliAuthorize(context, 'deploy:rollback')` and `cliCanAccess` from `@qodalis/cli-core`; they allow everything when no auth module is loaded. The files plugin uses the same layer for its rwx checks.

## API tokens

In server mode, `token create` makes long-lived, revocable bearer tokens (`qcli_pat_...`) for MCP clients such as Claude Code, CI jobs and scripts. A token acts as the user who created it, with that user's live permissions; `--permissions` narrows it to permissions you hold. The token is printed once, together with a ready-to-paste `claude mcp add --transport http qcli <server>/api/qcli/mcp ...` command. Local mode has no tokens; custom backends opt in by implementing `listApiTokens`, `createApiToken` and `revokeApiToken`.

## Rules

- Names and emails are unique (case-insensitive); groups must exist.
- You cannot delete or disable yourself; the last enabled administrator cannot be deleted, disabled or removed from `admin`.
- Disabling a user ends their sessions; a password change ends the user's other sessions; group changes apply to live sessions immediately.
- Lockout after 5 failed sign-ins for 5 minutes (local mode defaults; servers enforce their own).
- Local passwords use PBKDF2-HMAC-SHA256 (100,000 iterations) with constant-time comparison.
- Security-relevant actions are audited with the acting user. Built-in event names are written only by the backend; `ICliAuditService.log` records custom events under the signed-in user.

## Configuration

All options of `usersModule.configure()`:

| Option | Default | Description |
|---|---|---|
| `server` | | Server mode: name of an entry in `options.servers` |
| `backend` | | Custom `ICliUsersBackend`; takes precedence over `server` |
| `hostAuth` | | `{ getToken, loginHint?, logout? }`: reuse the host app's bearer token (server mode) |
| `persistToken` | `true` | Keep the session across reloads (IndexedDB); `false` keeps it in memory |
| `requirePassword` | `true` | `false` (local only) allows passwordless `login`/`su`; development only |
| `requirePasswordOnBoot` | `false` | Ask for credentials at startup |
| `sessionTimeout` | `0` | Local idle timeout in ms (`0` = none) |
| `maxSessionLifetime` | 12 h | Local: longest a session lasts in ms before signing in again (`0` = until sign-out) |
| `passwordPolicy` | `{ minLength: 8 }` | `minLength`, `requireUppercase`, `requireDigit`, `requireSpecialChar` |
| `bruteForceProtection` | `{ maxAttempts: 5, lockoutSeconds: 300 }` | Local lockout (`maxAttempts: 0` disables) |
| `passwordHashIterations` | `100000` | PBKDF2 iterations for local password hashes |
| `seedUsers` | | Users created on first boot (local mode) |
| `defaultPassword` | `root` | Password for seeded users |
| `hideUserName` | `false` | Hide the user name from the prompt |
| `anonymousName` | `anonymous` | Prompt label while signed out (`''` hides it) |
| `userDisplayFormatter` | `user.name` | Format the user name shown in the prompt |

## Services for extensions

| Token | Purpose |
|---|---|
| `ICliUsersStoreService_TOKEN` | Users |
| `ICliGroupsStoreService_TOKEN` | Groups (roles) and membership |
| `ICliAuthService_TOKEN` | Login, logout, switch user, passwords |
| `ICliUserSessionService_TOKEN` | Current session (observable) |
| `ICliSessionsService_TOKEN` | List and revoke sessions |
| `ICliAuditService_TOKEN` | Audit trail |
| `ICliUserEventService_TOKEN` | `login`, `logout`, `user_*`, `group_*`, `session_revoked`, ... |
| `ICliAuthorizationService_TOKEN` | Principal, `can`, `canAccess` (generic, from core) |

Calls run as the signed-in user; the backend enforces permissions and rejects with `CliUsersError` (`status` 400/401/403/404/409/429/501).

## Security notes

- In server, embedded and custom-backend modes the backend is the security boundary; client-side checks only improve the experience.
- Local mode stores everything in the browser: it separates CLI users but cannot protect data from whoever controls the browser.
- Use `persistToken: false` on shared machines, and never ship `seedUsers` with a weak `defaultPassword`.

Examples: `examples/vanilla/16-users-and-permissions.ts`, `19-custom-users-permissions.ts`, `20-user-group-management.ts`, `21-server-session-management.ts`, `22-command-guards.ts`.

## Documentation

https://cli.qodalis.com/docs/plugins/users

## License

MIT
