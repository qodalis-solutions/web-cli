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

### Paging list output (all servers)

A command that can return many rows must page them: a terminal should never receive thousands of rows.

- Declare the parameters: `--skip` (default 0) and `--take` (default 50, at most 500). Node `CliPaging.parameters()`, .NET `CliPaging.Parameters()` (`Qodalis.Cli.Abstractions.Helpers`), Python `CliPaging.parameters()`.
- Read the request: Node `CliPaging.from(command)`, .NET `CliPaging.From(command)`, Python `CliPaging.from_command(command)`. It gives `skip` and `take` for the query; missing or invalid values fall back to the defaults.
- Query those rows (and the total when it is cheap) and write it with the paged table writer: Node `writePagedTable(headers, rows, page, { total, hasMore })`, .NET `WritePagedTable(headers, rows, page, total, hasMore)`, Python `write_paged_table(headers, rows, page, total=None, has_more=None)`. Without a total, pass `hasMore` (query `take + 1` rows to find out).
- On the wire the table carries `page: { skip, take, total?, hasMore }`. The web terminal prints `Rows 51–100 of 1987 · next: <command> --skip 100` under it; MCP text output adds `(rows 51-100 of 1987; next: skip=100)`.
- Safety net: a table without a page that has more than the server's `maxTableRows` / `MaxTableRows` / `max_table_rows` rows (default 200, 0 = no limit) is cut to that many and marked `page.truncated`; the terminal says the command does not page. Do not rely on it: page instead.

.NET example:

```csharp
public override IEnumerable<ICliCommandParameterDescriptor>? Parameters { get; set; } = CliPaging.Parameters();

public async Task<ICliStructuredResponse?> HandleStructuredAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
{
    var page = CliPaging.From(command);
    var total = await db.Orders.CountAsync(cancellationToken);
    var rows = await db.Orders.OrderBy(o => o.Id).Skip(page.Skip).Take(page.Take)
        .Select(o => new[] { o.Id.ToString(), o.Customer }).ToArrayAsync(cancellationToken);

    var builder = new CliResponseBuilder();
    builder.WritePagedTable(["Id", "Customer"], rows, page, total);
    return builder.Build();
}
```

### Help for server commands (all servers)

A server command can carry the same help as a web command: examples, longer documentation, aliases, its own module and icon, and the allowed values of a parameter. All are optional; the web terminal shows them with `help <command>` and older servers simply send none.

- Command members: Node `aliases`, `examples` (`{ command, description? }[]`), `documentation`, `module`, `icon`; .NET `Aliases`, `Examples` (`new CliCommandExample("cmd", "what it does")`), `Documentation`, `Module`, `Icon`; Python properties `aliases`, `examples` (`CliCommandExample("cmd", "what it does")`), `documentation`, `module`, `icon`.
- Parameter member: Node `allowedValues` (7th constructor argument of `CliCommandParameterDescriptor`), .NET `AllowedValues`, Python `allowed_values`. The terminal lists them in help, completes them with Tab (`--format ` and `--format=`) and refuses other values before sending (ignoring case); MCP tools list them as an `enum`.
- Parameter examples: Node `examples` (8th constructor argument), .NET `Examples`, Python `examples`: example values shown in help after the description (`e.g. Paris, New York`) and as `examples` in MCP tool schemas.
- `documentation` is plain text; separate paragraphs with a blank line. Examples are command lines as the user types them.
- Aliases work on root commands and sub-commands, on the server too (execution and permission checks). In the terminal `node:base64` also answers to `node:b64`, and the bare alias `b64` is registered unless a local command owns that name.
- `module` and `icon` place the command in `help`'s list (default: the server's group, `Server (node)`, and 🖥); help still says which server the command runs on.
- Wire format in `GET /api/v1/qcli/commands`: `aliases`, `examples`, `documentation`, `module`, `icon` on each command and `allowedValues` and `examples` on each parameter, left out when unset.

Node example:

