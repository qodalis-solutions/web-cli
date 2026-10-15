# Users Module as a Complete Product — Design Spec

Date: 2026-10-14
Branches: web-cli `feature/users-server-mode`, cli-server-{node,python,dotnet} `feature/users-plugin`

## Goal

`@qodalis/cli-users` provides authentication, roles/permissions, user & group
management, sessions and audit for the CLI. It runs in two modes that expose
**the same commands, services and behaviour**:

- **local**: everything in the browser (IndexedDB). Useful standalone, offline, demos.
- **server**: everything delegated to a CLI server users plugin (node, python, .NET),
  which is the authority (enforces permissions on every endpoint).

The module is optional: without it the CLI works unchanged, and access metadata on
processors is informational.

## Concepts

| Concept | Model |
|---|---|
| User | `ICliUser` (name, email, groups by **name**, disabled, homeDir, lastLoginAt, data) |
| Role | A **group**. `ICliGroup.permissions?: string[]` grants permissions to members |
| Permission | `resource:action` string with `*` wildcards (`users:*`, `*`), helpers in core (`cliPermissionMatches`, `cliHasPermission`, ...) |
| Effective permissions | union of the user's groups' permissions; on `ICliUserSession.permissions` |
| Session | `ICliUserSession` (+ `data.sessionId`, server token in server mode) |
| Audit | `ICliAuditService` entries for every security-relevant event |

Built-in groups (seeded in both modes, never deletable):
- `admin`: `*`
- `users`: default group for new accounts, no permissions (self-service only)

Built-in permissions (`CliUsersPermissions`): `users:read|create|update|delete`,
`groups:read|create|update|delete`, `sessions:read|revoke`, `audit:read|clear`.

## Access control (guards)

Processor metadata, enforced by users-module guards (priority order):
1. `requireAuth` → `users:require-auth`
2. `requiredGroups` (any of) → `users:required-groups`
3. `requiredPermissions` (all of) → `users:required-permissions`

Built-in commands move from `requiredGroups: ['admin']` to specific permissions
(e.g. `adduser` → `users:create`). The `admin` group keeps working via `*`.
Self-service commands (`passwd`, `id`, `logout`, ...) stay `requireAuth`.

## Service surface (identical in both modes)

| Token | Interface | Local impl | Server impl |
|---|---|---|---|
| users store | `ICliUsersStoreService` | IndexedDB | `/users` |
| groups store | `ICliGroupsStoreService` (+ `updateGroup`, permissions) | IndexedDB | `/groups` |
| auth | `ICliAuthService` (+ `switchUser`) | local credentials | `/sessions`, `/users/{id}/password` |
| session | `ICliUserSessionService` | IndexedDB | token + `/sessions/current` |
| sessions | **new** `ICliSessionsService` (list/revoke) | IndexedDB session registry | `/sessions` |
| audit | `ICliAuditService` | IndexedDB | `/audit` |
| events | `ICliUserEventService` | shared | shared |
| authorization | **new** `ICliAuthorizationService` (effective permissions, `can`) | groups store | session permissions from server |

Commands use only these services — no `context.http` in processors — so every
command works in both modes.

## Generic authorization layer (core) — for every extension

Everything access-related lives in `@qodalis/cli-core` as interfaces + helpers, so any
extension can declare and check permissions without depending on `@qodalis/cli-users`:

- `ICliModule.permissions?: CliPermissionDefinition[]` — `{ name, description }` that
  the module uses (e.g. files declares `files:admin`, `files:chown`). Registered at
  boot into `ICliPermissionRegistry` (core service, always present) so `perms --list`,
  `groupmod --grant` completion and docs can show every known permission.
