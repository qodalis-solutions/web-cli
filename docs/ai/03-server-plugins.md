## Server plugins

### How server commands reach the browser terminal

A server plugin registers command processors in a Qodalis CLI server (Node, .NET or Python); the browser terminal discovers them and proxies execution over HTTP.

- The host app lists servers in `CliOptions.servers`: `{ name: 'node', url: 'http://localhost:8047' }` (optional `headers`, `timeout`, `enabled`).
- At startup the terminal calls `GET /api/qcli/versions` and `GET /api/v1/qcli/commands`, then registers each root command as `<server>:<command>` (e.g. `node:weather`) and as the bare name (`weather`) unless a local web command already owns it. If several servers have the command, the bare name uses the default server (`server default <name>`) or asks.
- Running a command sends `POST /api/v1/qcli/execute` with `{ command, chainCommands, rawCommand, value, positionals, args, data }`; the server resolves the processor and returns `{ exitCode, outputs: [...] }`. `POST /api/v1/qcli/execute/stream` returns Server-Sent Events (`output`, `done`, `error`).
- Output types rendered by the browser: `text` (optional `style`: `success | error | info | warning`), `table` (`headers`, `rows`), `list` (`items`, `ordered?`), `json` (`value`), `key-value` (`entries: { key, value }[]`).
- In the browser, a server command that has sub-commands accepts only its sub-command words; a leaf command accepts positional text (`weather current Paris`).
- Exceptions thrown by a processor become exit code 1 with `Error executing command: <message>` (style `error`). Unknown commands return `Unknown command: <name>`.
- Servers: Node `@qodalis/cli-server-node` (default port 8047 in the demos), .NET `Qodalis.Cli` (8046), Python `qodalis-cli-server` (8048).

### Node: minimal server processor

A Node server command extends `CliCommandProcessor` from `@qodalis/cli-server-abstractions` and returns its output text from `handleAsync`.

```typescript
import {
    CliCommandProcessor,
    CliProcessCommand,
    getPositionalText,
} from '@qodalis/cli-server-abstractions';

export class CliGreetCommandProcessor extends CliCommandProcessor {
    command = 'greet';
    description = 'Greets someone';
    acceptsValue = true;          // optional positional value (valueRequired = true makes it mandatory)

    async handleAsync(command: CliProcessCommand, signal?: AbortSignal): Promise<string> {
        const name = getPositionalText(command) || 'world';
        return `Hello, ${name}!`;
    }
}
```

```typescript
import { createCliServer } from '@qodalis/cli-server-node';

const { app } = createCliServer({
    configure: (builder) => builder.addProcessor(new CliGreetCommandProcessor()),
});
app.listen(8047);
```

- `ICliCommandProcessor` members: `command`, `description`, `author` (default `DefaultLibraryAuthor`), `version` (default `'1.0.0'`), `allowUnlistedCommands?`, `valueRequired?`, `acceptsValue?`, `processors?`, `parameters?`, `requiredPermissions?`, `handleAsync(command, signal?) => Promise<string>`, `handleStructuredAsync?(command, signal?) => Promise<CliStructuredResponse>` (takes precedence when present).
- `CliProcessCommand`: `command`, `chainCommands: string[]`, `rawCommand`, `value?` (as typed), `positionals?: string[]` (shell-split; sent by current browsers), `args: Record<string, any>`, `data?`. Helpers: `getPositionals(command)` (falls back to splitting `value`), `getPositionalText(command)`, `splitShellWords`, `joinShellWords`, `quoteShellWord`.
- `signal` is aborted when the HTTP client disconnects.
- Packages: `npm install @qodalis/cli-server-abstractions` for plugins; `@qodalis/cli-server-node` for the host.

### Node: parameters, sub-commands and modules

Node server commands declare flags with `CliCommandParameterDescriptor`, nest sub-commands in `processors`, and are grouped into a `CliModule` registered with `builder.addModule`.

