# Remote Shell (`ssh`) Command Design

## Summary

Add SSH-like remote shell execution to the Qodalis CLI. Users type `ssh <server>` for an interactive shell session or `ssh <server> <command>` for one-shot execution. Works across all server backends (.NET, Node, Python) via a common WebSocket protocol.

## WebSocket Protocol

Endpoint: `/ws/cli/shell`
Query params: `?cmd=<url-encoded-command>` (one-shot mode), `?cols=<n>&rows=<n>` (initial terminal size)

All messages are JSON text frames with a `type` discriminator.

### Client -> Server

| Type | Payload | Description |
|------|---------|-------------|
| `stdin` | `{ data: string }` | Raw terminal input (keystrokes, escape sequences) |
| `resize` | `{ cols: number, rows: number }` | Terminal dimension change |

### Server -> Client

| Type | Payload | Description |
|------|---------|-------------|
| `stdout` | `{ data: string }` | Shell output (ANSI escape sequences pass through) |
| `stderr` | `{ data: string }` | Shell error output |
| `exit` | `{ code: number }` | Shell process exited |
| `error` | `{ message: string }` | Server-side error (spawn failed, not supported, etc.) |
| `ready` | `{ shell: string, os: string }` | Session established |

### Connection Lifecycle

1. Client opens WebSocket to `/ws/cli/shell?cols=80&rows=24`
2. Server spawns PTY with OS-appropriate shell
3. Server sends `ready` with shell/OS info
4. Bidirectional stdin/stdout streaming
5. On process exit: server sends `exit`, closes socket
6. On client disconnect: server kills PTY process

### One-Shot Mode

1. Client opens `/ws/cli/shell?cmd=ls%20-la&cols=80&rows=24`
2. Server spawns shell, feeds command, waits for exit
3. Server streams `stdout`/`stderr`, sends `exit`, closes socket
4. Client collects output, renders inline (no full-screen)

## Server Capability Discovery

New endpoint on all server backends:

```
GET /api/cli/capabilities
```

Response:
```json
{
  "shell": true,
  "os": "linux",
  "shellPath": "/bin/bash",
  "version": "1.0.0"
}
```

The client checks this during `CliServerConnection.connect()` and stores the result. The `ssh` command only appears for servers that report `shell: true`.

## Client-Side Architecture

### `ssh` Command Processor

Top-level command registered by the server module when at least one server supports shell.

**Interactive mode** (`ssh <server>`):
- Calls `context.enterFullScreenMode(this)`
- Opens WebSocket to server's `/ws/cli/shell`
- `onData(data)` -> sends `{ type: "stdin", data }` over WebSocket
- WebSocket `stdout` messages -> `context.terminal.write(data)`
- `onResize(cols, rows)` -> sends `{ type: "resize", cols, rows }`
- On `exit` message -> `context.exitFullScreenMode()`
- On `error` message -> show error, exit full-screen
- Ctrl+D or shell `exit` -> server process exits -> `exit` message -> done

**One-shot mode** (`ssh <server> <command>`):
- Opens WebSocket with `?cmd=...`
- Collects `stdout`/`stderr` output
- Writes to terminal inline (no full-screen)
- Waits for `exit` message, propagates exit code

**Server selection:**
- `ssh <server>` — explicit server
- `ssh` (no args, one shell-capable server) — use it directly
- `ssh` (no args, multiple shell-capable servers) — prompt via `readSelectInline`

### Connection Handling

- WebSocket URL derived from server's HTTP URL (same as event socket pattern)
- Auth headers from `CliServerConfig.headers` sent as WebSocket protocols or query params
- Connection timeout from `CliServerConfig.timeout`
- If WebSocket drops mid-session, show error and exit full-screen

## .NET Server Changes

### New Endpoint: `/ws/cli/shell`

Replace existing raw `/ws/cli` with structured `/ws/cli/shell`. Uses `Pty.Net` NuGet package for real PTY allocation.

Flow:
1. Accept WebSocket, parse query params (`cmd`, `cols`, `rows`)
2. Detect OS, pick shell (`bash`/`zsh` on Linux/macOS, `cmd.exe`/`powershell` on Windows)
3. Spawn PTY via `Pty.Net` with initial dimensions
4. Send `ready` message
5. Read loop: PTY output -> JSON `stdout` frame -> WebSocket
6. Write loop: WebSocket -> parse JSON -> PTY stdin write (for `stdin`) or PTY resize (for `resize`)
7. On PTY exit: send `exit` frame with code, close WebSocket
8. On WebSocket close: kill PTY process

### New Endpoint: `/api/cli/capabilities`

Returns server capabilities including shell support, OS, and shell path.

### Deprecate `/ws/cli`

The old raw-byte endpoint is replaced by `/ws/cli/shell`. Remove or keep as legacy with a deprecation notice.

## File Changes

### web-cli (client)

| File | Change |
|------|--------|
| `packages/core/src/lib/models/server.ts` | Add `CliServerCapabilities` type |
| `packages/cli/src/lib/server/cli-server-connection.ts` | Fetch capabilities during `connect()`, store on connection |
| `packages/cli/src/lib/server/cli-ssh-command-processor.ts` | **New.** Top-level `ssh` command with full-screen interactive + one-shot modes |
| `packages/cli/src/lib/server/cli-server-module.ts` | Register `CliSshCommandProcessor` |
| `packages/cli/src/lib/server/cli-server-manager.ts` | Register `ssh` processor when shell-capable servers exist |
| `packages/cli/src/lib/server/index.ts` | Export new file |

### cli-server-dotnet

| File | Change |
|------|--------|
| `src/Qodalis.Cli/Extensions/WebApplicationExtensions.cs` | Add `/ws/cli/shell` endpoint, add `/api/cli/capabilities`, deprecate `/ws/cli` |
| `src/Qodalis.Cli/Qodalis.Cli.csproj` | Add `Pty.Net` NuGet dependency |
| `src/Qodalis.Cli/Services/ShellSessionManager.cs` | **New.** PTY lifecycle management |

## Security

Dev/demo only for v1. Auth relies on existing `CliServerConfig.headers` passed during WebSocket upgrade. No command allowlists or audit logging. Future versions can add `allowShell` config flag and server-side restrictions.

## Testing

- Build verification: `pnpm run build:core && pnpm run build:cli`
- Manual: start .NET server, configure in Angular demo, test `ssh dotnet`, `ssh dotnet ls -la`
- Verify Ctrl+C sends interrupt, terminal resize works, `exit` returns to local CLI
- Verify one-shot mode returns output inline
- Verify multi-server prompt when >1 server supports shell