- `ICliAuthorizationService` (token `ICliAuthorizationService_TOKEN`), provided by an
  auth module (users module provides it in both modes):
  - `getPrincipal()` → `{ id, name, groups, permissions } | undefined`
  - `can(permission)` → boolean (wildcards)
  - `canAccess(resource: { ownership?, permissions? }, action: 'read'|'write'|'execute')`
    → rwx check (owner/group/other) with bypass for `*` / a resource-specific admin
    permission passed by the caller.
- `cliAuthorize(context, permission)` / `cliCanAccess(context, ...)` helpers: return
  `true` when **no** authorization service is registered (open system), so extensions
  degrade gracefully without the users module.
- `CliAccessDeniedError` — thrown by services; the executor prints its message as a
  normal error (exit code 1) and it is distinguishable for callers.
- Guards (`requireAuth`, `requiredGroups`, `requiredPermissions`) are implemented on top
  of `ICliAuthorizationService` so a custom auth module gets them by providing the service.

### Files module integration

- The local file system (IndexedDB) enforces rwx on every operation through the
  authorization service when one is registered:
  read file → `r` on file + `x` on ancestors; list dir → `r`+`x` on dir; cd → `x`;
  create/delete/rename/write → `w`+`x` on parent dir (write existing file → `w` on file).
- `chmod` / `chown`: owner or `files:chown` (`files:admin` bypasses everything).
- New files/dirs owned by the current principal (`uid` = user name, `gid` = first group).
- Home directories created as `rwx------`-ish defaults per user (`rwxr-x---`).
- Without an authorization service (no users module): no checks, as today.
- The server file system (remote) keeps server-side enforcement; client shows ownership.

## Behaviour fixes (local mode)

- Logout leaves **no** session (signed-out state) instead of switching to the first admin.
  The prompt shows the anonymous state; `login` signs in again.
- Session timeout is an **idle** timeout: activity is recorded on every command; when it
  expires the session ends (signed out), never escalates.
- Expired restored session → signed out.
- Clearing the session clears `context.userSession` (shared session sync for both modes).
- `su` and passwordless login go through the auth service: lockout, events, audit, `lastLoginAt`.
- Lockout is keyed by the resolved user id (name or email).
- `userdel`: removes credentials, sessions of the user; refuses deleting self, the last
  admin, or a built-in account when it is the last admin.
- `groupdel`: removes the group from members; built-in groups are protected.
- Group names are validated on `adduser`/`usermod`.
- `usermod`: `--name` rename; refuses removing the last admin's `admin` membership or
  disabling yourself / the last admin.
- Changes to the signed-in user (groups, disabled) refresh the live session; disabling a
  user ends their sessions.
- Events: add `group_created`, `group_deleted`, `group_updated`, `user_switched`,
  `session_revoked`, `permissions_changed`; all are audited.
- `seedUsers` reports failures instead of swallowing them.

## Structure

`public-api.ts` becomes a thin module definition. Code moves into:
- `lib/module/local-setup.ts`, `lib/module/server-setup.ts`
- `lib/module/session-sync.ts` (context + filesystem sync, shared)
- `lib/module/home-dir.ts` (shared filesystem home creation)
- `lib/module/first-run-wizard.ts`, `lib/module/boot-login.ts`
- `lib/guards/` (all guards)

Services are registered declaratively; `onDestroy` unsubscribes everything.
The key-value store token moves to core so the plugin no longer imports `@qodalis/cli`.

## Commands

Existing: `whoami`, `id`, `groups`, `login`, `logout`, `su`, `passwd`, `adduser`,
`userdel`, `usermod`, `listusers`, `groupadd`, `groupdel`, `w`, `last`,
`sessions`, `session-kick` (now both modes).

New/extended:
- `groupmod <group> [--description] [--grant p1,p2] [--revoke p1,p2] [--set p1,p2]`
- `groups --all` lists groups with permissions and member count
- `id` / `whoami` show effective permissions
- `perms [user]` (alias `permissions`) shows effective permissions and their source groups
- `audit [--user] [--event] [--limit]`, `audit clear` (`audit:read` / `audit:clear`)

