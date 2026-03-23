# SSE Streaming Command Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SSE streaming to command execution across all 3 servers and the frontend, so output renders incrementally instead of waiting for the entire response.

**Architecture:** Each server gets a new `ICliStreamCommandProcessor` interface (separate from `ICliCommandProcessor`) and a `POST /execute/stream` endpoint that returns `text/event-stream`. The frontend's `CliServerConnection` gains an `executeStream()` method, and `executeOnServer()` prefers streaming when the server advertises `streaming: true` in capabilities. Non-streaming processors are auto-wrapped at the endpoint level.

**Tech Stack:** TypeScript/Express (Node.js server + frontend), Python/FastAPI, .NET 8/ASP.NET Core

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| **Node.js server** | | |
| `cli-server-node/packages/abstractions/src/cli-stream-command-processor.ts` | Create | `ICliStreamCommandProcessor` interface |
| `cli-server-node/packages/abstractions/src/index.ts` | Modify | Export new interface |
| `cli-server-node/src/controllers/cli-controller.ts` | Modify | Add `POST /execute/stream` SSE endpoint |
| `cli-server-node/src/controllers/cli-version-controller.ts` | Modify | Add `streaming: true` to capabilities |
| **Python server** | | |
| `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/cli_stream_command_processor.py` | Create | `ICliStreamCommandProcessor` ABC |
| `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/__init__.py` | Modify | Export new class |
| `cli-server-python/src/qodalis_cli/controllers/cli_controller.py` | Modify | Add `POST /execute/stream` SSE endpoint |
| `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py` | Modify | Add `streaming: true` to capabilities |
| **.NET server** | | |
| `cli-server-dotnet/src/Qodalis.Cli.Abstractions/ICliStreamCommandProcessor.cs` | Create | `ICliStreamCommandProcessor` interface |
| `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliController.cs` | Modify | Add `POST /execute/stream` SSE endpoint |
| `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliVersionController.cs` | Modify | Add `streaming: true` to capabilities |
| **Frontend (web-cli)** | | |
| `web-cli/packages/core/src/lib/models/server.ts` | Modify | Add `streaming?: boolean` to `CliServerCapabilities` |
| `web-cli/packages/cli/src/lib/server/cli-server-connection.ts` | Modify | Add `executeStream()` method with SSE parsing |
| `web-cli/packages/cli/src/lib/server/cli-server-proxy-processor.ts` | Modify | Extract `renderSingleOutput()`, prefer streaming in `executeOnServer()` |

---

### Task 1: Add ICliStreamCommandProcessor to Node.js abstractions

**Files:**
- Create: `cli-server-node/packages/abstractions/src/cli-stream-command-processor.ts`
- Modify: `cli-server-node/packages/abstractions/src/index.ts`
- Modify: `cli-server-node/src/abstractions/index.ts` (re-export barrel)

- [ ] **Step 1: Create the interface file**

Create `cli-server-node/packages/abstractions/src/cli-stream-command-processor.ts`:

```typescript
import { CliProcessCommand } from './cli-process-command';
import { CliStructuredOutput } from './cli-structured-response';

/**
 * Optional interface for command processors that support streaming output.
 * Processors implementing this interface can emit output chunks incrementally
 * via the `emit` callback, enabling real-time rendering on the client.
 *
 * A processor can implement both ICliCommandProcessor and ICliStreamCommandProcessor.
 * The stream execution endpoint will prefer this interface when available.
 */
export interface ICliStreamCommandProcessor {
    /** Must match the command keyword of the corresponding ICliCommandProcessor. */
    readonly command: string;

    /**
     * Execute the command, emitting output chunks as they become available.
     * @param command - Parsed command with arguments.
     * @param emit - Callback to send a single output chunk to the client.
     * @returns Exit code (0 for success).
     */
    handleStreamAsync(
        command: CliProcessCommand,
        emit: (output: CliStructuredOutput) => void,
    ): Promise<number>;
}

/**
 * Type guard to check if a processor supports streaming.
 */
export function isStreamCapable(
    processor: unknown,
): processor is ICliStreamCommandProcessor {
    return (
        typeof processor === 'object' &&
        processor !== null &&
        'handleStreamAsync' in processor &&
        typeof (processor as any).handleStreamAsync === 'function'
    );
}
```