```typescript
import {
    CliCommandParameterDescriptor,
    CliCommandProcessor,
    CliModule,
    CliProcessCommand,
    getPositionalText,
    ICliCommandProcessor,
} from '@qodalis/cli-server-abstractions';

// constructor order: (name, description, required = false, type = 'string', aliases?, defaultValue?)
const locationParam = new CliCommandParameterDescriptor(
    'location', 'City name', false, 'string', ['-l'], 'London',
);

function location(command: CliProcessCommand): string {
    return command.args?.location ? String(command.args.location) : getPositionalText(command) || 'London';
}

class WeatherCurrentProcessor extends CliCommandProcessor {
    command = 'current';
    description = 'Current conditions';
    parameters = [locationParam];
    acceptsValue = true;
    async handleAsync(command: CliProcessCommand): Promise<string> {
        return `Sunny in ${location(command)}`;
    }
}

class CliWeatherCommandProcessor extends CliCommandProcessor {
    command = 'weather';
    description = 'Weather information';
    parameters = [locationParam];
    processors: ICliCommandProcessor[] = [new WeatherCurrentProcessor()];
    async handleAsync(command: CliProcessCommand): Promise<string> {
        return `Sunny in ${location(command)}`;
    }
}

export class WeatherModule extends CliModule {
    name = 'weather';
    version = '1.0.0';
    description = 'Weather commands';
    processors: ICliCommandProcessor[] = [new CliWeatherCommandProcessor()];
}

// host: createCliServer({ configure: (builder) => builder.addModule(new WeatherModule()) });
```

- Dispatch: root by `command` (case-insensitive), then each `chainCommands` word against `processors`. If a word matches no child, the current processor handles it only when `allowUnlistedCommands` is true; otherwise `Unknown command`. Only the resolved processor runs.
- Registering a second processor with the same command replaces the first.
- `CliBuilder` (all chainable): `addProcessor(p)`, `addModule(m)`, `addMcpToolProvider(provider)`, `setFileStorageProvider(...)`, `addDataExplorerProvider(...)`, `addFileSystem(options)`.
- `createCliServer(options)` options: `basePath` (default `'/api/qcli'`), `cors`, `allowedOrigins`, `enableShell`, `shell`, `trustProxy`, `auth`, `mcp` (`boolean | CliMcpOptions`), `configure(builder)`. Returns `{ app, registry, builder, executor, eventSocketManager, logSocketManager, mountPlugin, setAuth, mcp }`.

### Node: structured and streaming output

Node processors return tables, lists, JSON and key-value output from `handleStructuredAsync`, or stream outputs over SSE with `handleStreamAsync`.

```typescript
import {
    CliCommandProcessor,
    CliProcessCommand,
    CliStructuredOutput,
    CliStructuredResponse,
    ICliStreamCommandProcessor,
} from '@qodalis/cli-server-abstractions';

export class CliUsersCommandProcessor extends CliCommandProcessor implements ICliStreamCommandProcessor {
    command = 'users';
    description = 'Lists users';

    async handleAsync(): Promise<string> {
        return 'use the structured output';
    }

    async handleStructuredAsync(command: CliProcessCommand): Promise<CliStructuredResponse> {
        return {
            exitCode: 0,
            outputs: [
                { type: 'text', value: '2 users', style: 'info' },
                { type: 'table', headers: ['Name', 'Role'], rows: [['ada', 'admin'], ['bob', 'user']] },
                { type: 'key-value', entries: [{ key: 'Total', value: '2' }] },
            ],
        };
    }

    async handleStreamAsync(
        command: CliProcessCommand,
        emit: (output: CliStructuredOutput) => void,
        signal?: AbortSignal,
    ): Promise<number> {
        for (const name of ['ada', 'bob']) {
            if (signal?.aborted) return 1;
            emit({ type: 'text', value: name });
        }
        return 0;                                        // exit code
    }
}
```

