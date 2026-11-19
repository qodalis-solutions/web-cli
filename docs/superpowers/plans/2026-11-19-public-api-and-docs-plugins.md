# Public API and Docs Plugins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any host of a Qodalis CLI server (.NET, Node, Python) can publish a public REST API (its own routes, guarded by `host` tokens, counted and limited per account) with a public OpenAPI document, Swagger UI, an API reference with code samples and a markdown guides site, all through three plugins and one prebuilt static site.

**Architecture:** Three new server plugins per server: **public-api** (serves the host's public OpenAPI document and Swagger UI, guards host routes with a host-token + permission + quota check, counts usage per token and day in a store, feeds `usage` to the users plugin's token views), **docs** (markdown pages from folders or code, served as JSON) and **portal** (embeds the prebuilt site `@qodalis/cli-server-portal` at one mount and serves `portal.json`, which tells the site which sections exist). Docs and public-api never reference each other or the portal; each exposes a small *portal section* that the portal reads (.NET: a core record in DI; Node/Python: a property on the plugin result handed to the portal builder). The users plugin gains a caller object for guarded routes, a host-token-only guard, guard metadata for OpenAPI, a token-usage hook and a guard-only mode; core gains a switch that leaves the CLI routes out. The site is a second Vite app in the cli-server-dashboard repo, reusing the dashboard's theme and components, built with a relative base and told its mount by a `<base href>` the servers rewrite.

**Tech Stack:** .NET 10 / ASP.NET Core / Microsoft.AspNetCore.OpenApi (Microsoft.OpenApi 2.x) / Swashbuckle.AspNetCore.SwaggerUI / EF Core 10 / xUnit; Node 22 / Express 4 / TypeScript / swagger-ui-dist 5 / vitest + supertest; Python / FastAPI / pydantic / pytest + httpx; React 18 / Vite 6 / Tailwind 3 / react-router 7 / react-markdown + remark-gfm + rehype-highlight / vitest + Testing Library (portal).

**Spec:** `web-cli/docs/superpowers/specs/2026-11-19-public-api-design.md`, sections "Part 2: public-api plugin" and "Part 3: docs plugin (three servers) and the portal site". Builds on Part 1: `web-cli/docs/superpowers/plans/2026-11-19-token-permissions.md` (its contract and its binding "Amendments made during implementation"). Part 4 (RateBell) consumes the .NET names pinned in the contract below.

## Global Constraints

