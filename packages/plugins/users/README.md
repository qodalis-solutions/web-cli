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

## First sign-in and default accounts

| Mode | Initial account |
|---|---|
| **Local** (default) | None. On first boot (no accounts in the browser) the terminal asks you to create your administrator: name, email, password, home directory. There is no `root` / `root`. |
| **Local** with `seedUsers` | The seeded accounts, with `defaultPassword` (`root` when not set; a warning is logged for weak passwords). |
| **Server** | `root` (`root@localhost`, group `admin`). Without `defaultAdminPassword` the server generates a random password, prints it **once** in its log and requires a change at first sign-in. |

Browser data saved by versions before `2.0.0-beta.14` may still contain the old `root` / `root`
account; clear the site data (or run `userdel`) to start fresh.

```typescript
// Demo accounts in local mode (sign in with `login alice`)
usersModule.configure({
    seedUsers: [{ name: 'alice', email: 'alice@example.com', groups: ['admin'] }],
    defaultPassword: 'change-me-please',
});
```

## Roles and permissions

Groups are roles. Each group grants a list of permissions; a user's effective
permissions are the union of their groups' permissions.

- Permission strings are `resource:action`, with `*` wildcards: `users:*`, `*`.
- Built-in groups: `admin` (`*`, cannot be changed or deleted) and `users` (default for new accounts, grants `commands:execute` so members can run server commands).
- Built-in permissions: `users:read|create|update|delete`, `groups:read|create|update|delete`,
  `sessions:read|revoke`, `tokens:read|revoke`, `audit:read|clear`; core also declares `system:packages|services|eval`
  and `shell:execute` (`ssh` remote shells; not granted to `users` by default:
  `groupadd ops --permissions=shell:execute`).
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
Files are owned by login name: when both modules are loaded, renaming a user
(`usermod --name`) moves their files to the new name and deleting a user gives
their files to `root`, so a later account with the same name never inherits them.

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
| `adduser [name]` | `users:create` | Create a user step by step: name, email, full name, groups, home, enabled, password. Invalid answers are asked again (3 tries) |
| `adduser <name> --email=..` | `users:create` | Non-interactive (only asks for the password): `--full-name`, `--groups`, `--home`, `--disabled`, `--no-password` |
| `usermod <user> ..` | `users:update` | `--name`, `--email`, `--full-name`, `--groups`, `--add-groups`, `--remove-groups`, `--home`, `--disable`, `--enable` |
| `userdel <user>` | `users:delete` | Delete a user, their password and sessions |
| `listusers [--query --skip --take]` | `users:read` | List users |
| `groupadd <name> [--permissions]` | `groups:create` | Create a group (role) |
| `groupmod <group> ..` | `groups:update` | `--grant`, `--revoke`, `--set`, `--description`, `--add-member`, `--remove-member` |
| `groupdel <name>` | `groups:delete` | Delete a group (members are removed from it) |
| `w` | login | Who is signed in |
| `sessions` | `sessions:read` | Active sessions |
| `session-kick <id>` | login | End a session (own, or any with `sessions:revoke`) |
| `token create <name> [--expires=<days>\|never] [--permissions=a,b]` | login (server mode) | Create an API token, shown once |
| `token list [--all]` | login (server mode) | Own tokens; `--all` every user's (`tokens:read`) |
| `token revoke <id>` | login (server mode) | Revoke a token (own, or any with `tokens:revoke`) |
| `last [user]` | `audit:read` | Sign-in history |
| `audit [--user --event -n]`, `audit clear` | `audit:read` / `audit:clear` | Security audit log |

## API tokens and MCP

In server mode, `token` creates long-lived, revocable bearer tokens for MCP clients
(Claude Code, Claude Desktop, Cursor, …), CI jobs and scripts. A token acts as the
user who created it, with that user's live permissions; `--permissions` narrows it
further (you can only include permissions you hold).

```bash
token create claude --expires=90 --permissions=commands:execute
token list            # NAME, ID, EXPIRES, LAST USED, SCOPE
token list --all      # every user's tokens (tokens:read), adds USER
token revoke <id>     # own token, or any with tokens:revoke
```

- Expiry: 1-365 days (default 90). `--expires=never` works only when the server enables
  non-expiring tokens.