- `CliStructuredOutput` = `text` (`value`, `style?`) | `table` (`headers`, `rows`) | `list` (`items`, `ordered?`) | `json` (`value`) | `key-value` (`entries`). Import these types from `@qodalis/cli-server-abstractions` (the server package re-exports them as `CliServerOutput` / `CliServerResponse`).
- `CliResponseBuilder` (from `@qodalis/cli-server-node`): `writeText(text, style?)`, `writeTable(headers, rows)`, `writeList(items, ordered?)`, `writeJson(value)`, `writeKeyValue(record)`, `setExitCode(code)`, `build()`.
- `/execute/stream` prefers `handleStreamAsync`, then `handleStructuredAsync` (each output emitted), then `handleAsync`.

### Node: permissions and MCP tools

Node processors declare `requiredPermissions`; every command automatically becomes an MCP tool when MCP is on, and plugins can add custom tools with an `McpToolProvider`.

```typescript
import { createCliServer, mcpError, mcpObjectSchema, McpToolProvider } from '@qodalis/cli-server-node';

class CliDeployCommandProcessor extends CliCommandProcessor {
    command = 'deploy';
    description = 'Deploys the app';
    requiredPermissions = ['deploy:run'];        // plus commands:execute; enforced when the server is protected
    async handleAsync(): Promise<string> { return 'deployed'; }
}

const statusTools: McpToolProvider = {
    name: 'status',
    getTools: () => [
        {
            name: 'status_ping',                     // ^[a-z0-9_-]{1,64}$
            description: 'Ping a host',
            inputSchema: mcpObjectSchema({ host: { type: 'string', description: 'Host name' } }, ['host']),
            requiredPermissions: [],
            annotations: { readOnlyHint: true },
            call: async (args, context) =>
                args.host ? { text: `pong ${args.host}`, isError: false } : mcpError('host required'),
        },
    ],
};

createCliServer({
    mcp: { instructions: 'Deployment server tools' },   // or mcp: true; endpoint POST /api/qcli/mcp
    configure: (builder) => builder.addProcessor(new CliDeployCommandProcessor()).addMcpToolProvider(statusTools),
});
```

- Permissions are enforced only when an auth provider protects the server (the users plugin): `/execute` requires `commands:execute` plus every `requiredPermissions` along the root-to-sub-command chain.
- Command tools: a processor becomes a tool when it has no sub-processors, declares parameters or takes a value; name = command path joined with `_` (`weather_current`); input schema = parameters (+ `value`).
- `CliMcpOptions`: `enabled?`, `tools?` (allow-list, trailing `*` = prefix), `exclude?`, `token?` (static bearer, only without an auth provider), `instructions?`.
- `McpTool.call(args, context)` gets pre-validated args and `{ auth?, signal, request }`; return `McpToolResult` `{ text, structured?, isError }` (helpers `mcpError(message)`, `mcpJson(value, text?)`). Also `server.mcp.addProvider(provider)` after creation.

### Node: testing server processors

Node server processors are tested with Vitest, by calling `handleAsync` directly or through the HTTP API with Supertest.

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createCliServer } from '@qodalis/cli-server-node';
import { CliGreetCommandProcessor } from '../greet';

describe('greet', () => {
    it('greets directly', async () => {
        const result = await new CliGreetCommandProcessor().handleAsync({
            command: 'greet', chainCommands: [], rawCommand: 'greet Ada', value: 'Ada', args: {},
        });
        expect(result).toBe('Hello, Ada!');
    });

    it('greets over HTTP', async () => {
        const { app } = createCliServer({ configure: (b) => b.addProcessor(new CliGreetCommandProcessor()) });
        const res = await request(app)
            .post('/api/v1/qcli/execute')
            .send({ command: 'greet', chainCommands: [], rawCommand: 'greet Ada', value: 'Ada', args: {} })
            .expect(200);
        expect(res.body.exitCode).toBe(0);
        expect(res.body.outputs[0]).toEqual({ type: 'text', value: 'Hello, Ada!' });
    });
});
```

### .NET: minimal server processor

A .NET server command derives from `Qodalis.Cli.CliCommandProcessor` (interface `ICliCommandProcessor` in `Qodalis.Cli.Abstractions`) and returns text from `HandleAsync`.

```csharp
using Qodalis.Cli;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Abstractions.Helpers;