```typescript
class ExportProcessor extends CliCommandProcessor {
    command = 'export';
    description = 'Exports the orders';
    aliases = ['exp'];
    module = 'orders';
    icon = '📦';
    documentation = 'Writes the orders of a day in the chosen format.\n\nLarge days are paged: see --skip and --take.';
    examples = [
        { command: 'export --format csv', description: "Today's orders as CSV" },
        { command: 'export --day 2026-11-01 --format json', description: 'One day as JSON' },
    ];
    parameters = [
        new CliCommandParameterDescriptor('format', 'Output format', false, 'string', ['f'], 'csv', ['csv', 'json']),
        new CliCommandParameterDescriptor('day', 'Day (YYYY-MM-DD), default today', false, 'string'),
    ];
    async handleAsync(command: CliProcessCommand): Promise<string> { /* ... */ }
}
```

.NET: `public override IEnumerable<CliCommandExample>? Examples { get; set; } = [new("export --format csv", "Today's orders as CSV")];` and `AllowedValues = ["csv", "json"]` in the parameter's object initializer. Python: `@property def examples(self): return [CliCommandExample("export --format csv", "Today's orders as CSV")]` and `allowed_values=["csv", "json"]`.

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

- `ICliCommandProcessor` members: `command`, `description`, `author` (default `DefaultLibraryAuthor`), `version` (default `'1.0.0'`), `allowUnlistedCommands?`, `valueRequired?`, `acceptsValue?`, `processors?`, `parameters?`, `requiredPermissions?`, `aliases?`, `examples?`, `documentation?`, `module?`, `icon?` (see "Help for server commands"), `handleAsync(command, signal?) => Promise<string>`, `handleStructuredAsync?(command, signal?) => Promise<CliStructuredResponse>` (takes precedence when present).
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

- `CliStructuredOutput` = `text` (`value`, `style?`) | `table` (`headers`, `rows`, `page?`) | `list` (`items`, `ordered?`) | `json` (`value`) | `key-value` (`entries`). Import these types from `@qodalis/cli-server-abstractions` (the server package re-exports them as `CliServerOutput` / `CliServerResponse`).
- `CliResponseBuilder` (from `@qodalis/cli-server-node`): `writeText(text, style?)`, `writeTable(headers, rows)`, `writePagedTable(headers, rows, page, { total?, hasMore? })`, `writeList(items, ordered?)`, `writeJson(value)`, `writeKeyValue(record)`, `setExitCode(code)`, `build()`.
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

- `ICliResponseBuilder`: `WriteText(text, style?)`, `WriteTable(headers, rows)`, `WritePagedTable(headers, rows, page, total?, hasMore?)`, `WriteList(items, ordered = false)`, `WriteJson(value)`, `WriteKeyValue(dictionary)`, `SetExitCode(code)`, `Build()` -> `CliServerResponse { ExitCode, Outputs }`.
- Output classes (`Qodalis.Cli.Models`): `TextOutput { Value, Style }`, `TableOutput { Headers, Rows, Page? }`, `ListOutput { Items, Ordered }`, `JsonOutput { Value }`, `KeyValueOutput { Entries: KeyValueEntry[] }`.
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

- `CliCommandParameterDescriptor(name, description, required=False, type="string", aliases=None, default_value=None, allowed_values=None)`.
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
- `CliResponseBuilder`: `write_text(text, style=None)`, `write_table(headers, rows)`, `write_paged_table(headers, rows, page, total=None, has_more=None)`, `write_list(items, ordered=False)`, `write_json(value)`, `write_key_value(dict)`, `set_exit_code(code)`, `build()` -> `CliServerResponse`. Output models (`qodalis_cli.models`): `CliServerTextOutput`, `CliServerTableOutput`, `CliServerListOutput`, `CliServerJsonOutput`, `CliServerKeyValueOutput`.

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

### .NET: jobs that run elsewhere

