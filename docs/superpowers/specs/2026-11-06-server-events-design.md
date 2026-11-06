# Server events: an event bus, events for every change, scoped delivery

Date: 2026-11-06. Applies to cli-server-dotnet, cli-server-node, cli-server-python (1.0.0-beta.23), the
dashboard (1.0.0-beta.18) and web-cli (2.4.0).

## Problem

`/ws/v1/qcli/events` exists on every server, but:

- The servers can only broadcast a raw string to every connected socket. Plugins and host apps cannot react
  to an event in code (there is no in-process subscriber).
- Only the jobs scheduler (`job:*`) and the users plugin (`session-kicked`, `session-ended`, `access-changed`)
  publish anything. Changing a user, a token, a file or a job's options publishes nothing, so the dashboard
  cannot update live.
- Every broadcast reaches every connected socket, including terminal users without admin rights.
- The .NET jobs scheduler nests its events (`{type, data: {jobId}}`); Node, Python, the dashboard and the
  terminal read them flat (`{type, jobId}`). On .NET the job pages never refresh live.

## Wire format (all servers)

One JSON object per WebSocket text message, flat, camelCase:

```json
{ "type": "job:completed", "timestamp": "2026-11-06T10:15:00.000Z", "jobId": "cleanup", "executionId": "…", "duration": 1520 }
```

- `type`: `namespace:name` (lowercase, words joined by `-`, e.g. `job:runs-deleted`). Existing names stay.
- `timestamp`: ISO 8601 UTC, added by the bus when the publisher did not set one.
- The publisher's fields are merged into the object; `type` and `timestamp` are reserved.
- `actor` (optional): the user name that caused the change, when known.
- Existing control messages are unchanged: `connected`, `disconnect`, `session-kicked`, `session-ended`,
  `access-changed`.

## Audience (who receives an event)

Every event carries an audience, which is not sent on the wire:

| Audience | Delivered to |
|---|---|
| everyone (default) | every connected event socket |
| `permission: "jobs:read"` | sockets whose principal has that permission |
| `userId: "u1"` | sockets authenticated as that user |
| both | the user **or** anyone with the permission |

On a server without authentication (sockets have no principal), every event goes to every socket. In-process
subscribers receive every event regardless of audience.

## Server-side event bus

Each server registers one bus. The events WebSocket is one subscriber of `*` that applies the audience.

Pattern matching, same as web-cli's `matchesEventPattern`: `*` matches everything, `ns:*` every type that
starts with `ns:`, anything else must equal the type.

Publishing never fails the action that publishes: handler exceptions are logged and delivery continues to the
other handlers. Handlers run in subscription order; publish completes when they all completed.

### .NET (`Qodalis.Cli.Abstractions.Events`)

```csharp
public sealed class CliEvent
{
    public required string Type { get; init; }
    public DateTime Timestamp { get; init; }            // UTC
    public IReadOnlyDictionary<string, object?> Data { get; init; }   // the publisher's fields
    public CliEventAudience Audience { get; init; } = CliEventAudience.Everyone;
}

public sealed record CliEventAudience(string? Permission = null, string? UserId = null)
{
    public static CliEventAudience Everyone { get; }
    public static CliEventAudience WithPermission(string permission);
    public static CliEventAudience User(string userId);
}

public interface ICliEventBus
{
    // data: an anonymous object, a dictionary or a POCO; serialized camelCase and merged into the message
    Task PublishAsync(string type, object? data = null, CliEventAudience? audience = null,
        CancellationToken cancellationToken = default);
    IDisposable Subscribe(string pattern, Func<CliEvent, CancellationToken, Task> handler);
}

public static class CliEventPattern { public static bool Matches(string type, string pattern); }
```

`CliEventBus` (in `Qodalis.Cli`) is registered as a singleton by `AddCli`. `ICliEventSocketManager` keeps
`BroadcastMessageAsync`/`SendToUserAsync` for compatibility.

### Node (`@qodalis/cli-server-abstractions` types, `CliEventBus` in `@qodalis/cli-server-node`)

```ts
interface CliEvent { type: string; timestamp: string; data: Record<string, unknown>; audience: CliEventAudience }
interface CliEventAudience { permission?: string; userId?: string }
interface ICliEventBus {
    publish(type: string, data?: Record<string, unknown>, audience?: CliEventAudience): Promise<void>;
    subscribe(pattern: string, handler: (event: CliEvent) => void | Promise<void>): () => void;
}
function cliEventPatternMatches(type: string, pattern: string): boolean;
```