public class CliGreetCommandProcessor : CliCommandProcessor
{
    public override string Command { get; set; } = "greet";
    public override string Description { get; set; } = "Greets someone";
    public override bool? AcceptsRawInput { get; set; } = true;

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
    {
        var name = CliValueHelpers.GetPositionalText(command);
        return Task.FromResult($"Hello, {(string.IsNullOrWhiteSpace(name) ? "world" : name)}!");
    }
}
```

```csharp
// Program.cs
builder.Services
    .AddControllers()
    .AddCli(cli =>
    {
        cli.AddProcessor<CliGreetCommandProcessor>();     // built by DI (constructor injection)
    });

var app = builder.Build();
app.UseWebSockets();
app.MapControllers();
app.UseCli();                                            // after UseWebSockets()
app.Run();
```

- `ICliCommandProcessor`: `Command`, `Description`, `Author` (default `DefaultLibraryAuthor.Instance`), `AllowUnlistedCommands`, `ValueRequired`, `AcceptsRawInput`, `Version` (default `"1.0.0"`), `Processors`, `Parameters`, `RequiredPermissions`, `HandleAsync(command, cancellationToken)`, default-implemented `HandleStructuredAsync(command, cancellationToken)` (return `null` to fall back to `HandleAsync`).
- `CliProcessCommand`: `Command`, `Data`, `ChainCommands`, `RawCommand`, `Value`, `Positionals` (may be `null` from old clients), `Args: Dictionary<string, object>`. Helpers in `CliValueHelpers`: `GetPositionals`, `GetPositionalText`, `SplitShellWords`, `JoinShellWords`, `QuoteShellWord`.
- The base classes `CliCommandProcessor` and `CliModule` live in the `Qodalis.Cli` package (namespace `Qodalis.Cli`); reference it, not only `Qodalis.Cli.Abstractions`.
- The cancellation token is the HTTP request's `RequestAborted`.

### .NET: parameters, sub-commands and modules

.NET server commands declare flags with `CliCommandParameterDescriptor` object initializers, nest sub-commands in `Processors`, and group them in a `CliModule` registered with `cli.AddModule`.

```csharp
using Qodalis.Cli;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Abstractions.Helpers;

public class CliWeatherCommandProcessor : CliCommandProcessor
{
    public override string Command { get; set; } = "weather";
    public override string Description { get; set; } = "Weather information";
    public override bool? AcceptsRawInput { get; set; } = true;

    public override IEnumerable<ICliCommandParameterDescriptor>? Parameters { get; set; } =
    [
        new CliCommandParameterDescriptor
        {
            Name = "location",                       // required member
            Description = "City name",               // required member
            Aliases = ["-l"],
            Type = CommandParameterType.String,      // String | Number | Boolean | Array | Object
            DefaultValue = "London",
        },
    ];

    public override IEnumerable<ICliCommandProcessor>? Processors { get; set; } = [new WeatherCurrentProcessor()];

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
        => Task.FromResult($"Sunny in {Location(command)}");

    internal static string Location(CliProcessCommand command) =>
        command.Args.TryGetValue("location", out var loc) ? loc.ToString()!
        : CliValueHelpers.GetPositionalText(command) is { Length: > 0 } text ? text : "London";
}

internal class WeatherCurrentProcessor : CliCommandProcessor
{
    public override string Command { get; set; } = "current";
    public override string Description { get; set; } = "Current conditions";
    public override bool? AcceptsRawInput { get; set; } = true;

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
        => Task.FromResult($"Sunny in {CliWeatherCommandProcessor.Location(command)}");
}

public class WeatherModule : CliModule
{
    public override string Name => "weather";
    public override string Version => "1.0.0";
    public override string Description => "Weather commands";
    public override IEnumerable<ICliCommandProcessor> Processors { get; } = [new CliWeatherCommandProcessor()];
}