The jobs API (`/api/v1/qcli/jobs`), the `jobs_*` MCP tools, `server jobs` and the dashboard's jobs page work on an `ICliJobManager` (`Qodalis.Cli.Abstractions.Jobs`). The default runs the jobs registered with `AddJob` in the server's process; a host whose jobs run elsewhere implements the interface and registers it with `cli.SetJobManager<T>()` (scoped).

- Implement `GetJobsAsync` (each `CliJobInfo` with `Id`, `Name`, `Status`, `LastRunAt`, `LastRunStatus` and `Actions`, such as `["trigger", "pause", "resume"]`), `TriggerAsync`, `PauseAsync`, `ResumeAsync`, `GetExecutionsAsync` and `GetExecutionAsync`.
- `StopAsync`, `CancelAsync` and `UpdateAsync` default to `NotSupportedException` (HTTP `501`, `NOT_SUPPORTED`); the dashboard shows only the actions in `Actions`.
- Throw `KeyNotFoundException` for an unknown job (`404`) and `InvalidOperationException` when the job's state refuses the action (`409`).

### Jobs: inside a job (all servers)

A job's execution context gives each run its log lines, `properties` (the run's own values, saved with the execution and returned by the API as `properties`, e.g. `items=32`) and `discard()` (leaves a completed run that found nothing to do out of the history; failed runs are always kept).

- .NET: `context.Properties["synced"] = 12`, `context.Discard()`, and `context.Services`, a DI scope created for the run (for a `DbContext`).
- Node: `context.properties.synced = 12`, `context.discard()`.
- Python: `context.properties["synced"] = 12`, `context.discard()`.
- Job ids are stable: the `id` option (`Id`, `id`), or the job's name (`-2`, `-3`, ... for duplicate names). The API, the history and a saved pause use the id, so keep it the same across releases. Ids may not contain `/`, `\`, `?` or `#`.
- A saved pause or stop survives a restart; disabling a job in code (`Enabled = false`, `enabled: false`, `enabled=False`) always keeps it stopped.
- `RunOnStart` / `runOnStart` / `run_on_start` runs a job when the server starts; an interval job keeps its rhythm across restarts (the next run is the last run plus the interval).
- Run a job from the host's own code through the scheduler interface: `ICliJobScheduler.TriggerAsync(id)` (.NET, resolve the interface), `scheduler.triggerAsync(id)` (Node), `await scheduler.trigger(id)` (Python).
- `GET /api/v1/qcli/jobs/executions?job=a,b&group=&status=&since=&limit=&offset=` lists the runs of several jobs (or every job), newest first. Job storage can delete old runs: `PruneAsync(before)` (.NET), `prune(before)` (Node, Python).

```csharp
public class SyncOrdersJob : ICliJob
{
    public async Task ExecuteAsync(ICliJobExecutionContext context, CancellationToken cancellationToken)
    {
        var synced = await context.Services.GetRequiredService<IOrderSync>().SyncAsync(cancellationToken);
        if (synced == 0) { context.Discard(); return; }
        context.Properties["synced"] = synced;
    }
}

builder.Services.AddControllers().AddCli(cli => cli
    .AddJob(new SyncOrdersJob(), o => { o.Id = "sync-orders"; o.Interval = TimeSpan.FromMinutes(5); o.RunOnStart = true; })
    // history and state in your database (Qodalis.Cli.Plugin.Jobs.EfCore)
    .AddEfCoreJobStorage(o => o.UseNpgsql(connectionString)));
```

- .NET only: `AddEfCoreJobStorage` keeps the history in any EF Core database and creates its tables (`job_executions`, `job_states`) even in a database that already has others; call `modelBuilder.ApplyJobStorageModel()` to keep them in your own migrations. Database stores return `properties` values as JSON values.

### Audit log plugin (all servers)