## Server plugins (node, python, .NET)

Same API under `/api/v1/qcli`, parity across servers:
- Builder/registration consistent with the server's other plugins
  (node `CliUsersBuilder`, python builder, .NET `AddCliUsers` options).
- Groups carry `permissions`; `PUT /groups/{name}` updates description/permissions.
- Endpoints enforce permissions (not just "admin"): same permission strings.
- Session payload includes `permissions` (effective) — client uses it for guards.
- Same validations and cascades as local mode (last admin, self delete, group cleanup,
  credential cleanup, revoke sessions on disable/password change).
- Same audit events.

## Demos

Each demo keeps its original wiring as default and can switch via URL:
`?users=none|local|server&server=node|dotnet|python`. An `access-demo` module shows
a plain-module guard and access metadata that only bites with the users module.

## Testing

- Core: permission utils, guards.
- Users plugin: lifecycle specs per mode (boot, seed, logout, timeout, restore,
  destroy), cascades and protections, permissions guard, groupmod/perms/audit commands,
  no-users-module scenarios, custom store override.
- Servers: parity tests for permissions, cascades, protections.
- Browser (Playwright): none / local / server modes in the demo.

## Appendix A — Server contract (node, python, .NET must match exactly)

Base: `/api/v1/qcli`. Collections accept paths with **and** without trailing slash
(no redirects). Every error body is `{ "error": "<message>" }` (python: map pydantic
422 → 400 `{error}`; .NET: map model-binding ProblemDetails → 400 `{error}`).

### Models (camelCase JSON)

- `User`: `{ id, name, email, groups: string[], disabled: boolean, homeDir?, createdAt, updatedAt, lastLoginAt?, data? }`
  — `disabled` always present (false by default); optional fields omitted when absent.
- `Group`: `{ id, name, description?, permissions: string[], builtIn: boolean, createdAt, updatedAt }`
- `Session` (listing / current): `{ id, userId, userName, createdAt, lastActivity, expiresAt, metadata: { userAgent?, remoteAddress? }, current?: boolean }` — **never includes the token**.
- Login response (201): `{ token, session: { id, user: User, permissions: string[], loginTime, lastActivity, expiresAt } }`
- `GET /sessions/current` (200): same shape as the login response `session`.
- `AuditEntry`: `{ id, timestamp, event, username, details?, actor?, metadata? }`

### Built-ins, seeding

- Groups seeded when missing (also in external-auth mode): `admin` (`permissions: ["*"]`, builtIn) and `users` (`[]`, builtIn).
- Unless external auth: when the user store is empty seed `root` (`root@localhost`, groups `["admin"]`) with `defaultAdminPassword` (default `root`).
- New users without groups get `["users"]`.
- Group names are case-insensitive for lookup/membership/permission checks; stored as given.

### Permissions

Effective permissions = union of the user's groups' `permissions`. Matching:
`resource:action`, a trailing `*` matches the rest (`*`, `users:*`), a `*` elsewhere matches exactly one segment (`*:read` matches `users:read`, not `users:delete`), case-insensitive
(same semantics as `cliPermissionMatches` in web-cli core).