// Program.cs: .AddCli(cli => cli.AddModule(new WeatherModule()));
```

- Dispatch: root by `Command` (case-insensitive), then each chain word against `Processors`; at the first word that matches no child the deepest matched processor handles the command (so `weather Paris` runs `weather`).
- The last registration of a command name wins.
- `CliBuilder` (in `AddCli(cli => ...)`): `AddProcessor<T>()` (DI-built), `AddProcessor(instance)`, `AddProcessorsFromAssembly(assembly)`, `AddModule(module)` (module-created instances, no DI), `AddMcp(o => ...)`, `EnableShell(...)`, `SetAllowedOrigins(...)`, `AddFileSystem(...)`, `AddDataExplorerProvider(...)`, `AddApplicationPart(assembly)`, `Services` (the `IServiceCollection`). Plugins add their own `CliBuilder` extension methods (e.g. `cli.AddJob<T>(...)`).
- Packages: `dotnet add package Qodalis.Cli` (brings `Qodalis.Cli.Abstractions`); targets .NET 10.

### .NET: structured and streaming output

.NET processors return structured output by explicitly implementing `ICliCommandProcessor.HandleStructuredAsync` with `CliResponseBuilder`, and stream with `ICliStreamCommandProcessor`.

```csharp
using Qodalis.Cli;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;
using Qodalis.Cli.Services;

public class CliUsersCommandProcessor : CliCommandProcessor, ICliStreamCommandProcessor
{
    public override string Command { get; set; } = "users";
    public override string Description { get; set; } = "Lists users";

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken ct = default)
        => Task.FromResult(string.Empty);

    // The base class does not declare HandleStructuredAsync: implement the interface member explicitly
    Task<ICliStructuredResponse?> ICliCommandProcessor.HandleStructuredAsync(CliProcessCommand command, CancellationToken ct)
    {
        var builder = new CliResponseBuilder();
        builder.WriteText("2 users", "info");
        builder.WriteTable(["Name", "Role"], [["ada", "admin"], ["bob", "user"]]);
        builder.WriteKeyValue(new Dictionary<string, string> { ["Total"] = "2" });
        return Task.FromResult<ICliStructuredResponse?>(builder.Build());
    }

    public async Task<int> HandleStreamAsync(CliProcessCommand command, Func<object, Task> emit, CancellationToken ct = default)
    {
        foreach (var name in new[] { "ada", "bob" })
        {
            ct.ThrowIfCancellationRequested();
            await emit(new TextOutput { Value = name });
        }
        return 0;                                    // exit code
    }
}
```

- `ICliResponseBuilder`: `WriteText(text, style?)`, `WriteTable(headers, rows)`, `WriteList(items, ordered = false)`, `WriteJson(value)`, `WriteKeyValue(dictionary)`, `SetExitCode(code)`, `Build()` -> `CliServerResponse { ExitCode, Outputs }`.
- Output classes (`Qodalis.Cli.Models`): `TextOutput { Value, Style }`, `TableOutput { Headers, Rows }`, `ListOutput { Items, Ordered }`, `JsonOutput { Value }`, `KeyValueOutput { Entries: KeyValueEntry[] }`.
- The executor uses the structured result only if it is a `CliServerResponse`; an empty `HandleAsync` string produces no output.

### .NET: permissions and MCP tools

.NET processors declare `RequiredPermissions`; with `cli.AddMcp()` every command is an MCP tool, and plugins add tools by registering an `IMcpToolProvider`.

```csharp
using System.Text.Json.Nodes;
using Qodalis.Cli.Mcp;

public class CliDeployCommandProcessor : CliCommandProcessor
{
    public override string Command { get; set; } = "deploy";
    public override string Description { get; set; } = "Deploys the app";
    public override IEnumerable<string>? RequiredPermissions { get; set; } = ["deploy:run"];
    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken ct = default)
        => Task.FromResult("deployed");
}

