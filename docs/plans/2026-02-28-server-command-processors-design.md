# Server-Side Command Processors Design

## Overview

Add server-side command processor support to the Qodalis CLI ecosystem. The Angular CLI (and future React/Vue wrappers) connects to one or more configurable .NET backend servers, discovers their commands via a metadata endpoint, and creates local proxy processors that delegate execution over HTTP REST. Server commands appear seamlessly alongside local ones in help, autocomplete, and piping.

## Requirements

- Multiple configurable servers
- Framework-agnostic (lives in CliEngine/core, not Angular-specific)
- Structured JSON responses (server returns data, client renders)
- Command discovery via metadata endpoint
- Server-namespaced commands with bare-name shortcut when unambiguous
- Graceful degradation when servers are unreachable

## Configuration

### CliOptions Extension (`@qodalis/cli-core`)

```typescript
type CliOptions = {
  // ... existing options ...
  servers?: CliServerConfig[];
};

type CliServerConfig = {
  name: string;           // Unique identifier, used for namespacing
  url: string;            // Base URL: "https://api.example.com"
  enabled?: boolean;      // Default: true
  headers?: Record<string, string>; // Custom headers (auth tokens, etc.)
  timeout?: number;       // Request timeout in ms, default: 30000
};
```

## Structured Response Protocol

The JSON contract between .NET server and CLI client:

```typescript
type CliServerResponse = {
  exitCode: number;
  outputs: CliServerOutput[];
};

type CliServerOutput =
  | { type: 'text'; value: string; style?: 'success' | 'error' | 'info' | 'warning' }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'json'; value: any }
  | { type: 'key-value'; entries: { key: string; value: string }[] }
  | { type: 'progress'; percent: number; label?: string };
```

Maps directly to existing `CliTerminalWriter` methods (`writeSuccess`, `writeTable`, `writeList`, `writeJson`, `writeKeyValue`).

## .NET Server Architecture

### REST API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/cli/version` | GET | Server version (exists already) |
| `/api/cli/commands` | GET | Returns all registered processor metadata |
| `/api/cli/execute` | POST | Executes a command, returns structured response |

### Command Processor Registration (DI-based)

```csharp
// In Program.cs
builder.Services.AddCli(cli => {
    cli.AddProcessor<GuidCommandProcessor>();
    cli.AddProcessor<StatusCommandProcessor>();
});

// Or assembly scanning
builder.Services.AddCli(cli => {
    cli.AddProcessorsFromAssembly(typeof(Program).Assembly);
});
```

### Server-Side Execution Context

Since there's no terminal, processors write to a response builder:

```csharp
public interface ICliResponseBuilder {
    void WriteText(string text, string? style = null);
    void WriteTable(string[] headers, string[][] rows);
    void WriteList(string[] items, bool ordered = false);
    void WriteJson(object value);
    void WriteKeyValue(Dictionary<string, string> entries);
    void SetExitCode(int code);
}
```

### Execution Pipeline

1. `POST /api/cli/execute` receives `CliProcessCommand` JSON
2. `CliCommandExecutorService` finds processor via registry
3. Processor executes with `ICliResponseBuilder` to collect structured outputs
4. Collected outputs returned as `CliServerResponse`

## Client-Side Integration (CliEngine)

### Boot Flow

During engine startup, after core modules boot but before user modules:

1. Read `options.servers` from `CliOptions`
2. For each enabled server, create a `CliServerConnection` instance
3. Fetch `GET /api/cli/commands` from each server
4. For each command returned, create a `CliServerProxyProcessor` and register it
5. Track connections in a `CliServerManager` service (available via service container)

### CliServerConnection

Manages communication with one server:

```typescript
class CliServerConnection {
  constructor(config: CliServerConfig) {}

  async fetchCommands(): Promise<ICliCommandProcessor[]>;  // GET /commands
  async execute(command: CliProcessCommand): Promise<CliServerResponse>;  // POST /execute
  get connected(): boolean;
  get config(): CliServerConfig;
}
```

### CliServerProxyProcessor

A local processor that delegates to a remote server:

```typescript
class CliServerProxyProcessor implements ICliCommandProcessor {
  command: string;           // "servername:original-command"
  description: string;       // From server metadata
  parameters: [...];         // From server metadata
  metadata: { module: 'server:servername', requireServer: true };

  async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
    const response = await this.connection.execute(command);
    this.renderResponse(response, context);
  }

  private renderResponse(response: CliServerResponse, context: ICliExecutionContext) {
    for (const output of response.outputs) {
      switch (output.type) {
        case 'text':    context.writer[styleMethod(output.style)](output.value); break;
        case 'table':   context.writer.writeTable(output.headers, output.rows); break;
        case 'list':    context.writer.writeList(output.items); break;
        case 'json':    context.writer.writeJson(output.value); break;
        case 'key-value': context.writer.writeKeyValue(output.entries); break;
      }
    }
    context.process.exit(response.exitCode);
  }
}
```

### Namespacing Logic

- Always registered as `servername:command`
- If only one server provides `command`, also registered as bare `command` (alias)
- Help groups server commands under `Server: servername`

### CliServerManager

Registered in service container, accessible to other processors:

```typescript
class CliServerManager {
  connections: Map<string, CliServerConnection>;

  async connectAll(servers: CliServerConfig[]): Promise<void>;
  getConnection(name: string): CliServerConnection | undefined;
  async reconnect(name: string): Promise<void>;
}
```

## Built-In Server Commands

| Command | Description |
|---|---|
| `server list` | Shows configured servers and their status (connected/disconnected) |
| `server status <name>` | Pings a server, shows version and command count |
| `server reconnect <name>` | Re-fetches commands from a server |

## Error Handling

- **Server unreachable at boot**: Log a warning, skip that server's commands. Don't block boot.
- **Server unreachable at execution**: Show error: `"Server 'name' is not reachable. Run 'server reconnect name' to retry."`
- **Timeout**: Respect `CliServerConfig.timeout`, show timeout error with the configured duration.
- **Invalid response**: If server returns non-JSON or malformed response, show parse error and raw status code.

## Implementation Scope

### .NET Server (`cli-server-dotnet`)

1. Command processor registry with DI registration
2. `CliCommandExecutorService` for processor lookup and execution
3. `ICliResponseBuilder` and its implementation
4. `GET /api/cli/commands` endpoint returning processor metadata
5. `POST /api/cli/execute` endpoint with structured responses
6. `AddCli()` builder pattern with `AddProcessor<T>()` and `AddProcessorsFromAssembly()`
7. Sample command processors (e.g., guid, status, echo)

### Angular CLI (`angular-web-cli`)

1. Add `CliServerConfig` and response types to `@qodalis/cli-core`
2. Add `servers` to `CliOptions`
3. Implement `CliServerConnection` in `@qodalis/cli`
4. Implement `CliServerProxyProcessor` in `@qodalis/cli`
5. Implement `CliServerManager` in `@qodalis/cli`
6. Create `CliServerModule` that boots during engine startup
7. Built-in `server` command processor (list, status, reconnect)
8. Update demo app to configure a server connection