| Endpoint | Requirement |
|---|---|
| `POST /sessions` | public (login) |
| `GET /sessions/current`, `DELETE /sessions/current` | authenticated |
| `GET /sessions` | `sessions:read` |
| `DELETE /sessions/{id}` | `sessions:revoke`, or the session belongs to the caller |
| `GET /users` (`?query=&skip=&take=`; query matches name/email substring, case-insensitive) | `users:read` |
| `GET /users/{idOrName}` | `users:read` or self |
| `GET /users/{idOrName}/permissions` → `{ userId, groups, permissions }` | `users:read` or self |
| `POST /users` `{name, email, groups?, password?, disabled?, homeDir?, data?}` → 201 User | `users:create` |
| `PUT /users/{idOrName}` `{name?, email?, groups?, disabled?, homeDir?, data?}` → 200 User | `users:update`; self may change only `email`, `data` |
| `DELETE /users/{idOrName}` → 204 | `users:delete` |
| `PUT /users/{idOrName}/password` `{password, currentPassword?}` → 204 | self (requires correct `currentPassword`, wrong → 403) or `users:update` (no current needed) |
| `POST /users/{idOrName}/verify-password` `{password}` → `{valid}` | self or `users:update`; counts toward lockout on failure; audited on failure |
| `GET /groups` | authenticated (any user may list groups) |
| `GET /groups/{name}` | authenticated |
| `GET /groups/{name}/members` → User[] | `groups:read` or caller is a member |
| `POST /groups` `{name, description?, permissions?}` → 201 Group | `groups:create` |
| `PUT /groups/{name}` `{description?, permissions?}` → 200 Group | `groups:update` (`admin` permissions cannot be changed → 409) |
| `DELETE /groups/{name}` → 204 | `groups:delete` |
| `POST /groups/{name}/members/{idOrName}` → 204 | `groups:update` |
| `DELETE /groups/{name}/members/{idOrName}` → 204 | `groups:update` |
| `GET /audit` (`?limit=&event=&username=`) | `audit:read` |
| `DELETE /audit` → 204 | `audit:clear` |

Missing/invalid auth → 401. Insufficient permission → 403.

### Validation & protections (status)

- Missing required field / bad value → 400. Unknown user/group → 404.
- Duplicate user name or email (create **and** rename/update), duplicate group → 409.
- Referenced groups must exist (create/update user, add member) → 400 `unknown group: x`.
- Cannot delete yourself → 409. Cannot delete, disable, or remove `admin` from the **last enabled member of `admin`** → 409.
- Built-in groups cannot be deleted → 409.
- Password policy: minimum length 4 (configurable `minPasswordLength`) → 400.

### Cascades

- Delete group → removed from every user's `groups`.
- Delete user → credentials deleted, all their sessions revoked.
- Disable user → all their sessions revoked.
- Password changed: by self → the caller's *other* sessions revoked; by someone else → all the target's sessions revoked.
- Every revoked session broadcasts `{ "type": "session-kicked", "data": { "sessionId", "userId", "reason" } }` on the events socket (always, when the server has an event socket).

### Sessions

- A session references the user by id; the **live** user is resolved on every request (group/disabled changes apply immediately; disabled or deleted user → 401).
- Idle timeout (`sessionTimeoutMs`, default 30 min): checked on every request (expired → 401 and deleted), `lastActivity` slides. Background sweep still runs.
- `expiresAt` = `lastActivity + sessionTimeoutMs`.

### Login & credentials

- Password hashing: PBKDF2-HMAC-SHA256, 100,000 iterations, 16-byte random salt, 32-byte key; stored as `pbkdf2$100000$<saltB64>$<hashB64>`; constant-time comparison.
- Lockout: 5 consecutive failures for a user (resolved by name or email) → locked for 5 minutes → `429 { error: "account locked, try again later" }`. Success resets. Configurable (`maxLoginAttempts`, `lockoutMs`).
- Login by name **or** email. Disabled user → 403 `account disabled`.
- `lastLoginAt` is persisted through `userStore.updateUser`.

### Audit events (all logged with `actor` = acting user name when applicable)

`login`, `login_failed`, `logout`, `user_created`, `user_updated`, `user_deleted`,
`user_disabled`, `user_enabled`, `password_changed`, `group_created`, `group_updated`,
`group_deleted`, `group_member_added`, `group_member_removed`, `session_revoked`,
`audit_cleared`. In-memory audit store keeps the last 1000 entries (all servers).

### External auth adapter

Unchanged semantics: login/logout/verify/password endpoints → 501 `{error}`;
adapter resolves the user per request; no root seed (groups still seeded);
adapter sessions are not stored and not listed.