- The three servers behave identically: every route, JSON field name and order, status code, error text and header pinned in the contract is the same on .NET, Node and Python. Error bodies are `{ "error": "<text>" }`.
- Hosts that add none of the new plugins see no change: no new routes, no new fields in existing JSON (the token view's `usage` appears only when the public-api plugin is added), existing guards keep their texts. The new users-plugin options default to today's behaviour.
- Work continues on each repo's existing local branch `feature/public-api` (cli-server-dotnet, cli-server-node, cli-server-python, cli-server-dashboard, web-cli). Linear history, no merge commits, no push and no PR unless the user asks. No attribution lines in commit messages.
- Package names follow the siblings: .NET `Qodalis.Cli.Plugin.PublicApi`, `Qodalis.Cli.Plugin.PublicApi.EfCore`, `Qodalis.Cli.Plugin.Docs`, `Qodalis.Cli.Plugin.Portal` (folders `plugins/public-api`, `plugins/public-api-efcore`, `plugins/docs`, `plugins/portal`); Node `@qodalis/cli-server-plugin-public-api`, `-docs`, `-portal` (folders `plugins/public-api`, `plugins/docs`, `plugins/portal`); Python `qodalis-cli-server-plugin-public-api` / `qodalis_cli_public_api`, `qodalis-cli-server-plugin-docs` / `qodalis_cli_docs`, `qodalis-cli-server-plugin-portal` / `qodalis_cli_portal`; the site `@qodalis/cli-server-portal` (folder `portal/` of cli-server-dashboard).
- Versions: the new server packages start at the server version that follows 1.0.0-beta.29 (`1.0.0-beta.30`, Python `1.0.0b30`) and are bumped with all the others in one last task that waits for the portal's npm release (as Part 1 waited for the dashboard). Internal dependency ranges state the minimum compatible version and are not raised.
- The portal site is English only. The dashboard change (token usage column) is translated in its 10 languages.
- Tests use each repo's framework and exact commands: `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj` (per task `--filter "FullyQualifiedName~<Class>"`); Node `npx vitest run <file>` and `npm test`, type check `npm run build`; Python `python -m pytest <file> -q` from the repo root after the editable installs of `.github/workflows/build.yml`; dashboard `npm test`, portal `npm test -w portal`. Every process a test starts must exit; after each task `pgrep -f "testhost|vitest|uvicorn"` prints nothing. No dev server is started by any step.
- No new runtime dependency for markdown or YAML on the servers: front matter is parsed by the plugins themselves (C9), markdown is rendered by the site.

## Review Focus

1. **Revoking and recreating a token to reset the quota.** The account's daily count includes requests made with tokens revoked earlier that day; a new token starts at the account's count, not at zero. Tests: Task 3 `Quota_RevokedTokensStillCount` (Node Task 10, Python Task 15 mirror it).
2. **Concurrent requests at the limit** (several processes, or one process with parallel requests): no more than the limit is admitted. In-memory: exactly the limit; EF Core: never more than the limit (a refused extra under contention is acceptable). Tests: Task 3 `Quota_ParallelRequests_AdmitExactlyTheLimit` (mirrored in Tasks 10 and 15), Task 5 `TwoStores_ShareCounters_NeverExceed`.
3. **Day and minute boundaries in UTC**, whatever the server's time zone: a request at 23:59:59 UTC and one at 00:00:00 UTC are in different days; `Retry-After` and `X-RateLimit-Reset` count to the next UTC midnight or minute and are at least 1. Tests: Task 3 `Quota_DayRollsOverAtUtcMidnight` with a fake clock (Tasks 10 and 15 mirror it with `setClock` / `set_clock`).
4. **A portal mounted at `/` next to the host's own routes** (RateBell serves its docs at `/`): the portal answers only its own fixed paths (C8), so a host route like `GET /v1/rates` or `GET /health` is never shadowed, whatever the registration order. Tests: Task 7 `RootMount_DoesNotShadowHostRoutes` (Node Task 13, Python Task 18 register the host route before and after the portal).
5. **A host whose quota callback throws or is slow to configure** (database down): the guarded request answers 500 `internal server error`, is not counted, and the error text never reaches the client. Tests: Task 3 `QuotaResolverThrows_Returns500_NotCounted` (mirrored in Tasks 10 and 15).

---

## Cross-server contract

Everything in this section is identical on the three servers. Field order in JSON objects is the order written here.

### C1. Caller of a guarded host route (users plugin)

Every users-plugin host guard (.NET `[QcliAuthorize]`, `.RequireQcliAuthorization(...)`; Node `requireAuth`, `requirePermission`, `requireHostToken`; Python `require_auth`, `require_permission`, `require_host_token`) and the public-api guard (C5) make the caller available to the host's handler:

| Server | How the handler reads it | Type |
|---|---|---|
| .NET | `HttpContext.GetQcliCaller()` (namespace `Qodalis.Cli.Plugin.Users.Authorization`), and `HttpContext.User` (C1a) | `public sealed record QcliCaller(string UserId, string UserName, string? TokenId, string? Audience, IReadOnlyList<string> Permissions)` |
| Node | `req.qcliCaller` (declared on Express `Request` by the users plugin's type augmentation) | `interface QcliCaller { userId: string; userName: string; tokenId: string \| null; audience: 'cli' \| 'host' \| null; permissions: string[] }` |
| Python | `request.state.qcli_caller`, and the value the guard dependency returns gains `.caller` | `@dataclass(frozen=True) class QcliCaller: user_id: str; user_name: str; token_id: str \| None; audience: str \| None; permissions: tuple[str, ...]` |

`TokenId`/`Audience` are null for a session or an external-adapter caller; `Audience` is `cli` or `host` for a token (fail closed as in Part 1: anything not exactly `cli` reads as `host`). `Permissions` are the live, scope-narrowed effective permissions. The existing `GetUsersAuth()` / `req.qcliAuth` / returned `AuthContext` keep working.

**C1a (.NET only).** A guard that authenticated the request also sets `HttpContext.User` to `CliHostUser.Create(...)` when `UsersModuleOptions.SetHostUser` is on (default) and the host's own authentication has not set an authenticated user. Two claims are added to `CliHostUser`: `qcli:token` (token id, only for tokens) and `qcli:audience` (`cli`/`host`, only for tokens), constants `CliHostUser.TokenClaim`, `CliHostUser.AudienceClaim`. The users middleware's behaviour on unguarded host routes does not change.

### C2. Host-token-only guard (users plugin; closes Part 1 gap b)

| Server | API |
|---|---|
| .NET | `[QcliAuthorize("rates:read", HostTokenOnly = true)]`; `.RequireQcliAuthorization("rates:read", hostTokenOnly: true)` |
| Node | `usersPlugin.requireHostToken(...permissions: string[]): RequestHandler` |
| Python | `users_plugin.require_host_token(permission: str \| None = None)` (FastAPI dependency) |

Order: authentication (unchanged texts: 401 `unauthorized`, 401 `invalid or expired token`, 403 `account disabled`, 403 `password change required`) → a session, an external-adapter caller or a `cli` token → **403 `forbidden: a host token is required`** → permission check with each server's existing guard text (Part 1 C6). Without `HostTokenOnly` nothing changes.

### C3. Guard metadata for OpenAPI

- .NET: `public interface IQcliAuthorizeMetadata { string? Permission { get; } bool HostTokenOnly { get; } }`, implemented by `QcliAuthorizeAttribute` and by a `QcliAuthorizeEndpointMetadata` record that `.RequireQcliAuthorization(...)` now also adds with `WithMetadata`. The public-api guard adds the same metadata.
- Python: the callable returned by `require_permission`, `require_host_token` and the public-api guard carries the attributes `qcli_permission: str | None` and `qcli_host_token_only: bool`.
- Node: Express has no route metadata; `x-required-permission` comes from the host's schema only (C6).

### C4. Usage on token views (users plugin hook, public-api provider)

- `GET /api/v1/qcli/tokens` (own and `?all=true`) and the token manager's list add `usage` to every view **only when a usage provider is registered** (the public-api plugin registers one). Placed last, after `permissions`:

```json
"usage": { "today": 12, "last30Days": 340, "days": [ { "date": "2026-10-21", "requests": 0 }, "… 30 entries, oldest first, the last one today (UTC)" ] }
```

- `days` always has exactly 30 entries (zeros included); `last30Days` is their sum; `today` equals the last entry.
- `POST /api/v1/qcli/tokens` and the manager's create do not include `usage`.
- A provider failure is logged and the views are returned without `usage` (never a 500).
- Hook: .NET `public interface IApiTokenUsageProvider { Task<IReadOnlyDictionary<string, ApiTokenUsage>> GetUsageAsync(IReadOnlyCollection<string> tokenIds, CancellationToken ct = default); }` (namespace `Qodalis.Cli.Plugin.Users.Services`), `ApiTokenView.Usage : ApiTokenUsage?` (`[JsonPropertyName("usage")]`, omitted when null), `public sealed class ApiTokenUsage { long Today; long Last30Days; IReadOnlyList<ApiTokenUsageDay> Days }`, `public sealed record ApiTokenUsageDay(string Date, long Requests)`. Node `usersPlugin.setTokenUsageProvider(provider: (tokenIds: string[]) => Promise<Record<string, ApiTokenUsage>>)`. Python `users_plugin.set_token_usage_provider(provider: Callable[[list[str]], Awaitable[dict[str, dict]]])`.

### C5. Public-api guard, quotas and headers

Guard API:

| Server | API |
|---|---|
| .NET | `app.MapGet(...).RequirePublicApi("rates:read")` (`RequirePublicApi<TBuilder>(this TBuilder builder, string? permission = null) where TBuilder : IEndpointConventionBuilder`, works on route groups); MVC `[RequirePublicApi("rates:read")]` (`RequirePublicApiAttribute`) |
| Node | `publicApi.guard(permission?: string): RequestHandler[]` → `app.get('/v1/rates', publicApi.guard('rates:read'), handler)` |
| Python | `Depends(public_api.guard("rates:read"))`, returns the `QcliCaller` |

Checks in this order; the first failure answers and nothing is counted:

| # | Condition | Answer |
|---|---|---|
| 1 | authentication fails | as the users guard: 401 `unauthorized` / 401 `invalid or expired token` / 403 `account disabled` / 403 `password change required` |
| 2 | not a `host` token (session, adapter, `cli` token) | 403 `forbidden: a host token is required` |
| 3 | permission given and not held | 403 `forbidden: missing permission <permission>` |
| 4 | the quota resolver throws | 500 `internal server error` (logged with the exception; text never exposed) |
| 5 | a resolved limit is `0` (or negative, read as 0) | 403 `forbidden: no API access` |
| 6 | account's requests today ≥ `requestsPerDay` | 429 `quota exceeded: <requestsPerDay> requests per day`, `Retry-After` = seconds to the next UTC midnight |
| 7 | account's requests this minute ≥ `requestsPerMinute` | 429 `too many requests: <requestsPerMinute> per minute`, `Retry-After` = seconds to the next UTC minute |
| — | otherwise | the request is counted (token's day and minute counters), then the host's handler runs |

- **Quota resolver** (host-supplied; absent = unlimited): .NET `public interface IPublicApiQuotaResolver { ValueTask<PublicApiQuota> GetQuotaAsync(QcliCaller caller, CancellationToken ct); }` registered with `o.UseQuotaResolver<T>()` (resolved from `HttpContext.RequestServices` per request, so scoped services work) or `o.UseQuotaResolver(Func<QcliCaller, IServiceProvider, CancellationToken, ValueTask<PublicApiQuota>>)`; `public sealed record PublicApiQuota(long? RequestsPerDay, long? RequestsPerMinute) { public static readonly PublicApiQuota Unlimited = new(null, null); }`. Node `setQuota(resolver: (caller: QcliCaller) => PublicApiQuota | Promise<PublicApiQuota>)`, `interface PublicApiQuota { requestsPerDay: number | null; requestsPerMinute: number | null }`. Python `set_quota(resolver: Callable[[QcliCaller], PublicApiQuota | Awaitable[PublicApiQuota]])`, `@dataclass class PublicApiQuota: requests_per_day: int | None = None; requests_per_minute: int | None = None`.
- **Per account.** Counters are kept per token; limits are checked against the sum over every token of the account (`UserId`), revoked tokens included, for the current UTC day (`yyyy-MM-dd`) and UTC minute (`yyyy-MM-ddTHH:mm`), fixed windows.
- **Headers** on every answer of a guarded route that passed check 3 (including 429 and the handler's own answers, excluding 401/403/500): `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (integer seconds until the window resets, ≥ 1). They describe the daily limit when `requestsPerDay` is set, otherwise the per-minute limit; when both are null they are not sent. `Remaining` = max(0, limit − account count including this request). On a 429 `Remaining` is `0` and `Retry-After` (integer seconds, ≥ 1) is added.
- **Store** (shared by processes when persistent): .NET `public interface IPublicApiUsageStore { Task<long> IncrementAsync(string tokenId, string userId, string window, CancellationToken ct); Task DecrementAsync(string tokenId, string window, CancellationToken ct); Task<long> GetAccountCountAsync(string userId, string window, CancellationToken ct); Task<IReadOnlyDictionary<string, IReadOnlyDictionary<string, long>>> GetTokenDaysAsync(IReadOnlyCollection<string> tokenIds, string fromDay, string toDay, CancellationToken ct); Task PruneAsync(string beforeDay, string beforeMinute, CancellationToken ct); }`; admission is increment-then-check-then-compensate: increment the token's day and minute counters, read the account sums, and when a limit is exceeded decrement both and refuse (fails closed under contention). Node and Python stores have the same five methods (`increment`, `decrement`, `accountCount`/`account_count`, `tokenDays`/`token_days`, `prune`). Defaults: in-memory (one process). Retention: day rows `UsageRetentionDays` (default 31), minute rows 2 minutes; pruned at most once an hour by the guard.
- **Account usage service** (for a host's own pages): .NET `IPublicApiUsage.GetAccountUsageAsync(string userId, CancellationToken ct = default) : Task<PublicApiAccountUsage>`, `public sealed class PublicApiAccountUsage { long Today; PublicApiQuota Quota; IReadOnlyList<PublicApiTokenUsage> Tokens }`, `public sealed record PublicApiTokenUsage(string TokenId, string Name, ApiTokenUsage Usage)`; the quota comes from the resolver with `QcliCaller(userId, name, null, null, effectivePermissions)`; unknown user → `UsersApiException` 404 `user not found`. Node `publicApi.usage.account(userId)`, Python `public_api.usage.account(user_id)`, same fields in camelCase / snake_case.

### C6. Public OpenAPI document and Swagger UI

Default base `/qcli/api` (option: .NET `PublicApiOptions.BasePath`, Node `setBasePath`, Python `set_base_path`; must start with `/`, no trailing `/`, `/` itself not allowed).

| Route | Answer |
|---|---|
| `GET <base>/openapi.json` | 200 `application/json; charset=utf-8`, `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *`, the document below. No sign-in; credentials are ignored (a host bearer is not refused). |
| `GET <base>/swagger` and `<base>/swagger/` | 200 `text/html`: Swagger UI 5 for `<base>/openapi.json` only, `persistAuthorization: false`, `tryItOutEnabled: true`, title = the document's `info.title`. |
| any other path under `<base>` | not handled by the plugin (framework 404) |

The document is the host's, with these additions (the host's own values always win):
- `components.securitySchemes.qcliToken = { "type": "http", "scheme": "bearer", "bearerFormat": "qcli_pat", "description": "API token (qcli_pat_…), sent as Authorization: Bearer <token>" }` unless a scheme of that name exists; top-level `"security": [ { "qcliToken": [] } ]` unless the document has a top-level `security`.
- `servers: [ { "url": "<PublicApiOptions.ServerUrl or the request's scheme://host[pathBase]>" } ]` unless the document has `servers`.
- `x-required-permission: "<permission>"` on each operation whose guard is known (.NET C3 metadata, Python C3 attributes) and that does not already have it; `x-host-token-only: true` beside it for the public-api guard and `HostTokenOnly` guards.
- Code samples are generated by the site, not the server; a host's own `x-codeSamples` (`[ { "lang", "label"?, "source" } ]`) are passed through untouched.

Sources: .NET `PublicApiOptions.DocumentName` (default `"public"`): the named document of `services.AddOpenApi("public", ...)`, read through the keyed `IOpenApiDocumentProvider`; the plugin adds an operation transformer and a document transformer to that named document; a missing document fails `UseQodalisPublicApi()` with `InvalidOperationException("public-api: no OpenAPI document named 'public'; call services.AddOpenApi(\"public\")")`. Node `setOpenApi(source: object | string)` (an object, or a path to a JSON file read once at `build()`; unreadable/invalid → `Error('public-api: cannot read OpenAPI document <path>')`). Python `set_openapi(source)`: a `dict`, a zero-argument callable returning a dict, a `FastAPI` or an `APIRouter` (built with `fastapi.openapi.utils.get_openapi(title=<set_title or "API">, version=<set_version or "1.0.0">, routes=source.routes)`; routes with `include_in_schema=False` are left out by FastAPI as usual).

### C7. Docs pages

Default base `/qcli/docs` (.NET `DocsOptions.BasePath`, Node `setBasePath`, Python `set_base_path`; same rules as C6).

| Route | Answer |
|---|---|
| `GET <base>/pages` | 200, `Cache-Control: no-cache`, array of `{ "slug", "title", "group", "order" }` in page order |
| `GET <base>/pages/<slug>` | 200, `Cache-Control: no-cache`, `{ "slug", "title", "group", "order", "markdown" }` |
| unknown or invalid slug | 404 `page not found` |

No sign-in; credentials ignored. Page order: `order` ascending, then `title` (ordinal, case-insensitive), then `slug`.

### C8. Portal site mount and `portal.json`

Default path `/qcli/portal` (.NET `PortalOptions.Path`, Node `setPath`, Python `set_path`; must start with `/`, no trailing `/` except `/` itself, which is allowed). The portal answers exactly these paths and nothing else under its mount (anything else falls through to the host / framework 404), GET and HEAD only:

| Path (relative to the mount) | Answer |
|---|---|
| `` (the mount itself), `/`, `/guides/<slug>`, `/reference`, `/reference/<tag>` | 200 `text/html; charset=utf-8`, `Cache-Control: no-cache`: the site's `index.html` with its single `<base href="/" />` replaced by `<base href="<mount>/" />` (`/` for a root mount) |
| `/portal.json` | 200 JSON, `Cache-Control: no-cache` (below) |
| `/assets/<file>`, `/favicon.svg` | the site's file if it exists (`Cache-Control: public, max-age=31536000, immutable` for `/assets/`), otherwise 404 |

When no site files are found (neither the sibling `cli-server-dashboard/portal/dist` nor the npm package), the portal logs `[qcli] portal site not found; the portal is not served` once and serves nothing, `portal.json` included.

```json
{
  "name": "Documentation",
  "logo": null,
  "theme": { "mode": "system", "dark": {}, "light": {} },
  "footerLinks": [ { "label": "Terms", "url": "https://example.com/terms" } ],
  "docs": { "title": "Guides", "pages": "/qcli/docs/pages" },
  "api": { "title": "API reference", "openapi": "/qcli/api/openapi.json", "swagger": "/qcli/api/swagger" }
}
```

- `docs` / `api` are `null` when that plugin's section was not given to the portal; both null is allowed (the site shows "Nothing published yet").
- `theme` has the shape of the dashboard's `theme.json` without `branding`: `mode` `dark|light|system` (portal default `system`), `dark`/`light` maps of the 21 dashboard tokens (`primary, primaryHover, onPrimary, accent, background, backgroundAccent, sidebar, surface, popover, control, controlHover, border, overlay, heading, text, muted, subtle, success, warning, error, info`) holding only the set values.
- Validation at startup (ArgumentException / Error / ValueError) with the admin plugin's rules: `name` 1-80 characters, no control characters (`portal name must be 1-80 characters without control characters`); `logo` an http(s) URL, a root-relative path or a base64 `data:image/…` URL up to 200 000 characters (`portal logo must be an http(s) URL, a root-relative path or a data:image URL`); colours as the admin theme accepts (`invalid portal colour <scheme>.<token>: <value>`); at most 20 footer links, `label` 1-80 characters, `url` http(s) or root-relative (`invalid portal footer link: <label>`); an invalid path (`invalid portal path: <path>`, same text pattern `invalid docs base path: <path>` / `invalid public-api base path: <path>` for C6/C7).

Sections: .NET core record `Qodalis.Cli.Portal.CliPortalSection(string Kind, string Title, string BasePath)` (`Kind` = `CliPortalSection.Docs` `"docs"` or `CliPortalSection.Api` `"api"`) registered as a singleton by `AddDocs` / `AddPublicApi`; the portal reads `IEnumerable<CliPortalSection>` (a second section of the same kind fails startup: `portal section already registered: <kind>`). Node: docs and public-api results carry `portalSection: { kind: 'docs' | 'api'; title: string; basePath: string }`; the host passes them to `new CliPortalBuilder().addSection(docs).addSection(api)`. Python: `portal_section` dict with the same keys (`kind`, `title`, `base_path`), `CliPortalBuilder().add_section(docs).add_section(api)`.

Section titles: docs `"Guides"`, api `"API reference"` by default (.NET `DocsOptions.Title` / `PublicApiOptions.Title`, Node/Python `setTitle` / `set_title`). The api section's `title` is the portal's label; the OpenAPI `info.title` stays the document's.

### C9. Markdown pages: files, front matter, variables

- Folder: every `*.md` file directly in it (no subfolders; names starting with `.` or `_` ignored). Slug = file name without `.md`, lower-cased; must match `^[a-z0-9][a-z0-9-]*$` or startup fails with `invalid docs page name: <file name>`. `index` is the guides' home page.
- Pages in code: .NET `o.AddPage(string slug, string markdown)`, Node `addPage(slug, markdown)`, Python `add_page(slug, markdown)`; same slug rule (`invalid docs page slug: <slug>`). A slug seen twice (folders or code) fails startup: `duplicate docs page: <slug>`. A missing folder: `docs folder not found: <path>`. Folders are read once, when the plugin is built (.NET: when `UseQodalisDocs()` runs).
- Front matter: only when the first line is exactly `---`; it ends at the next line that is exactly `---` (no closing line → the whole file is body, no front matter). Each line `key: value`; keys `title`, `group`, `order` (others ignored); a value wrapped in matching `"…"` or `'…'` is unwrapped; `order` must be an integer (`invalid order in docs page: <slug>`). The front matter is removed from `markdown`.
- Defaults: `title` = the text of the first body line starting with `# `, else the slug; `group` = `"Guides"`; `order` = `0`.
- Variables: `{{ key }}` (pattern `\{\{\s*([A-Za-z][A-Za-z0-9_.-]*)\s*\}\}`) in `title` and `markdown` replaced per request; unknown keys left as written. Built in: `baseUrl` (.NET `DocsOptions.BaseUrl` / Node `setBaseUrl` / Python `set_base_url`, else the request's `scheme://host` plus path base, no trailing slash) and `name` (`DocsOptions.Name` / `setName` / `set_name`, default `"Documentation"`). Host variables: .NET `o.Variables["support"] = "help@example.com"`, Node `setVariable(key, value)`, Python `set_variable(key, value)`; key pattern as above (`invalid docs variable: <key>`); redefining `baseUrl` or `name` fails: `docs variable is built in: <key>`.

**Shared fixture** (every server's docs tests use these three files, under `tests/fixtures/docs/` .NET, `src/__tests__/fixtures/docs/` Node, `tests/fixtures/docs/` Python):

`index.md`:
```markdown
---
title: Welcome to {{name}}
order: 1
---
Call {{ baseUrl }}/v1/rates with {{support}} and {{unknown}}.
```
`auth.md`:
```markdown
---
title: "Authentication"
group: Basics
order: 2
---
# Ignored heading
Send `Authorization: Bearer <token>`.
```
`limits.md` (no front matter):
```markdown
# Limits and quotas
Requests per day.
```
With `Name = "RateBell API"`, `Variables["support"] = "help@ratebell.app"`, request host `http://localhost`: `GET /qcli/docs/pages` → `[{"slug":"limits","title":"Limits and quotas","group":"Guides","order":0},{"slug":"index","title":"Welcome to RateBell API","group":"Guides","order":1},{"slug":"auth","title":"Authentication","group":"Basics","order":2}]`; `GET /qcli/docs/pages/index` → `markdown` `"Call http://localhost/v1/rates with help@ratebell.app and {{unknown}}.\n"`; `GET /qcli/docs/pages/auth` → `markdown` `"# Ignored heading\nSend \`Authorization: Bearer <token>\`.\n"`.

### C10. Guard-only mode and a server without CLI routes (closes Part 1 gap c)

For a second service that only validates tokens (RateBell.PublicApi):

| Server | Core switch | Users switch |
|---|---|---|
| .NET | `cli.WithoutCliRoutes()` (`CliBuilder`; sets `CliServerOptions.CliRoutes = false`) | `o.GuardOnly = true` / `o.UseGuardOnly()` on `UsersModuleOptions` |
| Node | `createCliServer({ cliRoutes: false })` | `new CliUsersBuilder().setGuardOnly()` |
| Python | `CliServerOptions(cli_routes=False)` | `CliUsersBuilder().set_guard_only()` |

- Without CLI routes: none of core's HTTP routes or sockets are served (`/api/qcli/*`, `/api/v1/qcli/*`, `/api/v2/qcli/*`, `/api/cli/*`, `/ws/*` answer the framework 404); .NET adds no controller application parts of core or plugins (the new plugins use middleware/endpoint routing, not controllers) and `UseCli()` throws `InvalidOperationException("UseCli() is not available: the CLI routes are turned off (WithoutCliRoutes)")`; Node/Python `mountPlugin`/`mount_plugin` skip the router of a plugin that serves CLI routes and log `[qcli] CLI routes are turned off; <prefix> is not mounted`. The permission catalog, events and services stay.
- Guard-only users plugin: no users routes (sign-in, users, groups, sessions, tokens, permissions, link, audit), no seeding (no `root`, no built-in groups), no server protection; the guards (C1, C2, C5) authenticate `qcli_pat_` tokens against the shared stores; the token manager stays available but tokens should be created from one service only (C11).
- Plugins mark their prefixes as host routes so they are never treated as CLI routes: Node `MountablePlugin.cliRoutes?: boolean` (default true; the three new plugins set `false`, so `mountPlugin` neither adds their prefixes to `cliRoutePrefixes` nor refuses host tokens there); Python plugin attribute `cli_routes: bool = False` on the three new plugins (`mount_plugin` then skips `add_cli_route_prefix`).
- Python also gains `CliServerOptions(app_docs: bool = True)`: `False` turns off FastAPI's own `/docs`, `/redoc` and `/openapi.json` for the whole app (on by default, as today).

### C11. Documented limit (closes Part 1 gap d)

The token stores' name uniqueness and 20-token limit are checked in the process that creates the token (EF Core store included). Several services may *validate* tokens over shared stores; tokens must be *created and revoked* from one service only. The users-efcore README and the public-api README say so; nothing else changes.

### Task order and parallelism

| Track | Tasks | Depends on |
|---|---|---|
| .NET (cli-server-dotnet) | 1 → 2 → 3 → 4 → 5; 6 at any time; 7 after 3 and 6; 8 last | contract |
| Node (cli-server-node) | 9 → 10 → 11; 12 at any time; 13 after 10 and 12 | contract |
| Python (cli-server-python) | 14 → 15 → 16; 17 at any time; 18 after 15 and 17 | contract |
| Portal and dashboard (cli-server-dashboard) | 19 → 20 → 21 | contract (tests mock `portal.json`, the pages and the OpenAPI document) |
| Docs and release | 22, then 23 | all of the above; 23 also waits for the portal's npm release |

The server tracks embed the site from the sibling `cli-server-dashboard/portal/dist` when it exists; their portal tests use a small fixture site (C8 needs only `index.html` with the base tag, `assets/app.js`, `favicon.svg`), so they do not wait for Track 4.

---
## cli-server-dotnet

Branch: `feature/public-api` (already checked out). Whole suite: `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj`; per task `--filter "FullyQualifiedName~<Class>"`. `dotnet test` exits by itself; afterwards `pgrep -f testhost` prints nothing. New projects are added to `src/Qodalis.Cli.sln` (`dotnet sln src/Qodalis.Cli.sln add <csproj>`) and referenced from `tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj`; their csproj copies `plugins/audit-efcore/Qodalis.Cli.Plugin.Audit.EfCore.csproj`'s package metadata with `<Version>1.0.0-beta.29</Version>` (raised in Task 23) and an `AssemblyMetadata QodalisCliIcon`.

### Task 1: .NET users plugin: caller, host-token-only guards, guard metadata

**Files:**
- Create: `plugins/users/Authorization/QcliCaller.cs` (`QcliCaller`, `QcliCallerHttpContextExtensions`)
- Modify: `plugins/users/Authorization/QcliAuthorizeAttribute.cs` (`QcliAuthorization.AuthorizeAsync`, `QcliAuthorizeAttribute`, `QcliAuthorizeEndpointFilter`, `QcliAuthorizeEndpointExtensions`)
- Modify: `plugins/users/Authorization/CliHostUser.cs` (two claims)
- Modify: `plugins/users/Services/AuthService.cs` (constant `HostTokenRequiredMessage = "forbidden: a host token is required"`)
- Test: `tests/Qodalis.Cli.Tests/HostRouteCallerTests.cs`

**Interfaces:**
- Consumes: Part 1 `UsersAuthContext.IsHostToken`, `ApiTokenAudience`, `CliHostUser.Create`.
- Produces (namespace `Qodalis.Cli.Plugin.Users.Authorization`): `QcliCaller` (C1); `HttpContext.GetQcliCaller() : QcliCaller?`; `internal HttpContext.SetQcliCaller(QcliCaller)`; `UsersAuthContext.ToQcliCaller() : QcliCaller`; `public interface IQcliAuthorizeMetadata { string? Permission { get; } bool HostTokenOnly { get; } }`; `public sealed record QcliAuthorizeEndpointMetadata(string? Permission, bool HostTokenOnly) : IQcliAuthorizeMetadata`; `QcliAuthorizeAttribute.HostTokenOnly { get; init; }` (attribute implements `IQcliAuthorizeMetadata`); `RequireQcliAuthorization<TBuilder>(this TBuilder builder, string? permission = null, bool hostTokenOnly = false)`; `QcliAuthorization.AuthorizeAsync(HttpContext context, string? permission, bool hostTokenOnly = false) : Task<(int Status, string Error)?>`; `CliHostUser.TokenClaim = "qcli:token"`, `CliHostUser.AudienceClaim = "qcli:audience"`.

- [ ] **Step 1: Write the failing tests** in `HostRouteCallerTests` (host via `UsersTestHost.StartAsync(configureCli: cli => cli.AddPermissions(p => p.Group("Rates").Add("rates:read", "Official exchange rates")), configureApp: app => ...)` mapping, inside `UseEndpoints`, `GET /host/caller` `.RequireQcliAuthorization("rates:read")` returning `ctx.GetQcliCaller()` and `ctx.User` claims as JSON, `GET /host/only` `.RequireQcliAuthorization("rates:read", hostTokenOnly: true)`, and an MVC controller action with `[QcliAuthorize("rates:read", HostTokenOnly = true)]`; `alice` holds `rates:read`; `hostToken` from `IApiTokenManager.CreateAsync(alice.Id, new() { Name = "site", Audience = "host", Permissions = ["rates:read"] })`, `cliToken` an HTTP-created token, `session` alice's login):
  - `Caller_HostToken`: `GET /host/caller` with `hostToken` → 200, caller `{ userId: alice.Id, userName: "alice", tokenId: <id>, audience: "host", permissions: ["rates:read"] }`; `User` claims include `NameIdentifier = alice.Id`, `qcli:auth = token`, `qcli:token = <id>`, `qcli:audience = host`, `qcli:permission = rates:read`.
  - `Caller_Session`: with `session` → `tokenId` and `audience` null, no `qcli:token` claim.
  - `HostAuthenticatedUser_IsKept`: with `configureAuth` setting an authenticated `HttpContext.User` named `host-user` → `User.Identity.Name == "host-user"`, `GetQcliCaller()` still alice.
  - `SetHostUserOff_LeavesUserAlone`: `o.SetHostUser = false` → `User.Identity.IsAuthenticated == false`, caller set.
  - `[Theory] HostTokenOnly_RefusesSessionAndCliToken` on `/host/only` and the MVC action with `session` and `cliToken` → 403 `{"error":"forbidden: a host token is required"}`; with `hostToken` → 200.
  - `HostTokenOnly_ChecksPermissionAfterAudience`: a host token whose owner lost `rates:read` → 403 `permission denied: rates:read`; a `cli` token without the permission → 403 `forbidden: a host token is required` (audience first).
  - `Metadata_IsOnTheEndpoint`: resolve `EndpointDataSource`; the `/host/only` endpoint's metadata has one `IQcliAuthorizeMetadata` with `("rates:read", true)`; the MVC action's endpoint has the attribute with the same values.
  - `NoHostTokenOnly_Unchanged`: `/host/caller` with `cliToken` and `session` → 200 (Part 1 behaviour).
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~HostRouteCallerTests"` — expected: build error (types missing).
- [ ] **Step 3: Implement.** `AuthorizeAsync` after its existing must-change-password check: `if (hostTokenOnly && !auth.IsHostToken) return (403, AuthService.HostTokenRequiredMessage);`, then the existing permission check; on success `context.SetQcliCaller(auth.ToQcliCaller())` and, when `UsersModuleOptions.SetHostUser` and `context.User.Identity?.IsAuthenticated != true`, `context.User = CliHostUser.Create(principal, auth.User.Email, auth.ApiToken)` (new optional parameter `ApiToken? token = null` adds the two claims). `RequireQcliAuthorization` adds the filter and `WithMetadata(new QcliAuthorizeEndpointMetadata(permission, hostTokenOnly))`.
- [ ] **Step 4: Run** the filter, then `--filter "FullyQualifiedName~HostTokensTests|FullyQualifiedName~HostUserTests"` and the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: guarded host routes expose the caller (GetQcliCaller, HttpContext.User), HostTokenOnly guards, guard metadata for OpenAPI"` with the files above.

### Task 2: .NET users plugin: token usage hook and guard-only mode; core without CLI routes

**Files:**
- Modify: `plugins/users/Models/ApiToken.cs` (`ApiTokenView.Usage`, `ApiTokenUsage`, `ApiTokenUsageDay`)
- Create: `plugins/users/Services/ApiTokenUsageProvider.cs` (`IApiTokenUsageProvider`)
- Modify: `plugins/users/Controllers/TokensController.cs` (`GetAll`), `plugins/users/Services/ApiTokenManager.cs` (`ListAsync`)
- Modify: `plugins/users/UsersModuleOptions.cs` (`GuardOnly`, `UseGuardOnly()`), `plugins/users/Extensions/CliBuilderUsersExtensions.cs` (`AddUsers`, `UseQodalisUsers`), `plugins/users/Services/UsersBootstrapService.cs` (no seeding when guard-only)
- Modify: `src/Qodalis.Cli/Security/CliServerOptions.cs` (`CliRoutes`), `src/Qodalis.Cli/Extensions/CliBuilder.cs` (`WithoutCliRoutes()`), `src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs` (`AddCli`: no application parts when off), `src/Qodalis.Cli/Extensions/WebApplicationExtensions.cs` (`UseCli` throws when off)
- Test: `tests/Qodalis.Cli.Tests/TokenUsageViewTests.cs`, `tests/Qodalis.Cli.Tests/GuardOnlyTests.cs`

**Interfaces:**
- Consumes: Task 1 guards and caller.
- Produces: C4 .NET types; `UsersModuleOptions.GuardOnly : bool` (default false) and `UseGuardOnly() : UsersModuleOptions`; `CliServerOptions.CliRoutes : bool` (default true); `CliBuilder.WithoutCliRoutes() : CliBuilder`.

- [ ] **Step 1: Write the failing tests.** `TokenUsageViewTests`:
  - `NoProvider_NoUsageField`: `GET tokens` → elements have no `usage` property (JSON keys exactly as Part 1).
  - `Provider_AddsUsageLast`: register a fake `IApiTokenUsageProvider` (through `configureServices`) returning for token `t1` 30 days with `requests` 0..29 → the view's last property is `usage`, `usage.today == 29`, `usage.last30Days == 435`, `usage.days.Length == 30`, `days[0].date` is 29 days before the fake clock's UTC date.
  - `Provider_AllTrue_CoversEveryUser`: root with `?all=true` → each token's usage requested once (one provider call with every id).
  - `ProviderThrows_ListStillReturned`: provider throws → 200, no `usage`, one error log line (`CapturingLoggerProvider`).
  - `Manager_List_HasUsage` and `Create_HasNoUsage`: `IApiTokenManager.ListAsync` views carry `Usage`; `POST tokens` response's `apiToken` has no `usage`.
  `GuardOnlyTests` (a host built like `UsersTestHost` but with `cli.WithoutCliRoutes()` and `o.UseGuardOnly()`, the stores pre-filled through `o.SetUserStore`/`SetGroupStore`/`SetApiTokenStore` instances shared with a second, normal `UsersTestHost` that created alice and her host token; host route `GET /host/rates` `.RequireQcliAuthorization("rates:read", hostTokenOnly: true)`):
  - `HostRoute_AcceptsHostToken`: 200 with the host token created by the other host.
  - `[Theory] CliAndUsersRoutes_Answer404` for `GET /api/v1/qcli/commands`, `POST /api/v1/qcli/execute`, `POST /api/v1/qcli/auth/login`, `GET /api/v1/qcli/tokens`, `GET /api/v1/qcli/permissions`, `GET /api/v1/qcli/audit`, `GET /api/qcli/versions` → 404.
  - `NoSeeding`: the shared user store gains no `root` and the group store no new built-in group.
  - `UseCli_Throws`: building an app that calls `app.UseCli()` with `WithoutCliRoutes()` → `InvalidOperationException` with the C10 text.
  - `Catalog_StillServesHostEntries`: `ICliPermissionCatalog.Find("rates:read")` is not null.
  - `DefaultHost_Unchanged`: a normal `UsersTestHost` still answers `GET /api/v1/qcli/commands` 200.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~TokenUsageViewTests|FullyQualifiedName~GuardOnlyTests"` — expected: FAIL.
- [ ] **Step 3: Implement.** `TokensController.GetAll` and `ApiTokenManager.ListAsync` call `IApiTokenUsageProvider` (optional service, `GetService`) once with all ids and set `Usage`; a throw is logged with `ILogger<TokensController>`/`ILogger<ApiTokenManager>` and ignored. `AddCli`: when `CliRoutes` is false skip the core `AssemblyPart` and every `AdditionalAssemblyParts` entry. `AddUsers` with `GuardOnly`: skip `AddApplicationPart`, force `ProtectServer = false`, register everything else; `UsersBootstrapService.EnsureSeededAsync` returns at once; `UseQodalisUsers()` adds no middleware in guard-only mode.
- [ ] **Step 4: Run** the filter, then the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: token usage on token views through IApiTokenUsageProvider, guard-only mode; core: WithoutCliRoutes"`.

### Task 3: .NET public-api plugin: guard, quotas, in-memory store, usage

**Files:**
- Create: `plugins/public-api/Qodalis.Cli.Plugin.PublicApi.csproj` (references `../users`, `../../src/Qodalis.Cli`; packages `Microsoft.AspNetCore.OpenApi 10.0.*`, `Swashbuckle.AspNetCore.SwaggerUI` latest stable for net10.0)
- Create: `plugins/public-api/PublicApiOptions.cs`, `plugins/public-api/Quotas/PublicApiQuota.cs` (`PublicApiQuota`, `IPublicApiQuotaResolver`), `plugins/public-api/Usage/IPublicApiUsageStore.cs`, `plugins/public-api/Usage/InMemoryPublicApiUsageStore.cs`, `plugins/public-api/Usage/PublicApiUsageService.cs` (`IPublicApiUsage`, `PublicApiAccountUsage`, `PublicApiTokenUsage`, the `IApiTokenUsageProvider` implementation), `plugins/public-api/Guard/PublicApiGuard.cs` (shared check), `plugins/public-api/Guard/RequirePublicApiAttribute.cs`, `plugins/public-api/Guard/PublicApiEndpointExtensions.cs` (`RequirePublicApi`), `plugins/public-api/Extensions/CliBuilderPublicApiExtensions.cs` (`AddPublicApi`), `plugins/public-api/README.md`
- Test: `tests/Qodalis.Cli.Tests/PublicApiQuotaTests.cs`, `tests/Qodalis.Cli.Tests/Helpers/PublicApiTestHost.cs`

**Interfaces:**
- Consumes: Task 1 `QcliAuthorization.AuthorizeAsync`, `QcliCaller`, `IQcliAuthorizeMetadata`, `QcliAuthorizeEndpointMetadata`; Task 2 `IApiTokenUsageProvider`, `ApiTokenUsage`.
- Produces (namespace `Qodalis.Cli.Plugin.PublicApi`): `CliBuilder.AddPublicApi(Action<PublicApiOptions>? configure = null) : CliBuilder`; `PublicApiOptions { string BasePath = "/qcli/api"; string DocumentName = "public"; string Title = "API reference"; string? ServerUrl; int UsageRetentionDays = 31; UseQuotaResolver<T>() where T : class, IPublicApiQuotaResolver; UseQuotaResolver(Func<QcliCaller, IServiceProvider, CancellationToken, ValueTask<PublicApiQuota>>); SetUsageStore<T>() where T : class, IPublicApiUsageStore; SetUsageStore(Func<IServiceProvider, IPublicApiUsageStore>) }`; C5 types; `RequirePublicApi`, `RequirePublicApiAttribute` (implements `IQcliAuthorizeMetadata` with `HostTokenOnly = true`); the guard calls Task 1's `QcliAuthorization.AuthorizeAsync(http, null)`, which already sets `GetQcliCaller()` and `HttpContext.User`; `CliBuilder.SetPublicApiUsageStore<T>()` for the EF Core package. `AddPublicApi` registers `CliPortalSection(CliPortalSection.Api, Title, BasePath)`; this task creates the core record `src/Qodalis.Cli/Portal/CliPortalSection.cs` (Task 7 lists it too, for when Task 6 or 7 runs first).

- [ ] **Step 1: Write the failing tests.** `PublicApiTestHost.StartAsync(Action<PublicApiOptions>? configure = null, ...)` wraps `UsersTestHost.StartAsync` with `cli.AddPermissions(Rates)` + `cli.AddPublicApi(configure)` and maps `GET /v1/rates` `.RequirePublicApi("rates:read")` returning `ctx.GetQcliCaller()!.TokenId`, plus `GET /v1/open` `.RequirePublicApi()`; helper `HostTokenAsync(userName)` creates a user holding `rates:read` and a host token. Tests in `PublicApiQuotaTests` (clock = `ManualTimeProvider` set to `2026-11-19T23:59:30Z`):
  - `Unlimited_NoHeaders`: no resolver → 200 and no `X-RateLimit-*` headers.
  - `[Theory] Refusals` (C5 rows 1-3): no header → 401 `unauthorized`; `Bearer qcli_pat_unknown` → 401 `invalid or expired token`; a session and a `cli` token → 403 `forbidden: a host token is required`; a host token without `rates:read` on `/v1/rates` → 403 `forbidden: missing permission rates:read` (and 200 on `/v1/open`). None is counted (store count stays 0).
  - `Daily_HeadersAndLimit`: resolver `(_ , _, _) => new PublicApiQuota(3, null)` → three 200s with `X-RateLimit-Limit: 3`, `Remaining` 2, 1, 0, `Reset: 30`; the fourth → 429 `{"error":"quota exceeded: 3 requests per day"}`, `Retry-After: 30`, `X-RateLimit-Remaining: 0`.
  - `Minute_Limit`: `new PublicApiQuota(null, 2)` → third request 429 `too many requests: 2 per minute`, `Retry-After: 30`, headers describe the minute (`Limit: 2`).
  - `BothLimits_HeadersDescribeTheDay`: `(100, 2)` → `X-RateLimit-Limit: 100`; third request 429 with the minute text.
  - `ZeroLimit_Returns403`: `(0, null)` → 403 `forbidden: no API access`; `(-5, null)` the same.
  - `Quota_IsPerAccount`: two host tokens of one user, limit 3: two requests with the first, one with the second, the fourth (either token) → 429; another user's token → 200.
  - `Quota_RevokedTokensStillCount`: limit 2, two requests with token A, revoke A (`IApiTokenManager.RevokeAsync`), new token B → 429.
  - `Quota_DayRollsOverAtUtcMidnight`: limit 1, request at `23:59:30Z` → 200; second → 429 `Retry-After: 30`; advance the clock 31 s → 200 (new day), `X-RateLimit-Reset: 86369`.
  - `Quota_ParallelRequests_AdmitExactlyTheLimit`: limit 10, 50 parallel requests → exactly 10 × 200 and 40 × 429.
  - `QuotaResolverThrows_Returns500_NotCounted`: resolver throws `InvalidOperationException("db down")` → 500 `{"error":"internal server error"}` (body does not contain `db down`), error logged; resolver fixed → the next request's `Remaining` shows one request used.
  - `ResolverGetsTheCaller`: the resolver receives `QcliCaller` with the user id, token id, `audience == "host"`.
  - `ScopedResolver_ResolvedPerRequest`: `o.UseQuotaResolver<ScopedResolver>()` where `ScopedResolver` takes a scoped dependency → 200 (no captive-dependency exception).
  - `Usage_OnTokenViews`: three requests today with token A → alice's `GET /api/v1/qcli/tokens` (session) shows `usage.today == 3` for A and `0` for B; `IPublicApiUsage.GetAccountUsageAsync(alice.Id)` → `Today == 3`, `Quota == (3, null)`, two `Tokens`.
  - `Usage_UnknownUser_Throws404`.
  - `Headers_OnHandlerErrors`: a guarded route that returns 404 itself still carries the `X-RateLimit-*` headers.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~PublicApiQuotaTests"` — expected: build error.
- [ ] **Step 3: Implement** `PublicApiGuard.CheckAsync(HttpContext http, string? permission) : Task<IResult?>` (null = admitted) used by both the endpoint filter and the attribute (`IAsyncAuthorizationFilter`): `QcliAuthorization.AuthorizeAsync(http, null)` for row 1; rows 2-7 as C5 with the store's increment-then-check-then-compensate; windows from `TimeProvider.GetUtcNow()`; headers set on `http.Response.Headers` before the handler runs; prune at most once an hour (`PruneAsync(today - UsageRetentionDays, minute - 2)`). `InMemoryPublicApiUsageStore` keeps `Dictionary<(string TokenId, string Window), (string UserId, long Count)>` under one lock. `PublicApiUsageService` implements `IPublicApiUsage` and `IApiTokenUsageProvider` (30 dense days ending today).
- [ ] **Step 4: Run** the filter, then the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: RequirePublicApi guard (host tokens, permission, per-account daily and per-minute quotas, X-RateLimit headers), in-memory usage store, token usage"`.

### Task 4: .NET public-api plugin: public OpenAPI document and Swagger UI

**Files:**
- Create: `plugins/public-api/OpenApi/PublicApiDocumentTransformers.cs` (document and operation transformers), `plugins/public-api/OpenApi/PublicApiDocumentEndpoint.cs`
- Modify: `plugins/public-api/Extensions/CliBuilderPublicApiExtensions.cs` (`UseQodalisPublicApi`; `AddPublicApi` configures `OpenApiOptions` for `DocumentName`)
- Test: `tests/Qodalis.Cli.Tests/PublicApiOpenApiTests.cs`

**Interfaces:**
- Consumes: Task 1 `IQcliAuthorizeMetadata`; Task 3 `PublicApiOptions`.
- Produces: `public static IApplicationBuilder UseQodalisPublicApi(this IApplicationBuilder app)` — serves `GET <BasePath>/openapi.json` (middleware) and Swagger UI (`UseSwaggerUI` with `RoutePrefix = BasePath.TrimStart('/') + "/swagger"`, one endpoint `<BasePath>/openapi.json`, `ConfigObject.PersistAuthorization = false`, `ConfigObject.TryItOutEnabled = true`, `DocumentTitle` = `info.title`). Call it after `UseRouting()` and before `UseEndpoints`/`MapControllers`.

- [ ] **Step 1: Write the failing tests** (host: `services.AddOpenApi("public", o => o.ShouldInclude = d => d.GroupName == "public")` and `services.AddOpenApi("v1")`; endpoints `GET /v1/rates` `.RequirePublicApi("rates:read").WithGroupName("public").WithTags("Rates")`, `GET /v1/banks` `.RequireQcliAuthorization("banks:read", hostTokenOnly: true).WithGroupName("public")`, `GET /v1/ping` `.WithGroupName("public")` with `.WithOpenApi`-free metadata, `GET /api/v1/internal` (no group); `app.UseQodalisPublicApi()`):
  - `Document_HasOnlyPublicRoutes`: `GET /qcli/api/openapi.json` (anonymous) → 200, `Content-Type` `application/json; charset=utf-8`, `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *`; `paths` keys exactly `/v1/rates`, `/v1/banks`, `/v1/ping`; no CLI route (`/api/v1/qcli/...`) and no `/api/v1/internal`.
  - `Document_SecuritySchemeAndRequirement`: `components.securitySchemes.qcliToken` equals C6's object; top-level `security == [{"qcliToken":[]}]`.
  - `Document_RequiredPermission`: `/v1/rates.get` has `x-required-permission: "rates:read"`, `x-host-token-only: true`; `/v1/banks.get` the same with `banks:read`; `/v1/ping.get` has neither.
  - `Document_HostValuesWin`: a host document transformer that sets `servers = [https://api.example.com]`, a `qcliToken` scheme of its own and `x-required-permission: "custom"` on `/v1/ping` → all three kept as the host set them.
  - `Document_ServersFromRequest`: without host servers → `servers == [{"url":"http://localhost"}]`; with `o.ServerUrl = "https://api.ratebell.app"` → that URL.
  - `Document_IgnoresCredentials`: with `Authorization: Bearer <host token>` and with a garbage bearer → 200.
  - `Swagger_ServesUi`: `GET /qcli/api/swagger/index.html` → 200 `text/html`; the page's config (`/qcli/api/swagger/index.js` or the inline config Swashbuckle emits) references `/qcli/api/openapi.json` and no other document; `GET /qcli/api/swagger` redirects or serves the same page (assert final 200 HTML after following redirects).
  - `CustomBasePath`: `o.BasePath = "/developers/api"` → `/developers/api/openapi.json` 200, `/qcli/api/openapi.json` 404.
  - `[Theory] InvalidBasePath_Throws` for `""`, `"/"`, `"api"`, `"/api/"` → `ArgumentException("invalid public-api base path: <value>")` when `AddPublicApi` runs.
  - `MissingDocument_Throws`: `DocumentName = "nope"` → `UseQodalisPublicApi()` throws the C6 `InvalidOperationException` text with `nope`.
  - `XCodeSamples_PassThrough`: an operation transformer of the host adding `x-codeSamples: [{ "lang": "curl", "source": "curl …" }]` → present unchanged.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~PublicApiOpenApiTests"` — expected: FAIL.
- [ ] **Step 3: Implement.** `AddPublicApi` calls `services.Configure<OpenApiOptions>(DocumentName, o => { o.AddOperationTransformer(...); o.AddDocumentTransformer(...); })` — the operation transformer reads `context.Description.ActionDescriptor.EndpointMetadata.OfType<IQcliAuthorizeMetadata>().LastOrDefault()`; the document transformer is registered so it runs after the host's (it is added in `UseQodalisPublicApi` via `PostConfigure`) and only fills what is missing. `openapi.json` is produced by the keyed `IOpenApiDocumentProvider.GetOpenApiDocumentAsync`, serialized as OpenAPI 3.1 JSON; `servers` is filled per request.
- [ ] **Step 4: Run** the filter, then the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: the host's public OpenAPI document at <base>/openapi.json with the bearer scheme and required permissions, Swagger UI at <base>/swagger"`.

### Task 5: .NET public-api EF Core usage store

**Files:**
- Create: `plugins/public-api-efcore/Qodalis.Cli.Plugin.PublicApi.EfCore.csproj` (references `../public-api`; `Microsoft.EntityFrameworkCore` and `.Relational` 10.0.13 as audit-efcore), `ApiUsageEntity.cs`, `PublicApiUsageDbContext.cs` (with `public static ModelBuilder ApplyPublicApiUsageModel(this ModelBuilder modelBuilder)`), `EfCorePublicApiUsageStore.cs`, `Extensions/EfCorePublicApiUsageStoreExtensions.cs`, `README.md`
- Test: `tests/Qodalis.Cli.Tests/EfCorePublicApiUsageStoreTests.cs`

**Interfaces:**
- Consumes: Task 3 `IPublicApiUsageStore`, `CliBuilder.SetPublicApiUsageStore<T>()`.
- Produces: `CliBuilder.AddEfCorePublicApiUsageStore(Action<DbContextOptionsBuilder> configure) : CliBuilder`; table `qcli_api_usage` (`TokenId` varchar(64), `UserId` varchar(128), `Window` varchar(16), `Count` bigint; primary key (`TokenId`, `Window`); index (`UserId`, `Window`)), created on first use like `EfCoreAuditStore`, or by host migrations with `ApplyPublicApiUsageModel()`; option `UpgradeSchema`-style switch `EnsureCreated` (default true) for hosts that own the table.

- [ ] **Step 1: Write the failing tests** (SQLite in-memory shared connection, as `EfCoreAuditStoreTests`):
  - `Increment_InsertsThenUpdates`: two increments of (`t1`, `u1`, `2026-11-19`) → 1, 2; `GetAccountCountAsync("u1", "2026-11-19") == 2`.
  - `AccountCount_SumsTokens`: `t1` ×2, `t2` ×3 for `u1` → 5; `u2` unaffected.
  - `Decrement_Compensates`.
  - `TokenDays_ReturnsRange`: rows on 3 days → `GetTokenDaysAsync([t1], "2026-11-18", "2026-11-19")` holds only the two days in range.
  - `Prune_RemovesOldDaysAndMinutes`.
  - `TwoStores_ShareCounters_NeverExceed`: two `EfCorePublicApiUsageStore` instances over one SQLite file database, a `PublicApiTestHost` per store with limit 20, 60 requests split in parallel across both hosts → at most 20 admitted, at least 18.
  - `HostOwnedTable`: `EnsureCreated = false` and a table created with `ApplyPublicApiUsageModel()` → works; no `CREATE TABLE` issued (command interceptor counts).
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~EfCorePublicApiUsageStoreTests"` — expected: build error.
- [ ] **Step 3: Implement.** `IncrementAsync`: `ExecuteUpdateAsync(set Count = Count + 1)` on the key; 0 rows → insert with `Count = 1`; a unique-key `DbException` on insert → retry the update once.
- [ ] **Step 4: Run** the filter, then the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi.EfCore: usage counters in a database (qcli_api_usage), shared by every process"`.

### Task 6: .NET docs plugin

**Files:**
- Create: `plugins/docs/Qodalis.Cli.Plugin.Docs.csproj` (references `../../src/Qodalis.Cli`), `DocsOptions.cs`, `DocsPage.cs`, `DocsPageLoader.cs` (folder reading and C9 front matter), `DocsVariables.cs`, `Extensions/CliBuilderDocsExtensions.cs` (`AddDocs`, `UseQodalisDocs`), `README.md`
- Create: `tests/Qodalis.Cli.Tests/fixtures/docs/index.md`, `auth.md`, `limits.md` (C9 fixture, copied to the output directory)
- Test: `tests/Qodalis.Cli.Tests/DocsPluginTests.cs`

**Interfaces:**
- Consumes: core `CliPortalSection` (`src/Qodalis.Cli/Portal/CliPortalSection.cs`, C8; created by whichever of Tasks 3, 6, 7 runs first).
- Produces (namespace `Qodalis.Cli.Plugin.Docs`): `CliBuilder.AddDocs(Action<DocsOptions>? configure = null) : CliBuilder`; `IApplicationBuilder.UseQodalisDocs() : IApplicationBuilder`; `DocsOptions { string BasePath = "/qcli/docs"; string Title = "Guides"; string Name = "Documentation"; string? BaseUrl; IDictionary<string, string> Variables; DocsOptions AddFolder(string path) /* relative to ContentRootPath */; DocsOptions AddPage(string slug, string markdown) }`; `public sealed record DocsPage(string Slug, string Title, string Group, int Order, string Markdown)`; `internal static class DocsPageLoader { DocsPage Parse(string slug, string text); }`.

- [ ] **Step 1: Write the failing tests** in `DocsPluginTests` (a `TestServer` host with `AddCli(cli => cli.AddDocs(o => { o.Name = "RateBell API"; o.Variables["support"] = "help@ratebell.app"; o.AddFolder(<fixture dir>); }))` and `app.UseQodalisDocs()`):
  - `Pages_ListInOrder`: `GET /qcli/docs/pages` equals the C9 list JSON exactly.
  - `Page_ReplacesVariables`: `GET /qcli/docs/pages/index` → C9 `markdown`, `title` `Welcome to RateBell API`, `Cache-Control: no-cache`.
  - `Page_FrontMatterRemoved_HeadingKept`: `auth` → C9 `markdown`.
  - `BaseUrl_Option`: `o.BaseUrl = "https://api.ratebell.app"` → `index` markdown starts with `Call https://api.ratebell.app/v1/rates`.
  - `[Theory] UnknownSlug_404` for `nope`, `INDEX`, `..%2Fsecret`, `index.md` → 404 `{"error":"page not found"}`.
  - `CodePages`: `o.AddPage("errors", "# Errors\nBody")` → listed with title `Errors`, group `Guides`, order 0.
  - `[Theory] Startup_Errors`: `AddPage("Bad Slug", …)` → `invalid docs page slug: Bad Slug`; a folder with `Read Me.md` → `invalid docs page name: Read Me.md`; `AddPage("index", …)` with the fixture → `duplicate docs page: index`; missing folder → `docs folder not found: <path>`; front matter `order: x` → `invalid order in docs page: <slug>`; `Variables["baseUrl"]` → `docs variable is built in: baseUrl`; `Variables["1x"]` → `invalid docs variable: 1x`; `BasePath = "/"` → `invalid docs base path: /`.
  - `FrontMatter_Unclosed_IsBody`: `"---\ntitle: x\nbody"` → title from slug, markdown is the whole text.
  - `Parse_QuotesAndUnknownKeys` (unit, `DocsPageLoader.Parse`): `title: 'A: B'` → `A: B`; `author: x` ignored.
  - `IgnoresCredentials`: a garbage bearer → 200.
  - `PortalSection_Registered`: `GetServices<CliPortalSection>()` holds `("docs", "Guides", "/qcli/docs")`.
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~DocsPluginTests"` — expected: build error.
- [ ] **Step 3: Implement** the loader with the C9 rules (front matter parsed line by line, no YAML library) and a middleware in `UseQodalisDocs` for the two GET routes (`HEAD` too); JSON with `System.Text.Json` camelCase in the C7 field order.
- [ ] **Step 4: Run** the filter, then the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Docs: markdown guides from folders or code, front matter and variables, served as JSON at <base>/pages"`.

### Task 7: .NET portal plugin

**Files:**
- Create: `src/Qodalis.Cli/Portal/CliPortalSection.cs` (if Task 3 or 6 did not already)
- Create: `src/Qodalis.Cli/Appearance/CliColor.cs` (`public static bool IsValid(string? value)`, the patterns moved from `AdminTheme.IsColor`); Modify: `plugins/admin/Services/AdminTheme.cs` (`IsColor` delegates to it)
- Create: `plugins/portal/Qodalis.Cli.Plugin.Portal.csproj` (copy admin's dashboard targets: `PortalSourceDir` = `../../../cli-server-dashboard/portal/dist`, `PortalNpmDir` = `node_modules/@qodalis/cli-server-portal/dist`, staging `wwwroot/portal`, embedded with `GenerateEmbeddedFilesManifest`), `plugins/portal/package.json` (`"@qodalis/cli-server-portal": "^1.0.0-beta.26"`), `PortalOptions.cs` (`PortalOptions`, `PortalTheme`, `PortalThemeColors`, `PortalLink`), `PortalSiteResolver.cs`, `Extensions/CliBuilderPortalExtensions.cs` (`AddPortal`, `UseQodalisPortal`), `README.md`
- Create: `tests/Qodalis.Cli.Tests/fixtures/portal-site/index.html` (`<!doctype html><html><head><base href="/" /></head><body>portal</body></html>`), `assets/app.js`, `favicon.svg`
- Test: `tests/Qodalis.Cli.Tests/PortalPluginTests.cs`

**Interfaces:**
- Consumes: Task 3 and Task 6 sections (`CliPortalSection`).
- Produces (namespace `Qodalis.Cli.Plugin.Portal`): `CliBuilder.AddPortal(Action<PortalOptions>? configure = null) : CliBuilder`; `IApplicationBuilder.UseQodalisPortal() : IApplicationBuilder`; `PortalOptions { string Path = "/qcli/portal"; string Name = "Documentation"; string? LogoUrl; PortalTheme Theme = new(); List<PortalLink> FooterLinks; string? SitePath /* physical override, like AdminConfig.DashboardPath */ }`; `PortalTheme { PortalThemeMode Mode = System; PortalThemeColors Dark; PortalThemeColors Light }` (`PortalThemeColors` has the 21 properties of `AdminThemeColors`); `public sealed record PortalLink(string Label, string Url)`; `Qodalis.Cli.Portal.CliPortalSection(string Kind, string Title, string BasePath)` with `const string Docs = "docs", Api = "api"`.

- [ ] **Step 1: Write the failing tests** in `PortalPluginTests` (host with `AddDocs`, `AddPublicApi` (stub document), `AddPortal(o => { o.SitePath = <fixture site>; o.Name = "RateBell API"; o.FooterLinks.Add(new("Terms", "/terms")); o.Theme.Light.Primary = "#0a7"; })`, `UseQodalisDocs()`, `UseQodalisPublicApi()`, `UseQodalisPortal()`):
  - `PortalJson_BothSections`: `GET /qcli/portal/portal.json` equals `{"name":"RateBell API","logo":null,"theme":{"mode":"system","dark":{},"light":{"primary":"#0a7"}},"footerLinks":[{"label":"Terms","url":"/terms"}],"docs":{"title":"Guides","pages":"/qcli/docs/pages"},"api":{"title":"API reference","openapi":"/qcli/api/openapi.json","swagger":"/qcli/api/swagger"}}`.
  - `PortalJson_DocsOnly` and `PortalJson_ApiOnly`: the other section is `null`.
  - `[Theory] Index_ForSiteRoutes` for `/qcli/portal`, `/qcli/portal/`, `/qcli/portal/guides/auth`, `/qcli/portal/reference`, `/qcli/portal/reference/Rates` → 200 `text/html; charset=utf-8`, body contains `<base href="/qcli/portal/" />`, `Cache-Control: no-cache`; `HEAD` → 200 without body.
  - `Assets_Served`: `/qcli/portal/assets/app.js` → 200 with `Cache-Control: public, max-age=31536000, immutable`; `/qcli/portal/favicon.svg` → 200.
  - `[Theory] OtherPaths_FallThrough` for `/qcli/portal/other`, `/qcli/portal/assets/missing.js`, `/qcli/portal/guides/a/b`, `POST /qcli/portal/` → 404 (framework), not the index.
  - `RootMount_DoesNotShadowHostRoutes`: `o.Path = "/"`, host endpoints `GET /v1/rates` (returns `"rates"`) and `GET /health` → those answer as the host wrote them (also with `Accept: text/html`); `GET /` and `/guides/x` → index with `<base href="/" />`; `/portal.json` 200.
  - `NoSite_ServesNothing`: `SitePath` pointing to an empty folder and no embedded files → `/qcli/portal/` and `/qcli/portal/portal.json` 404, one warning log `[qcli] portal site not found; the portal is not served`.
  - `[Theory] Invalid_Options_Throw` with the C8 texts (name of 81 characters, logo `javascript:alert(1)`, colour `red;}`, 21 footer links, link url `ftp://x`, path `qcli`) when `UseQodalisPortal()` runs.
  - `DuplicateSection_Throws`: two `CliPortalSection` of kind `docs` → `InvalidOperationException("portal section already registered: docs")`.
  - `AdminTheme_StillValidates`: `AdminTheme.IsColor("red;}") == false`, `("#0a7") == true` (moved patterns).
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~PortalPluginTests|FullyQualifiedName~AdminThemeTests"` — expected: build error.
- [ ] **Step 3: Implement** `UseQodalisPortal` as one middleware that handles only the C8 paths (GET/HEAD) and calls `next()` for everything else, reading files from the resolved provider (`SitePath`, else the embedded `wwwroot/portal` manifest) and rewriting `<base href="/" />` once at startup.
- [ ] **Step 4: Run** the filter, then the whole suite; `dotnet build src/Qodalis.Cli.sln` must succeed with and without `../cli-server-dashboard/portal/dist` present — expected: PASS (a missing site only logs the build message, like the dashboard).
- [ ] **Step 5: Commit** `git commit -m "Portal: the prebuilt portal site at one mount with portal.json (name, logo, theme, footer links, docs and API sections); CliColor shared with the admin theme"`.

### Task 8: .NET demo wiring and READMEs of the new packages

**Files:**
- Modify: `demo/Program.cs` (and `demo/Demo.csproj` references): `AddPermissions(Rates)`, `AddPublicApi`, `AddDocs(o => o.AddFolder("docs"))`, `AddPortal`, one public endpoint `GET /v1/demo/time` `.RequirePublicApi("demo:read").WithGroupName("public")`, `services.AddOpenApi("public", o => o.ShouldInclude = d => d.GroupName == "public")`
- Create: `demo/docs/index.md`
- Modify: `plugins/public-api/README.md`, `plugins/public-api-efcore/README.md`, `plugins/docs/README.md`, `plugins/portal/README.md`, `plugins/users/README.md` (C1, C2, C4, C10 sections), `plugins/users-efcore/README.md` (C11 note), `README.md` (plugin table; `WithoutCliRoutes`), `CHANGELOG.md` (`## Unreleased` bullets)
- Test: `tests/Qodalis.Cli.Tests/DemoPublicApiSmokeTests.cs`

- [ ] **Step 1: Write the failing test** `DemoPublicApiSmokeTests.Demo_ServesPortalDocsAndApi` with `WebApplicationFactory<Demo.Program>`: `/qcli/api/openapi.json` lists `/v1/demo/time`; `/qcli/docs/pages` lists `index`; `/qcli/portal/portal.json` has both sections (skip the site assertions when no site is resolved).
- [ ] **Step 2: Run** `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj --filter "FullyQualifiedName~DemoPublicApiSmokeTests"` — expected: FAIL.
- [ ] **Step 3: Wire the demo and write the READMEs.** Each README: install, the `Add…`/`Use…` calls with RateBell-like examples, the option table with defaults, the C-section routes and texts it implements. Public-api README: quota resolver example, headers, EF Core store, C11. Users README: `GetQcliCaller`, `HostTokenOnly`, `GuardOnly`, `usage`.
- [ ] **Step 4: Run** the whole suite — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Demo and docs: public API, docs and portal plugins"`.

---
## cli-server-node

Branch: `feature/public-api`. Tests: `npx vitest run <file>` from the repo root (exits by itself); full run `npm test`; type check `npm run build`. Tests live in `src/__tests__/`; `vitest.config.ts` gains aliases for the three new packages to their `index.ts`. New plugins follow `plugins/audit`: sources at the plugin root (`index.ts`, `cli-<name>-builder.ts`, `package-info.ts`), `tsconfig.json` copied from audit, `package.json` name per Global Constraints, version `1.0.0-beta.29` (raised in Task 23), `"@qodalis/cli-server-abstractions": "file:../../packages/abstractions"`, peer `express ^4.18.0`, `files: [dist, LICENSE, README.md]`; the root `package.json` gains `file:` dependencies on them (the publish workflow already rewrites `file:` ranges). The users-plugin changes respect Part 1's packaging constraint: no import from core; core reads the new plugin fields structurally.

### Task 9: Node core and users plugin: cliRoutes, caller, host-token-only guard, usage hook, guard-only

**Files:**
- Modify: `src/create-cli-server.ts` (`MountablePlugin.cliRoutes`, option `cliRoutes` on `createCliServer`, `mountPlugin` `:405-437`), `src/auth/cli-server-auth-gate.ts` (nothing new is a CLI route when `cliRoutePrefixes` skips host-route plugins)
- Modify: `plugins/users/server-auth.ts` (`guard` `:245-269`: caller, host-token-only), `plugins/users/cli-users-builder.ts` (`requireHostToken`, `setGuardOnly`, `setTokenUsageProvider`, result fields `:447-448`), `plugins/users/models.ts` (`QcliCaller`, `ApiTokenUsage`, `ApiTokenView.usage`), `plugins/users/controllers/tokens-controller.ts` (`:19-37`), `plugins/users/services/api-token-manager.ts` (`list`), `plugins/users/services/auth-service.ts` (constant `HOST_TOKEN_REQUIRED = 'forbidden: a host token is required'`), `plugins/users/index.ts` (exports), `plugins/users/types.d.ts` or the existing Express augmentation (`qcliCaller`)
- Test: `src/__tests__/users-host-caller.test.ts`, `src/__tests__/users-token-usage.test.ts`, `src/__tests__/guard-only.test.ts`

**Interfaces:**
- Consumes: Part 1 `isHostToken`, `tokenAudience`, `AuthService.toApiTokenView`.
- Produces: C1 `QcliCaller` and `req.qcliCaller` (set by `requireAuth`, `requirePermission`, `requireHostToken`); `UsersPluginResult.requireHostToken(...permissions: string[]): RequestHandler`; `UsersPluginResult.setTokenUsageProvider(provider: TokenUsageProvider | null): void` with `type TokenUsageProvider = (tokenIds: string[]) => Promise<Record<string, ApiTokenUsage>>`; `interface ApiTokenUsage { today: number; last30Days: number; days: { date: string; requests: number }[] }`; `ApiTokenView.usage?: ApiTokenUsage` (last key); `UsersPluginResult.getUser(id: string): Promise<User | undefined>` (reads the user store; used by public-api for account usage); `CliUsersBuilder.setGuardOnly(on = true): this` (result: empty `router`, `cliRoutes: true` kept for its prefix so nothing is served there, no seeding, `protectServer` false); `MountablePlugin.cliRoutes?: boolean`; `CliServerOptions.cliRoutes?: boolean` (default true).

- [ ] **Step 1: Write the failing tests** mirroring Task 1 and Task 2 one for one (same names in camelCase `it('…')` titles, same assertions on JSON and texts):
  - `users-host-caller.test.ts` (harness of `users-host-tokens-routes.test.ts`: `createCliServer`, `addPermissions(Rates)`, users plugin mounted, host routes `cli.app.get('/host/caller', plugin.requirePermission('rates:read'), (req, res) => res.json(req.qcliCaller))`, `cli.app.get('/host/only', plugin.requireHostToken('rates:read'), …)`): `caller for a host token` (`{ userId, userName: 'alice', tokenId, audience: 'host', permissions: ['rates:read'] }`), `caller for a session` (`tokenId: null, audience: null`), `host token only refuses session and cli token` (403 `forbidden: a host token is required`), `host token only checks the audience first` (a `cli` token without the permission → the host-token text; a host token whose owner lost it → 403 `forbidden: missing permission rates:read`), `requirePermission unchanged for cli tokens and sessions`.
  - `users-token-usage.test.ts`: `no provider, no usage key`, `provider adds usage last` (30 dense days, `today`, `last30Days`), `?all=true calls the provider once with every id`, `provider failure keeps the list`, `apiTokens.list has usage, POST /tokens has none`.
  - `guard-only.test.ts`: a server `createCliServer({ cliRoutes: false })` with `new CliUsersBuilder().setOptions({ userStore, groupStore, apiTokenStore }).setGuardOnly()` sharing stores with a normal server that created alice's host token; `host route accepts the host token`; `it.each` over `GET /api/v1/qcli/commands`, `POST /api/v1/qcli/execute`, `POST /api/v1/qcli/auth/login`, `GET /api/v1/qcli/tokens`, `GET /api/v1/qcli/permissions`, `GET /api/v1/qcli/audit`, `GET /api/qcli/versions` → 404; `no seeding`; `mountPlugin of a CLI plugin logs and skips` (spy on the logger: `[qcli] CLI routes are turned off; /api/v1/qcli/jobs is not mounted`); `a cliRoutes:false plugin prefix is not a CLI route` (a stub plugin `{ prefix: '/qcli/x', router, cliRoutes: false }` on an unprotected server: a host-token bearer on `GET /qcli/x/ping` → 200).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/users-host-caller.test.ts src/__tests__/users-token-usage.test.ts src/__tests__/guard-only.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** as Tasks 1-2 describe for .NET (no HttpContext.User equivalent). `mountPlugin`: when `plugin.cliRoutes === false` skip `cliRoutePrefixes.add`; when the server's `cliRoutes` is false and the plugin's is not false, register the installed plugin, event bus and catalog hooks but not the router, and log the C10 line. `createCliServer({ cliRoutes: false })` mounts none of core's routers and attaches no socket handlers.
- [ ] **Step 4: Run** the three files, then `npm test` and `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: req.qcliCaller, requireHostToken, token usage hook, guard-only mode; core: cliRoutes option and host-route plugins"`.

### Task 10: Node public-api plugin: guard, quotas, store, usage

**Files:**
- Create: `plugins/public-api/package.json`, `tsconfig.json`, `index.ts`, `package-info.ts` (icon `🔑`), `cli-public-api-builder.ts`, `quota.ts` (`PublicApiQuota`, windows, header computation), `usage-store.ts` (`IPublicApiUsageStore`, `InMemoryPublicApiUsageStore`), `usage-service.ts` (`account`, the users usage provider), `README.md`
- Modify: `vitest.config.ts`, root `package.json`
- Test: `src/__tests__/public-api-quota.test.ts`

**Interfaces:**
- Consumes: Task 9 `requireAuth`, `QcliCaller`, `setTokenUsageProvider`, `apiTokens`.
- Produces: `class CliPublicApiBuilder { setUsers(users: { requireAuth(): RequestHandler; setTokenUsageProvider(p): void; apiTokens: { list(userId: string): Promise<ApiTokenView[]> }; users: { getUser(id: string): Promise<…> } }): this; setBasePath(path: string): this; setTitle(title: string): this; setServerUrl(url: string): this; setOpenApi(source: object | string): this; setQuota(resolver): this; setUsageStore(store: IPublicApiUsageStore): this; setUsageRetentionDays(days: number): this; setClock(now: () => Date): this /* tests */; build(): PublicApiPluginResult }`; `PublicApiPluginResult extends MountablePlugin { prefix: string; router: Router; cliRoutes: false; guard(permission?: string): RequestHandler[]; usage: { account(userId: string): Promise<PublicApiAccountUsage> }; portalSection: { kind: 'api'; title: string; basePath: string } }`. `setUsers` is required: `build()` throws `Error('public-api: setUsers(usersPlugin) is required')` without it. The store's methods are C5's, async. `setUsers` reads only members Task 9 pins on the users result (`requireAuth`, `setTokenUsageProvider`, `apiTokens`, `getUser`).

- [ ] **Step 1: Write the failing tests** in `public-api-quota.test.ts`, one `it` per .NET `PublicApiQuotaTests` case of Task 3 with the same names, limits, clock (`2026-11-19T23:59:30Z`) and expected texts, headers and counts (`Scoped resolver` → `async resolver`: a resolver returning a Promise works). Host route: `cli.app.get('/v1/rates', api.guard('rates:read'), (req, res) => res.json({ tokenId: req.qcliCaller!.tokenId }))`, mounted after `cli.mountPlugin(api)`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/public-api-quota.test.ts` — expected: FAIL (module missing).
- [ ] **Step 3: Implement.** `guard(permission)` returns `[users.requireAuth(), check]`; `check` applies C5 rows 2-7 with errors `res.status(n).json({ error })`, sets headers with `res.setHeader` before `next()`, logs resolver errors with the core logger. `InMemoryPublicApiUsageStore` uses a `Map` keyed `${tokenId}|${window}`; Node is single-threaded, so each increment-check-compensate runs without awaiting between steps for the in-memory store.
- [ ] **Step 4: Run** the file, `npm test`, `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: guard with per-account quotas and X-RateLimit headers, in-memory usage store, token usage"`.

### Task 11: Node public-api plugin: OpenAPI document and Swagger UI

**Files:**
- Modify: `plugins/public-api/cli-public-api-builder.ts`, create `plugins/public-api/openapi.ts` (document additions), `plugins/public-api/swagger.ts` (HTML page and `swagger-ui-dist` static assets); `plugins/public-api/package.json` (`"swagger-ui-dist": "^5.17.0"`)
- Test: `src/__tests__/public-api-openapi.test.ts`, fixture `src/__tests__/fixtures/public-openapi.json`

**Interfaces:**
- Consumes: Task 10 builder.
- Produces: `router` serves C6: `GET /openapi.json`, `GET /swagger` and `/swagger/` (HTML: `SwaggerUIBundle({ url: '<base>/openapi.json', dom_id: '#swagger-ui', persistAuthorization: false, tryItOutEnabled: true })`), `GET /swagger/assets/<file>` from `swagger-ui-dist`'s `getAbsoluteFSPath()` (only `swagger-ui.css`, `swagger-ui-bundle.js`, `swagger-ui-standalone-preset.js`, `favicon-32x32.png`).

- [ ] **Step 1: Write the failing tests**, the Task 4 cases that apply to a schema handed over by the host: `document is the host's with the additions` (fixture with two paths, `x-required-permission` on one, no `security`/`servers` → `qcliToken` scheme, top-level `security`, `servers: [{ url: 'http://127.0.0.1:<port>' }]` from supertest's host, the host's `x-required-permission` kept, no `x-required-permission` added where absent); `host values win` (fixture with its own `servers`, `qcliToken` and `security`); `serverUrl option`; `headers` (content type, `Cache-Control: no-cache`, `Access-Control-Allow-Origin: *`); `ignores credentials`; `swagger page points at this document only` (HTML contains `<base>/openapi.json` and `swagger-ui-bundle.js`; `GET /qcli/api/swagger/assets/swagger-ui-bundle.js` 200); `custom base path`; `it.each invalid base paths` (`''`, `'/'`, `'api'`, `'/api/'` → `invalid public-api base path: <value>` at `build()`); `file source` (a path to the fixture) and `unreadable file` (`public-api: cannot read OpenAPI document <path>` at `build()`); `x-codeSamples pass through`; `the document is not mutated between requests` (two requests with different hosts get their own `servers`).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/public-api-openapi.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** with a deep clone of the source per request (`structuredClone`) before adding `servers`.
- [ ] **Step 4: Run** the file, `npm test`, `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: the host's public OpenAPI document with the bearer scheme, Swagger UI for it"`.

### Task 12: Node docs plugin

**Files:**
- Create: `plugins/docs/package.json`, `tsconfig.json`, `index.ts`, `package-info.ts` (icon `📚`), `cli-docs-builder.ts`, `docs-pages.ts` (C9 loader, `parsePage(slug, text)`), `README.md`; fixture `src/__tests__/fixtures/docs/{index,auth,limits}.md` (C9, byte for byte)
- Modify: `vitest.config.ts`, root `package.json`
- Test: `src/__tests__/docs-plugin.test.ts`

**Interfaces:**
- Produces: `class CliDocsBuilder { setBasePath(path): this; setTitle(title): this; setName(name): this; setBaseUrl(url): this; setVariable(key, value): this; addFolder(path: string /* relative to process.cwd() */): this; addPage(slug, markdown): this; build(): DocsPluginResult }`; `DocsPluginResult extends MountablePlugin { prefix; router; cliRoutes: false; pages: DocsPage[]; portalSection: { kind: 'docs'; title; basePath } }`; `interface DocsPage { slug: string; title: string; group: string; order: number; markdown: string }`.

- [ ] **Step 1: Write the failing tests**, one per Task 6 case with the same names and expected JSON/texts (startup errors are thrown by `build()`).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/docs-plugin.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** with `fs.readdirSync`/`readFileSync` at `build()`; `baseUrl` per request `${req.protocol}://${req.get('host')}`.
- [ ] **Step 4: Run** the file, `npm test`, `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Docs: markdown guides from folders or code, front matter and variables, served as JSON"`.

### Task 13: Node portal plugin

**Files:**
- Create: `plugins/portal/package.json` (dependency `"@qodalis/cli-server-portal": "^1.0.0-beta.26"`; scripts `prebuild`/`prepublishOnly`: `node scripts/copy-portal.js`; `files` adds `site`), `tsconfig.json`, `index.ts`, `package-info.ts` (icon `🧭`), `cli-portal-builder.ts`, `portal-options.ts` (validation; colour patterns copied from `plugins/admin/services/admin-theme.ts`), `site-dir.ts` (`resolvePortalSiteDir(explicitDir?, moduleDir = __dirname, cwd = process.cwd())`, candidates as `resolveDashboardDir` with `cli-server-dashboard/portal/dist`, `<pkgRoot>/site`, `@qodalis/cli-server-portal/dist`), `scripts/copy-portal.js` (copy of `plugins/admin/scripts/copy-dashboard.js` for the portal), `README.md`; `.gitignore` entry `plugins/portal/site/`
- Create: fixture site `src/__tests__/fixtures/portal-site/` (as .NET Task 7)
- Modify: `vitest.config.ts`, root `package.json`
- Test: `src/__tests__/portal-plugin.test.ts`

**Interfaces:**
- Consumes: Task 10 and 12 `portalSection`.
- Produces: `class CliPortalBuilder { setPath(path): this; setName(name): this; setLogoUrl(url): this; setTheme(theme: { mode?: 'dark' | 'light' | 'system'; dark?: Record<string, string>; light?: Record<string, string> }): this; addFooterLink(link: { label: string; url: string }): this; addSection(plugin: { portalSection: PortalSection }): this; setSiteDir(dir: string): this; build(): PortalPluginResult }`; `PortalPluginResult extends MountablePlugin { prefix: string; router: Router; cliRoutes: false; installedPlugin }`.

- [ ] **Step 1: Write the failing tests**, one per Task 7 case (same names, JSON and texts). `RootMount_DoesNotShadowHostRoutes` runs twice: host routes registered before `mountPlugin(portal)` and after it.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/portal-plugin.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** a router with explicit routes for the C8 paths only (`router.get(['/', '/guides/:slug', '/reference', '/reference/:tag'], …)`, `/portal.json`, `/favicon.svg`, `/assets/:file`), each calling `next()` when the file does not exist; `index.html` read and rewritten once at `build()`. With `setPath('/')`, `prefix` is `/` and Express's mount does not strip anything.
- [ ] **Step 4: Run** the file, `npm test`, `npm run build` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal: the prebuilt portal site at one mount with portal.json"`.

- [ ] **Step 6: Demo and READMEs.** Modify `demo/` (the wiring of .NET Task 8: Rates permissions, `/v1/demo/time` guarded with `api.guard('demo:read')`, an OpenAPI object for it, docs folder `demo/docs`, the portal), `plugins/users/README.md` (C1, C2, C4, C10), `README.md` (plugins table, `cliRoutes`), `CHANGELOG.md` (`## Unreleased`) and the three new READMEs. Test `src/__tests__/demo-public-api.test.ts` `demo serves portal, docs and api` (as .NET `DemoPublicApiSmokeTests`); run it, then `npm test` and `npm run build` — PASS. Commit `git commit -m "Demo and docs: public API, docs and portal plugins"`.

---

## cli-server-python

Branch: `feature/public-api`. Install once per environment as CI does (`.github/workflows/build.yml:20-33`) plus the three new plugins: `pip install -e plugins/portal/ -e plugins/docs/ -e plugins/public-api/` (CI list updated in the same tasks). Tests: `python -m pytest tests/<file> -q`; full run `python -m pytest tests/ plugins/aws/tests/ -q`. `TestClient` is always used as a context manager so its portal thread exits. New plugins follow `plugins/audit`: `pyproject.toml` (hatchling, version `1.0.0b29`, raised in Task 23; dependency `qodalis-cli-server-abstractions>=1.0.0b17`, `fastapi>=0.100.0`; public-api also `qodalis-cli-server-plugin-users>=1.0.0b29`), package `qodalis_cli_<name>/__init__.py` with `__plugin_icon__` and `__all__`, plugin dataclass with `prefix`, `router`, `cli_routes = False`, `on_mount`.

### Task 14: Python core and users plugin: cli_routes, app_docs, caller, host-token-only guard, guard tags, usage hook, guard-only

**Files:**
- Modify: `src/qodalis_cli/create_cli_server.py` (`CliServerOptions.cli_routes`, `app_docs`; `mount_plugin` `:134-172`; `FastAPI(...)` `:204` with `docs_url`/`redoc_url`/`openapi_url` None when `app_docs` is False)
- Modify: `plugins/users/qodalis_cli_users/middleware/auth_middleware.py` (`permission_dependency` `:70`: tags, caller, host-token-only), `plugins/users/qodalis_cli_users/cli_users_builder.py` (`require_host_token`, `set_guard_only`, `set_token_usage_provider`), `plugins/users/qodalis_cli_users/models.py` (`QcliCaller`, `to_view` usage), `plugins/users/qodalis_cli_users/controllers/tokens_controller.py` (`list_tokens` `:219-228`), `plugins/users/qodalis_cli_users/services/api_token_manager.py` (`list`), `plugins/users/qodalis_cli_users/services/auth_service.py` (`HOST_TOKEN_REQUIRED`), `plugins/users/qodalis_cli_users/__init__.py`
- Test: `tests/test_users_host_caller.py`, `tests/test_users_token_usage.py`, `tests/test_guard_only.py`

**Interfaces:**
- Produces: C1 `QcliCaller` (in `qodalis_cli_users.models`), `request.state.qcli_caller`, `AuthContext.caller` property; `users_plugin.require_host_token(permission: str | None = None)`; dependencies returned by `require_auth`, `require_permission`, `require_host_token` carry `qcli_permission` and `qcli_host_token_only` (C3); `users_plugin.set_token_usage_provider(provider | None)`; `ApiToken.to_view(user_name, usage: dict | None = None)` appends `usage` last; `CliUsersBuilder.set_guard_only(on: bool = True)`; `CliServerOptions.cli_routes: bool = True`, `CliServerOptions.app_docs: bool = True`; plugins with `cli_routes = False` are mounted without `add_cli_route_prefix`.

- [ ] **Step 1: Write the failing tests** mirroring Task 9's (same names in snake_case, same JSON and texts; the `_make()` harness of `tests/test_users_host_tokens.py`), plus `test_require_permission_is_tagged` (`users.require_permission("rates:read").qcli_permission == "rates:read"`, `.qcli_host_token_only is False`; `require_host_token("rates:read").qcli_host_token_only is True`), and `test_app_docs_off` (`CliServerOptions(app_docs=False)` → `/docs`, `/redoc`, `/openapi.json` 404; default → 200 as today).
- [ ] **Step 2: Run** `python -m pytest tests/test_users_host_caller.py tests/test_users_token_usage.py tests/test_guard_only.py -q` — expected: FAIL.
- [ ] **Step 3: Implement** as Task 9 (errors raised as `UsersApiError` so the users plugin's handler renders `{"error": …}`).
- [ ] **Step 4: Run** the three files, then the full run — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Users: request.state.qcli_caller, require_host_token, guard tags for OpenAPI, token usage hook, guard-only mode; core: cli_routes and app_docs options"`.

### Task 15: Python public-api plugin: guard, quotas, store, usage

**Files:**
- Create: `plugins/public-api/pyproject.toml`, `plugins/public-api/README.md`, `plugins/public-api/qodalis_cli_public_api/__init__.py` (icon `🔑`), `cli_public_api_builder.py`, `quota.py`, `usage_store.py` (`IPublicApiUsageStore` ABC, `InMemoryPublicApiUsageStore` with an `asyncio.Lock`), `usage_service.py`, `headers_middleware.py` (pure ASGI: copies `scope["state"]["qcli_rate_headers"]` onto the response start message)
- Modify: `.github/workflows/build.yml` (editable installs)
- Test: `tests/test_public_api_quota.py`

**Interfaces:**
- Consumes: Task 14 `require_auth`, `QcliCaller`, `set_token_usage_provider`, `api_tokens`.
- Produces: `CliPublicApiBuilder` with `set_users(users_plugin)`, `set_base_path`, `set_title`, `set_server_url`, `set_openapi(source)`, `set_quota(resolver)`, `set_usage_store(store)`, `set_usage_retention_days(days)`, `set_clock(now: Callable[[], datetime])`, `build() -> CliPublicApiPlugin`; `CliPublicApiPlugin` dataclass: `prefix`, `router`, `cli_routes = False`, `portal_section: dict`, `usage` (with `async account(user_id) -> PublicApiAccountUsage`), `guard(permission: str | None = None)` (FastAPI dependency returning `QcliCaller`, tagged per C3 with `qcli_host_token_only = True`), `on_mount(server)` (adds the headers middleware once). `build()` without `set_users` raises `ValueError("public-api: set_users(users_plugin) is required")`.

- [ ] **Step 1: Write the failing tests**, one per .NET Task 3 case (same names in snake_case, same limits, clock, texts, headers, counts; `test_quota_parallel_requests_admit_exactly_the_limit` uses `httpx.AsyncClient(transport=ASGITransport(app))` with `asyncio.gather` of 50 requests; `scoped resolver` → `test_async_resolver`). Host route: `@app.get("/v1/rates") async def rates(caller = Depends(api.guard("rates:read"))): return {"tokenId": caller.token_id}`.
- [ ] **Step 2: Run** `python -m pytest tests/test_public_api_quota.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**: the guard dependency `Depends(users.require_auth)`, rows 2-7 raising `UsersApiError(status, text, headers=...)` (429 carries `Retry-After` and the `X-RateLimit-*` headers), on admission stores the headers in `request.state.qcli_rate_headers` for the middleware.
- [ ] **Step 4: Run** the file and the full run — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: guard with per-account quotas and X-RateLimit headers, in-memory usage store, token usage"`.

### Task 16: Python public-api plugin: OpenAPI document and Swagger UI

**Files:**
- Create: `plugins/public-api/qodalis_cli_public_api/openapi.py` (source handling, guard tags → `x-required-permission`/`x-host-token-only`, C6 additions)
- Modify: `plugins/public-api/qodalis_cli_public_api/cli_public_api_builder.py` (routes `GET /openapi.json`, `GET /swagger`, `GET /swagger/` via `fastapi.openapi.docs.get_swagger_ui_html(openapi_url=…, title=…, swagger_ui_parameters={"persistAuthorization": False, "tryItOutEnabled": True})`; the Swagger assets come from FastAPI's default CDN URLs, overridable with `set_swagger_assets(js_url, css_url)`)
- Test: `tests/test_public_api_openapi.py`

- [ ] **Step 1: Write the failing tests**, the Task 4 cases with an `APIRouter` holding `GET /v1/rates` (`Depends(api.guard("rates:read"))`, tag `Rates`), `GET /v1/banks` (`Depends(users.require_host_token("banks:read"))`), `GET /v1/ping`, mounted on the app, plus an app route `/api/v1/internal`; `set_openapi(router)`: only the three paths; `x-required-permission`/`x-host-token-only` stamped from the tags on the first two; `set_openapi(dict)` and `set_openapi(callable)` used as given (host values win); `servers` from `request.base_url` (`http://testserver`); `set_openapi(FastAPI app)` uses its routes; the remaining Task 4 cases (headers, credentials ignored, swagger page references only `<base>/openapi.json`, custom and invalid base paths, `x-codeSamples` pass-through).
- [ ] **Step 2: Run** `python -m pytest tests/test_public_api_openapi.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**: walk `route.dependant` recursively for callables with `qcli_permission`; build per request from a cached base document, deep-copied before `servers` is added.
- [ ] **Step 4: Run** the file and the full run — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "PublicApi: the host's public OpenAPI document (router, app or schema) with the bearer scheme and required permissions, Swagger UI"`.

### Task 17: Python docs plugin

**Files:**
- Create: `plugins/docs/pyproject.toml`, `plugins/docs/README.md`, `plugins/docs/qodalis_cli_docs/__init__.py` (icon `📚`), `cli_docs_builder.py`, `pages.py` (C9 loader, `parse_page(slug, text) -> DocsPage`); fixture `tests/fixtures/docs/{index,auth,limits}.md` (C9, byte for byte)
- Modify: `.github/workflows/build.yml`
- Test: `tests/test_docs_plugin.py`

**Interfaces:**
- Produces: `CliDocsBuilder` with `set_base_path`, `set_title`, `set_name`, `set_base_url`, `set_variable(key, value)`, `add_folder(path)` (relative to the working directory), `add_page(slug, markdown)`, `build() -> CliDocsPlugin` (`prefix`, `router`, `cli_routes = False`, `pages: list[DocsPage]`, `portal_section`); `@dataclass(frozen=True) class DocsPage: slug: str; title: str; group: str; order: int; markdown: str`.

- [ ] **Step 1: Write the failing tests**, one per Task 6 case (startup errors raised by `build()` as `ValueError` with the C9 texts).
- [ ] **Step 2: Run** `python -m pytest tests/test_docs_plugin.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**; files read with `encoding="utf-8"` and newline normalisation to `\n` (the fixture's expected `markdown` uses `\n` on every OS).
- [ ] **Step 4: Run** the file and the full run — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Docs: markdown guides from folders or code, front matter and variables, served as JSON"`.

### Task 18: Python portal plugin, demo and READMEs

**Files:**
- Create: `plugins/portal/pyproject.toml` (`[tool.hatch.build] artifacts = ["qodalis_cli_portal/site/**"]`), `plugins/portal/package.json` (`"@qodalis/cli-server-portal": "^1.0.0-beta.26"`), `plugins/portal/scripts/copy_portal.py` (as `plugins/admin/scripts/copy_dashboard.py`), `plugins/portal/README.md`, `plugins/portal/qodalis_cli_portal/__init__.py` (icon `🧭`), `cli_portal_builder.py`, `options.py` (validation, colour patterns from `plugins/admin/qodalis_cli_admin/services/admin_theme.py`), `site_resolver.py` (as `dashboard_resolver.py` for `cli-server-dashboard/portal/dist` and `@qodalis/cli-server-portal/dist`); fixture site `tests/fixtures/portal-site/`
- Modify: `.github/workflows/build.yml`, `.gitignore` (`plugins/portal/qodalis_cli_portal/site/`), `demo/` (wiring as .NET Task 8), `plugins/users/README.md`, `README.md`, `CHANGELOG.md`
- Test: `tests/test_portal_plugin.py`, `tests/test_demo_public_api.py`

**Interfaces:**
- Consumes: Task 15 and 17 `portal_section`.
- Produces: `CliPortalBuilder` with `set_path`, `set_name`, `set_logo_url`, `set_theme(dict)`, `add_footer_link(label, url)`, `add_section(plugin)`, `set_site_dir(path)`, `build() -> CliPortalPlugin` (`prefix`, `router` with explicit routes for the C8 paths only, `cli_routes = False`).

- [ ] **Step 1: Write the failing tests**, one per Task 7 case (same names, JSON and texts); `test_root_mount_does_not_shadow_host_routes` registers the host route before and after `mount_plugin(portal)`; plus `test_demo_serves_portal_docs_and_api`.
- [ ] **Step 2: Run** `python -m pytest tests/test_portal_plugin.py tests/test_demo_public_api.py -q` — expected: FAIL.
- [ ] **Step 3: Implement**: explicit routes for the C8 paths only (so no other path is captured, whatever the order); a missing asset answers the framework's 404. Write the READMEs (same content as .NET Task 8 in Python idiom) and the CHANGELOG bullets.
- [ ] **Step 4: Run** the files and the full run — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal: the prebuilt portal site at one mount with portal.json; demo and docs for the public API, docs and portal plugins"`.

---
## cli-server-dashboard (portal site and the token usage column)

Branch: `feature/public-api`. The repo becomes an npm workspace root with one member, `portal/`; the dashboard stays at the root (its `src/`, `vite.config.ts`, `index.html` do not move). Tests: dashboard `npm test`; portal `npm test -w portal` (vitest run, jsdom per file with `// @vitest-environment jsdom`, `fetch` stubbed with `vi.stubGlobal` as in `src/api/logs.test.ts`); builds `npm run build` and `npm run build -w portal`; lint `npm run lint` covers both. No `vite` dev server is started by any step.

### Task 19: Portal app: workspace, shell, theme, guides

**Files:**
- Modify: `package.json` (`"workspaces": ["portal"]`), `package-lock.json` (regenerated by `npm install`), `eslint.config.*` (include `portal/src`), `.gitignore` (`portal/dist`)
- Create: `portal/package.json` (`"name": "@qodalis/cli-server-portal"`, `"version": "1.0.0-beta.26"`, `"type": "module"`, `"files": ["dist"]`, scripts `build: "tsc -b && vite build"`, `test: "vitest run"`; dependencies `react`, `react-dom`, `react-router` at the dashboard's ranges, `react-markdown ^9`, `remark-gfm ^4`, `rehype-highlight ^7`, `highlight.js ^11`; devDependencies as the dashboard's build/test set), `portal/vite.config.ts` (`base: './'`, `root: __dirname`, alias `@dashboard` → `../src`, `server.fs.allow: ['..']`, `test.setupFiles: ['../src/test/setup.ts']`), `portal/tsconfig.json` (includes `src`, `../src/theme`, `../src/components`), `portal/tailwind.config.ts` (content `./index.html`, `./src/**/*`, `../src/components/**/*`; colours from `../src/theme/tokens`), `portal/postcss.config.js`, `portal/index.html` (exactly one `<base href="/" />` in `<head>`, `<link rel="icon" href="favicon.svg">`, title `Documentation`), `portal/public/favicon.svg`
- Create: `portal/src/main.tsx`, `portal/src/config.ts` (`loadPortalConfig(): Promise<PortalConfig>`, `basePath(): string` from `new URL(document.baseURI).pathname`), `portal/src/theme.ts` (`applyPortalTheme(config.theme)` over the dashboard's `buildThemeCss`/`applyTheme`; reader toggle stored in `localStorage` key `qcli_portal_theme`, wrapped in try/catch), `portal/src/layout/PortalLayout.tsx` (header with logo, name, theme toggle; sidebar navigation: "Guides" groups then "API reference" tags; footer links; mobile drawer), `portal/src/guides/GuidesApi.ts` (`listPages(url)`, `getPage(url, slug)`), `portal/src/guides/GuidePage.tsx` (react-markdown + remark-gfm + rehype-highlight, `skipHtml`), `portal/src/pages/HomePage.tsx`, `portal/src/pages/NotFoundPage.tsx`, `portal/src/App.tsx` (routes `/`, `/guides/:slug`, `/reference`, `/reference/:tag`, `*`)
- Test: `portal/src/config.test.ts`, `portal/src/App.test.tsx`, `portal/src/guides/GuidePage.test.tsx`

**Interfaces:**
- Consumes: C7 and C8 JSON (mocked).
- Produces: `interface PortalConfig { name: string; logo: string | null; theme: { mode: 'dark' | 'light' | 'system'; dark: Record<string, string>; light: Record<string, string> }; footerLinks: { label: string; url: string }[]; docs: { title: string; pages: string } | null; api: { title: string; openapi: string; swagger: string } | null }`; `interface DocsPageSummary { slug: string; title: string; group: string; order: number }`, `interface DocsPage extends DocsPageSummary { markdown: string }`; the `App` route table above, used by Task 20 for `/reference`.

- [ ] **Step 1: Write the failing tests:**
  - `config.test.ts`: `loads portal.json relative to the base` (jsdom with `<base href="/developers/">` → fetch called with `/developers/portal.json`); `basePath of a root mount is "/"`; `a failed portal.json shows the error state` (rejects with `Error('portal.json: 500')`).
  - `App.test.tsx` (fetch fake routing `portal.json`, `/qcli/docs/pages`, `/qcli/docs/pages/index`, `/qcli/api/openapi.json` to the C8/C9 example bodies): `docs and api on: navigation has the guide groups in order (Guides: Limits and quotas, Welcome to RateBell API; Basics: Authentication) and an API reference entry`; `docs only: no API entry`; `api only: home redirects to /reference`; `neither: "Nothing published yet"`; `home shows the index page when it exists, else the first page`; `unknown route shows Not found`; `name and logo in the header, footer links rendered with their urls`; `theme from portal.json is applied (style#qcli-theme contains --qcli-primary)`; `theme toggle switches data-qcli-theme and survives a throwing localStorage`.
  - `GuidePage.test.tsx`: `renders headings, tables and fenced code with highlight classes`; `raw HTML in markdown is not rendered` (`<script>` and `<img onerror>` absent from the DOM); `a missing page (404) shows Not found`; `relative links like ./auth navigate inside the portal` (`[x](auth)` → `/guides/auth`).
- [ ] **Step 2: Run** `npm install && npm test -w portal` — expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the files above, reusing `../src/theme/*` and self-contained dashboard components (`Badge`, `Tooltip`, `ErrorBoundary`, `PageHeader`); none that need the dashboard's i18n provider. English strings inline.
- [ ] **Step 4: Run** `npm test -w portal`, `npm run build -w portal` (output `portal/dist/index.html` contains `<base href="/" />` once and only relative `./assets/` URLs: `grep -c '<base href="/" />' portal/dist/index.html` prints `1`, `grep -c 'src="/assets' portal/dist/index.html` prints `0`), `npm test`, `npm run build`, `npm run lint` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal: second app (@qodalis/cli-server-portal): shell, theme, navigation and markdown guides from portal.json"`.

### Task 20: Portal API reference, code samples and "try it"

**Files:**
- Create: `portal/src/reference/openapi.ts` (`loadDocument(url)`, `resolveRef`, `groupByTag(doc): { tag: string; description?: string; operations: Operation[] }[]` (untagged operations under `Other`), `operationId(op)`), `portal/src/reference/codeSamples.ts`, `portal/src/reference/ReferencePage.tsx` (overview: info, servers, authentication with the `qcliToken` scheme, the tag list, a link to `api.swagger`), `portal/src/reference/TagPage.tsx` (operations of one tag: method, path, summary, description, `x-required-permission` badge, parameters table, request body and response schemas as collapsible trees, code-sample tabs, try-it panel), `portal/src/reference/SchemaView.tsx`, `portal/src/reference/TryIt.tsx`
- Test: `portal/src/reference/codeSamples.test.ts`, `portal/src/reference/openapi.test.ts`, `portal/src/reference/TagPage.test.tsx`, `portal/src/reference/TryIt.test.tsx`

**Interfaces:**
- Consumes: Task 19 `PortalConfig`, routes.
- Produces: `type SampleLang = 'curl' | 'javascript' | 'python' | 'csharp' | 'php' | 'go' | 'java'`; `SAMPLE_LANGS: { lang: SampleLang; label: string }[]` in that order with labels `cURL, JavaScript, Python, C#, PHP, Go, Java`; `generateSample(lang: SampleLang, req: SampleRequest): string`; `interface SampleRequest { method: string; url: string /* server url + path with example path params, query appended */; headers: Record<string, string> /* Authorization: Bearer YOUR_TOKEN, plus Content-Type for a JSON body */; body?: string /* pretty JSON from the schema's example / examples / generated from the schema */ }`; `samplesFor(op, serverUrl): { lang: string; label: string; source: string }[]` — generated ones, each replaced by the host's `x-codeSamples` entry whose `lang` matches case-insensitively (aliases: `shell`/`bash`/`sh` → curl, `js`/`node` → javascript, `c#`/`cs`/`dotnet` → csharp, `golang` → go), host entries for other languages appended after.

Generated sample shapes (pinned): curl `curl -X GET 'URL' \` + `-H 'Authorization: Bearer YOUR_TOKEN'` lines + `-d '<json>'`; JavaScript `fetch(URL, { method, headers, body })` with `await response.json()`; Python `requests.request(method, url, headers=..., json=...)`; C# `HttpClient` with `HttpRequestMessage` and `DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "YOUR_TOKEN")`; PHP `curl_init` / `curl_setopt_array` with `CURLOPT_HTTPHEADER`; Go `http.NewRequest` + `http.DefaultClient.Do`; Java `java.net.http.HttpClient` with `HttpRequest.newBuilder(URI.create(...))`. Every sample contains the literal `YOUR_TOKEN` and never a pasted token.

- [ ] **Step 1: Write the failing tests:**
  - `codeSamples.test.ts`: `it.each(SAMPLE_LANGS)` for `GET https://api.example.com/v1/rates/md?currency=EUR` → contains the method, the full URL and `YOUR_TOKEN`; a `POST` with body `{"a":1}` → every language carries the JSON and a `Content-Type: application/json` header; snapshot each language's GET sample (inline snapshots, reviewed once); `path params use examples, else {name}` (`/v1/rates/{country}` with example `md` → `/v1/rates/md`; without example → `/v1/rates/{country}`); `quotes in values are escaped per language` (a query value `a'b"c`); `host x-codeSamples replace the generated language and extra languages are appended` (`[{lang:'shell',source:'X'},{lang:'Ruby',source:'Y'}]` → curl source `X`, a `Ruby` tab last).
  - `openapi.test.ts`: `groups by tag in document order with Other last`; `resolves $ref in parameters, bodies and responses, and stops on cycles`; `servers missing → the document's own origin`.
  - `TagPage.test.tsx`: `shows operations of the tag with method, path and the permission badge (x-required-permission)`; `parameters table lists path and query parameters with required marks`; `code tabs switch languages`; `unknown tag shows Not found`.
  - `TryIt.test.tsx`: `sends the request with the pasted token and shows status, X-RateLimit headers and body` (fetch stub asserts `Authorization: Bearer qcli_pat_x` and URL `https://api.example.com/v1/rates/md`); `the token is not stored` (after typing and sending: `localStorage`, `sessionStorage`, `document.cookie` and `location.href` do not contain `qcli_pat_x`; the input has `type="password"` and `autocomplete="off"`); `the token is kept while switching operations in the same tab and gone after a remount`; `a network/CORS failure shows "Request failed: <message>"`; `invalid JSON body shows "Body is not valid JSON" and sends nothing`.
- [ ] **Step 2: Run** `npm test -w portal` — expected: the new specs FAIL.
- [ ] **Step 3: Implement.** The pasted token lives in a React context provider above the routes (memory only).
- [ ] **Step 4: Run** `npm test -w portal`, `npm run build -w portal`, `npm run lint` — expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Portal: API reference per tag from the OpenAPI document, code samples in seven languages (host x-codeSamples win), try it with a token kept in memory"`.

### Task 21: Dashboard usage column, publishing both packages, versions

**Files:**
- Modify: `src/api/tokens.ts` (`ApiTokenView.usage?: { today: number; last30Days: number; days: { date: string; requests: number }[] }`), `src/pages/tokens/TokensPage.tsx` (a "Requests today" column shown only when at least one token has `usage`; cell `today`, tooltip `Last 30 days: <n>`), `src/i18n/messages/tokens.ts` (`tokens.requestsToday`, `tokens.last30Days` in the 10 languages)
- Modify: `.github/workflows/build.yml` (lint, test and build for both workspaces), `.github/workflows/publish.yml` (loop over `.` and `portal`: the existing "skip when `name@version` is published" check, then `npm publish --access public`)
- Modify: `CHANGELOG.md` (`## 1.0.0-beta.26`: usage column; new package `@qodalis/cli-server-portal`), `package.json` version `1.0.0-beta.26`, `package-lock.json`; create `portal/README.md` (what the site is, `portal.json` contract C8, how servers embed it, `<base href>` rewrite) and `portal/CHANGELOG.md` (`## 1.0.0-beta.26` first release)
- Test: `src/pages/tokens/TokensPage.test.tsx`

- [ ] **Step 1: Write the failing tests** in `TokensPage.test.tsx`: `no usage → no Requests today column`; `usage → column with today's count and the 30-day tooltip`; `mixed tokens (one without usage) → shows "–" for it`.
- [ ] **Step 2: Run** `npm test` — expected: the new specs FAIL.
- [ ] **Step 3: Implement** the column and translations; update the workflows and the version/CHANGELOG files.
- [ ] **Step 4: Run** `npm ci && npm run lint && npm test && npm test -w portal && npm run build && npm run build -w portal` — expected: PASS; `npm pack --dry-run -w portal` lists `dist/index.html` and `dist/assets/*` only.
- [ ] **Step 5: Commit** two commits: `git commit -m "Tokens: requests today and the last 30 days when the server counts API usage"` (dashboard files) and `git commit -m "1.0.0-beta.26: token usage column; @qodalis/cli-server-portal published from portal/"` (workflows, versions, changelogs, READMEs).

---

## Docs and release

### Task 22: AI guide, web-cli changelog and cross-repo doc check

**Files:**
- Modify: `web-cli/docs/ai/03-server-plugins.md` (new heading `### Public API, docs and portal plugins (all servers)` after `### Permission catalog and host tokens (all servers)`, at most 30 lines: the three plugins per server with their add/mount calls, `RequirePublicApi` / `guard` / `Depends(guard)`, the quota resolver signature, the headers and the 429/403 texts, `GetQcliCaller` / `req.qcliCaller` / `request.state.qcli_caller`, `HostTokenOnly` / `requireHostToken` / `require_host_token`, guard-only + without CLI routes, `portal.json`), `web-cli/CHANGELOG.md` (`## Unreleased`: a line pointing at the server plugins; no web-cli package changes)
- Check: every README and CHANGELOG written in Tasks 8, 13, 18, 21 against the contract (each quoted route, field and error text greps to the same string in this plan)

- [ ] **Step 1: Write the AI-guide section and the changelog line.**
- [ ] **Step 2: Verify:** `node tools/build-llms.js` exits 0 and `apps/docs/src/static/llms-full.txt` (git-ignored) contains `Public API, docs and portal plugins`; for each of `forbidden: a host token is required`, `quota exceeded: `, `too many requests: `, `forbidden: no API access`, `page not found`, `portal.json`, `X-RateLimit-Remaining`: `grep -rl` finds it in each server repo's README of the plugin that answers it.
- [ ] **Step 3: Commit** in web-cli: `git commit -m "Docs: public API, docs and portal plugins in the AI guide"`; fix and commit any README mismatch in its own repo (`git commit -m "Docs: align with the public API contract"`).

### Task 23: Versions (after the portal's npm release)

Runs only after `@qodalis/cli-server-portal@1.0.0-beta.26` and `@qodalis/cli-server-dashboard@1.0.0-beta.26` are on npm (cli-server-dashboard `feature/public-api` merged and `main` fast-forwarded by the user) and the servers' Part 1 version (`1.0.0-beta.29`) is the current one. Done exactly like Part 1's bump commits: every package's own version, the README "Versioning" line, `## Unreleased` renamed, internal ranges untouched.

- [ ] **Step 1: .NET:** every `*.csproj` of the solution including the four new ones → `<Version>1.0.0-beta.30</Version>`; `plugins/admin/package.json` dashboard pin `^1.0.0-beta.26`; `plugins/portal/package.json` portal pin `^1.0.0-beta.26`; `CHANGELOG.md` `## 1.0.0-beta.30`. Run `dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj` and `dotnet build src/Qodalis.Cli.sln --configuration Release` (portal site embedded from npm when the sibling dist is absent) — PASS. Commit `git commit -m "chore: every package at 1.0.0-beta.30; admin embeds dashboard 1.0.0-beta.26, portal embeds the portal site 1.0.0-beta.26"`.
- [ ] **Step 2: Node:** root `package.json`, `packages/abstractions/package.json`, every `plugins/*/package.json` and the lockfiles → `1.0.0-beta.30`; the same two pins; `npm test && npm run build` — PASS; same commit message.
- [ ] **Step 3: Python:** root `pyproject.toml`, `packages/abstractions/pyproject.toml`, every `plugins/*/pyproject.toml` → `1.0.0b30`; the two `package.json` pins; full pytest run — PASS; same commit message with `1.0.0b30`.
- [ ] **Step 4: Verify** in each repo `grep -rn "1.0.0-beta.29\|1.0.0b29" --include='*.csproj' --include='package.json' --include='pyproject.toml' . | grep -v node_modules` shows only internal dependency ranges.
- [ ] **Step 5: Final process sweep:** `ps aux | grep -E "nx.js|karma|ChromeHeadless|vitest|testhost|uvicorn|vite" | grep -v grep` prints nothing.
- [ ] **Step 6:** Push and open PRs into `develop` only when the user asks.

---
## Self-review

- **Spec coverage (Parts 2 and 3).** Plugins named like their siblings — Global Constraints, Tasks 3, 6, 7, 10, 12, 13, 15, 17, 18. Host hands over its public document (.NET named `Microsoft.AspNetCore.OpenApi` document, Python app/router/schema, Node object/file), served without sign-in at `<base>/openapi.json` with the bearer scheme and `x-required-permission` from the guard where the framework allows — C3, C6, Tasks 4, 11, 16. Swagger UI for that document only — C6, Tasks 4, 11, 16. Reference per tag with samples in curl, JavaScript, Python, C#, PHP, Go, Java, host `x-codeSamples` winning, try-it with an in-memory token — Task 20. Guard after the token check, counted per token and day, limits from the host per principal (per day, per minute, null = unlimited), checked per account, 429 + `Retry-After`, `X-RateLimit-*` — C5, Tasks 3, 10, 15. Store, in-memory default, EF Core for .NET — C5, Tasks 3, 5. `usage` (today, last 30 days) on `GET /tokens` and through the manager — C4, Tasks 2, 9, 14. Default base `/qcli/api` — C6. Docs: folder pages with `title`/`group`/`order`, pages in code, `{{baseUrl}}`, `{{name}}`, host variables, JSON at `<base>/pages[/slug]`, default `/qcli/docs` — C7, C9, Tasks 6, 12, 17. Name, logo, colours, footer links, light/dark — C8 (portal options), Tasks 7, 13, 18, 19. Portal `@qodalis/cli-server-portal`, second app in the dashboard repo, React/Vite/Tailwind with the dashboard's components, embedded like the dashboard, one navigation, each plugin alone, English only — C8, Tasks 7, 13, 18, 19-21. Part 1 gaps: (a) caller — C1, Tasks 1, 9, 14; (b) host-token-only — C2, same tasks; (c) guard-only — C10, Tasks 2, 9, 14; (d) documented — C11, Tasks 8, 22. Docs, changelogs, AI guide — Tasks 8, 13 (Step 6), 18, 21, 22. Versions after the portal's npm release — Task 23.
- **Names across tasks** checked: `QcliCaller`, `GetQcliCaller`, `IQcliAuthorizeMetadata`, `QcliAuthorizeEndpointMetadata`, `HostTokenOnly`/`requireHostToken`/`require_host_token`, `IApiTokenUsageProvider`/`setTokenUsageProvider`/`set_token_usage_provider`, `ApiTokenUsage`, `GuardOnly`/`setGuardOnly`/`set_guard_only`, `WithoutCliRoutes`/`cliRoutes`/`cli_routes`, `PublicApiOptions`, `PublicApiQuota`, `IPublicApiQuotaResolver`, `IPublicApiUsageStore`, `IPublicApiUsage`, `RequirePublicApi`, `guard`, `CliPortalSection`/`portalSection`/`portal_section`, `DocsOptions`, `PortalOptions`, `PortalConfig`, `SampleLang`.
- **Review Focus** items each have a named test in the owning task (Tasks 3, 5, 7 and their mirrors).
- **Proportion.** Most of the length is the contract shared by five repos and the test lists; bodies are left to the implementers except the admission algorithm (C5) and the front-matter rules (C9), which three servers must implement identically.

### Decisions this plan made that the spec left open

1. **A third plugin, portal**, owns the embedded site, its mount and `portal.json`; docs and public-api only expose a section (core record in .NET DI, a result property in Node/Python handed to the portal builder), so neither depends on the other or on the portal. Branding, colours and footer links are portal options, not docs options.
2. **The site learns its mount from `<base href>`** (built with `base: './'`, rewritten by the servers) and **which parts are on from `portal.json`**; it answers only its own fixed paths, so a root mount never shadows host routes.
3. **Markdown is rendered by the site**; servers return markdown with front matter removed and variables replaced (one renderer instead of three). Front matter is a minimal `key: value` parser, no YAML dependency; top-level files only.
4. **Code samples are generated by the site**, not the servers.
5. **Public-api guard requires a `host` token** (sessions and `cli` tokens refused) and uses its own error texts, identical on all servers; a limit of `0` is a 403, not a 429.
6. **Fixed UTC windows** (calendar day, calendar minute); headers describe the daily limit when set; headers omitted when unlimited; refused requests are not counted; revoked tokens keep counting for the account that day.
7. **Admission is increment-then-check-then-compensate** in the store, so several processes never exceed a limit.
8. **Caller identity**: a `QcliCaller` on all three servers; .NET also sets `HttpContext.User` on guarded routes (with token and audience claims).
9. **Guard-only** is two switches: core without CLI routes and users guard-only. Python also gets `app_docs` to turn FastAPI's own whole-app `/docs` and `/openapi.json` off.
10. **Versions**: new server packages ship at `1.0.0-beta.30`; the portal starts at `1.0.0-beta.26` together with the dashboard.

### Spec statements that do not match the code

- "colours (the CLI's existing `Branding` and dashboard theme options)": there is no core branding; `AdminBranding`/`AdminTheme` live in each admin plugin. The portal reuses their shape and validation rules (.NET moves the colour patterns to core `CliColor`), not the types.
- "embedded by the servers the way the dashboard is": the dashboard's base path is fixed at build time (`base: '/qcli/admin/'`), so it cannot be mounted at a host-chosen path; the portal needs the runtime `<base href>` rewrite instead.
- Node `mountPlugin` and Python `mount_plugin` register every plugin prefix as a CLI route (host tokens refused there); a portal at `/` would turn every route into a CLI route. Hence `cliRoutes: false` / `cli_routes = False` (C10).
- Python core already serves FastAPI's `/docs` and `/openapi.json` for the whole app (CLI routes included), which contradicts the anti-goal "the app's endpoints appearing in the public Swagger"; `app_docs=False` turns that off (default unchanged).
- "taken from the guard where the framework allows it": .NET's `RequireQcliAuthorization` is an endpoint filter, invisible to OpenAPI, so the plan adds endpoint metadata; Express exposes nothing, so Node takes `x-required-permission` from the host's schema only.
- "Counters live in a store … so several processes share them": only the EF Core store (.NET) is shared; Node and Python ship the in-memory store only (as their users stores), so a multi-process Node/Python host must supply its own `IPublicApiUsageStore`.
- The host-route guards' 403 texts differ per server today (Part 1 C6); the public-api guard therefore pins its own texts rather than reusing them.
- "sends `X-RateLimit-Limit/Remaining/Reset` on every answer": there is no limit to describe for an unlimited account or before the caller is known (401/403), so the headers are omitted there.