internal sealed class StatusMcpToolProvider : IMcpToolProvider
{
    public Task<IReadOnlyList<McpToolDefinition>> GetToolsAsync(McpToolContext context, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<McpToolDefinition>>(
        [
            new McpToolDefinition
            {
                Name = "status_ping",
                Description = "Ping a host",
                InputSchema = McpSchema.Object(new JsonObject { ["host"] = McpSchema.Property("string", "Host name") }, "host"),
                Annotations = McpToolAnnotations.ReadOnly,
                CallAsync = (args, ctx, ct) => Task.FromResult(McpToolResult.Ok($"pong {McpSchema.GetString(args, "host")}")),
            },
        ]);
}

// Program.cs
.AddCli(cli =>
{
    cli.AddProcessor<CliDeployCommandProcessor>();
    cli.Services.AddMcpToolProvider<StatusMcpToolProvider>();
    cli.AddMcp(o => o.Instructions = "Deployment server tools");   // POST /api/qcli/mcp
});
```

- Permissions are checked only when the server requires authentication (users plugin): `commands:execute` plus the `RequiredPermissions` of every processor from the root to the resolved sub-command (401 without a principal, 403 when missing).
- `McpOptions`: `Enabled`, `Tools` (allow-list, trailing `*`), `Exclude`, `Token`, `Instructions`. Command tools: name = command path joined with `_`; schema from `Parameters` (+ `value`).
- `McpToolResult.Ok(text, structured?)` / `McpToolResult.Error(text)`; `McpToolContext` has `Principal`, `Services`, `HttpContext`. Plugin tools win name collisions over command tools.

### .NET: testing server processors

.NET server processors are tested with xUnit by building a `CliCommandRegistry` and `CliCommandExecutorService` directly.

```csharp
using Microsoft.Extensions.Logging.Abstractions;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;
using Qodalis.Cli.Services;

public class GreetTests
{
    [Fact]
    public async Task Greets()
    {
        var registry = new CliCommandRegistry(NullLogger<CliCommandRegistry>.Instance);
        var executor = new CliCommandExecutorService(registry, NullLogger<CliCommandExecutorService>.Instance, Array.Empty<ICliProcessorFilter>());
        registry.Register(new CliGreetCommandProcessor());

        var response = await executor.ExecuteAsync(new CliProcessCommand { Command = "greet", Value = "Ada" });

        Assert.Equal(0, response.ExitCode);
        Assert.Equal("Hello, Ada!", Assert.IsType<TextOutput>(response.Outputs[0]).Value);
    }
}
```

- Or call `processor.HandleAsync(new CliProcessCommand { ... })` directly. Integration tests use `Microsoft.AspNetCore.Mvc.Testing` / `TestServer`.

### Python: minimal server processor

A Python server command subclasses `CliCommandProcessor` from `qodalis_cli_server_abstractions` and returns text from `async handle_async(command, cancellation_event=None)`.

```python
import asyncio

from qodalis_cli_server_abstractions import (
    CliCommandProcessor,
    CliProcessCommand,
    get_positional_text,
)


class CliGreetCommandProcessor(CliCommandProcessor):
    @property
    def command(self) -> str:
        return "greet"

    @property
    def description(self) -> str:
        return "Greets someone"

    @property
    def value_required(self) -> bool | None:
        return False  # False = optional positional value, True = required, None = no value

    async def handle_async(
        self,
        command: CliProcessCommand,
        cancellation_event: asyncio.Event | None = None,
    ) -> str:
        return f"Hello, {get_positional_text(command) or 'world'}!"
```

```python
import uvicorn
from qodalis_cli import CliServerOptions, create_cli_server

result = create_cli_server(
    CliServerOptions(configure=lambda builder: builder.add_processor(CliGreetCommandProcessor()))
)
uvicorn.run(result.app, host="0.0.0.0", port=8048)
```

- `ICliCommandProcessor` properties: `command` and `description` (abstract), `author` (default `DEFAULT_LIBRARY_AUTHOR`), `version` (`"1.0.0"`), `allow_unlisted_commands`, `value_required`, `processors`, `parameters`, `required_permissions`; methods `handle_async(command, cancellation_event=None) -> str` (abstract) and `handle_structured_async(command, cancellation_event=None)`.
- `CliProcessCommand` dataclass: `command`, `raw_command`, `value`, `args: dict`, `chain_commands: list[str]`, `data`, `positionals: list[str] | None`. Helpers: `get_positionals`, `get_positional_text`, `split_shell_words`, `join_shell_words`.
- Packages: `pip install qodalis-cli-server-abstractions` (plugins), `qodalis-cli-server` (host, import `qodalis_cli`). Python >= 3.10.
- Poll `cancellation_event.is_set()` in long loops when it is given; `/execute` passes `None`.

### Python: parameters, sub-commands and modules

Python server commands declare flags with `CliCommandParameterDescriptor`, nest sub-commands in `processors`, and are grouped into a `CliModule` registered with `builder.add_module`.

```python
import asyncio

from qodalis_cli_server_abstractions import (
    CliCommandParameterDescriptor,
    CliCommandProcessor,
    CliModule,
    CliProcessCommand,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    get_positional_text,
)

_location = CliCommandParameterDescriptor(
    name="location", description="City name", required=False,
    type="string", aliases=["-l"], default_value="London",
)


def _get_location(command: CliProcessCommand) -> str:
    return str(command.args.get("location") or get_positional_text(command) or "London")


class _WeatherCurrentProcessor(CliCommandProcessor):
    @property
    def command(self) -> str:
        return "current"