### Registration (per server conventions)

- node: `new CliUsersBuilder().setDefaultAdminPassword(..).setUserStore(..)...setAuthAdapter(..).setSessionTimeout(ms).build(broadcastFn)` → `{ prefix, router, ready: Promise<void>, authService, stores..., dispose() }` (sync build; seeding awaited via `ready`). Package `@qodalis/cli-server-plugin-users`, listed in demo package.json and imported by package name. Keep `buildUsersPlugin` as a deprecated async wrapper.
- python: `CliUsersBuilder()...build(broadcast_fn)` → plugin with `router`, `prefix`, async `startup()` (seed + start cleanup task on the running loop) and `shutdown()`; demo uses the app lifespan/startup hook. Package `qodalis_cli_users`, imported by package name in demo.
- .NET: keep `AddUsers(o => ...)` / `UseQodalisUsers()`; add `SetUserStore<T>()`-style DI registration for stores; controllers must fail closed (401) if the middleware did not authenticate the request.

## Appendix B — Security contract (all three servers + local backend where applicable)

Applies on top of Appendix A. Where B conflicts with A, B wins.

### B1. The users plugin protects the whole server (not only its own routes)

- New option `protectServer` (default **true** when the users plugin is installed). When true,
  every CLI server route and socket requires an authenticated users session, except:
  `POST /api/v1/qcli/sessions` (login), version discovery (`/api/qcli/versions`, `/api/cli/versions`,
  `/api/v1/qcli/version`, `/api/v1/qcli/capabilities`) and health endpoints.
- Required permissions (admin `*` covers all):

  | Surface | Permission |
  |---|---|
  | `GET /commands` | authenticated |
  | `POST /execute`, `/execute/stream` | `commands:execute` **plus** the processor's declared `requiredPermissions` (server processors may declare them; enforce server-side) |
  | fs read (`ls`, `cat`, `stat`, `download`) | `files:read` |
  | fs write (`upload`, `mkdir`, `rm`, …) | `files:write` |
  | data explorer | `data:query` |
  | jobs read / manage | `jobs:read` / `jobs:manage` |
  | events WebSocket | authenticated |
  | logs WebSocket | `logs:read` |
  | shell WebSocket | `shell:execute` |

- The built-in `users` group now grants `["commands:execute"]` by default (so normal users can use the CLI); seeded only if absent.
- Export reusable guards for host apps: node `requireAuth()` / `requirePermission(p)` Express middleware on the plugin result;
  python `require_auth` / `require_permission(p)` FastAPI dependencies; .NET `[QcliAuthorize("perm")]` filter attribute / endpoint filter.
  Host apps use them for their own routes.
- Declare the new permissions in the README tables.

### B2. WebSockets

- Shell is **opt-in**: `enableShell` option, default **false** in the library (demos turn it on explicitly).
- WebSocket upgrades (events, logs, shell, jobs) authenticate with a **single-use ticket**:
  `POST /api/v1/qcli/sessions/ws-ticket` (authenticated) → `201 { "ticket": "<random 32 bytes hex>", "expiresIn": 30 }`.
  Ticket: bound to the session, expires after 30 s, consumed on first use. Upgrade URL carries `?ticket=<t>`.
  The bearer token is **not** accepted in WS query strings when `protectServer` is on (remove `_header_Authorization` handling for protected sockets).
  Invalid/missing ticket → close with code 4401 (or reject the upgrade with 401).
- `allowedOrigins` option (list). When set, WS upgrades and CORS accept only those origins; the `Origin` check applies to every WS upgrade.
  Library default for CORS: **disabled** unless `allowedOrigins` (or an explicit cors option) is provided; never `*` together with credentials.
  Demos set `allowedOrigins` to the local dev origins (`http://localhost:4300-4303`, `http://localhost:4200`, `http://127.0.0.1:*` equivalents as needed).