The audit log is a plugin of its own (.NET `Qodalis.Cli.Plugin.Audit`, Node `@qodalis/cli-server-plugin-audit`, Python `qodalis-cli-server-plugin-audit`): it keeps the entries and serves `GET /api/v1/qcli/audit?event=&username=&actor=&limit=&offset=` (`audit:read`; newest first, 100 without a `limit`, at most 1000) and `DELETE /api/v1/qcli/audit` (`audit:clear`; records `audit_cleared` with who did it), read by the console's `audit` and the dashboard's Audit page, and listed on its Plugins page. The users plugin adds it and records sign-ins, failed sign-ins, user, group, token and shell events there; a host can add it alone: .NET `cli.AddAudit()`, Node `new CliAuditBuilder().build()` mounted with `mountPlugin` (pass it to the users plugin with `setAuditPlugin` to share it), Python `CliAuditBuilder().build()` mounted with `mount_plugin` (the users plugin joins a mounted one).

- An entry has `event`, `actor`, `username` (the user it is about), `target` (what else it is about, e.g. `group:admins`), `metadata` and `properties` (the host's own values).
- A host writes its own entries to the same log through the audit store: `IAuditStore.LogAsync` (.NET, `Qodalis.Cli.Abstractions.Audit`), `auditStore.log(...)` (Node), `await audit_store.log(...)` (Python).
- Another store: `cli.SetAuditStore<T>()` (.NET), `CliAuditBuilder.setStore(store)` (Node), `CliAuditBuilder().set_store(store)` (Python); the users plugin's audit-store option still works and does the same. The contract (`AuditEntry`, `AuditQueryOptions`, the store interface) is in each server's abstractions package. Old entries: `PruneAsync(before)` (.NET), `prune(before)` (Node; Python takes Unix milliseconds).
- .NET only: `cli.AddEfCoreAuditStore(o => o.UseNpgsql(connectionString))` (`Qodalis.Cli.Plugin.Audit.EfCore`) keeps the log in a database (table `audit_entries`; `modelBuilder.ApplyAuditStorageModel()` for your own migrations). It keeps every entry, failed sign-ins included: prune it from a daily job.

### Data explorer sources: permissions, read-only, masking (all servers)

Each data explorer source takes these options besides `timeout` and `maxRows` (Node and JSON names; .NET PascalCase, Python snake_case):

- `readOnly` (default **true**): only queries that read are accepted (`SELECT`/`WITH`/`EXPLAIN`/`SHOW`..., MongoDB `find`/`aggregate`..., Redis read commands, Elasticsearch `GET` and `_search`), and SQL providers run them in a read-only transaction. Set it to false for a source that must write.
- `requiredPermissions`: permissions the caller needs besides `data:query`; other users do not see the source (403 on `schema`/`execute`).
- `allowedObjects`: glob patterns of the tables (`schema.table` or `table`), collections, Redis keys or indices the source shows and accepts.
- `maskColumns` (values shown as `***`) and `dropColumns` (removed from results and schema): glob patterns of column or field names.
- `rateLimit` `{ maxQueries, windowSeconds }`: per user and source; more answer 429.
- `audit` (default true): every execute is written to the audit log as `data_query` with the source, the query (first 2000 characters), success, row count and duration.
- `exportPermissions`: `GET /sources` reports `canExport`, and the web CLI's `data-explorer` refuses `\format json|csv` when it is false.

The object filter and the read-only check are a convenience: give the source a database account that can only read what its users may see.

### Server logs and Seq (.NET)

The dashboard's Logs page reads `GET /api/v1/qcli/logs?level=&search=&service=&from=&to=&limit=&offset=` (`logs:read`; `level` is one level or a comma list of `DEBUG`, `INFO`, `WARN`, `ERROR`; `from`/`to` ISO 8601; at most 500 per page) and tails `/ws/v1/qcli/logs` live. By default the history is the admin plugin's in-memory buffer: the latest 1000 entries of that process, gone on restart.

- .NET: `cli.AddSeqLogs(seq => { seq.ServerUrl = "http://seq:5341"; seq.ApiKey = ...; seq.ServiceName = "my-api"; })` (`Qodalis.Cli.Plugin.Logs.Seq`) sends every log entry to Seq as CLEF, tagged `Service`, and makes Seq the history: it survives restarts and holds every service that writes there, filtered by service, level, text and time. A service that only writes (a worker without the admin plugin) sets `seq.ReadHistory = false`. Logging never waits for Seq or fails because of it.
- The answer carries `store` (`memory`, `seq`), `persistent`, `services` and `hasMore`; `total` is null when the store cannot count (Seq). 502 with `{ error }` when the store is unreachable.
- Another store: implement `ILogStore` (`Qodalis.Cli.Abstractions.Logs`) and register it as a singleton.

### Installed plugins (all servers)

`GET /api/v1/qcli/plugins/installed` (admin plugin) lists the server plugins the host installed (users, admin, jobs, storage providers, ...) with their package id, version and description; the dashboard's Plugins page shows them above the command modules. The built-in plugins list themselves; a plugin of your own registers with `cli.AddInstalledPlugin(assembly)` (.NET), `builder.addInstalledPlugin(...)` (Node) or `builder.add_installed_plugin(...)` (Python).

### Dashboard statistics endpoints (all servers)

Since 1.0.0-beta.19 every server answers read-only endpoints the admin dashboard (1.0.0-beta.15) charts; the JSON is the same on .NET, Node and Python. Times are ISO 8601 (no offset = UTC), durations milliseconds; a range is `[since, until)` cut into `buckets` equal columns (1-200, default 24; the default range is the last 24 hours) and a start not before its end answers 400.

- `GET /api/v1/qcli/jobs/stats?since=&until=&buckets=&job=&group=` (jobs plugin): runs per column by result (`succeeded`, `failed` incl. timed out, `cancelled`, `running`), `totals` (`successRate` = succeeded / (succeeded + failed), `avgDuration`, `p95Duration`, `maxDuration`, `lastFailureAt`) and per job (`jobs[]` with the same totals and its 12 latest runs in `recent`). Counted over every run in the range through the store's execution query, so it works with any jobs store.
- `GET /api/v1/qcli/logs/histogram?from=&to=&buckets=&level=&search=&service=` (admin plugin): entries per level (`DEBUG`, `INFO`, `WARN`, `ERROR`) and column with the filters of `GET /logs`, from the in-memory history or, on .NET, Seq (`ILogStore.HistogramAsync`, with a default that pages `QueryAsync`).
- `GET /api/v1/qcli/status/history?minutes=` (admin plugin, 1-1440, default 60): the status sampled every 15 seconds for 24 hours (`memoryMb`, `cpuPercent` of one core, `activeWsConnections`, `activeShellSessions`), oldest first; in memory, gone on restart.
- `GET /api/v1/qcli/commands/stats` (core, same access as `GET /commands`): executions, failures (non-zero exit, exception, unknown command), average duration and last run of each root command since the server started; `known` is false for commands the registry does not have.
- `GET /api/v1/qcli/audit` takes `from` and `to` (ISO 8601 or epoch ms); a custom audit store applies them from `AuditQueryOptions`.

### Admin dashboard: name and icon (all servers)

The dashboard is "Qodalis Cli Admin" with the Qodalis Solutions logo unless the admin plugin sets its branding: the name and icon (browser tab, sidebar, sign-in page) and the terminal's name in its welcome banner.

- .NET: `cli.AddAdmin(o => { o.Branding.Name = "RateBell"; o.Branding.IconUrl = "/favicon.svg"; o.Branding.CliName = "RateBell CLI"; })`
- Node: `new CliAdminBuilder().setBranding({ name: 'RateBell', iconUrl: '/favicon.svg', cliName: 'RateBell CLI' })`
- Python: `CliAdminBuilder().set_branding({"name": "RateBell", "icon_url": "/favicon.svg", "cli_name": "RateBell CLI"})`
- The icon is an absolute http(s) URL, a root-relative path or a base64 `data:image` URL; invalid values fail at startup. The values are served as `branding` in `/qcli/admin/theme.json`.
- The filesystem API (`/api/qcli/fs/*`) and the dashboard's Files page exist only when the server enables the filesystem (`AddFileSystem()` in .NET); otherwise the routes answer `404`.