- [ ] **Step 2: Export from package index**

In `cli-server-node/packages/abstractions/src/index.ts`, add:

```typescript
export { ICliStreamCommandProcessor, isStreamCapable } from './cli-stream-command-processor';
```

- [ ] **Step 3: Re-export from src/abstractions barrel**

In `cli-server-node/src/abstractions/index.ts`, add `ICliStreamCommandProcessor, isStreamCapable` to the re-export list from `'@qodalis/cli-server-abstractions'`.

- [ ] **Step 4: Build and test**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build && npm test
```

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add packages/abstractions/src/cli-stream-command-processor.ts packages/abstractions/src/index.ts src/abstractions/index.ts
git commit -m "feat: add ICliStreamCommandProcessor interface to Node.js abstractions"
```

---

### Task 2: Add streaming endpoint to Node.js server

**Files:**
- Modify: `cli-server-node/src/controllers/cli-controller.ts`
- Modify: `cli-server-node/src/controllers/cli-version-controller.ts`

- [ ] **Step 1: Add streaming capability to cli-controller capabilities**

In `cli-server-node/src/controllers/cli-controller.ts`, add `streaming: true` to the capabilities response in the `router.get('/capabilities', ...)` handler (around line 39):

```typescript
        res.json({
            shell: true,
            os: detectedOs,
            shellPath,
            version: SERVER_VERSION,
            streaming: true,
        });
```

Also add `streaming: true` to the same capabilities response in `cli-server-node/src/controllers/cli-version-controller.ts` for consistency.

- [ ] **Step 2: Add isBlocked helper to executor**

In `cli-server-node/src/services/cli-command-executor-service.ts`, add a public method to `CliCommandExecutorService`:

```typescript
    isBlocked(processor: ICliCommandProcessor): boolean {
        return this._filters.some(f => !f.isAllowed(processor));
    }
```

Also add it to the `ICliCommandExecutorService` interface:

```typescript
    isBlocked(processor: ICliCommandProcessor): boolean;
```

- [ ] **Step 3: Add SSE stream endpoint to cli-controller**

In `cli-server-node/src/controllers/cli-controller.ts`, add the `isStreamCapable` import at the top:

```typescript
import { ICliCommandProcessor, isStreamCapable } from '../abstractions';
```

Add the new route before `return router;`:

```typescript
    router.post('/execute/stream', async (req, res) => {
        const command = req.body;
        logger.debug('Stream executing command: %s', command.command);

        // SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const emit = (output: any) => {
            res.write(`event: output\ndata: ${JSON.stringify(output)}\n\n`);
        };

        try {
            const processor = registry.findProcessor(
                command.command,
                command.chainCommands?.length ? command.chainCommands : undefined,
            );

            if (!processor) {
                res.write(`event: error\ndata: ${JSON.stringify({ message: `Unknown command: ${command.command}` })}\n\n`);
                res.end();
                return;
            }

            if (executor.isBlocked(processor)) {
                res.write(`event: error\ndata: ${JSON.stringify({ message: `Command '${command.command}' is currently disabled.` })}\n\n`);
                res.end();
                return;
            }

            let exitCode: number;

            if (isStreamCapable(processor)) {
                exitCode = await processor.handleStreamAsync(command, emit);
            } else if (processor.handleStructuredAsync) {
                const response = await processor.handleStructuredAsync(command);
                for (const output of response.outputs) {
                    emit(output);
                }
                exitCode = response.exitCode;
            } else {
                const result = await processor.handleAsync(command);
                emit({ type: 'text', value: result });
                exitCode = 0;
            }

            res.write(`event: done\ndata: ${JSON.stringify({ exitCode })}\n\n`);
        } catch (err: any) {
            logger.error('Stream execution failed: %s - %s', command.command, err.message ?? err);
            res.write(`event: error\ndata: ${JSON.stringify({ message: `Error executing command: ${err.message ?? err}` })}\n\n`);
        }

        res.end();
    });
```