- `session-kicked` and other user-scoped events are sent **only** to event sockets authenticated as that user/session.
- Logs socket requires `logs:read`. Never log shell `cmd` values or tokens.

### B3. No privilege escalation

A caller can never grant or exercise more than they hold. Let `P(x)` be effective permissions.

- Creating/updating a group's `permissions`: every granted permission must be covered by `P(caller)` (`*` only if caller holds `*`), else 403 `cannot grant permissions you do not hold: <list>`.
- Adding a user to a group, or setting `groups` on user create/update: `P(caller)` must cover every permission of every added group, else 403.
- Acting on a target user (update name/groups/disabled, password reset, delete, revoke their sessions): if `P(target)` is not covered by `P(caller)` → 403 `insufficient privileges for this user`.
  (`covered`: every permission of the target matches some permission of the caller via the wildcard rules.)
- Same rules in the web-cli local backend.

### B4. Default credentials and password policy

- Root seeding: if `defaultAdminPassword` is not configured, generate a random 16-char password, log it **once** at startup with a clear warning, and mark root `mustChangePassword: true`.
  Explicit `defaultAdminPassword` → no flag (demos set it explicitly), but log a warning if it is one of `root`, `admin`, `password`.
- `User.mustChangePassword: boolean` (always present in JSON). While true, a session may only call
  `GET/DELETE /sessions/current` and `PUT /users/{self}/password`; everything else (including
  `POST /sessions/ws-ticket` and every protected server route) → 403 `password change required`.
  Successful self password change clears it. Admin reset (`PUT /users/{other}/password`) sets it to true unless body has `"temporary": false`.
  Login response/session payload includes the user, so clients see the flag.
- Minimum password length default **8** (`minPasswordLength`), max 1024.

### B5. Brute force, enumeration, DoS

- Lockout bookkeeping must be atomic: reserve the attempt before PBKDF2 verification (increment first, reset on success) so concurrent requests cannot exceed the limit.
- Unknown usernames are tracked and locked exactly like known ones (same 429), and run a dummy PBKDF2 so timing does not reveal existence.
- Per-IP limiter on `POST /sessions`, `verify-password` and self password change: 20 attempts / minute / IP → 429. Trust `X-Forwarded-For` only when `trustProxy` is configured.
- Self password change (`currentPassword`) goes through lockout + audit (`login_failed` on mismatch) in every server.
- Admin password reset clears the target's lockout.
- PBKDF2 runs off the request thread / event loop (python `run_in_executor`; node async `crypto.pbkdf2`; .NET already threaded) with a concurrency cap (e.g. 4).
- Absolute session lifetime `maxSessionLifetimeMs` (default 12 h) in addition to the idle timeout; `expiresAt` = min(idle, absolute).

### B6. Tokens and secrets

- Session stores keep `SHA-256(token)` (hex), never the raw token; lookups hash the presented token. Store interfaces take the hash.
- Tokens, passwords, tickets never appear in logs, audit entries or error messages.

### B7. Input validation (400 `{error}`)

- User names, group names: 1–64 chars, `^[A-Za-z0-9][A-Za-z0-9._@-]*$`.
- Email: ≤ 254 chars, `^[^\s@]+@[^\s@]+$` (`root@localhost` is valid), no control characters.
- Permission strings: ≤ 128 chars, `^(\*|[a-z0-9_.-]+(:([a-z0-9_.-]+|\*))*)$` (case-insensitive), ≤ 100 per group.
- Group description ≤ 256, `data` ≤ 16 KB serialized, request body ≤ 1 MB on users routes.
- Name and email share one uniqueness namespace: a name may not equal any user's email and vice versa (409).
- Strip/reject control characters (`\u0000-\u001f`, `\u007f`, ANSI ESC) in every stored string (names, emails, descriptions, details) — reject in input (400), sanitize in audit details.

### B8. Audit