`createCliServer` returns `eventBus`; plugins and builders take it instead of a raw broadcast function (the
broadcast-function parameters keep working).

### Python (`qodalis_cli_server_abstractions` protocol, `CliEventBus` in `qodalis_cli`)

```python
@dataclass
class CliEvent: type: str; timestamp: str; data: dict[str, Any]; audience: CliEventAudience
@dataclass
class CliEventAudience: permission: str | None = None; user_id: str | None = None
class ICliEventBus(Protocol):
    async def publish(self, type: str, data: dict | None = None, audience: CliEventAudience | None = None) -> None: ...
    def subscribe(self, pattern: str, handler: Callable[[CliEvent], Awaitable[None] | None]) -> Callable[[], None]: ...
def cli_event_pattern_matches(type: str, pattern: str) -> bool: ...
```

`CliServerResult.event_bus`; plugins take it instead of a raw broadcast function (which keeps working).

## Event catalog

Publish at the layer every caller goes through (REST API, MCP tools and server commands alike), so a host's
own job manager, user store or file system provider gets the events too.

### Jobs (audience `jobs:read`)

| Type | Fields | Published by |
|---|---|---|
| `job:started` | jobId, executionId | scheduler (existing) |
| `job:completed` | jobId, executionId, duration | scheduler (existing) |
| `job:failed` | jobId, executionId, error | scheduler (existing) |
| `job:cancelled`, `job:timed_out` | jobId, executionId | scheduler (existing) |
| `job:retrying` | jobId, executionId, attempt, maxRetries, delayMs | scheduler (existing) |
| `job:paused`, `job:resumed`, `job:stopped` | jobId, **status** (`paused`, `active`, `stopped`) | scheduler (existing; add status) |
| `job:triggered` | jobId | jobs API / MCP / command (new) |
| `job:updated` | jobId | jobs API / MCP / command, after an options change (new) |
| `job:runs-deleted` | jobId, executionId (one run) or count (bulk) | jobs API / MCP (new) |

### Users plugin

| Type | Fields | Audience |
|---|---|---|
| `user:created`, `user:updated`, `user:deleted` | userId, username | `users:read` |
| `group:created`, `group:updated`, `group:deleted` | group (name or id) | `groups:read` |
| `token:created`, `token:revoked` | tokenId, name, userId | `tokens:read` or the owner |
| `session:opened`, `session:closed` | userId, username, sessionId | `sessions:read` |

`user:updated` covers profile, password, enabled/disabled and group membership changes.
`session:closed` covers sign-out, expiry clean-up and kicks (the user-scoped `session-kicked`/`session-ended`
signals stay as they are).

### Files (audience `files:read`)

| Type | Fields |
|---|---|
| `fs:changed` | action (`upload`, `mkdir`, `delete`, `write`, `move`, `copy`), path, (newPath for move/copy) |

### Commands (audience `audit:read`)

| Type | Fields |
|---|---|
| `command:executed` | command (the processor name only, never arguments or input), success, durationMs, userId? |

### Audit (audience `audit:read`)

| Type | Fields |
|---|---|
| `audit:recorded` | the audit entry as the audit API returns it |

Not in this round: data explorer queries (reads are noisy and writes are not distinguishable everywhere).

## Consumers

Dashboard (`WebSocketContext.subscribe` already supports `*` and `ns:*`):

- Jobs list: any `job:*` reloads the jobs and the runs shown (debounced), instead of patching a `status` the
  events never carried.
- Job detail: reloads on any event of its job (`job:updated`, `job:runs-deleted` included).
- Users, groups, tokens, sessions views: reload on `user:*`, `group:*`, `token:*`, `session:*`.
- File browser: reloads the open folder on `fs:changed` inside it.
- Audit page: reloads (or prepends) on `audit:recorded`.
- Overview and Events pages show the new events as they are.

Terminal (web-cli): server events reach the terminal bus as `server:event {server, type, data}`. The existing
`events` command shows them next to the terminal's own events (one command for both):

- `events watch [pattern]` / `events log [pattern]` match a server event by its own type (`job:*`), still by
  `server:*`, and print it with the server name and the time the server sent it.
- `--server <name>` keeps one server's events, `--local` only the terminal's own.
- Server events stay wrapped in `server:event` on the bus: a server's `user:*` or `session:*` events never
  reach plugins listening for the terminal's own events of those names, and `events emit` cannot fake the
  `server` namespace. Delivery is scoped by the servers (audience above); the terminal's rule that hides its
  own `user:*` events without `audit:read` stays.