- [ ] **Step 4: Build and test**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build && npm test
```

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add src/controllers/cli-controller.ts src/controllers/cli-version-controller.ts src/services/cli-command-executor-service.ts
git commit -m "feat: add SSE streaming execution endpoint to Node.js server"
```

---

### Task 3: Add ICliStreamCommandProcessor to Python abstractions and server

**Files:**
- Create: `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/cli_stream_command_processor.py`
- Modify: `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/__init__.py`
- Modify: `cli-server-python/src/qodalis_cli/controllers/cli_controller.py`
- Modify: `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`
- Modify: `cli-server-python/src/qodalis_cli/services/cli_command_executor_service.py`

- [ ] **Step 1: Create the stream processor interface**

Create `cli-server-python/packages/abstractions/src/qodalis_cli_server_abstractions/cli_stream_command_processor.py`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable

from .cli_process_command import CliProcessCommand


class ICliStreamCommandProcessor(ABC):
    """Optional interface for processors that support streaming output.

    Processors implementing this can emit output chunks incrementally
    via the ``emit`` callback, enabling real-time rendering on the client.
    """

    command: str

    @abstractmethod
    async def handle_stream_async(
        self,
        command: CliProcessCommand,
        emit: Callable[[dict[str, Any]], None],
    ) -> int:
        """Execute the command, calling *emit* for each output chunk.

        Returns the exit code (0 for success).
        """
        ...


def is_stream_capable(processor: object) -> bool:
    """Return True if *processor* implements streaming."""
    return hasattr(processor, "handle_stream_async") and callable(
        getattr(processor, "handle_stream_async")
    )
```

- [ ] **Step 2: Export from __init__.py**

In the abstractions `__init__.py`, add:

```python
from .cli_stream_command_processor import ICliStreamCommandProcessor, is_stream_capable
```

- [ ] **Step 3: Add streaming capability to version controller**

In `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`, add `"streaming": True` to the capabilities response:

```python
        return {
            "shell": True,
            "os": detected_os,
            "shellPath": shell_path,
            "version": SERVER_VERSION,
            "streaming": True,
        }
```

- [ ] **Step 4: Add isBlocked helper to executor**

In `cli-server-python/src/qodalis_cli/services/cli_command_executor_service.py`, add a public method:

```python
    def is_blocked(self, processor: ICliCommandProcessor) -> bool:
        """Return True if any filter blocks this processor."""
        return any(not f.is_allowed(processor) for f in self._filters)
```

- [ ] **Step 5: Add SSE stream endpoint to Python controller**

In `cli-server-python/src/qodalis_cli/controllers/cli_controller.py`, add the import at the top:

```python
from fastapi.responses import StreamingResponse
from qodalis_cli_server_abstractions import is_stream_capable
```

Add the stream endpoint inside the `create_cli_router()` function, after the existing `/execute` route:

```python
    @router.post("/execute/stream")
    async def execute_stream(request: ExecuteRequest) -> StreamingResponse:
        command = CliProcessCommand(
            command=request.command,
            raw_command=request.raw_command,
            value=request.value,
            args=request.args,
            chain_commands=request.chain_commands,
            data=request.data,
        )

        async def event_generator():
            import json

            def emit(output: dict) -> str:
                return f"event: output\ndata: {json.dumps(output)}\n\n"

            try:
                processor = registry.find_processor(
                    command.command,
                    list(command.chain_commands) if command.chain_commands else None,
                )

                if processor is None:
                    yield f"event: error\ndata: {json.dumps({'message': f'Unknown command: {command.command}'})}\n\n"
                    return

                if executor.is_blocked(processor):
                    yield f"event: error\ndata: {json.dumps({'message': f\"Command '{command.command}' is currently disabled.\"})}\n\n"
                    return

                if is_stream_capable(processor):
                    outputs: list[str] = []

                    def collect_and_yield(output: dict) -> None:
                        outputs.append(emit(output))

                    exit_code = await processor.handle_stream_async(command, collect_and_yield)
                    for chunk in outputs:
                        yield chunk
                else:
                    response = await executor.execute_async(command)
                    for output in response.outputs:
                        yield emit(output.model_dump(by_alias=True, exclude_none=True))
                    exit_code = response.exit_code

                yield f"event: done\ndata: {json.dumps({'exitCode': exit_code})}\n\n"
            except Exception as exc:
                yield f"event: error\ndata: {json.dumps({'message': f'Error executing command: {exc}'})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