- Entries add `userId` and `actorId` (when known).
- Failed logins for unknown users store the attempted name sanitized and truncated to 64 chars.
- Failed-login entries are capped separately (last 200) so they cannot evict other history (total cap 1000 for the rest).

### B9. CSRF (cookie/adapter mode)

- State-changing requests (POST/PUT/DELETE) to users routes and protected server routes must either carry `Authorization: Bearer …` or (adapter/cookie mode) have an `Origin` header in `allowedOrigins`; otherwise 403.

### B10. Admin dashboard plugin

- When the users plugin is installed, the admin dashboard authenticates through it: dashboard login calls the users auth service and requires the `admin:access` permission (admin `*` has it); its own static credentials are only used when the users plugin is absent.
- Python admin rate limiter trusts `X-Forwarded-For` only with `trustProxy`; .NET admin middleware matches `/auth/login` exactly; python admin uses byte-wise `hmac.compare_digest`.

### B11. Resolved details (all three servers + local backend)

Decisions taken while implementing Appendix B, kept consistent across node, python and .NET:

- **WebSocket Origin**: a *present* Origin that is not allowed is rejected (403 at upgrade, or close 4403). A *missing* Origin is accepted: browsers always send one, so its absence means a non-browser client, which still needs a ticket on a protected server.
- **CSRF (B9)** applies to cookie/adapter auth. Bearer-token requests cannot be forged cross-site; login stays exempt.
- **Escalation (B3)**: the default `users` group assigned on create is not checked; explicitly requested groups are. Changing a group's permissions checks the whole new list. Escalation 403 is evaluated before the last-admin 409.
- **Public routes** under a protected server: version discovery, capabilities, health, `POST /sessions` and the admin dashboard login (`POST /auth/login`, which then requires `admin:access`). Everything else under `/api/*` and `/ws/*` requires a session.
- **Defaults**: CORS is off until `allowedOrigins` is configured (patterns like `http://127.0.0.1:*` allowed); the PTY shell is off until enabled explicitly; existing stores keep their `users` group as-is (`commands:execute` is only seeded with a new group).
- **Body limit**: oversized bodies are refused (python/.NET 400, node 413).
- **Known follow-up**: the admin dashboard UI package still opens its live sockets with `?token=`; on a protected server it must switch to `POST /sessions/ws-ticket`.

## Appendix C — Remote shell security (all three servers + client)

The PTY shell (`/ws/v1/qcli/shell`, `/ws/qcli/shell`) gives OS-level access. It must be secure by
default, optional, and work with and without the users plugin.

### C1. Enabling and access modes

- The shell stays **off** unless enabled explicitly (`enableShell` / `enable_shell` / `cli.EnableShell()`).
- When enabled, access is decided by exactly one mode:
  1. **users** — the users plugin is mounted: ticket-authenticated session with `shell:execute` (unchanged).
  2. **token** — no users plugin, `shell: { token: '<secret>' }`: the client must send `Authorization: Bearer <secret>`
     (header, or the legacy `_header_Authorization` query parameter that browser clients use via the server's
     configured `headers`). Constant-time comparison. Token never logged.
  3. **authorize** — no users plugin, `shell: { authorize: (request) => boolean | Promise<boolean> }`: host-defined
     check (request headers, query, remote address). Exceptions = deny.
  4. **anonymous** — only with explicit `shell: { allowAnonymous: true }`; logs a startup WARNING
     ("shell is enabled without authentication").
- Precedence: users plugin mounted ⇒ mode 1 (token/authorize may additionally be required if configured, i.e. both
  must pass). Otherwise token, then authorize, then allowAnonymous.
- **Enabled with no mode available ⇒ locked**: every connection refused (close 4401) and a startup ERROR log
  explaining the options. Never silently open.
- `/capabilities` keeps `shell: true|false` and adds `shellAuth: 'users'|'token'|'custom'|'anonymous'|'locked'`
  (only when enabled).