    @property
    def description(self) -> str:
        return "Current conditions"

    @property
    def parameters(self) -> list[ICliCommandParameterDescriptor]:
        return [_location]

    async def handle_async(self, command: CliProcessCommand, cancellation_event: asyncio.Event | None = None) -> str:
        return f"Sunny in {_get_location(command)}"


class _CliWeatherCommandProcessor(CliCommandProcessor):
    @property
    def command(self) -> str:
        return "weather"

    @property
    def description(self) -> str:
        return "Weather information"

    @property
    def parameters(self) -> list[ICliCommandParameterDescriptor]:
        return [_location]

    @property
    def processors(self) -> list[ICliCommandProcessor]:
        return [_WeatherCurrentProcessor()]

    async def handle_async(self, command: CliProcessCommand, cancellation_event: asyncio.Event | None = None) -> str:
        return f"Sunny in {_get_location(command)}"


class WeatherModule(CliModule):
    @property
    def name(self) -> str:
        return "weather"

    @property
    def version(self) -> str:
        return "1.0.0"

    @property
    def description(self) -> str:
        return "Weather commands"

    @property
    def processors(self) -> list[ICliCommandProcessor]:
        return [_CliWeatherCommandProcessor()]


# host: create_cli_server(CliServerOptions(configure=lambda b: b.add_module(WeatherModule())))
```

- `CliCommandParameterDescriptor(name, description, required=False, type="string", aliases=None, default_value=None)`.
- Dispatch: root by `command.lower()`, then each `chain_commands` word against `processors`; if a word matches no child, the current processor handles it only when `allow_unlisted_commands` is truthy, else `Unknown command`. Only the resolved processor runs.
- `CliBuilder` (chainable): `add_processor`, `add_module`, `set_file_storage_provider`, `add_data_explorer_provider`, `add_filesystem` (legacy). Registering the same command twice replaces the first.
- `CliServerOptions`: `base_path` (`"/api/qcli"`), `cors`, `cors_origins`, `allowed_origins`, `enable_shell`, `shell`, `mcp` (`True`, dict or `CliMcpOptions`), `configure`. `create_cli_server` returns `CliServerResult` with `app`, `registry`, `builder`, `executor`, `mcp`, `mount_plugin(plugin)`, ...

### Python: structured and streaming output

Python processors return structured output by overriding `handle_structured_async` with `CliResponseBuilder`, and stream by also implementing `ICliStreamCommandProcessor`.

```python
import asyncio
from typing import Any, Callable

from qodalis_cli import CliResponseBuilder
from qodalis_cli_server_abstractions import (
    CliCommandProcessor,
    CliProcessCommand,
    ICliStreamCommandProcessor,
)


class CliUsersCommandProcessor(CliCommandProcessor, ICliStreamCommandProcessor):
    @property
    def command(self) -> str:
        return "users"

    @property
    def description(self) -> str:
        return "Lists users"

    async def handle_async(self, command: CliProcessCommand, cancellation_event: asyncio.Event | None = None) -> str:
        return "ada, bob"