```

Note: The `emit` callback in the Python async generator can't directly yield from inside a callback. For truly streaming processors, the implementation uses a list accumulator. For processors that need real streaming, they should use an `asyncio.Queue` pattern — but that's future work when actual streaming processors are written. The auto-wrap path (non-streaming processors) works correctly.

- [ ] **Step 6: Run tests**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-python && python3 -m pytest
```

- [ ] **Step 7: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-python
git add packages/abstractions/src/qodalis_cli_server_abstractions/cli_stream_command_processor.py packages/abstractions/src/qodalis_cli_server_abstractions/__init__.py src/qodalis_cli/controllers/cli_controller.py src/qodalis_cli/controllers/cli_version_controller.py src/qodalis_cli/services/cli_command_executor_service.py
git commit -m "feat: add SSE streaming execution endpoint to Python server"
```

---

### Task 4: Add ICliStreamCommandProcessor to .NET abstractions and server

**Files:**
- Create: `cli-server-dotnet/src/Qodalis.Cli.Abstractions/ICliStreamCommandProcessor.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliController.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliVersionController.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Services/CliCommandExecutorService.cs`

- [ ] **Step 1: Create the stream processor interface**

Create `cli-server-dotnet/src/Qodalis.Cli.Abstractions/ICliStreamCommandProcessor.cs`:

```csharp
namespace Qodalis.Cli.Abstractions;

/// <summary>
/// Optional interface for command processors that support streaming output.
/// Processors implementing this interface can emit output chunks incrementally,
/// enabling real-time rendering on the client via Server-Sent Events.
/// </summary>
public interface ICliStreamCommandProcessor
{
    /// <summary>
    /// Must match the <see cref="ICliCommandProcessor.Command"/> of the corresponding processor.
    /// </summary>
    string Command { get; }

    /// <summary>
    /// Execute the command, calling <paramref name="emit"/> for each output chunk.
    /// </summary>
    /// <param name="command">Parsed command with arguments.</param>
    /// <param name="emit">Callback to send a single output chunk to the client.</param>
    /// <returns>Exit code (0 for success).</returns>
    Task<int> HandleStreamAsync(CliProcessCommand command, Func<object, Task> emit);
}
```

Note: `emit` uses `Func<object, Task>` (async) instead of `Action<CliServerOutput>` because: (1) `CliServerOutput` lives in `Qodalis.Cli`, not in `Abstractions`, and (2) the emit callback writes to the HTTP response which is inherently async — avoids deadlocks from blocking `.GetAwaiter().GetResult()`. At the controller level, `CliServerOutput` objects are passed and serialized.

- [ ] **Step 2: Add streaming capability to version controller**

In `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliVersionController.cs`, add `Streaming = true` to the capabilities response. First read the file to find the exact capabilities endpoint.

- [ ] **Step 3: Add IsBlocked helper to executor**

In `cli-server-dotnet/src/Qodalis.Cli/Services/CliCommandExecutorService.cs`, add:

```csharp
    public bool IsBlocked(ICliCommandProcessor processor)
    {
        return _filters.Any(f => !f.IsAllowed(processor));
    }
```

- [ ] **Step 4: Add SSE stream endpoint to .NET controller**

In `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliController.cs`, add a new endpoint. Read the file first to understand the existing pattern, then add:

```csharp
    [HttpPost("execute/stream")]
    public async Task ExecuteStream([FromBody] CliProcessCommand command)
    {
        Response.ContentType = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["Connection"] = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";

        async Task WriteEvent(string eventType, object data)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(data, _jsonOptions);
            await Response.WriteAsync($"event: {eventType}\ndata: {json}\n\n");
            await Response.Body.FlushAsync();
        }

        try
        {
            var processor = _registry.FindProcessor(command.Command, command.ChainCommands);

            if (processor == null)
            {
                await WriteEvent("error", new { message = $"Unknown command: {command.Command}" });
                return;
            }

            if (_executor.IsBlocked(processor))
            {
                await WriteEvent("error", new { message = $"Command '{command.Command}' is currently disabled." });
                return;
            }

            int exitCode;

            if (processor is ICliStreamCommandProcessor streamProcessor)
            {
                exitCode = await streamProcessor.HandleStreamAsync(command, async output =>
                {
                    await WriteEvent("output", output);
                });
            }
            else
            {
                var response = await _executor.ExecuteAsync(command);
                foreach (var output in response.Outputs)
                {
                    await WriteEvent("output", output);
                }
                exitCode = response.ExitCode;
            }

            await WriteEvent("done", new { exitCode });
        }
        catch (Exception ex)
        {
            await WriteEvent("error", new { message = $"Error executing command: {ex.Message}" });
        }
    }
