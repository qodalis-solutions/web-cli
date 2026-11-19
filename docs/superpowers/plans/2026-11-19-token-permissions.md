# Selectable Token Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** API tokens get selectable permissions from a catalog the servers, their plugins and the host declare, and a host can issue `host`-audience tokens that only its own guarded routes accept.

**Architecture:** Each server's core gets a permission catalog (registered at startup, read-only afterwards). The users plugin serves `GET /api/v1/qcli/permissions`, adds an `audience` to tokens, refuses `host` tokens in its auth middleware on every route it authenticates, and exposes a host-facing token manager that shares the HTTP routes' validation. The dashboard and the `@qodalis/cli-users` console build their pickers from `/permissions`. The three servers implement one contract (below) in parallel; the dashboard and console are built against the same contract.

**Tech Stack:** .NET 10 / ASP.NET Core / EF Core / xUnit; Node 22 / Express 4 / TypeScript / vitest + supertest; Python / FastAPI / pydantic / pytest + httpx; React 18 / Vite / vitest (dashboard); TypeScript / Jasmine + Karma ChromeHeadless (web-cli).

**Spec:** `web-cli/docs/superpowers/specs/2026-11-19-public-api-design.md`, section "Part 1: selectable token permissions". Parts 2-4 build on the names pinned in this plan's contract section.

## Global Constraints

