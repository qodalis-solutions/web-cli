# MCP endpoint and API tokens (servers 1.0.0-beta.7, web-cli 2.0.0-beta.15)

Status: approved 2026-10-15. Applies identically to `cli-server-node`, `cli-server-python`
and `cli-server-dotnet`; web-cli adds the `token` commands. One contract, three servers:
behaviour, status codes and JSON shapes below are normative.

## Goals

- **MCP endpoint**: AI clients (Claude Code, Claude Desktop, Cursor, …) call the server's
  CLI commands as MCP tools, with the same permissions as a CLI user.
- **API tokens**: long-lived, revocable bearer tokens for MCP clients, CI and scripts
  (sessions expire and need a password sign-in).

## Part 1 — API tokens (users plugin)

### Model

```
ApiToken {
  id: string            // random, url-safe
  userId: string
  name: string          // 1-64 chars, [A-Za-z0-9._ -], unique per user (case-insensitive)
  tokenHash: string     // same hashing as session tokens; the token itself is never stored
  createdAt: number     // epoch ms
  expiresAt: number | null
  lastUsedAt?: number   // updated at most once per 60 s
  permissions?: string[] // optional scope, see below
}
```

Token format: `qcli_pat_` + 32 random bytes, base64url without padding (so a token is
recognisable and the server can route it to the token store without a session lookup).

Stored in a new `ApiTokenStore` (in-memory implementation, same pluggable pattern as the
other stores: interface + `InMemory…` + builder option to replace it).

### Endpoints (users plugin prefix, next to `/sessions`)

| Method | Path | Who | Result |
|---|---|---|---|
| GET | `/api/v1/qcli/tokens` | any signed-in user | own tokens (array of views) |
| GET | `/api/v1/qcli/tokens?all=true` | `tokens:read` | every user's tokens |
| POST | `/api/v1/qcli/tokens` | any signed-in user, **session only** | `201 { token, apiToken }` |
| DELETE | `/api/v1/qcli/tokens/{id}` | owner, or `tokens:revoke` | `204` |

View (never contains the token or hash):
`{ id, name, userId, userName, createdAt, expiresAt, lastUsedAt, permissions }`
(`permissions` omitted/null when unscoped, `lastUsedAt` null when never used).

POST body: `{ name: string, expiresInDays?: number | null, permissions?: string[] }`
- `expiresInDays`: integer 1-365, default 90. `null` (never expires) only when the
  builder option `allowNonExpiringTokens` is true, else 400.
- `permissions`: optional scope. Every entry must be a valid permission string and be
  covered by the caller's current effective permissions (same check as granting a group
  permission) — else 403 `forbidden: cannot grant <perm>`.