```

Note: The `_jsonOptions` should use camelCase naming. Check the existing controller for the JSON serialization pattern.

- [ ] **Step 5: Build and test**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln && dotnet test tests/Qodalis.Cli.Tests/Qodalis.Cli.Tests.csproj
```

- [ ] **Step 6: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-dotnet
git add src/Qodalis.Cli.Abstractions/ICliStreamCommandProcessor.cs src/Qodalis.Cli/Controllers/CliController.cs src/Qodalis.Cli/Controllers/CliVersionController.cs src/Qodalis.Cli/Services/CliCommandExecutorService.cs
git commit -m "feat: add SSE streaming execution endpoint to .NET server"
```

---

### Task 5: Add streaming support to frontend CliServerConnection

**Files:**
- Modify: `web-cli/packages/core/src/lib/models/server.ts`
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`

- [ ] **Step 1: Add streaming to CliServerCapabilities type**

In `web-cli/packages/core/src/lib/models/server.ts`, add `streaming` to `CliServerCapabilities`:

```typescript
export type CliServerCapabilities = {
    /** Whether this server supports remote shell access */
    shell: boolean;
    /** Server operating system (e.g. "linux", "win32", "darwin") */
    os?: string;
    /** Path to the shell binary on the server */
    shellPath?: string;
    /** Server version string */
    version?: string;
    /** Whether this server supports SSE streaming execution */
    streaming?: boolean;
};
```

- [ ] **Step 2: Add executeStream method to CliServerConnection**

In `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`, add the `CliServerOutput` import:

```typescript
import {
    CliProcessCommand,
    CliServerCapabilities,
    CliServerConfig,
    CliServerResponse,
    CliServerOutput,
    CliServerCommandDescriptor,
    ICliBackgroundServiceRegistry,
    ICliLogger,
    ServerVersionNegotiator,
} from '@qodalis/cli-core';
```

Add the `executeStream` method after the existing `execute()` method:

```typescript
    async executeStream(
        command: CliProcessCommand,
        onOutput: (output: CliServerOutput) => void,
    ): Promise<{ exitCode: number }> {
        const url = `${this._basePath}/execute/stream`;
        const response = await this.httpFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(command),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let exitCode = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const parts = buffer.split('\n\n');
                buffer = parts.pop() ?? '';

                for (const part of parts) {
                    if (!part.trim()) continue;

                    let eventType = 'message';
                    let data = '';

                    for (const line of part.split('\n')) {
                        if (line.startsWith('event: ')) {
                            eventType = line.slice(7);
                        } else if (line.startsWith('data: ')) {
                            data = line.slice(6);
                        }
                    }

                    if (!data) continue;

                    try {
                        const parsed = JSON.parse(data);

                        if (eventType === 'output') {
                            onOutput(parsed);
                        } else if (eventType === 'done') {
                            exitCode = parsed.exitCode ?? 0;
                        } else if (eventType === 'error') {
                            throw new Error(parsed.message ?? 'Stream error');
                        }
                    } catch (e: any) {
                        if (e.message && !e.message.includes('JSON')) {
                            throw e; // Re-throw non-parse errors (like our error event)
                        }
                        // Ignore malformed JSON
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return { exitCode };
    }
```

- [ ] **Step 3: Build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core && npx nx build cli
```

- [ ] **Step 4: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/core/src/lib/models/server.ts packages/cli/src/lib/server/cli-server-connection.ts
git commit -m "feat: add SSE streaming execution to frontend CliServerConnection"
```