- The three servers behave identically: every route, JSON field name, status code and error text the contract section pins is the same byte for byte on all three. Texts the contract leaves to existing code (permission-syntax errors, the guards' 403s) stay as each server words them today.
- One `feature/public-api` branch per repo (cli-server-dotnet, cli-server-node, cli-server-python, cli-server-dashboard, web-cli), created from `develop`; PRs into `develop`, merged with `--rebase`. Linear history: rebase onto `develop`, never merge it in. No attribution lines in commit messages.
- "The catalog is for choosing, not for validation": unknown and wildcard entries stay accepted on `cli` tokens exactly as today. Only `host` tokens are validated against the catalog.
- `audience` defaults to `cli`; existing tokens, existing store rows and the HTTP routes keep today's behaviour. Sessions are not affected.
- Server version: every package of all three servers goes to `1.0.0-beta.29` (Python `1.0.0b29`) in one commit per repo, the way `1.0.0-beta.28` was bumped; internal dependency ranges stay as they are.
- Tests use each repo's existing framework. Every process a test run starts must exit; after Karma runs: `pkill -f "karma|ChromeHeadless"`.
- `@qodalis/cli-users` changes follow web-cli conventions: 4-space indentation, single quotes, semicolons; specs under `src/tests/`.

## Review Focus

1. **Stored tokens without an audience** (beta.28 rows, custom Node/Python stores that drop unknown fields): they must read as `cli` and keep working everywhere. Tests: .NET Task 5 (old table); Node Task 7 and Python Task 11 add `a store returning a token without audience behaves as cli` (a stub store whose `getToken`/`get_token_by_hash` omit the field → CLI route 200, view `audience: 'cli'`).
2. **Case and wildcards in host-token permissions**: `RATES:READ` must match the catalog entry and be stored as the catalog's spelling (`rates:read`); a user holding `rates:*` through a group may grant `rates:read`; `rates:*` itself is refused on a host token. Tests: .NET Task 3 adds `CreateHost_NormalizesCase` and `CreateHost_HeldThroughWildcard` (Node Task 8 and Python Task 12 mirror them, as they mirror every Task 3 case).
3. **A host entry that disappears later** (the host stops registering `banks:read`): existing host tokens keep it; the catalog is checked only at creation, the guard checks the user's live permissions on every request. Test: .NET Task 4 adds `HostToken_GuardDoesNotConsultTheCatalog` (Node Task 9 and Python Task 13 mirror it with a spy on `find`/`all`).
4. **A client of an older server**: dashboard and console must degrade (free-text field; a clear `needs server 1.0.0-beta.29` error) instead of breaking token creation. Tests: Task 14 `falls back to the other field when /permissions fails`, Task 15 `token permissions on an older server`.
5. **Duplicate or colliding registrations** (a host registering `audit:read`, or registering the same entry twice through two modules): startup must fail with `permission already registered: <name>` rather than silently keeping one description. Tests: Tasks 1, 6, 10 (`Duplicate_Throws`).

---

## Cross-server contract

Everything in this section is identical on .NET, Node and Python. Server tasks implement it; dashboard and console tasks consume it. Error bodies are the existing `{ "error": "<text>" }` shape.

### C1. Catalog entry

```json
{ "name": "files:read", "description": "List, read and download files", "group": "Files", "surface": "cli" }
```

- `name`: a concrete permission, `^[a-z0-9_.-]+:[a-z0-9_.-]+$` (lower case, exactly one `:`, no `*`), unique case-insensitively in the catalog.
- `description`: 1-200 characters, one line. `group`: 1-64 characters. `surface`: `"cli"` or `"host"`.
- Registration is startup-only. An invalid entry or a duplicate name fails startup with an exception whose message is `invalid permission entry: <name>` or `permission already registered: <name>`.
- Order: registration order (core, then plugins in the order they are added, then the host). `/permissions` returns entries in this order; consumers group by `group` in first-seen order.

### C2. Built-in `cli` entries (exact text; core registers the first 11, the users plugin the last 12)

| name | group | description | registered by |
|---|---|---|---|
| `commands:execute` | Commands | Run commands on the server | core |
| `shell:execute` | Commands | Open an interactive shell on the server | core |
| `files:read` | Files | List, read and download files | core |
| `files:write` | Files | Upload, create and delete files | core |
| `data:query` | Data | Query the data explorer's sources | core |
| `jobs:read` | Jobs | See jobs and their runs | core |
| `jobs:manage` | Jobs | Start, stop, pause and change jobs | core |
| `logs:read` | Server | Read the server's logs | core |
| `admin:access` | Server | Open the admin dashboard and its server pages | core |
| `audit:read` | Audit | Read the audit log | core |
| `audit:clear` | Audit | Clear the audit log | core |
| `users:read` | Users | See users and their permissions | users plugin |
| `users:create` | Users | Create users | users plugin |
| `users:update` | Users | Change users, their groups and passwords | users plugin |
| `users:delete` | Users | Delete users | users plugin |
| `groups:read` | Groups | See groups | users plugin |
| `groups:create` | Groups | Create groups | users plugin |
| `groups:update` | Groups | Change groups and their permissions | users plugin |
| `groups:delete` | Groups | Delete groups | users plugin |
| `sessions:read` | Sessions | See every user's sessions | users plugin |
| `sessions:revoke` | Sessions | End other users' sessions | users plugin |
| `tokens:read` | Tokens | See every user's API tokens | users plugin |
| `tokens:revoke` | Tokens | Revoke other users' API tokens | users plugin |

(23 rows; `audit:*` are checked by core's route policy and the users plugin alike, so core owns them.) Core registers the route-policy permissions because core's route policy is what checks them, also on servers without the filesystem, data-explorer or jobs feature configured. Command processors' free-form `RequiredPermissions` are not registered (the dashboard's "other" field and `--permissions` cover them).

### C3. Host registration (the `host` surface)

- .NET: `cli.AddPermissions(p => p.Group("Rates").Add("rates:read", "Official exchange rates").Add("banks:read", "Banks and their buy and sell rates"));` — entries get `surface = "host"`. Plugins register with `cli.AddPermissions(configure, CliPermissionSurface.Cli)`.
- Node: `builder.addPermissions([{ name: 'rates:read', description: 'Official exchange rates', group: 'Rates' }])`; optional second argument `surface: 'cli' | 'host'`, default `'host'`.
- Python: `builder.add_permissions([CliPermission(name="rates:read", description="Official exchange rates", group="Rates")])` (plain dicts with the same keys accepted); keyword `surface: Literal["cli", "host"] = "host"`.

### C4. `GET /api/v1/qcli/permissions` (users plugin; authenticated like the other users routes)

| Request | Result |
|---|---|
| no query, or `?all=false` | 200, array of C1 entries whose `name` the caller holds (`PermissionMatcher.HasPermission(caller.permissions, entry.name)`; wildcards in the caller's permissions match) |
| `?all=true` with `users:read` | 200, every catalog entry |
| `?all=true` without `users:read` | 403 `permission denied: users:read` (the same text on all three servers, although their existing routes word this 403 differently) |
| `?all=<anything else>` | 400 `all must be true or false` |
| no credentials | 401 `unauthorized` |
| a `host` token | 403 `forbidden: host tokens cannot use CLI routes` |

A scoped `cli` token sees only the entries its scope covers (its permissions are already narrowed). The route is under the users plugin's route prefixes, so `mustChangePassword` sessions get the usual 403.

### C5. Token `audience`

- Values: `"cli"` (default) or `"host"`. Stored on every token; a missing/null stored value reads as `"cli"`.
- Token view (`GET /tokens`, `POST /tokens` response, manager list/create results) gains `"audience": "cli" | "host"`, always present, placed after `lastUsedAt`, before `permissions`.
- `POST /api/v1/qcli/tokens` body: `audience` absent or `"cli"` → as today. `"host"` → 400 `host tokens can only be created by the host application`. Any other value (including non-strings) → 400 `audience must be cli or host`.
- Name uniqueness (case-insensitive, per user) and the 20-token limit count both audiences together.
- Revocation (`DELETE /tokens/{id}`, user deletion, disable, sign-out-everywhere paths that delete tokens today) is the same for both audiences.

### C6. Where `host` tokens are refused and accepted

- Refused with 403 `forbidden: host tokens cannot use CLI routes` by the users plugin's auth middleware, right after authentication, on every request it authenticates: all users-plugin routes (`/users`, `/sessions`, `/groups`, `/audit`, `/tokens`, `/link`, `/permissions`), and every CLI route when `ProtectServer`/`protectServer`/`protect_server` is on. Sockets: tickets come only from `POST /sessions/ws-ticket`, which refuses host tokens, so a host token never opens the shell, events or logs socket; where a server authenticates an upgrade from the `Authorization` header (.NET adapter mode), the shell closes with 4403 and the same text. This check runs before the route's permission check, so it applies whatever the route requires and also when the token's live permissions are empty.
- The external-auth path (`ApiTokensWithExternalAuth` and its Node/Python equivalents) authenticates `qcli_pat_` bearers through the same function, so the same check covers it.
- Accepted only by the host-route guards: .NET `[QcliAuthorize]` / `.RequireQcliAuthorization(...)`, Node `usersPlugin.requirePermission(...)` (and `requireAuth` if present), Python `users_plugin.require_permission(...)`. The guards check the permission as today against the token's narrowed live permissions and keep their existing 403 texts, which differ per server today (.NET `permission denied: <perm>`, Node `forbidden: missing permission <perm>`, Python `missing permission: <perm>`); aligning them is out of Part 1's scope.
- When the server is not protected, CLI routes are not authenticated at all (today's behaviour); a `host` token there is ignored like any other header, which grants nothing an anonymous caller lacks.

### C7. Host-facing token manager

Same validation, limits, audit entries (`token_created`, `token_revoked`) and events (`TokenCreated`/`TokenRevoked` and the Node/Python equivalents) as the HTTP routes. Errors are the users plugin's existing API exception type with the HTTP status and text the route would answer, so a host can map them 1:1.

| Operation | .NET `IApiTokenManager` | Node `usersPlugin.apiTokens` (`ApiTokenManager`) | Python `users_plugin.api_tokens` (`ApiTokenManager`) |
|---|---|---|---|
| create | `Task<CreatedApiToken> CreateAsync(string userId, ApiTokenCreateOptions options, CancellationToken ct = default)` | `create(userId: string, options: ApiTokenCreateOptions): Promise<CreatedApiToken>` | `async create(user_id: str, options: ApiTokenCreateOptions) -> CreatedApiToken` |
| list | `Task<IReadOnlyList<ApiTokenView>> ListAsync(string userId, CancellationToken ct = default)` | `list(userId: string): Promise<ApiTokenView[]>` | `async list(user_id: str) -> list[dict[str, Any]]` (the `to_view` dicts) |
| revoke | `Task<bool> RevokeAsync(string userId, string tokenId, string? actor = null, CancellationToken ct = default)` | `revoke(userId: string, tokenId: string, actor?: string): Promise<boolean>` | `async revoke(user_id: str, token_id: str, actor: str \| None = None) -> bool` |
| grantable permissions | `Task<IReadOnlyList<CliPermission>> GetGrantablePermissionsAsync(string userId, string audience = ApiTokenAudience.Cli, CancellationToken ct = default)` | `grantablePermissions(userId: string, audience?: 'cli' \| 'host'): Promise<CliPermission[]>` | `async grantable_permissions(user_id: str, audience: str = "cli") -> list[Any]` (catalog entries: `name`, `description`, `group`, `surface`, `to_dict()`) |

`ApiTokenCreateOptions` fields: `Name`/`name` (required), `ExpiresInDays`/`expiresInDays`/`expires_in_days` (int; absent = 90), `NeverExpires`/`neverExpires`/`never_expires` (bool, default false; needs `AllowNonExpiringTokens` as today, else 400 `non-expiring tokens are not allowed`; with `ExpiresInDays` also set → 400 `expiresInDays and neverExpires cannot both be set`), `Permissions`/`permissions` (list or null), `Audience`/`audience` (default `"cli"`), `Actor`/`actor` (audit actor name; default the token owner's name). `CreatedApiToken` = `{ token, apiToken }` exactly as the `POST /tokens` response.

Create rules, in this order (first failure wins):
0. external auth configured without API tokens enabled (.NET `ApiTokensWithExternalAuth` false, and its Node/Python equivalent) → 501 `Authentication is managed by the host application` (as `POST /tokens` answers today).
1. user missing → 404 `user not found`; user disabled → 403 `account disabled`.
2. audience not `cli`/`host` → 400 `audience must be cli or host`.
3. name, expiry: as `POST /tokens` (same texts).
4. permissions: syntax as `POST /tokens` on that server (400 with its existing text; .NET `invalid permission: <p>`).
5. `host` only: permissions null or empty → 400 `host tokens need permissions`; an entry that is not a `host`-surface catalog entry (case-insensitive match; wildcards never match) → 400 `not a host permission: <p>`. Matching entries are stored with the catalog's spelling (`RATES:READ` → `rates:read`).
6. each entry must be held by the user's live effective permissions → 403 `forbidden: cannot grant <p>`.
7. duplicate name → 409 `token '<name>' already exists`; limit → 400 `a user may have at most 20 tokens`.

`list` returns the user's tokens, oldest first, both audiences. `revoke` returns false when the token does not exist or belongs to another user (no exception), true after revoking; audits with `actor` (default the owner's name). `grantablePermissions(userId, 'host')` returns the `host`-surface entries the user holds; `'cli'` returns every entry the user holds (same rule as C4).

The HTTP `POST /tokens` keeps its own caller rules (session only, 403 `forbidden: API tokens cannot create tokens`) and then calls the same internal creation path with `audience = "cli"` and the caller's live permissions.

### Task order and parallelism

| Track | Tasks | Depends on |
|---|---|---|
| .NET (cli-server-dotnet) | 1 → 2 → 3 → 4 → 5 | contract only |
| Node (cli-server-node) | 6 → 7 → 8 → 9 | contract only |
| Python (cli-server-python) | 10 → 11 → 12 → 13 | contract only |
| Dashboard (cli-server-dashboard) | 14 | contract only (tests mock `/permissions`) |
| Console (web-cli `@qodalis/cli-users`) | 15 | contract only (tests mock the HTTP calls) |
| Release | 16 | all of the above |

The five tracks can start at the same time. Inside a server track the order is catalog → audience + `/permissions` → manager → enforcement (+ persistent stores).

---

## cli-server-dotnet

Branch: `git -C cli-server-dotnet switch -c feature/public-api origin/develop`. Test command for the whole project: `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj`; per task use `--filter "FullyQualifiedName~<Class>"`. `dotnet test` exits on its own; afterwards check `pgrep -f testhost` is empty.

### Task 1: .NET core permission catalog

**Files:**
- Create: `src/Qodalis.Cli/Security/CliPermissionCatalog.cs`
- Modify: `src/Qodalis.Cli/Extensions/CliBuilder.cs` (constructor and a new `AddPermissions`; the builder is created in `MvcBuilderExtensions.AddCli`, `:36`)
- Test: `tests/Qodalis.Cli.Tests/PermissionCatalogTests.cs`

**Interfaces:**
- Consumes: `CliRoutePolicy` constants (`src/Qodalis.Cli/Security/CliRoutePolicy.cs:20-30`) for the 11 core names.
- Produces (namespace `Qodalis.Cli.Security`):
  - `public static class CliPermissionSurface { public const string Cli = "cli"; public const string Host = "host"; }`
  - `public sealed record CliPermission(string Name, string Description, string Group, string Surface)` with `[property: JsonPropertyName("name"|"description"|"group"|"surface")]`.
  - `public interface ICliPermissionCatalog { IReadOnlyList<CliPermission> All { get; } CliPermission? Find(string name); }` (`Find` case-insensitive).
  - `public sealed class CliPermissionCatalogBuilder { public CliPermissionCatalogBuilder Group(string group); public CliPermissionCatalogBuilder Add(string name, string description); }` — `Add` before any `Group` call is an invalid entry.
  - `CliBuilder.AddPermissions(Action<CliPermissionCatalogBuilder> configure, string surface = CliPermissionSurface.Host) : CliBuilder`.
  - `ICliPermissionCatalog` registered as a singleton holding the builder's entries (one `CliPermissionCatalog` instance owned by `CliBuilder`, frozen when first resolved; `AddPermissions` after that throws `InvalidOperationException`).

- [ ] **Step 1: Write the failing tests** in `PermissionCatalogTests`:
  - `CoreEntries_AreRegisteredInOrder`: a `CliBuilder` over a new `ServiceCollection`; resolve `ICliPermissionCatalog`; `All.Select(p => p.Name)` equals the 11 core names of contract C2 in table order; every entry has `Surface == "cli"`; `Find("FILES:READ")!.Description == "List, read and download files"` and `.Group == "Files"`.
  - `AddPermissions_AddsHostEntries`: `AddPermissions(p => p.Group("Rates").Add("rates:read", "Official exchange rates").Add("banks:read", "Banks and their buy and sell rates"))`; the last two entries are `("rates:read", "Official exchange rates", "Rates", "host")` and `("banks:read", ..., "Rates", "host")`.
  - `AddPermissions_WithCliSurface`: `AddPermissions(p => p.Group("Things").Add("things:read", "Read things"), CliPermissionSurface.Cli)` → surface `"cli"`.
  - `[Theory] InvalidEntries_Throw` with names `"rates"`, `"rates:*"`, `"*"`, `"Rates:Read"`, `"a:b:c"`, `""` and with an empty description, a 201-character description, an empty group → `ArgumentException` with message starting `invalid permission entry: `.
  - `Duplicate_Throws`: `Add("files:read", "x")` → `InvalidOperationException("permission already registered: files:read")`; also `FILES:READ`.
  - `AddPermissions_AfterResolve_Throws`.
  - `JsonShape`: `JsonSerializer.Serialize(catalog.Find("files:read"))` equals `{"name":"files:read","description":"List, read and download files","group":"Files","surface":"cli"}`.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~PermissionCatalogTests"` — expected: build error (types missing).
- [ ] **Step 3: Implement** the types above. Name regex `^[a-z0-9_.-]+:[a-z0-9_.-]+$`, description 1-200 chars without control characters, group 1-64 chars. The `CliBuilder` constructor registers the 11 core entries of C2 with `CliPermissionSurface.Cli` and `Services.AddSingleton<ICliPermissionCatalog>(catalog)`.
- [ ] **Step 4: Run** the same filter — expected: PASS; then the whole project — expected: no regressions.
- [ ] **Step 5: Commit** `git add src/Qodalis.Cli/Security/CliPermissionCatalog.cs src/Qodalis.Cli/Extensions/CliBuilder.cs tests/Qodalis.Cli.Tests/PermissionCatalogTests.cs && git commit -m "Core: permission catalog (CliBuilder.AddPermissions, ICliPermissionCatalog) with the core permissions"`

### Task 2: .NET token audience, users-plugin catalog entries and `GET /permissions`

**Files:**
- Modify: `plugins/users/Models/ApiToken.cs` (`ApiToken`, `ApiTokenView`, `CreateApiTokenRequest`)
- Modify: `plugins/users/Stores/InMemoryApiTokenStore.cs` (keeps `Audience` through `Clone()`; nothing else)
- Modify: `plugins/users/Services/AuthService.cs` (`ToApiTokenView` `:953`, `CreateApiTokenAsync` `:971`)
- Modify: `plugins/users/Extensions/CliBuilderUsersExtensions.cs` (`AddUsers` `:28`)
- Modify: `plugins/users/Middleware/UsersAuthMiddleware.cs` (`UsersPrefixes` `:35`: add `Base + "/permissions"`)
- Create: `plugins/users/Controllers/PermissionsController.cs`
- Test: `tests/Qodalis.Cli.Tests/PermissionsEndpointTests.cs`, `tests/Qodalis.Cli.Tests/ApiTokensTests.cs`

**Interfaces:**
- Consumes: Task 1 `ICliPermissionCatalog`, `CliPermission`, `CliBuilder.AddPermissions(..., CliPermissionSurface.Cli)`.
- Produces:
  - `public static class ApiTokenAudience { public const string Cli = "cli"; public const string Host = "host"; public static bool IsValid(string? value); }` in `Models/ApiToken.cs`.
  - `ApiToken.Audience : string` (default `ApiTokenAudience.Cli`); `ApiTokenView.Audience` (`[JsonPropertyName("audience")]`, always written, declared between `LastUsedAt` and `Permissions`); `CreateApiTokenRequest.Audience : JsonElement` (raw, to tell absent / `"cli"` / `"host"` / other).
  - `AuthService.HostTokensCreatedByHostMessage = "host tokens can only be created by the host application"`, `AuthService.InvalidAudienceMessage = "audience must be cli or host"`.
  - `UsersPermissions` keeps its constants; `AddUsers` calls `builder.AddPermissions(..., CliPermissionSurface.Cli)` with the 12 users-plugin entries of C2 (groups Users, Groups, Sessions, Tokens, in table order).
  - `PermissionsController` at `api/v1/qcli/permissions`, deriving from `UsersControllerBase`.

- [ ] **Step 1: Write the failing tests.** `PermissionsEndpointTests` (use `UsersTestHost.StartAsync(configureCli: cli => cli.AddPermissions(p => p.Group("Rates").Add("rates:read", "Official exchange rates")))`):
  - `Root_GetsEveryEntryItHolds`: `GET permissions` with the root session → 200, 24 entries (23 of C2 + `rates:read`), first `commands:execute`, last `rates:read` with `surface` `"host"`; every element has exactly the keys `name, description, group, surface`.
  - `PlainUser_GetsOnlyWhatItHolds`: a user in a group with `["files:read", "rates:*"]` → names exactly `["files:read", "rates:read"]`.
  - `All_RequiresUsersRead`: that user with `?all=true` → 403 `{"error":"permission denied: users:read"}`; root with `?all=true` → 24 entries.
  - `All_InvalidValue_Returns400`: `?all=yes` → 400 `all must be true or false`.
  - `Anonymous_Returns401`.
  - `ScopedCliToken_SeesItsScope`: root creates a token with `permissions: ["files:read"]`; `GET permissions` with it → `["files:read"]`.
  In `ApiTokensTests`:
  - `Create_ReturnsAudienceCli`: the `apiToken` of a created token has `audience == "cli"`, and `GET tokens` shows it; JSON property order puts `audience` after `lastUsedAt`.
  - `[Theory] Create_AudienceCli_Accepted` for bodies with `audience` absent and `"cli"` → 201.
  - `Create_AudienceHost_Returns400`: `audience: "host"` → 400 `host tokens can only be created by the host application`.
  - `[Theory] Create_InvalidAudience_Returns400` for `"HOST "`, `"api"`, `1`, `null` → 400 `audience must be cli or host`.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~PermissionsEndpointTests|FullyQualifiedName~ApiTokensTests"` — expected: FAIL (404 on `/permissions`, no `audience`).
- [ ] **Step 3: Implement.** `PermissionsController.Get([FromQuery] string? all)` mirrors `TokensController.GetAll`'s `all` parsing (`Controllers/TokensController.cs:31-37`) and returns `JsonOk(...)` of `ICliPermissionCatalog.All`, filtered with `PermissionMatcher.HasPermission(Auth.Permissions, p.Name)` unless `all=true`. `CreateApiTokenAsync` checks `request.Audience` before the name: `Undefined` or string `"cli"` → continue; string `"host"` → 400 `HostTokensCreatedByHostMessage`; anything else → 400 `InvalidAudienceMessage`. `ToApiTokenView` copies `Audience`.
- [ ] **Step 4: Run** the same filter, then the whole project — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: token audience (cli by default), the plugin's permissions in the catalog, GET /api/v1/qcli/permissions"` with the files above.

### Task 3: .NET `IApiTokenManager`

**Files:**
- Create: `plugins/users/Services/ApiTokenManager.cs` (`IApiTokenManager`, `ApiTokenManager`, `ApiTokenCreateOptions`, `CreatedApiToken`)
- Modify: `plugins/users/Services/AuthService.cs` (`CreateApiTokenAsync` `:971-1042`, `RevokeApiTokenAsync` `:1049-1065`)
- Modify: `plugins/users/Extensions/CliBuilderUsersExtensions.cs` (`services.AddSingleton<IApiTokenManager, ApiTokenManager>()`)
- Test: `tests/Qodalis.Cli.Tests/ApiTokenManagerTests.cs`

**Interfaces:**
- Consumes: Task 1 catalog; Task 2 `ApiTokenAudience`, `ApiToken.Audience`, `ApiTokenView`.
- Produces (namespace `Qodalis.Cli.Plugin.Users.Services`): the four C7 methods on `public interface IApiTokenManager`;
  `public sealed class ApiTokenCreateOptions { public required string Name { get; init; } public int? ExpiresInDays { get; init; } public bool NeverExpires { get; init; } public IReadOnlyList<string>? Permissions { get; init; } public string Audience { get; init; } = ApiTokenAudience.Cli; public string? Actor { get; init; } }`;
  `public sealed class CreatedApiToken { public required string Token { get; init; } public required ApiTokenView ApiToken { get; init; } }` (same JSON names as `CreateApiTokenResponse`).
  Inside `AuthService`: `internal Task<(string Token, ApiToken ApiToken)> CreateApiTokenForAsync(User owner, IReadOnlyList<string> grantable, ApiTokenCreateOptions options, string actorName, string actorId)` holding rules 3-7 of C7 (the existing body of `CreateApiTokenAsync` from the name check on), and `internal Task RevokeApiTokenCoreAsync(ApiToken token, string ownerName, string actorName, string actorId)` (the existing revoke body after the lookup). `CreateApiTokenAsync(caller, request)` keeps its caller checks and its `JsonElement` parsing of `expiresInDays`, maps the request to `ApiTokenCreateOptions` (`Audience = "cli"`) and calls `CreateApiTokenForAsync(caller.User, caller.Permissions, ...)`.
  New messages on `AuthService`: `HostTokensNeedPermissionsMessage = "host tokens need permissions"`, `NotAHostPermissionMessagePrefix = "not a host permission: "`, `ExpiryConflictMessage = "expiresInDays and neverExpires cannot both be set"`; user lookups use 404 `user not found` and 403 `AccountDisabledMessage`.

- [ ] **Step 1: Write the failing tests** in `ApiTokenManagerTests` (host from `UsersTestHost.StartAsync(configureCli: cli => cli.AddPermissions(p => p.Group("Rates").Add("rates:read", "Official exchange rates").Add("banks:read", "Banks and their buy and sell rates")))`, manager from `_h.Service<IApiTokenManager>()`; user `alice` in a group with `["rates:read", "files:read"]`):
  - `CreateHost_ReturnsTokenAndView`: `CreateAsync(alice.Id, new() { Name = "site", Audience = "host", Permissions = ["rates:read"] })` → `Token` starts with `qcli_pat_`, `ApiToken.Audience == "host"`, `Permissions == ["rates:read"]`, `ExpiresAt == now + 90 days`; an audit entry `token_created` with actor `alice`; a `token:created` event.
  - `CreateHost_WithoutPermissions_Throws400`: `Permissions = null` and `[]` → `UsersApiException` 400 `host tokens need permissions`.
  - `[Theory] CreateHost_NonHostEntry_Throws400` for `"files:read"`, `"rates:*"`, `"unknown:read"` → 400 `not a host permission: <p>`.
  - `CreateHost_NotHeld_Throws403`: `banks:read` → 403 `forbidden: cannot grant banks:read`.
  - `CreateCli_AcceptsFreeFormAndUnscoped`: `Audience` default, `Permissions = null` → unscoped token; `Permissions = ["files:*"]` → 403 (alice lacks it) while `["files:read"]` → ok.
  - `Create_UnknownUser_Throws404` (`user not found`), `Create_DisabledUser_Throws403` (`account disabled`), `Create_InvalidAudience_Throws400` (`audience must be cli or host`), `Create_BothExpiries_Throws400`, `Create_NeverExpires_RequiresOption` (400 `non-expiring tokens are not allowed`).
  - `Create_SharesNameAndLimitWithHttpTokens`: a `cli` token `site` created over HTTP by alice's session, then `CreateAsync(..., Name = "SITE", Audience = "host", ...)` → 409 `token 'SITE' already exists`; 20 tokens → 400 `a user may have at most 20 tokens`.
  - `Create_ExternalAuthWithoutApiTokens_Throws501` (host started with an external adapter, `ApiTokensWithExternalAuth` false) → 501 `Authentication is managed by the host application`.
  - `List_ReturnsBothAudiences_OldestFirst`.
  - `Revoke_OwnToken_True_OtherUsersToken_False`: revoking alice's token with alice's id → true, token gone, `token_revoked` audited with actor `alice` (or the `actor` argument when given); with another user's id → false and the token stays.
  - `GrantablePermissions`: `GetGrantablePermissionsAsync(alice.Id, "host")` → `["rates:read"]`; `"cli"` → `["files:read", "rates:read"]`.
  - `CreateHost_NormalizesCase`: `Permissions = ["RATES:READ"]` → stored `["rates:read"]`.
  - `CreateHost_HeldThroughWildcard`: bob in a group with `["rates:*"]` → host token `["rates:read", "banks:read"]` created; `Permissions = ["rates:*"]` → 400 `not a host permission: rates:*`.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~ApiTokenManagerTests"` — expected: build error.
- [ ] **Step 3: Implement** `ApiTokenManager` over `AuthService`, `IUserStore` and `ICliPermissionCatalog`, applying C7's rules 0-2 and 5 itself and delegating 3, 4, 6, 7 to `CreateApiTokenForAsync` (grantable = `GetEffectivePermissionsAsync(user)`). Rule 0 reads `UsersModuleOptions.UsesExternalAuth && !ApiTokensWithExternalAuth` and `UsersApiFilter.ExternalAuthMessage`.
- [ ] **Step 4: Run** the filter, then `--filter "FullyQualifiedName~ApiTokensTests"` (HTTP behaviour unchanged), then the whole project — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: IApiTokenManager, tokens a host creates, lists and revokes for its users (host audience)"`.

### Task 4: .NET host tokens refused on CLI routes

**Files:**
- Modify: `plugins/users/Middleware/UsersAuthMiddleware.cs` (after the `auth == null` check, `:139-143`)
- Modify: `plugins/users/Services/UsersAuthBridge.cs` (`AuthenticateAsync` `:46-68`, `RevalidateAsync` `:79-85`)
- Modify: `plugins/users/Services/AuthService.cs` (message constant)
- Test: `tests/Qodalis.Cli.Tests/HostTokensTests.cs`

**Interfaces:**
- Consumes: Task 3 `IApiTokenManager.CreateAsync`; Task 2 `ApiTokenAudience`.
- Produces: `AuthService.HostTokensCannotUseCliRoutesMessage = "forbidden: host tokens cannot use CLI routes"`; `UsersAuthContext.IsHostToken => ApiToken?.Audience == ApiTokenAudience.Host` (property on `Services/UsersAuthContext.cs`).

- [ ] **Step 1: Write the failing tests** in `HostTokensTests` (host started with `ProtectServer = true`, the Rates entries of Task 3, a `TestProcessor`, a minimal API route `app.MapGet("/host/rates", () => "ok").RequireQcliAuthorization("rates:read")` and an MVC action with `[QcliAuthorize("rates:read")]` via `configureApp`/`configureMvc`; `alice` holds `rates:read` and `commands:execute`; `host` = a host token with `["rates:read"]`):
  - `HostToken_AcceptedByGuards`: `GET /host/rates` and the MVC action with the host token → 200.
  - `HostToken_GuardChecksPermission`: alice's group loses `rates:read` → guard answers 403 `permission denied: rates:read`.
  - `[Theory] HostToken_RefusedOnCliRoutes` for `POST /api/v1/qcli/execute`, `GET /api/v1/qcli/commands`, `GET /api/v1/qcli/tokens`, `GET /api/v1/qcli/permissions`, `GET /api/v1/qcli/sessions/current`, `POST /api/v1/qcli/sessions/ws-ticket`, `GET /api/v1/qcli/users`, `POST /api/qcli/mcp` → 403 `{"error":"forbidden: host tokens cannot use CLI routes"}`.
  - `HostToken_RefusedEvenWithNoPermissionsLeft`: alice loses every permission → `GET /api/v1/qcli/commands` still 403 with the host-token text (not `permission denied`).
  - `CliToken_And_Session_Unchanged`: a `cli` token and alice's session reach `GET /api/v1/qcli/commands` (200) and the guarded host route (200).
  - `Bridge_RefusesHostToken`: `ICliAuthBridge.AuthenticateAsync` on a `DefaultHttpContext` carrying the host bearer throws `CliAuthException` with status 403 and the host-token text; `RevalidateAsync` of a principal with the host token's id returns null.
  - `HostToken_GuardDoesNotConsultTheCatalog`: register (through `configureServices`) a decorator of `ICliPermissionCatalog` that counts `All`/`Find` calls; create the host token, reset the counter, call the guarded route → 200 and the counter is 0.
  - `ExternalAuthWithApiTokens_HostTokenRefusedOnCliRoutes`: a host using an external adapter with `ApiTokensWithExternalAuth = true` and `ProtectServer` → the CLI route answers 403 host-token text; the guarded host route 200.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~HostTokensTests"` — expected: FAIL (CLI routes answer 200).
- [ ] **Step 3: Implement**: middleware — `if (auth.IsHostToken) { await FailAsync(context, isShellSocket, 403, AuthService.HostTokensCannotUseCliRoutesMessage); return; }` before the `MustChangePassword` check. Bridge — the same condition throws `CliAuthException(403, ...)` in both branches of `AuthenticateAsync`; `RevalidateAsync` returns null for host tokens. `QcliAuthorization.AuthorizeAsync` does not change.
- [ ] **Step 4: Run** the filter, then the whole project — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: host tokens are refused on every CLI route and accepted only by QcliAuthorize guards"`.

### Task 5: .NET EF Core token store keeps the audience

**Files:**
- Modify: `plugins/users-efcore/ApiTokenEntity.cs` (new `Audience`)
- Modify: `plugins/users-efcore/ApiTokenStorageDbContext.cs` (`ApplyApiTokenStorageModel`: `entity.Property(e => e.Audience).HasMaxLength(16);`, nullable)
- Modify: `plugins/users-efcore/EfCoreApiTokenStore.cs` (`CreateTokenAsync`, `ToToken` `:161`, `EnsureTableAsync` `:129`)
- Test: `tests/Qodalis.Cli.Tests/EfCoreApiTokenStoreTests.cs`

**Interfaces:**
- Consumes: Task 2 `ApiToken.Audience`, `ApiTokenAudience`.
- Produces: `ApiTokenEntity.Audience : string?` (column `Audience`, `null` read as `"cli"`); `EfCoreApiTokenStore` adds the column to an existing `api_tokens` table on first use.

Schema change reaching hosts: the plugin has no migrations; it creates `api_tokens` on first use (`EnsureTableAsync`). The same first-use step now also probes the column and, when missing, runs `ALTER TABLE <api_tokens> ADD <Audience> VARCHAR(16) NULL` with both identifiers quoted by the provider's `ISqlGenerationHelper.DelimitIdentifier` (works on SQLite, PostgreSQL, SQL Server, MySQL). Existing rows keep `NULL` = `cli`. Hosts that create the table in their own migrations (`ApplyApiTokenStorageModel`) add a migration after upgrading (`dotnet ef migrations add QcliApiTokenAudience`); the probe then finds the column and does nothing.

- [ ] **Step 1: Write the failing tests:**
  - `RoundTripsTheAudience`: create a token with `Audience = "host"`, read it back by hash, id and list → `"host"`.
  - `AddsTheAudienceColumnToAnOldTable`: on the shared SQLite connection, create `api_tokens` with the beta.28 columns only (`Id, UserId, Name, TokenHash, CreatedAt, ExpiresAt, LastUsedAt, Permissions`) and insert one row; a new `EfCoreApiTokenStore` → `GetTokenAsync` returns it with `Audience == "cli"`; creating a `host` token then succeeds and reads back `"host"`; `PRAGMA table_info(api_tokens)` lists `Audience`.
  - `ProbeRunsOnce_AndToleratesAConcurrentAdd`: two stores over the old table initialised concurrently (`Task.WhenAll`) both succeed.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~EfCoreApiTokenStoreTests"` — expected: FAIL.
- [ ] **Step 3: Implement**: after the table exists, `try { _ = await db.Tokens.Select(t => t.Audience).AnyAsync(ct); } catch (DbException) { try { ALTER ... } catch (DbException) { re-probe; rethrow when still missing } }`.
- [ ] **Step 4: Run** the filter, then the whole project — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users.EfCore: api_tokens.Audience, added to existing tables on first use"`.

---

## cli-server-node

Branch: `git -C cli-server-node switch -c feature/public-api origin/develop`. Tests: `npx vitest run <file>` from the repo root (vitest exits by itself; `vitest.config.ts` aliases the workspace packages to their sources). Full run: `npm test`; type check: `npm run build`.

Packaging constraint: `@qodalis/cli-server-plugin-users` must not gain a runtime dependency on code that first ships in beta.29 (plugin CI installs internal packages from the registry, and internal ranges stay as they are). So the catalog class lives in core (`src/`), and the users plugin talks to it through a structural interface handed over by `attachToServer`, the way it already receives the event bus.

### Task 6: Node core permission catalog

**Files:**
- Create: `src/permissions/cli-permission-catalog.ts`
- Modify: `src/extensions/cli-builder.ts` (`CliBuilder`, `:24-45`)
- Modify: `src/create-cli-server.ts` (`setAuth` `:375-386`: pass the catalog to `attachToServer`)
- Modify: `src/auth/cli-server-auth.ts` (`ICliServerAuth.attachToServer` parameter `:67`)
- Modify: `src/index.ts` (export the new names)
- Test: `src/__tests__/permission-catalog.test.ts`

**Interfaces:**
- Produces (exported from `@qodalis/cli-server-node`):
  - `export type CliPermissionSurface = 'cli' | 'host';`
  - `export interface CliPermission { name: string; description: string; group: string; surface: CliPermissionSurface; }`
  - `export type CliPermissionInput = Omit<CliPermission, 'surface'>;`
  - `export class CliPermissionCatalog { add(entries: readonly CliPermissionInput[], surface: CliPermissionSurface): void; all(): CliPermission[]; find(name: string): CliPermission | undefined; }` (constructor seeds nothing; `find` case-insensitive; `all()` returns copies in registration order).
  - `export const CORE_PERMISSIONS: readonly CliPermissionInput[]` — the 11 core rows of C2.
  - `CliBuilder.permissions: CliPermissionCatalog` (readonly, seeded with `CORE_PERMISSIONS` as `'cli'` in the constructor) and `CliBuilder.addPermissions(entries: readonly CliPermissionInput[], surface: CliPermissionSurface = 'host'): CliBuilder`.
  - `attachToServer` argument gains `permissions?: CliPermissionCatalog`; `setAuth` passes `builder.permissions`.
- Errors: `add` throws `Error('invalid permission entry: <name>')` / `Error('permission already registered: <name>')` (C1 rules).

- [ ] **Step 1: Write the failing tests** in `permission-catalog.test.ts`:
  - `seeds the core permissions`: `createCliServer({}).builder.permissions.all().map(p => p.name)` equals the 11 core names of C2 in order, all `surface: 'cli'`; `find('FILES:READ')` → description `List, read and download files`, group `Files`.
  - `addPermissions adds host entries`: `builder.addPermissions([{ name: 'rates:read', description: 'Official exchange rates', group: 'Rates' }])` → last entry `{ name: 'rates:read', description: 'Official exchange rates', group: 'Rates', surface: 'host' }`; with second argument `'cli'` → `surface: 'cli'`.
  - `rejects invalid entries` for names `rates`, `rates:*`, `*`, `Rates:Read`, `a:b:c`, `''`, empty description, 201-char description, empty group → throws `invalid permission entry: ...`.
  - `rejects duplicates`: `files:read` and `FILES:READ` → throws `permission already registered: files:read` / `...: FILES:READ`.
  - `hands the catalog to the auth provider`: a fake `ICliServerAuth` whose `attachToServer` records its argument → `arg.permissions === builder.permissions`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/permission-catalog.test.ts` — expected: FAIL (module not found).
- [ ] **Step 3: Implement** the catalog and builder members above (name regex `^[a-z0-9_.-]+:[a-z0-9_.-]+$`, description 1-200 chars, group 1-64 chars).
- [ ] **Step 4: Run** the test file, then `npm test` and `npm run build` — expected: PASS, no type errors.
- [ ] **Step 5: Commit** `git commit -m "Core: permission catalog (builder.addPermissions, builder.permissions) with the core permissions"`.

### Task 7: Node token audience, users-plugin entries and `GET /permissions`

**Files:**
- Modify: `plugins/users/models.ts` (`ApiToken` `:118`, `ApiTokenView` `:134`; new `ApiTokenAudience`, `UsersPermissionCatalog`, `CliPermission`)
- Modify: `plugins/users/permissions.ts` (new `USERS_PERMISSION_ENTRIES`)
- Modify: `plugins/users/services/auth-service.ts` (`toApiTokenView` `:631`, `createApiToken` `:653`)
- Modify: `plugins/users/stores/in-memory-api-token-store.ts` (copies keep `audience`)
- Create: `plugins/users/controllers/permissions-controller.ts`
- Modify: `plugins/users/cli-users-builder.ts` (`build()` `:285-430`: own catalog fallback, `/permissions` route in `scoped` and mounted with `authMiddleware`, attach hook)
- Modify: `plugins/users/server-auth.ts` (`OWN_ROUTES` `:39`: add `permissions`; `UsersServerAttachment` gains `permissions?`)
- Test: `src/__tests__/users-permissions-endpoint.test.ts`, `src/__tests__/api-tokens.test.ts`

**Interfaces:**
- Consumes: Task 6 `CliPermissionCatalog` (structurally), C1-C5.
- Produces (exported from `plugins/users/index.ts`):
  - `export type ApiTokenAudience = 'cli' | 'host';` `ApiToken.audience?: ApiTokenAudience` (absent = `'cli'`), `ApiTokenView.audience: ApiTokenAudience` (always set; key order `..., lastUsedAt, audience, permissions?`).
  - `export interface CliPermission { name: string; description: string; group: string; surface: 'cli' | 'host'; }` and `export interface UsersPermissionCatalog { add(entries: readonly Omit<CliPermission, 'surface'>[], surface: 'cli' | 'host'): void; all(): CliPermission[]; find(name: string): CliPermission | undefined; }` (structurally satisfied by core's `CliPermissionCatalog`).
  - `export const USERS_PERMISSION_ENTRIES: readonly Omit<CliPermission, 'surface'>[]` — the 12 users-plugin rows of C2.
  - `AuthService.setPermissionCatalog(catalog: UsersPermissionCatalog): void` and `AuthService.permissionCatalog(): UsersPermissionCatalog`. `build()` starts with a minimal local catalog holding `USERS_PERMISSION_ENTRIES` (a small class in `permissions.ts`, same rules as core's); `attachToServer` with `permissions` adds `USERS_PERMISSION_ENTRIES` as `'cli'` to the server's catalog (unless `find('users:read')` already exists) and switches the service to it.
  - `createPermissionsController(authService: AuthService): Router`.
- Texts: `HOST_TOKENS_CREATED_BY_HOST = 'host tokens can only be created by the host application'`, `INVALID_AUDIENCE = 'audience must be cli or host'` exported from `auth-service.ts`.

- [ ] **Step 1: Write the failing tests.** `users-permissions-endpoint.test.ts`, using a real server (`createCliServer({})`, `builder.addPermissions([{ name: 'rates:read', description: 'Official exchange rates', group: 'Rates' }])`, `mountPlugin(plugin)`, `await plugin.ready`), with the same cases as .NET Task 2's `PermissionsEndpointTests`: root gets 24 entries (first `commands:execute`, last `rates:read` with `surface: 'host'`, keys exactly `name, description, group, surface`); a user with `['files:read', 'rates:*']` gets `['files:read', 'rates:read']`; `?all=true` without `users:read` → 403 `{ error: 'permission denied: users:read' }`, with root → 24; `?all=yes` → 400 `all must be true or false`; anonymous → 401; a token scoped to `['files:read']` → `['files:read']`. Plus `standalone plugin router serves its own entries`: `createTestServer()` (router mounted without a core server) → root gets the 12 users-plugin entries.
  In `api-tokens.test.ts` (`describe('API tokens: audience')`): created and listed views carry `audience: 'cli'` right after `lastUsedAt` (`Object.keys(view)`); body `audience` absent or `'cli'` → 201; `'host'` → 400 `host tokens can only be created by the host application`; `'HOST '`, `'api'`, `1`, `null` → 400 `audience must be cli or host`.
  Plus `a store returning a token without audience behaves as cli`: a custom `apiTokenStore` wrapping the in-memory one and deleting `audience` from results → the token's view says `audience: 'cli'` and `GET /api/v1/qcli/commands` with it answers 200.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/users-permissions-endpoint.test.ts src/__tests__/api-tokens.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.** The controller copies the `all` parsing of `tokens-controller.ts:23-28` and filters with `hasPermission(auth.permissions, p.name)`. `createApiToken` checks `'audience' in body` before the name: absent or `'cli'` → continue; `'host'` → 400; otherwise 400 invalid audience.
- [ ] **Step 4: Run** the two files, then `npm test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: token audience (cli by default), the plugin's permissions in the catalog, GET /api/v1/qcli/permissions"`.

### Task 8: Node `ApiTokenManager` (`usersPlugin.apiTokens`)

**Files:**
- Create: `plugins/users/services/api-token-manager.ts`
- Modify: `plugins/users/services/auth-service.ts` (`createApiToken` `:653`, `revokeApiToken` `:735`)
- Modify: `plugins/users/cli-users-builder.ts` (`UsersPluginResult` `:40-72` gains `apiTokens: ApiTokenManager`; `build()` creates it)
- Modify: `plugins/users/index.ts` (exports)
- Test: `src/__tests__/api-token-manager.test.ts`

**Interfaces:**
- Consumes: Task 7 `ApiTokenAudience`, `UsersPermissionCatalog`, `AuthService.permissionCatalog()`.
- Produces: `export class ApiTokenManager` with the four C7 methods; `export interface ApiTokenCreateOptions { name: string; expiresInDays?: number; neverExpires?: boolean; permissions?: string[] | null; audience?: ApiTokenAudience; actor?: string; }`; `export interface CreatedApiToken { token: string; apiToken: ApiTokenView; }` (same as `CreateApiTokenResult`). Errors are the plugin's `HttpError` (`status`, `message`).
  Inside `AuthService`: `createApiTokenFor(owner: CliUser, grantable: string[], options: ApiTokenCreateOptions, actor: { name: string; id: string }): Promise<{ token: string; apiToken: ApiToken }>` (rules 3, 4, 6, 7 of C7; the existing body from the name check on) and `revokeApiTokenCore(token: ApiToken, ownerName: string, actor: { name: string; id: string }): Promise<void>`. `createApiToken(ctx, body)` keeps its caller checks and body parsing and calls `createApiTokenFor(ctx.user, ctx.permissions, {..., audience: 'cli'}, ...)`. Messages `HOST_TOKENS_NEED_PERMISSIONS = 'host tokens need permissions'`, `NOT_A_HOST_PERMISSION = 'not a host permission: '`, `EXPIRY_CONFLICT = 'expiresInDays and neverExpires cannot both be set'`.

- [ ] **Step 1: Write the failing tests** in `api-token-manager.test.ts`: the same cases as .NET Task 3's `ApiTokenManagerTests`, through `plugin.apiTokens` on a `createCliServer` with the Rates entries (`rates:read`, `banks:read`) and the plugin mounted; errors asserted as `await expect(...).rejects.toMatchObject({ status: 400, message: 'host tokens need permissions' })`. The external-auth case uses `setOptions({ authAdapter })` without `apiTokensWithExternalAuth` → `{ status: 501, message: 'Authentication is managed by the host application' }`. Audit asserted through `plugin.auditStore`, events through a spy bus passed to `build(bus)`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/api-token-manager.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** `ApiTokenManager(authService, userStore)` with C7 rules 0-2 and 5; rule 0 reads the plugin's `externalAuth` and `apiTokensWithExternalAuth` flags (passed to the constructor by `build()`).
- [ ] **Step 4: Run** the file, `npx vitest run src/__tests__/api-tokens.test.ts`, then `npm test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: usersPlugin.apiTokens, tokens a host creates, lists and revokes for its users (host audience)"`.

### Task 9: Node host tokens refused on CLI routes

**Files:**
- Modify: `plugins/users/middleware/auth-middleware.ts` (`createAuthMiddleware` `:130-139`)
- Modify: `plugins/users/server-auth.ts` (`authenticateRequest` `:73`, `consumeTicket` `:87`, `revalidate` `:110`, `authenticateToken` `:192`; guards `:203-235` unchanged)
- Test: `src/__tests__/users-host-tokens.test.ts`

**Interfaces:**
- Consumes: Task 8 `plugin.apiTokens.create`.
- Produces: `export const HOST_TOKENS_CANNOT_USE_CLI_ROUTES = 'forbidden: host tokens cannot use CLI routes'` (in `auth-service.ts`); `export function isHostToken(ctx: AuthContext): boolean` (`ctx.apiToken?.audience === 'host'`).

- [ ] **Step 1: Write the failing tests** in `users-host-tokens.test.ts`: the cases of .NET Task 4's `HostTokensTests` on a `createCliServer` with the users plugin mounted (`protectServer` default true), MCP enabled (`mcp: true`), an echo processor, and host routes `app.get('/host/rates', plugin.requirePermission('rates:read'), ...)` and `app.get('/host/me', plugin.requireAuth(), ...)`. CLI routes probed: `POST /api/v1/qcli/execute`, `GET /api/v1/qcli/commands`, `GET /api/v1/qcli/tokens`, `GET /api/v1/qcli/permissions`, `GET /api/v1/qcli/sessions/current`, `POST /api/v1/qcli/sessions/ws-ticket`, `GET /api/v1/qcli/users`, `POST /api/qcli/mcp` → 403 `{ error: 'forbidden: host tokens cannot use CLI routes' }`. The guard with the permission removed keeps its existing text `forbidden: missing permission rates:read`. Also: `plugin.serverAuth.authenticateToken(hostToken)` (admin dashboard provider) rejects with status 403 and the host-token text; `revalidate({ userId, tokenId: hostTokenId, permissions: [] })` resolves `undefined`; the external-adapter + `apiTokensWithExternalAuth` variant refuses the CLI route and admits the host route.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/users-host-tokens.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement**: `createAuthMiddleware` and `UsersServerAuth.authenticateRequest`/`authenticateToken` throw `forbidden(HOST_TOKENS_CANNOT_USE_CLI_ROUTES)` when `isHostToken(ctx)`, checked before `mustChangePassword`; `consumeTicket`/`revalidate` return `undefined` for host tokens; `guard()` keeps calling `authenticateFull` (accepts host tokens).
- [ ] **Step 4: Run** the file, then `npm test` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: host tokens are refused on every CLI route and accepted only by requireAuth/requirePermission"`.

---

## cli-server-python

Branch: `git -C cli-server-python switch -c feature/public-api origin/develop`. Tests from the repo root: `python -m pytest tests/<file> -q` (FastAPI `TestClient`, `asyncio_mode = "auto"`; pytest exits by itself). Full run: `python -m pytest -q`.

Packaging constraint as for Node: `qodalis-cli-server-plugin-users` depends only on the audit plugin and FastAPI, and must not import core code that first ships in 1.0.0b29. The catalog lives in core (`qodalis_cli`); the plugin reaches it in `on_mount(server)` through `getattr(server.builder, "permissions", None)` and a structural `Protocol`.

Python-specific finding: `ServerProtectionMiddleware._protected` (`server_protection.py:122`) protects **every** `/api/` and `/ws/` path, host routes included, unlike .NET and Node (CLI prefixes only). The host-token refusal therefore must test for a CLI path itself, or a host's guarded `/api/...` route would refuse its own tokens.

### Task 10: Python core permission catalog

**Files:**
- Create: `src/qodalis_cli/permissions/__init__.py`, `src/qodalis_cli/permissions/catalog.py`
- Modify: `src/qodalis_cli/extensions/cli_builder.py` (`CliBuilder.__init__` `:40`, new `add_permissions` and `permissions`)
- Modify: `src/qodalis_cli/__init__.py` (exports)
- Test: `tests/test_permission_catalog.py`

**Interfaces:**
- Produces (exported from `qodalis_cli`):
  - `CliPermissionSurface = Literal["cli", "host"]`
  - `@dataclass(frozen=True) class CliPermission: name: str; description: str; group: str; surface: CliPermissionSurface = "host"` with `def to_dict(self) -> dict[str, str]` → `{"name", "description", "group", "surface"}` in that key order.
  - `class CliPermissionCatalog: def add(self, entries: Iterable[CliPermission | Mapping[str, str]], surface: CliPermissionSurface) -> None; def all(self) -> list[CliPermission]; def find(self, name: str) -> CliPermission | None` (case-insensitive; the `surface` argument overrides the entry's).
  - `CORE_PERMISSIONS: tuple[CliPermission, ...]` — the 11 core rows of C2 with `surface="cli"`.
  - `CliBuilder.permissions -> CliPermissionCatalog` (property; seeded with `CORE_PERMISSIONS`), `CliBuilder.add_permissions(entries, *, surface: CliPermissionSurface = "host") -> CliBuilder`.
- Errors: `ValueError("invalid permission entry: <name>")`, `ValueError("permission already registered: <name>")`.

- [ ] **Step 1: Write the failing tests** in `test_permission_catalog.py`, the same cases as Node Task 6 (core seed and order, host entries via `create_cli_server(CliServerOptions(configure=lambda b: b.add_permissions([CliPermission(name="rates:read", description="Official exchange rates", group="Rates")])))` and via a plain dict, `surface="cli"`, invalid entries, duplicates) plus `test_to_dict_shape`: `CORE_PERMISSIONS[2].to_dict() == {"name": "files:read", "description": "List, read and download files", "group": "Files", "surface": "cli"}`.
- [ ] **Step 2: Run** `python -m pytest tests/test_permission_catalog.py -q` — expected: FAIL (ImportError).
- [ ] **Step 3: Implement** with the C1 rules (regex `^[a-z0-9_.-]+:[a-z0-9_.-]+$`, description 1-200 chars, group 1-64 chars).
- [ ] **Step 4: Run** the file, then `python -m pytest -q` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Core: permission catalog (builder.add_permissions, builder.permissions) with the core permissions"`.

### Task 11: Python token audience, users-plugin entries and `GET /permissions`

**Files:**
- Modify: `plugins/users/qodalis_cli_users/models.py` (`ApiToken` `:150`, `to_view`, `CreateApiTokenRequest` `:259`)
- Modify: `plugins/users/qodalis_cli_users/permissions.py` (new `USERS_PERMISSION_ENTRIES`, local fallback catalog, `PermissionCatalog` Protocol)
- Modify: `plugins/users/qodalis_cli_users/controllers/tokens_controller.py` (`create_token` `:164`)
- Create: `plugins/users/qodalis_cli_users/controllers/permissions_controller.py`
- Modify: `plugins/users/qodalis_cli_users/cli_users_builder.py` (`build()` `:522-615` includes the router; `on_mount` `:173` adopts the server catalog)
- Modify: `plugins/users/qodalis_cli_users/server_protection.py` (`SELF_PROTECTED` `:43`: add `permissions`)
- Modify: `plugins/users/qodalis_cli_users/stores/in_memory_api_token_store.py` (copies keep `audience`)
- Test: `tests/test_users_permissions_endpoint.py`, `tests/test_api_tokens.py`

**Interfaces:**
- Consumes: Task 10 catalog (structurally), C1-C5.
- Produces:
  - `ApiToken.audience: str = "cli"`; `to_view` writes `"audience"` after `"lastUsedAt"`; `CreateApiTokenRequest.audience: Any = None` (absent vs. present told apart by `model_fields_set`).
  - `API_TOKEN_AUDIENCES = ("cli", "host")`, `HOST_TOKENS_CREATED_BY_HOST = "host tokens can only be created by the host application"`, `INVALID_AUDIENCE = "audience must be cli or host"` in `tokens_controller.py`.
  - `class PermissionCatalog(Protocol)` with `add`, `all`, `find` as Task 10; `USERS_PERMISSION_ENTRIES: tuple[dict[str, str], ...]` (the 12 users-plugin rows of C2); `AuthService.permission_catalog` attribute (local fallback catalog with those entries until `on_mount` adopts `server.builder.permissions`, adding the 12 entries as `"cli"` unless `find("users:read")` exists).
  - `create_permissions_router(auth_service: AuthService, get_auth: Callable) -> APIRouter` (prefix `/permissions`).

- [ ] **Step 1: Write the failing tests:** `test_users_permissions_endpoint.py` with the cases of Node Task 7 (server via `create_cli_server` with the `rates:read` host entry and the users plugin mounted; standalone case: a FastAPI app including only `plugin.router` → the 12 users entries). In `test_api_tokens.py`: audience on created/listed views (key order via `list(view)`), body `audience` absent/`"cli"` → 201, `"host"` → 400 host-created text, `"HOST "`, `"api"`, `1`, `None` → 400 `audience must be cli or host`.
  Plus `test_store_without_audience_behaves_as_cli`: a store subclass returning `ApiToken` objects built without `audience` (default) and a dict-backed store that drops the key → view `"audience": "cli"`, CLI route 200.
- [ ] **Step 2: Run** `python -m pytest tests/test_users_permissions_endpoint.py tests/test_api_tokens.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**: the router mirrors `list_tokens`'s `all` parsing (`tokens_controller.py:153-158`) and filters with `ctx.can(p.name)`; it answers `[p.to_dict() for p in ...]` (for the fallback catalog, entries expose the same `to_dict`). 403 text `permission denied: users:read`.
- [ ] **Step 4: Run** the two files, then `python -m pytest -q` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: token audience (cli by default), the plugin's permissions in the catalog, GET /api/v1/qcli/permissions"`.

### Task 12: Python `ApiTokenManager` (`users_plugin.api_tokens`)

**Files:**
- Create: `plugins/users/qodalis_cli_users/services/api_token_manager.py`
- Modify: `plugins/users/qodalis_cli_users/controllers/tokens_controller.py` (`create_api_token` `:103`, `revoke_api_token` `:80`, `scope_permissions` `:56`)
- Modify: `plugins/users/qodalis_cli_users/controllers/link_controller.py` and `services/link_service.py` (callers of `create_api_token`/`revoke_api_token`, new signatures)
- Modify: `plugins/users/qodalis_cli_users/cli_users_builder.py` (`CliUsersPlugin.api_tokens: ApiTokenManager`)
- Modify: `plugins/users/qodalis_cli_users/__init__.py` (exports)
- Test: `tests/test_api_token_manager.py`

**Interfaces:**
- Consumes: Task 11 audience, `AuthService.permission_catalog`.
- Produces: `class ApiTokenManager` with the four async C7 methods; `@dataclass class ApiTokenCreateOptions: name: str; expires_in_days: int | None = None; never_expires: bool = False; permissions: list[str] | None = None; audience: str = "cli"; actor: str | None = None`; `@dataclass class CreatedApiToken: token: str; api_token: dict[str, Any]` with `to_dict()` → `{"token", "apiToken"}`. Errors: `UsersApiError(status, message)`.
  `create_api_token(auth_service, owner: User, actor: tuple[str, str], name, permissions, expires_at, audience="cli")` and `revoke_api_token(auth_service, actor: tuple[str, str], record)` replace the `ctx` parameter with the owner and an `(actor_name, actor_id)` pair; `scope_permissions(granted: list[str], raw)` takes the grantable list instead of `ctx`. Messages `HOST_TOKENS_NEED_PERMISSIONS`, `NOT_A_HOST_PERMISSION = "not a host permission: "`, `EXPIRY_CONFLICT` with the C7 texts.

- [ ] **Step 1: Write the failing tests** in `test_api_token_manager.py`: the cases of .NET Task 3 through `plugin.api_tokens` (`pytest.raises(UsersApiError)` asserting `.status_code` and `.message`); the external-auth case with `set_auth_adapter(...)` and no `set_allow_api_tokens()` → 501.
- [ ] **Step 2: Run** `python -m pytest tests/test_api_token_manager.py -q` — expected: FAIL.
- [ ] **Step 3: Implement** the manager over `AuthService` (C7 rules 0-2 and 5 in the manager; 3, 4, 6, 7 through the refactored helpers; rule 0 reads `auth_service.external_auth and not auth_service.options.api_tokens_with_external_auth`).
- [ ] **Step 4: Run** the file, `python -m pytest tests/test_api_tokens.py tests/test_server_link.py -q`, then `python -m pytest -q` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: users_plugin.api_tokens, tokens a host creates, lists and revokes for its users (host audience)"`.

### Task 13: Python host tokens refused on CLI routes

**Files:**
- Modify: `plugins/users/qodalis_cli_users/middleware/auth_middleware.py` (`create_auth_dependencies` `:41`: new `get_cli_auth`)
- Modify: `plugins/users/qodalis_cli_users/cli_users_builder.py` (`build()`: controllers get `get_cli_auth`; `plugin.require_auth`/`require_permission` stay on `get_auth`; `authorize_audit` `:243` uses the CLI variant)
- Modify: `plugins/users/qodalis_cli_users/server_protection.py` (`_http` `:137`, `_websocket` `:165`; new `is_cli_path`)
- Modify: `plugins/users/qodalis_cli_users/shell_access.py` (host-token contexts refused)
- Modify: `plugins/users/qodalis_cli_users/services/auth_service.py` (`consume_ticket`, `is_context_active` return falsy for host tokens)
- Test: `tests/test_users_host_tokens.py`

**Interfaces:**
- Consumes: Task 12 `plugin.api_tokens.create`.
- Produces: `HOST_TOKENS_CANNOT_USE_CLI_ROUTES = "forbidden: host tokens cannot use CLI routes"` and `AuthContext.is_host_token -> bool` (property) in `services/auth_service.py`; `create_auth_dependencies` returns `(get_auth, require_permission, get_auth_pending, get_cli_auth)` (callers updated); `is_cli_path(path: str, base_paths: list[str]) -> bool` = `^/(api|ws)/(v\d+/)?(qcli|cli)(/|$)` or under a base path.

- [ ] **Step 1: Write the failing tests** in `test_users_host_tokens.py`: the cases of .NET Task 4 with a FastAPI host route `@app.get("/api/host/rates", dependencies=[Depends(plugin.require_permission("rates:read"))])` (under `/api/` on purpose, see the finding above) and `/host/me` with `Depends(plugin.require_auth)`; CLI routes as listed in Node Task 9 → 403 `{"error": "forbidden: host tokens cannot use CLI routes"}`; the guard without the permission keeps `missing permission: rates:read`; the shell socket with a ticket cannot be reached (ticket issuance 403); the external-adapter + `set_allow_api_tokens()` variant.
- [ ] **Step 2: Run** `python -m pytest tests/test_users_host_tokens.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**: `get_cli_auth` = `get_auth` + `if ctx.is_host_token: raise forbidden(HOST_TOKENS_CANNOT_USE_CLI_ROUTES)` (before the password-change gate); the `get_auth_pending` handed to the sessions and users routers gets the same check (it serves `/sessions/current` and the password change); server protection refuses host tokens only when `is_cli_path(path, self.base_paths)`, otherwise it sets the scope auth and lets the host route's guard decide.
- [ ] **Step 4: Run** the file, then `python -m pytest -q` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: host tokens are refused on every CLI route and accepted only by require_auth/require_permission"`.

---

## cli-server-dashboard

Branch: `git -C cli-server-dashboard switch -c feature/public-api origin/develop`. Tests: `npx vitest run src/pages/tokens` (jsdom; exits by itself), then `npm test`, `npm run lint`, `npm run build`.

### Task 14: Dashboard permission picker and chip tooltips

**Files:**
- Create: `src/api/permissions.ts`
- Modify: `src/api/tokens.ts` (`ApiTokenView.audience`)
- Create: `src/pages/tokens/PermissionPicker.tsx`
- Modify: `src/pages/tokens/NewTokenModal.tsx` (permissions block `:156-170`, state, `reset`, `submit`)
- Modify: `src/pages/tokens/tokenInfo.ts` (selection helpers)
- Modify: `src/pages/tokens/TokensPage.tsx` (permissions column `:113-118`: `title` on chips; fetch the catalog once)
- Modify: `src/i18n/messages/tokens.ts` (new keys in all 10 locales: en, es, fr, de, pt, it, ja, ko, zh, ru)
- Test: `src/pages/tokens/NewTokenModal.test.tsx` (new), `src/pages/tokens/TokensPage.test.tsx`, `src/pages/tokens/tokenInfo.test.ts`

**Interfaces:**
- Consumes: contract C1, C4, C5 (`GET /api/v1/qcli/permissions` → `CliPermission[]`; `audience` on token views).
- Produces:
  - `src/api/permissions.ts`: `export interface CliPermission { name: string; description: string; group: string; surface: 'cli' | 'host'; }` and `export function getPermissions(all = false): Promise<CliPermission[]>`.
  - `ApiTokenView.audience?: 'cli' | 'host'` (optional: older servers omit it).
  - `tokenInfo.ts`: `export function groupPermissions(entries: CliPermission[]): { group: string; entries: CliPermission[] }[]` (groups in first-seen order) and `export function selectedPermissions(checked: ReadonlySet<string>, other: string): string[]` (checked names in catalog order, then `parsePermissions(other)` entries not already present, case-insensitive de-duplication).
  - `PermissionPicker` props: `{ entries: CliPermission[]; checked: ReadonlySet<string>; onToggle: (name: string) => void; other: string; onOtherChange: (value: string) => void; }`.
  - i18n keys (`tokens.`): `scopeLabel` "Permissions", `scopeAll` "Everything I can do", `scopeAllHint` "The token always has all of your current permissions.", `scopeSelected` "Selected", `otherPermissions` "Other permissions", `otherHint` "Permissions not in the list, separated by commas or spaces (e.g. a command's own permission).", `catalogUnavailable` "This server does not list its permissions; type them below.", `noneSelected` "Select at least one permission, or choose Everything I can do.", `hostToken` "Host" (badge for `audience: 'host'` rows), `hostTokenHint` "Created by the host application; works only on its own API." Translate the 10 entries per locale like the existing keys; `permissionsOptional` and `permissionsHint` are removed.

Behaviour: the form opens with "Everything I can do" checked (radio group `scopeLabel`); "Selected" reveals `PermissionPicker` (catalog fetched on first switch, `getPermissions()`; while loading show `common.loading`; on any error show `catalogUnavailable` and only the other field). Each group renders a heading (`group`) and checkboxes labelled by `name` (monospace) with `description` beneath. Submit sends `permissions` only in Selected mode (`selectedPermissions(...)`), and is disabled while Selected yields an empty list (message `noneSelected`). Server descriptions and group names are shown as the server sends them (not translated). In the table, each chip gets `title={description}` when the catalog (fetched once with `getPermissions()`, errors ignored) knows the name; a token with `audience === 'host'` shows a `Badge` `hostToken` with `title={t('tokens.hostTokenHint')}` next to its name.

- [ ] **Step 1: Write the failing tests.**
  - `tokenInfo.test.ts`: `groupPermissions` keeps first-seen group order and entry order; `selectedPermissions(new Set(['files:read']), 'deploy:run, FILES:READ files:read')` → `['files:read', 'deploy:run']`.
  - `NewTokenModal.test.tsx` (fetch stubbed: `GET /api/v1/qcli/permissions` → the C2 entries for `files:*`, `jobs:read` plus `{ name: 'rates:read', description: 'Official exchange rates', group: 'Rates', surface: 'host' }`; `POST /api/v1/qcli/tokens` records its body):
    - `creates an unscoped token by default`: name `ci`, Create → body `{ name: 'ci', expiresInDays: 90 }` (no `permissions` key).
    - `creates a token with the selected permissions`: choose Selected, groups "Files", "Jobs", "Rates" rendered as headings, description "Official exchange rates" visible; check `files:read` and `rates:read`, other `deploy:run` → body `permissions: ['files:read', 'rates:read', 'deploy:run']`.
    - `picking equals typing`: the body from checking `files:read` + `jobs:read` equals the body from typing `files:read jobs:read` in the other field.
    - `Selected with nothing chosen disables Create` and shows `noneSelected`.
    - `falls back to the other field when /permissions fails`: `/permissions` → 404 → `catalogUnavailable` shown, other field works.
  - `TokensPage.test.tsx`: the chip `commands:execute` has `title` "Run commands on the server" when `/permissions` returns that entry; no `title` when it answers 404; a row with `audience: 'host'` shows the Host badge.
  - Locale completeness: the existing i18n test (or a new assertion in `NewTokenModal.test.tsx`) checks every new key exists in all 10 locales.
- [ ] **Step 2: Run** `npx vitest run src/pages/tokens` — expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** `npx vitest run src/pages/tokens`, `npm test`, `npm run lint`, `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Tokens: pick a new token's permissions from the server's list (Everything I can do or Selected, grouped, with descriptions and other permissions), descriptions on the chips, host tokens marked"`.

---

## web-cli (`@qodalis/cli-users`)

Branch: `feature/public-api` (exists; it holds the spec and this plan). Tests: `npx nx test users` (Jasmine, Karma ChromeHeadless, `watch: false`), then `pkill -f "karma|ChromeHeadless"` and check `ps aux | grep -E "karma|ChromeHeadless" | grep -v grep` is empty. Lint: `npx nx lint users`; build: `npx nx build users`.

Naming note: web-cli already has a *client-side* permission registry (`ICliPermissionRegistry`, `CliPermissionDefinition` in `packages/core/src/lib/interfaces/authorization.ts`, filled from `ICliModule.permissions`). The server catalog is a different list, so its console type is named `CliServerPermission` to avoid confusion; nothing in core changes.

### Task 15: Console `token create --select` and `token permissions`

**Files:**
- Modify: `packages/plugins/users/src/lib/backend/users-backend.ts` (`CliApiToken` `:96` gains `audience?`; new `CliServerPermission`; `ICliUsersBackend` `:61` gains `listPermissions?`)
- Modify: `packages/plugins/users/src/lib/backend/http-users-backend.ts` (`:181-191`: `listPermissions`)
- Modify: `packages/plugins/users/src/lib/services/cli-users-services.ts` (`CliApiTokensService` `:384-415`: `permissions(options)`)
- Modify: `packages/plugins/users/src/lib/processors/cli-token-command-processor.ts` (create `:43-98`, new `CliTokenPermissionsCommandProcessor`, parent usage `:168-174`, `tokenRow` `:180`)
- Test: `packages/plugins/users/src/tests/token-commands.spec.ts`

**Interfaces:**
- Consumes: contract C1, C4, C5.
- Produces:
  - `export interface CliServerPermission { name: string; description: string; group: string; surface: 'cli' | 'host'; }`
  - `ICliUsersBackend.listPermissions?(token: string, options?: { all?: boolean }): Promise<CliServerPermission[]>` → `GET /permissions` (`?all=true`).
  - `CliApiTokensService.permissions(options?: { all?: boolean }): Promise<CliServerPermission[]>`; when the backend lacks `listPermissions` → `CliUsersError(501, API_TOKENS_LOCAL_MESSAGE)` like the other methods. A 404 from an older server becomes `CliUsersError(404, 'this server does not list its permissions (needs server 1.0.0-beta.29 or later)')`.
  - `CliApiToken.audience?: 'cli' | 'host'`.

Behaviour:
- `token create <name> --select`: fetches `permissions()`, opens `context.reader.readMultiSelect('Permissions for <name>:', options, { searchable: true })` with one option per entry: `{ label: name, value: name, description, group }` (the reader already renders `group` headers and descriptions). `null` (Esc/Ctrl+C) → `writeInfo('Cancelled')`, nothing created. `[]` → `writeInfo('No permissions selected; token not created')`, nothing created. Otherwise sends `permissions` in the order chosen entries appear in the list. `--select` with `--permissions` → `CliUsersError(400, 'use --select or --permissions, not both')`. An empty catalog → `CliUsersError(400, 'the server lists no permissions you hold; use --permissions')`.
- `token permissions [--all]`: `writeTable(['GROUP', 'PERMISSION', 'DESCRIPTION'], ...)` rows in server order; host entries get ` (host)` after the name; empty → `writeInfo('No permissions')`. `--all` / `-a` → `?all=true`.
- Parent usage gains `['token create <name> --select', 'Pick the permissions from a list']` and `['token permissions [--all]', 'Permissions you can put on a token (--all: every one, requires users:read)']`; create usage gains `['token create <name> --select', 'Pick the token's permissions from the server's list']`; the create parameters gain `{ name: 'select', description: "Pick the permissions from the server's list", type: 'boolean', required: false }`.
- `token list` shows host tokens with SCOPE suffixed ` (host)`.

- [ ] **Step 1: Write the failing tests** in `token-commands.spec.ts`. Extend `fakeServer()` with `GET /permissions` (returns `files:read`, `files:write` in group Files, `jobs:read` in Jobs, `rates:read` host entry in Rates; `?all=true` adds `users:read`) and record calls. New `it`s:
  - `token permissions prints the groups, names and descriptions`: output contains `Files`, `files:read`, `List, read and download files`, `rates:read (host)`; `calls` has `GET /permissions`.
  - `token permissions --all asks for every permission`: `GET /permissions?all=true`, output contains `users:read`.
  - `token create --select sends the chosen permissions`: `h.setReaderResponses(['rates:read', 'files:read'])` (one queued answer: the array) → POST body `permissions` equals `['files:read', 'rates:read']` (list order), output has `Scope: files:read, rates:read`.
  - `picking equals typing`: the POST body of `--select` with `['files:read', 'jobs:read']` equals that of `--permissions=files:read,jobs:read`.
  - `token create --select with nothing chosen creates nothing`: `h.setReaderResponses([])` → no POST, `No permissions selected; token not created`. (The harness's queued reader turns `null` into `[]`, so the `Cancelled` branch is covered by a unit test of the processor with a stub `context.reader.readMultiSelect` resolving `null`.)
  - `token create --select --permissions=a is refused`: stderr `use --select or --permissions, not both`.
  - `token permissions on an older server`: `/permissions` → 404 → stderr contains `needs server 1.0.0-beta.29`.
  - `token list marks host tokens`: a fake token with `audience: 'host'` and `permissions: ['rates:read']` → SCOPE `rates:read (host)`.
- [ ] **Step 2: Run** `npx nx test users` then `pkill -f "karma|ChromeHeadless"` — expected: the new specs FAIL.
- [ ] **Step 3: Implement** the members and behaviour above.
- [ ] **Step 4: Run** `npx nx test users`, `pkill -f "karma|ChromeHeadless"`, `npx nx lint users`, `npx nx build users` — expected: PASS, no leftover Karma/Chrome processes.
- [ ] **Step 5: Commit** `git commit -m "Users: token create --select picks permissions from the server's list, token permissions prints it"`.

---

## Release and docs

### Task 16: Docs, changelogs and versions (every repo)

Runs after Tasks 1-15. One docs commit per repo on its `feature/public-api` branch; then the version commits, done exactly like the beta.28 bump commits (`fe21f3e` .NET, `429e5d6` Node, `6bd1cc1` Python: every package's version field, `README.md`'s "Versioning" line, `CHANGELOG.md`'s `## Unreleased` renamed to the version, admin plugin's dashboard pin; internal dependency ranges untouched).

**Files:**
- .NET: `plugins/users/README.md` (Configuration table `:41-46`, Permissions `:65`, Endpoints table `:126-128`, API tokens section `:142-175`: `audience`, `GET /permissions`, host tokens, `IApiTokenManager`), `plugins/users-efcore/README.md` (Audience column added on first use; "Host migrations": add a migration after upgrading), `README.md` (`AddPermissions` under the core builder section; Versioning line), `CHANGELOG.md` (`## Unreleased` bullets).
- Node: `plugins/users/README.md` (route table near `:107`, tokens section, `usersPlugin.apiTokens`), `README.md` (`builder.addPermissions`; Versioning), `CHANGELOG.md`.
- Python: `plugins/users/README.md`, `README.md` (`builder.add_permissions`; Versioning), `CHANGELOG.md`.
- Dashboard: `CHANGELOG.md` (`## 1.0.0-beta.25`), `package.json` + `package-lock.json` version `1.0.0-beta.25`.
- web-cli: `CHANGELOG.md` (notes for the next release, under `## Unreleased` until `pnpm run release` names the version), `docs/ai/03-server-plugins.md` (new heading `### Permission catalog and host tokens (all servers)` after `### Audit log plugin (all servers)` `:815`), `packages/plugins/users/README.md` if it lists the `token` commands.
- Version bumps: every `*.csproj` the beta.28 commit touched (26 projects) and the admin plugin's `package.json` → `1.0.0-beta.29`; Node: root `package.json`, `packages/abstractions/package.json`, every `plugins/*/package.json` and the lockfiles the beta.28 commit touched → `1.0.0-beta.29`; Python: root `pyproject.toml`, `packages/abstractions/pyproject.toml`, every `plugins/*/pyproject.toml` → `1.0.0b29`; each server's `plugins/admin/package.json` dashboard pin → `1.0.0-beta.25` (after the dashboard release).

Content of the shared doc text (each README/CHANGELOG in its own idiom): the catalog and its 23 built-in entries; `AddPermissions` / `addPermissions` / `add_permissions` with the Rates example; `GET /api/v1/qcli/permissions` (C4 table); `audience` (C5); host tokens and where they are refused (C6); the manager (C7 signatures and rules); the EF Core column note (.NET only). The AI-guide section is at most 15 lines and names the three registration calls, the route, the manager per server and the 403 text.

- [ ] **Step 1: Write the docs** listed above; check every route, field name and error text against the contract section (grep each quoted text in the plan and the README).
- [ ] **Step 2: Verify docs build where a repo builds them:** web-cli `node tools/build-llms.js` exits 0 and `apps/docs/src/static/llms-full.txt` (git-ignored) contains `Permission catalog and host tokens`.
- [ ] **Step 3: Commit docs** per repo: `git commit -m "Docs: token permissions, the permission catalog and host tokens"`.
- [ ] **Step 4: Dashboard version** `1.0.0-beta.25` (package.json, lockfile, CHANGELOG section); `npm test && npm run build` pass; commit `git commit -m "1.0.0-beta.25: pick a token's permissions, host tokens marked"`.
- [ ] **Step 5: Server versions** — in each server repo apply the bump as described; verify with `grep -rn "1.0.0-beta.28\|1.0.0b28" --include='*.csproj' --include='package.json' --include='pyproject.toml' . | grep -v node_modules` returning only internal dependency ranges (none expected for these files' own version fields). Run the full suites: `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj`, `npm test`, `python -m pytest -q`. Commit `git commit -m "chore: every package at 1.0.0-beta.29; admin embeds dashboard 1.0.0-beta.25"` (Python: `1.0.0b29`).
- [ ] **Step 6: Final process sweep:** `ps aux | grep -E "nx.js|karma|ChromeHeadless|vitest|testhost|uvicorn" | grep -v grep` prints nothing.
- [ ] **Step 7: Push and open PRs into `develop`** (one per repo, `gh pr create --base develop`), only when the user asks to publish.

---

## Self-review

- **Spec coverage (Part 1):** catalog with `name`/`description`/`group`/`surface` — C1-C3, Tasks 1, 6, 10; core and plugins register as `cli`, host as `host` via `AddPermissions`/`addPermissions`/`add_permissions` — C2-C3, Tasks 1-2, 6-7, 10-11; "for choosing, not validation" — Global Constraints, `CreateCli_AcceptsFreeFormAndUnscoped`; `GET /permissions` and `?all=true` with `users:read` — C4, Tasks 2, 7, 11; `IApiTokenManager` and equivalents (create/list/revoke for a user id, same validation, limits, audit, events) — C7, Tasks 3, 8, 12; `audience` (`cli` default, `host` only through the manager, required host-surface permissions the user holds) — C5, C7 rule 5, Tasks 2-3, 7-8, 11-12; host tokens 403 on every CLI route, also with no permissions left, accepted only by the guards, sessions unaffected — C6, Tasks 4, 9, 13; stores gain the field with `cli` default, EF Core schema change — Task 5 (Node and Python have only in-memory stores in their repos); dashboard picker, other field, chip tooltips, 10 languages — Task 14; console `--select` and `token permissions`, `--permissions` kept — Task 15; READMEs, AI guide, CHANGELOGs, beta.29 bump — Task 16.
- **Names used across tasks:** `ApiTokenAudience`, `CliPermission`, `ICliPermissionCatalog`/`CliPermissionCatalog`, `IApiTokenManager`/`ApiTokenManager`, `ApiTokenCreateOptions`, `CreatedApiToken`, `apiTokens`/`api_tokens`, `HOST_TOKENS_CANNOT_USE_CLI_ROUTES`/`HostTokensCannotUseCliRoutesMessage` — checked against their defining tasks.
- **Proportion:** most length is the contract (shared by five repos) and test lists; bodies are left to the implementers except the EF Core column probe.