- 400 for invalid/duplicate name (`409` for duplicate), max **20** tokens per user (`400`).
- Creating a token **requires a session**: a request authenticated by an API token gets
  `403 forbidden: API tokens cannot create tokens`. (A leaked token can't mint more.)

Unknown id or another user's token without `tokens:revoke` → `404`.

### Authentication

`Authorization: Bearer qcli_pat_…` is accepted everywhere a session bearer token is:
- look up by hash; missing or expired → `401`; user missing or disabled → `401`;
  `mustChangePassword` → same 403 rule as sessions.
- Effective permissions: the user's live effective permissions; if the token has a scope,
  keep only scope entries the user still holds (`hasPermission(userPerms, scopeEntry)`).
- The auth context records `apiTokenId` (no session). Server auth context (`toServerContext`)
  gets `tokenId`.
- Long-lived sockets opened with a token identity are re-checked like session identities:
  token revoked/expired or user disabled → close `4401 "session ended"`.
- `GET /sessions/current` and `DELETE /sessions/current` with a token → `404` (`not a session`).
  Password changes with a token → `403 forbidden: API tokens cannot change passwords`.

### Lifecycle and audit

- Audit events: `token_created`, `token_revoked` (details: token name and id; actor = caller).
- Deleting a user deletes their tokens. Disabling a user makes their tokens fail (no deletion).
- Declared permissions: `tokens:read`, `tokens:revoke` (admin gets them through `*`).

## Part 2 — MCP endpoint (core server)

### Enabling

Opt-in server option (off by default), language-idiomatic names:

```
mcp: boolean | {
  enabled?: boolean        // default true when the object is given
  tools?: string[]         // allow-list of tool names; trailing * allowed ("weather_*")
  exclude?: string[]       // deny-list, same syntax, applied after tools
  token?: string           // only WITHOUT an auth provider: required static bearer token
  instructions?: string    // returned by initialize
}
```

### Route and transport

- `POST /api/qcli/mcp` — MCP "Streamable HTTP", **stateless** (no `Mcp-Session-Id`),
  **JSON responses only** (`Content-Type: application/json`; no SSE stream).
- `GET` / `DELETE /api/qcli/mcp` → `405` with `Allow: POST`.
- If an `Origin` header is present it must be allowed (server `allowedOrigins`) or
  same-origin, else `403` (DNS-rebinding protection required by the MCP spec).
- JSON-RPC 2.0 over the body. Notifications (no `id`, e.g. `notifications/initialized`)
  → `202` with empty body. Malformed JSON → JSON-RPC `-32700`; invalid request `-32600`;
  unknown method `-32601`; bad params `-32602`. JSON-RPC errors use HTTP 200.
- Use the language's official MCP SDK when it supports this mode cleanly inside the
  existing app/route and auth; otherwise implement the small stateless subset directly.
  Either way the observable behaviour is this spec.

### Authentication and authorization

- With an auth provider protecting the server (users plugin): the existing server auth
  gate authenticates the request (sessions or API tokens). Route-level permission:
  `commands:execute` (add `/api/qcli/mcp` to `requiredServerPermissions`).
  401/403 are plain HTTP errors with the usual `{ "error": … }` body.
- Without an auth provider: if `mcp.token` is set, require `Authorization: Bearer <token>`
  (constant-time compare, else 401); if not set, the endpoint is as open as `/execute`.

### Methods

- `initialize` → `{ protocolVersion, capabilities: { tools: { listChanged: false } },
  serverInfo: { name: "qodalis-cli-server", version: <server version> }, instructions? }`.
  Supported versions: `2025-06-18`, `2025-03-26` (and newer ones the SDK supports).
  Echo the client's requested version if supported, else the newest supported.
- `ping` → `{}`.
- `tools/list` → `{ tools: [...] }` (no pagination; ignore `cursor`).
- `tools/call` → see below. Other methods → `-32601`.

### Tools

Built from the command registry on every request (so registration changes and the
caller's permissions are always current):

- Walk each root processor and its sub-processors. A node becomes a tool when it has no
  sub-processors, **or** declares parameters, **or** takes a value (`valueRequired` /
  `acceptsRawInput` or the language equivalent).
- Name: the command path joined with `_` (`weather`, `weather_current`), lower-cased,
  characters outside `[a-z0-9_-]` replaced by `-`, max 64 chars. On a collision the
  first one wins (log a warning).
- Visible only if: allowed by `tools`/`exclude`, and the caller holds `commands:execute`
  plus every `requiredPermissions` along the chain (when an auth provider is active).
  The interactive shell is never a tool.
- `description`: the processor description (fallback: `Run '<command path>'`).
- `inputSchema`:
  `{ type: "object", properties, required, additionalProperties: false }` —
  one property per parameter (`string`→string, `number`→number, `boolean`→boolean,
  `array`→array of strings, anything else→string; `description`, `default` when known;
  required when the parameter is required) plus `value` (string, the positional input)
  when the processor takes a value (required when `valueRequired`).

### tools/call

- Unknown or not-visible tool → JSON-RPC `-32602` (`Unknown tool: <name>`); invalid
  arguments (wrong type, unknown property, missing required) → `-32602` with the reason.
- Builds the same command the CLI would send (`command`, `chainCommands`, `value`, args)
  and runs it through the **same executor and context as `/execute`** (so per-command
  behaviour, permission checks and any auditing are identical).
- Result: `{ content: [{ type: "text", text }], isError }` where `text` is the outputs
  rendered as plain text (text lines as-is; tables as header + rows separated by ` | `;
  lists one item per line; json pretty-printed; key-value as `key: value`), `isError` is
  `exitCode != 0`. When the outputs are exactly one json output whose value is an object,
  also return it as `structuredContent`.
- Execution exceptions → `isError: true` with the message (not a JSON-RPC error).

## Part 3 — web-cli (`@qodalis/cli-users`)

Commands (server mode; local mode prints `API tokens are available when the CLI is
connected to a server (usersModule.configure({ server }))`):

- `token create <name> [--expires=<days>|never] [--permissions=a,b]` → prints the token
  once with a warning that it is not shown again, plus a ready-to-paste example:
  `claude mcp add --transport http qcli <server>/api/qcli/mcp --header "Authorization: Bearer <token>"`.
- `token list [--all]` → table NAME, ID, EXPIRES, LAST USED, SCOPE (+ USER with `--all`).
- `token revoke <id>`.
Backend contract (`ICliUsersBackend`) gets optional `listApiTokens`, `createApiToken`,
`revokeApiToken`; the HTTP backend implements them.

## Versions

Servers: every changed package → `1.0.0-beta.7` (Python `1.0.0b7`). web-cli: `2.0.0-beta.15`.

## Verification

Each server: unit/integration tests for tokens (create/list/revoke, scope, expiry, session-only
creation, revoked token → 401, socket closed on revoke) and MCP (initialize, ping, list filtered
by permissions and allow/deny lists, call success/error/unknown/invalid args, origin check,
405s, static token without users plugin). Then one cross-server end-to-end run in Docker.