### C2. Session binding (users mode)

- An open shell belongs to the session that opened it. Logout, idle/absolute expiry, admin revoke (kick),
  user disabled/deleted, or losing `shell:execute` (checked at least every 60 s and on the session events)
  ⇒ the shell is closed with code **4401** (`session ended`) and the process tree killed.

### C3. Limits and environment

- `maxSessionsPerUser` (default **3**; anonymous/token/custom modes: per remote address) ⇒ close **4429**
  `too many shell sessions`.
- `idleTimeout` (default **15 min** without stdin) and optional `maxDuration` (default none) ⇒ close **4408**
  `shell timed out`, process killed.
- `cwd` (default: unchanged behaviour), `shell` (default: detected), and `env`:
  the child environment is **not** the full server environment any more: only `PATH`, `HOME`, `USER`, `LANG`,
  `TERM`, `COLUMNS`, `LINES`, `SHELL` plus `env.allow` names and `env.set` values. (Server secrets such as DB
  passwords must not leak into the shell.)
- Total concurrent shells cap `maxSessions` (default **20**) ⇒ 4429.

### C4. Audit and logging

- users mode: audit entries `shell_opened` / `shell_closed` with `userId`, `actorId`, `metadata: { mode:
  'interactive'|'command', sessionId, durationMs?, exitCode?, reason? }`. **Never** the command text or stdin.
- Other modes: one info log line per open/close with the remote address and mode (no command text).

### C5. Rejections the browser can read

- Auth/authorization failures on the shell socket: **accept, then close** with a code and short reason
  (browsers cannot read HTTP status of a failed upgrade):
  `4401` login required / session ended, `4403` forbidden (missing `shell:execute`, bad token, authorize false),
  `4404` shell disabled, `4429` limit reached, `4408` timeout. Origin rejection may stay HTTP 403.

### C6. Client (web-cli)

- New core permission `shell:execute` (declared by the server-connection feature). `ssh` declares
  `requiredPermissions: ['shell:execute']`: enforced by the access guards only when an auth module is loaded;
  without one, `ssh` stays available and the server decides.
- `ssh` maps close codes to messages: 4401 "login required" / "session ended", 4403 "permission denied", 4404
  "shell is disabled on <server>", 4408 "shell timed out", 4429 "too many shell sessions".

### C7. Canonical details (identical on node, python and .NET)

- **Close code + reason text** (shell socket):
  - `4401 "login required"` — no ticket / no or non-Bearer token
  - `4401 "session ended"` — logout, expiry, kick, user disabled/deleted, `shell:execute` removed, password change now required
  - `4401 "shell access is not configured"` — enabled but locked
  - `4403 "forbidden"` — wrong token, `authorize` false/throws, missing `shell:execute` (users middleware rejections may say "forbidden"/"unauthorized" with the same codes)
  - `4404 "shell disabled"`, `4408 "shell timed out"` (idle or max duration), `4429 "too many shell sessions"`
  - server shutdown: `1001`
- **Audit `metadata.reason`** (`shell_closed`): `exited` | `closed` (client) | `session ended` | `permission removed` | `shell timed out` | `server shutdown` | `error`. `exitCode` only for `exited`. `metadata.mode`: `interactive` | `command`.
- **Mode precedence & combination**: users plugin mounted (even with `protectServer: false`) ⇒ users mode, plus token/authorize if configured. Otherwise every configured check among token/authorize must pass; `shellAuth` reports the first (`token` before `custom`); `allowAnonymous` is ignored once token/authorize is set.
- **Re-check**: default every 30 s (max 60 s) and immediately on session/user/group change events. Re-checks do not extend the session; stdin since the last check touches the session (at most once per 30 s).
- **Limits** key: users mode `userId`; other modes the socket remote address (`X-Forwarded-For` only when the server's trust-proxy option is on).
- **Token compare**: SHA-256 of both, constant-time compare.