    async def handle_structured_async(
        self, command: CliProcessCommand, cancellation_event: asyncio.Event | None = None
    ) -> Any:
        builder = CliResponseBuilder()
        builder.write_text("2 users", "info")
        builder.write_table(["Name", "Role"], [["ada", "admin"], ["bob", "user"]])
        builder.write_key_value({"Total": "2"})
        return builder.build()

    async def handle_stream_async(
        self,
        command: CliProcessCommand,
        emit: Callable[[dict[str, Any]], None],
        cancellation_event: asyncio.Event | None = None,
    ) -> int:
        for name in ("ada", "bob"):
            emit({"type": "text", "value": name})
        return 0  # exit code
```

- Keep the `cancellation_event` parameter in every override: the executor always passes two arguments.
- Return `self._STRUCTURED_NOT_IMPLEMENTED` from `handle_structured_async` to fall back to `handle_async`.
- `CliResponseBuilder`: `write_text(text, style=None)`, `write_table(headers, rows)`, `write_list(items, ordered=False)`, `write_json(value)`, `write_key_value(dict)`, `set_exit_code(code)`, `build()` -> `CliServerResponse`. Output models (`qodalis_cli.models`): `CliServerTextOutput`, `CliServerTableOutput`, `CliServerListOutput`, `CliServerJsonOutput`, `CliServerKeyValueOutput`.

### Python: permissions and MCP tools

Python processors declare `required_permissions`; with `mcp=True` every command is an MCP tool, and plugins add tools by registering an `IMcpToolProvider` on `result.mcp`.

```python
from qodalis_cli import CliMcpOptions, CliServerOptions, McpTool, McpToolResult, create_cli_server
from qodalis_cli.mcp import object_schema


class StatusToolProvider:
    name = "status"

    async def get_tools(self, context):
        async def ping(args, ctx):
            return McpToolResult(text=f"pong {args['host']}")

        return [
            McpTool(
                name="status_ping",
                description="Ping a host",
                input_schema=object_schema({"host": {"type": "string"}}, ["host"]),
                call=ping,
                annotations={"readOnlyHint": True},
            )
        ]


result = create_cli_server(
    CliServerOptions(configure=configure, mcp=CliMcpOptions(instructions="Deployment server tools"))
)
result.mcp.add_provider(StatusToolProvider())   # endpoint POST /api/qcli/mcp
```

- Declare permissions on a processor with `@property def required_permissions(self) -> list[str] | None: return ["deploy:run"]`; enforced (403) only when the users plugin protects the server, together with `commands:execute`, along the whole command chain.
- `CliMcpOptions(enabled=True, tools=None, exclude=None, token=None, instructions=None)`. Command tools: name = command path joined with `_`; schema from `parameters` (+ `value` when `value_required` is not `None`).
- `McpToolResult(text, structured=None, is_error=False)`, `McpToolResult.error(message)`; a plugin object with `on_mount(self, server)` can call `server.mcp.add_provider(...)` when mounted with `result.mount_plugin(plugin)`.

### Python: testing server processors

Python server processors are tested with pytest (`asyncio_mode = "auto"`), calling `handle_async` directly or through `CliCommandExecutorService`.

```python
from qodalis_cli import CliCommandExecutorService, CliCommandRegistry
from qodalis_cli_server_abstractions import CliProcessCommand


async def test_greet_direct():
    command = CliProcessCommand(command="greet", raw_command="greet Ada", value="Ada")
    assert await CliGreetCommandProcessor().handle_async(command) == "Hello, Ada!"


async def test_greet_executor():
    registry = CliCommandRegistry()
    registry.register(CliGreetCommandProcessor())
    result = await CliCommandExecutorService(registry).execute_async(CliProcessCommand(command="greet", value="Ada"))
    assert result.exit_code == 0
    assert result.outputs[0].value == "Hello, Ada!"
```

- HTTP tests: `from fastapi.testclient import TestClient`; `with TestClient(create_cli_server(CliServerOptions(configure=...)).app) as client: client.post("/api/v1/qcli/execute", json={...})`.
