# SSE Streaming Command Execution — Design Spec

## Goal

Add Server-Sent Events (SSE) streaming to the CLI server command execution flow so the frontend can render output incrementally instead of waiting for the entire response.

## Problem

Currently, `POST /api/v1/qcli/execute` returns a single JSON response after the command finishes. For long-running commands (HTTP requests, data queries, system operations), the user sees only a spinner until completion.

## Solution

Add a streaming execution endpoint (`POST /api/v1/qcli/execute/stream`) that returns `text/event-stream`. Processors opt-in to streaming via a separate `ICliStreamCommandProcessor` interface. Non-streaming processors are auto-wrapped: their full response is emitted as a single SSE burst.

## Architecture

### SSE Event Protocol

Three event types flow from server to client:

```
event: output
data: {"type":"text","value":"Fetching data...","style":"info"}

event: output
data: {"type":"table","headers":["ID","Name"],"rows":[["1","foo"]]}

event: done
data: {"exitCode":0}

event: error
data: {"message":"Connection refused"}
```

- `output` — A single `CliServerOutput` object (text, table, list, json, key-value). Sent as many times as needed.
- `done` — Signals command completion. Contains `exitCode`. Always the last event on success.
- `error` — Unrecoverable execution failure. Contains `message`. Terminates the stream.

### Backend: Separate Interface for Streaming

A new `ICliStreamCommandProcessor` interface sits alongside the existing `ICliCommandProcessor`. Processors implement one or both. The registry only cares about `ICliCommandProcessor` for discovery — `ICliStreamCommandProcessor` is a runtime capability check.

#### Node.js (TypeScript)

```typescript
// packages/abstractions/src/cli-stream-command-processor.ts
import { CliProcessCommand } from './cli-process-command';
import { CliServerOutput } from './cli-server-output';

export interface ICliStreamCommandProcessor {
    readonly command: string;
    handleStreamAsync(
        command: CliProcessCommand,
        emit: (output: CliServerOutput) => void,
    ): Promise<number>; // returns exit code
}
```

#### Python

```python
# packages/abstractions/src/qodalis_cli_abstractions/stream_command_processor.py
class ICliStreamCommandProcessor(ABC):
    command: str

    @abstractmethod
    async def handle_stream_async(
        self,
        command: CliProcessCommand,
        emit: Callable[[CliServerOutput], None],
    ) -> int:
        """Execute command, calling emit() for each output chunk. Returns exit code."""
        ...
```

#### .NET

```csharp
// src/Qodalis.Cli.Abstractions/ICliStreamCommandProcessor.cs
public interface ICliStreamCommandProcessor
{
    string Command { get; }
    Task<int> HandleStreamAsync(
        CliProcessCommand command, Action<CliServerOutput> emit);
}
```

### Backend: Stream Execution Endpoint

`POST /api/v1/qcli/execute/stream`

- Same request body as `/execute` (`CliProcessCommand` JSON).
- Response: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
- The executor resolves the processor from the registry:
  - If the processor implements `ICliStreamCommandProcessor`, call `handleStreamAsync()` and emit each output as an SSE `output` event, then send `done`.
  - If the processor does NOT implement `ICliStreamCommandProcessor`, fall back to `handleStructuredAsync()`/`handleAsync()`, then emit all outputs as SSE `output` events followed by `done`.
- On exception, send an `error` event and close the stream.

### Backend: Capabilities

Add `streaming: true` to the capabilities response (`GET /api/v1/qcli/capabilities`) so the frontend can detect support:

```json
{
    "shell": true,
    "os": "linux",
    "shellPath": "/bin/bash",
    "version": "2.0.0",
    "streaming": true
}
```

### Frontend: CliServerConnection

Add `executeStream()` method:

```typescript
async executeStream(
    command: CliProcessCommand,
    onOutput: (output: CliServerOutput) => void,
): Promise<{ exitCode: number }>
```

Uses `fetch()` with the stream endpoint. Reads the response body as a `ReadableStream`, parses SSE events line-by-line, and calls `onOutput()` for each `output` event. Returns `{ exitCode }` when the `done` event arrives. Throws on `error` events or network failures.

### Frontend: executeOnServer

Update `executeOnServer()` in `cli-server-proxy-processor.ts`:

1. Check `connection.capabilities?.streaming`.
2. If supported: call `connection.executeStream(command, (output) => renderSingleOutput(output, context))`. No spinner — outputs render in real-time.
3. If not supported: fall back to current `connection.execute()` + spinner behavior.

Extract `renderSingleOutput()` from the existing `renderServerResponse()` to render one output at a time.

### Frontend: CliServerCapabilities Type

Add `streaming?: boolean` to the `CliServerCapabilities` type in `packages/core/src/lib/models/server.ts`.

## Backward Compatibility

- Existing `ICliCommandProcessor` implementations work unchanged. Non-streaming processors are auto-wrapped at the endpoint level.
- Old servers without `/execute/stream` continue working — the frontend checks `capabilities.streaming` and falls back to `/execute`.
- The existing `/execute` endpoint is unchanged.

## Scope

### In Scope
- SSE stream endpoint on all 3 servers (Node.js, Python, .NET)
- `ICliStreamCommandProcessor` interface in all 3 abstractions packages
- Frontend streaming execution with fallback
- Capabilities advertisement

### Out of Scope
- Client-to-server streaming (stdin during execution)
- Cancellation of in-flight streaming commands (future work)
- Converting existing processors to use streaming (future work — this spec only adds the infrastructure)