---

### Task 6: Update executeOnServer to prefer streaming

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-proxy-processor.ts`

- [ ] **Step 1: Extract renderSingleOutput from renderServerResponse**

Refactor the existing `renderServerResponse` to use a shared `renderSingleOutput` helper. In `cli-server-proxy-processor.ts`:

```typescript
/**
 * Render a single CliServerOutput to the terminal.
 */
export function renderSingleOutput(
    output: CliServerOutput,
    context: ICliExecutionContext,
): void {
    switch (output.type) {
        case 'text': {
            const style = output.style;
            if (style === 'success')
                context.writer.writeSuccess(output.value);
            else if (style === 'error')
                context.writer.writeError(output.value);
            else if (style === 'info')
                context.writer.writeInfo(output.value);
            else if (style === 'warning')
                context.writer.writeWarning(output.value);
            else context.writer.writeln(output.value);
            break;
        }
        case 'table':
            context.writer.writeTable(output.headers, output.rows);
            break;
        case 'list':
            context.writer.writeList(output.items, {
                ordered: output.ordered,
            });
            break;
        case 'json':
            context.writer.writeJson(output.value);
            break;
        case 'key-value': {
            const record: Record<string, string> = {};
            for (const e of output.entries) {
                record[e.key] = e.value;
            }
            context.writer.writeKeyValue(record);
            break;
        }
    }
}
```

Update `renderServerResponse` to use it:

```typescript
export function renderServerResponse(
    response: CliServerResponse,
    context: ICliExecutionContext,
): void {
    for (const output of response.outputs ?? []) {
        renderSingleOutput(output, context);
    }

    if (response.exitCode !== 0) {
        context.process.exit(response.exitCode);
    }
}
```

- [ ] **Step 2: Add CliServerOutput to imports**

Add `CliServerOutput` to the import from `@qodalis/cli-core`:

```typescript
import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    CliServerResponse,
    CliServerOutput,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
```

- [ ] **Step 3: Update executeOnServer to prefer streaming**

Replace the `executeOnServer` function:

```typescript
export async function executeOnServer(
    connection: CliServerConnection,
    serverName: string,
    descriptor: CliServerCommandDescriptor,
    command: CliProcessCommand,
    context: ICliExecutionContext,
): Promise<void> {
    if (!connection.connected) {
        context.writer.writeError(
            `Server '${serverName}' is not reachable. Run 'server reconnect ${serverName}' to retry.`,
        );
        context.process.exit(1);
        return;
    }

    const serverCommand: CliProcessCommand = {
        ...command,
        command: descriptor.command,
    };

    try {
        if (connection.capabilities?.streaming) {
            // Streaming mode — render outputs as they arrive
            const result = await connection.executeStream(
                serverCommand,
                (output) => renderSingleOutput(output, context),
            );
            if (result.exitCode !== 0) {
                context.process.exit(result.exitCode);
            }
        } else {
            // Legacy mode — wait for full response
            context.spinner?.show('Executing on server...');
            const response = await connection.execute(serverCommand);
            context.spinner?.hide();
            renderServerResponse(response, context);
        }
    } catch (e: any) {
        context.spinner?.hide();
        if (e.name === 'AbortError') {
            context.writer.writeError(
                `Request to server '${serverName}' timed out after ${connection.config.timeout ?? 30000}ms.`,
            );
        } else {
            context.writer.writeError(
                `Error communicating with server '${serverName}': ${e.message}`,
            );
        }
        context.process.exit(1);
    }
}
```

- [ ] **Step 4: Build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-proxy-processor.ts
git commit -m "feat: prefer SSE streaming in executeOnServer with fallback to legacy"
```

---

### Task 7: Build and verify all projects

- [ ] **Step 1: Build web-cli**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build
```
Expected: All projects build successfully.

- [ ] **Step 2: Build and test cli-server-node**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build && npm test
```
Expected: Build and all tests pass.

- [ ] **Step 3: Test cli-server-python**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-python && python3 -m pytest
```
Expected: All tests pass.

- [ ] **Step 4: Build cli-server-dotnet**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln
```
Expected: Build succeeds.