- Tokens are created from a signed-in session only: a request authenticated with an
  API token cannot create more tokens or change passwords.
- Disabling a user makes their tokens fail; deleting a user deletes them.
- Local mode has no tokens: the commands print where they are available. Custom
  backends opt in by implementing `listApiTokens`, `createApiToken` and `revokeApiToken`
  of `ICliUsersBackend`.

### Using the server's MCP endpoint from outside

The servers expose their CLI commands as MCP tools at `POST <server>/api/qcli/mcp`
(Streamable HTTP, stateless, JSON responses). Tools are filtered by the caller's
permissions. Default ports: .NET `8046`, Node `8047`, Python `8048`.

**1. Enable MCP on the server** (off by default). See each server's README section
"Using the MCP endpoint from an MCP client":

- .NET: `cli.EnableMcp()` — [cli-server-dotnet](https://github.com/qodalis-solutions/cli-server-dotnet#using-the-mcp-endpoint-from-an-mcp-client)
- Node: `createCliServer({ mcp: true })` — [cli-server-node](https://github.com/qodalis-solutions/cli-server-node#using-the-mcp-endpoint-from-an-mcp-client)
- Python: `CliServerOptions(mcp=True)` — [cli-server-python](https://github.com/qodalis-solutions/cli-server-python#using-the-mcp-endpoint-from-an-mcp-client)

**2. Create a token** in a CLI connected to the server (`usersModule.configure({ server })`),
signed in as the user the client should act as:

```bash
token create claude --expires=90
```

The token (`qcli_pat_…`) is shown once, together with the Claude Code command below.

**3. Connect Claude Code:**

```bash
claude mcp add --transport http qcli http://localhost:8047/api/qcli/mcp --header "Authorization: Bearer <token>"
```

**4. Claude Desktop / Cursor** (`claude_desktop_config.json`, `.cursor/mcp.json`):

```json
{
    "mcpServers": {
        "qcli": {
            "type": "http",
            "url": "http://localhost:8047/api/qcli/mcp",
            "headers": { "Authorization": "Bearer <token>" }
        }
    }
}
```

**5. MCP Inspector** (interactive testing): run `npx @modelcontextprotocol/inspector`,
choose transport *Streamable HTTP*, URL `http://localhost:8047/api/qcli/mcp`, add the
header `Authorization: Bearer <token>`, then *Connect* and *List Tools*.

**6. Raw request** (curl):

```bash
curl -s http://localhost:8047/api/qcli/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $QCLI_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Troubleshooting**

| Symptom | Cause |
|---|---|
| `401` | Token missing, mistyped, expired or revoked (`token list`), or its user is disabled |
| `403` | The request's `Origin` is not allowed (add it to the server's allowed origins), or the user lacks `commands:execute` |
| A tool is missing | The user (or the token's `--permissions` scope) lacks the command's permissions, or the server's `tools` / `exclude` lists hide it |
| `405` | `GET`/`DELETE` used: the endpoint only accepts `POST` |

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
- The audit log cannot be forged: built-in event names (`login`, `logout`, `su`,
  `login_*`, `user_*`, `group_*`, `session_*`, `password_*`, `audit_*`) are written only
  by the backend. `ICliAuditService.log` rejects them (`CliUsersError` 400) and records
  custom events (e.g. `deploy`) under the signed-in user, ignoring any `username` /
  `actor` the caller passes (401 when signed out; stored locally only, servers keep
  their own trail).

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
    anonymousName: 'anonymous', // prompt label while signed out (dimmed); '' to hide
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
- Never expose a system with a known password: leave the server's `defaultAdminPassword` unset (a random one is generated) or set a strong one, and don't ship `seedUsers` with a weak `defaultPassword`.

## Examples

- `examples/vanilla/16-users-and-permissions.ts` — roles, permissions, protected commands
- `examples/vanilla/19-custom-users-permissions.ts` — integrate your own system (custom backend)
- `examples/vanilla/20-user-group-management.ts` — use the services from your own commands
- `examples/vanilla/21-server-session-management.ts` — server mode and embedded `hostAuth`
- `examples/vanilla/22-command-guards.ts` — global guards
