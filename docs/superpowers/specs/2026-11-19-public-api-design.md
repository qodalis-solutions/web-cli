# Public API toolkit (token permissions, docs and API plugins) and RateBell's public API

Date: 2026-11-19. Status: design, waiting for approval.

## Intent

Other platforms (websites, apps, back-office systems) should be able to build on RateBell's rates. RateBell
gets a public API for **rates and banks only**. Everything generic that this needs is built in the Qodalis CLI
servers, the dashboard and web-cli, so any host application can publish an API the same way; RateBell only
configures it.

## Goals

1. API tokens (`qcli_pat_…`) get **selectable permissions**: the host and the plugins declare the permissions
   that exist, and the dashboard and the console let a user pick them.
2. A host's own routes can require such a token and a permission, for accounts that are not CLI users.
3. A **public-api plugin**: a public OpenAPI document and Swagger UI holding only the public endpoints, an
   API reference with code examples in common languages, per-token usage counts and quotas.
4. A **docs plugin**: a customizable documentation site (the host's markdown guides, name, logo, colours).
5. RateBell: a separate C# service, `RateBell.PublicApi`, with its own endpoints, its own Swagger, a
   Developers page for tokens, quotas by plan and a per-source republishing rule.

## Non-goals

- Bots, alerts, accounts, billing or anything else of a user's through the public API. Read-only rates and banks.
- OAuth, acting for another user, webhooks, client SDK packages.
- A separate price list for the API: access and quotas come from the existing plans.
- Translating the documentation (English first). Search-engine rendering of the docs site.

## Anti-goals

- A public response that republishes a source whose terms forbid it.
- An integrator's token reaching the CLI's own routes (console commands, dashboard, files, jobs).
- The app's endpoints (`/api/v1`) appearing in the public Swagger, or becoming a contract by accident.
- Behaviour that differs between the .NET, Node and Python servers.

## Approaches

- **A. Tokens guard ordinary host routes, docs come from OpenAPI (chosen).** The host writes its public
  endpoints in its own framework; the plugins add the permission list, the token guard, quotas, Swagger, the
  reference and the docs site. Fits RateBell's `Endpoints/<Name>` layout and each server's idioms.
- **B. The plugin owns the public API** (endpoints declared through a plugin builder). The same on all three
  servers, but it reinvents routing and fights host conventions.
- **C. Public API as CLI commands over `/execute` and MCP.** Cheapest, but not the REST API other systems expect.

The user chose A, asked for a separate Swagger with only the public endpoints, and for RateBell a **separate
C# API** so the two APIs are not mixed.

## What exists (checked 2026-11-19, servers at 1.0.0-beta.28)

- Tokens already store `permissions` (null = everything the user holds). Creating one checks only the syntax
  (`resource:action`) and that the caller holds each entry (`AuthService.CreateApiTokenAsync`, .NET :971;
  Node `auth-service.ts:685`; Python `tokens_controller.py:56`). A scoped token is narrowed against the
  user's live permissions on every request (`ScopePermissions`).
- Host-route guards exist and accept tokens: .NET `[QcliAuthorize("perm")]` / `.RequireQcliAuthorization`,
  Node `usersPlugin.requirePermission(...)`, Python `users_plugin.require_permission(p)`.
- There is **no list of known permissions** anywhere (only constants: `UsersPermissions`, `CliRoutePolicy`,
  commands' `RequiredPermissions`), and no endpoint that lists them.
- The dashboard's New token form takes permissions as free text (`NewTokenModal.tsx:158`); the console takes
  `token create <name> --permissions=a,b`.
- Tokens record only `lastUsedAt`; there are no request counts or quotas.
- `POST /tokens` needs a session and takes the caller as the owner; there is no host-facing service to create
  a token for a given user.
- The dashboard is the only static site a plugin serves (`/qcli/admin`); Node and Python can mount another
  one generically, .NET needs its own `Use…` extension.

## Part 1: selectable token permissions (three servers, dashboard, web-cli)

**Permission catalog.** Core gets a registry of permissions: `name`, `description`, `group` (a heading such
as "Files" or "Rates"), `surface` (`cli` or `host`). Core and every plugin register the permissions they
check (`commands:execute`, `files:*`, `jobs:*`, `tokens:*`, …) as `cli`. The host adds its own as `host`:

```csharp
cli.AddPermissions(p => p.Group("Rates")
    .Add("rates:read", "Official exchange rates")
    .Add("banks:read", "Banks and their buy and sell rates"));
```

Node: `builder.addPermissions([...])`; Python: `builder.add_permissions([...])`. The catalog is for choosing,
not for validation: unknown or wildcard entries stay accepted as today (commands declare free-form
permissions).

**Endpoint.** `GET /api/v1/qcli/permissions`: the catalog entries the caller holds (so they are exactly what
the caller may put on a token); `?all=true` needs `users:read` and returns everything.

**Tokens for host accounts.** The users plugin exposes a host service (`IApiTokenManager`: create, list,
revoke for a user id; same validation, limits, audit and events as the HTTP routes), so a host can offer
tokens on its own pages to accounts that never sign in to the CLI.

**Host tokens.** A token has an `audience`: `cli` (the default, today's behaviour, unchanged) or `host`.
Only `IApiTokenManager` creates `host` tokens (never the HTTP route). A `host` token's permissions are
required (never unscoped) and each must be a `host`-surface catalog entry the user holds; anything else is
refused at creation. A `host` token is refused (403) on every CLI route whatever the route requires, also
when its permissions have shrunk to none, and is accepted only by the host-route guards. Sessions are not
affected. This is what lets a host admit every account as a token holder without opening the console, the
dashboard or the unguarded CLI routes to them. Stores (in-memory, EF Core, the Node and Python ones) gain
the column, defaulting to `cli` for existing rows.

**Dashboard.** New token: "Everything I can do" (unscoped, as today) or "Selected", a checkbox list from
`/permissions` grouped by `group` with descriptions, plus an "other" field for entries not in the catalog.
The tokens table keeps its chips, with the description as a tooltip. Translated in the 10 languages.

**Console (`@qodalis/cli-users`).** `token create <name> --select` opens a multi-select of the same list;
`token permissions` prints it. `--permissions=a,b` stays.

## Part 2: public-api plugin (three servers)

Named like its siblings (`Qodalis.Cli.Plugin.PublicApi`, the Node and Python equivalents).

- **OpenAPI.** The host hands over the public document: .NET names a `Microsoft.AspNetCore.OpenApi`
  document, Python passes the FastAPI app or a schema, Node passes a schema object or a file. The plugin
  serves it without sign-in at `<base>/openapi.json`, adds the bearer security scheme and each operation's
  required permission (`x-required-permission`, taken from the guard where the framework allows it).
- **Swagger UI** at `<base>/swagger`, for that document only.
- **Reference.** A page per tag listing operations, parameters and schemas, with code examples generated
  from the operation in curl, JavaScript, Python, C#, PHP, Go and Java, the host's own `x-codeSamples`
  winning when present, and a "try it" box using a token the reader pastes (kept in memory only).
- **Usage and quotas.** A guard for public routes that, after the token check, counts the request per token
  and day and applies the limits the host returns for that principal (`requests per day`, `per minute`;
  null = unlimited). **The quota is per account**: requests are counted per token (for display) and the
  limit is checked against the sum over the account's tokens, so more tokens never mean more requests. Answers `429` with `Retry-After` and sends `X-RateLimit-Limit/Remaining/Reset`.
  Counters live in a store (in-memory by default; EF Core for .NET, as the other plugins do) so several
  processes share them. `GET /api/v1/qcli/tokens` adds `usage` (today, last 30 days) for the dashboard and
  for hosts through `IApiTokenManager`.
- `<base>` is the host's choice (default `/qcli/api`).

## Part 3: docs plugin (three servers) and the portal site

- **Content.** Markdown pages from a folder (front matter: `title`, `group`, `order`) or added in code;
  `{{baseUrl}}`, `{{name}}` and host-defined variables are replaced. Served as JSON (`<base>/pages`,
  `<base>/pages/{slug}`).
- **Customizing.** Name, logo, colours (the CLI's existing `Branding` and dashboard theme options), footer
  links, the mount path (default `/qcli/docs`), light and dark.
- **Portal site.** One prebuilt static site, `@qodalis/cli-server-portal`, a second app in the
  cli-server-dashboard repo (React, Vite, Tailwind, the dashboard's components), embedded by the servers the
  way the dashboard is. It shows the guides when the docs plugin is on and the API reference when the
  public-api plugin is on, in one navigation; each plugin also works alone.

## Part 4: RateBell

**Service.** `server/src/RateBell.PublicApi`, a third ASP.NET service beside `RateBell.Api` and
`RateBell.Jobs`, same conventions (`Endpoints/<Name>/{Ioc,Models,Services}`, `Result<T>`, `Error{code,text}`),
reusing Core and Infrastructure (`IRatesService`, `IRateStore`, `IOfficialRateReader`, the catalogs). Own
container (`ratebell-<channel>-public-api`), own image in `publish.yml`, served at `https://api.ratebell.app`
(dev: `api.dev.ratebell.app`). It hosts the CLI's users plugin (token check against the shared `api_tokens`
table), the public-api plugin and the docs plugin, and nothing else of the CLI (no console, no dashboard).
Its Swagger is public and holds only its endpoints. Docs at `/`, reference and Swagger under it.

**Endpoints** (`/v1`, JSON, camelCase, own response models so the app's can change freely):

| Route | Permission | Returns |
|---|---|---|
| `GET /v1/countries` | `rates:read` | countries, their currencies and sources |
| `GET /v1/countries/{country}/banks` | `banks:read` | banks: id, name, short name, website |
| `GET /v1/rates/{country}` | `rates:read` | official rates; with `banks:read` also bank buy/sell and the best per currency |
| `GET /v1/rates/{country}/official?currency&from&to` | `rates:read` | official rate per day, averages |
| `GET /v1/rates/{country}/history?currency&source&from&to` | `rates:read` (`banks:read` for a bank source) | history of one source |
| `GET /v1/rates/{country}/on?date&currency` | `rates:read` | rates on a date |

Every response carries `sources` (name, website, credit) for the rates in it. `Cache-Control` of a minute.

**Republishing rule.** `SourceDefinition` gets `Republish` (allowed or not, overridable by
`Sources:<id>:Republish`) and a credit line. Official sources are allowed where their terms say so (BNM is
CC BY 4.0; BNR stays off until its reuse terms are confirmed); **banks default to not allowed** until marked.
`IRepublishPolicy` filters the public API only. **The widget does not change**: it keeps its own
`Widget:HiddenSources` list and shows what it shows today (it displays rates with a credit and a link; the
API hands out the data itself, which is the stricter case). A hidden source is absent from responses, not
an error; a country whose official source is hidden answers with its banks only, or 404 `no_public_rates`
when nothing is left. Which banks are marked allowed at launch is the user's decision (open); the bank
endpoints, `banks:read` and `ApiBankRates` ship either way and simply return the banks that are marked.

**Plans.** Two new limits on `PlanDefinition`, managed on the admin Plans page like the others:
`ApiRequestsPerDay` (0 = no API access) and `ApiBankRates` (holds `banks:read`). The plan gives an account
its `host` permissions; the public-api plugin's quota callback reads the plan. Seeds: Free 100 a day without
banks, Plus 5,000 with banks, Premium 50,000 with banks (the user sets the real numbers).

**Accounts as token holders.** `CliUserStore` returns any enabled account for a token lookup, with the plan's
`rates:read` / `banks:read`; only staff stay CLI users for sessions. The Developers page creates `host`
tokens, which `RateBell.Api`'s CLI routes refuse. `CliAccess`, `CliUserStore` and `CliGroupStore` move to a
project both services reference.

**Developers page.** `/developers` on the website, public, in the footer and `lib/nav.ts`, translated like
the other pages: what the API offers (rates and banks), a short example request and response, the limits per
plan, the credit rule, and links to the docs, the reference and Swagger on `api.ratebell.app`. Signed in, the
same page has the account's tokens: create one with
checkboxes for what the plan allows, see it once, list, revoke, today's usage against the quota. Signed
out, that section asks to sign in. Settings links to it. Backed by `RateBell.Api` endpoints (`/api/v1/developer/tokens`) over `IApiTokenManager`. Signing
out everywhere, disabling or deleting an account removes its tokens, as today.

**Also.** API terms of use page (credit required, no resale of raw data, quotas); `privacy.html` if anything
new is collected; a `CHANGELOG.md` line; edge and NPM entries for the new hostnames; `docs/` guides in the
repo (getting started, authentication, limits, sources and credits, errors).

## Order and releases

1. Part 1: servers 1.0.0-beta.29 (all packages together), dashboard, `@qodalis/cli-users`.
2. Parts 2 and 3: the two plugins and the portal, next server version.
3. Part 4: RateBell, once the packages are on NuGet and npm.

Each part gets its own implementation plan and feature branch per repo; all three servers stay in step.

## Left to the builder

Package and class names following the siblings; the portal's layout and visual design; storage schema of
the usage counters; exact option names; how each framework reads a route's required permission into
OpenAPI; test layout. The AI guide (`web-cli/docs/ai`) and the server READMEs gain the new plugins.

## Verification

- Each server: catalog and `/permissions` tests, token creation with selected permissions, an API-only token
  refused on CLI routes and accepted on a guarded host route, quota headers and 429, the OpenAPI document
  listing only public routes, the docs pages served.
- Dashboard and console: picking permissions creates the same token as typing them.
- RateBell: a Free token reads official rates, gets 403 on banks and 429 past its quota; a source marked not
  republishable is absent from every public response and from the widget; the public Swagger lists no
  `/api/v1` route; a token is refused by `RateBell.Api`'s CLI routes.
