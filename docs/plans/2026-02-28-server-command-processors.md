# Server Command Processors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the CLI to connect to one or more .NET backend servers, discover their command processors via REST, and execute them transparently alongside local commands.

**Architecture:** Engine-level server module. Servers are configured via `CliOptions.servers`. On boot, the engine fetches command metadata from each server and creates proxy processors. When invoked, proxy processors POST to the server and render the structured JSON response using existing terminal writer methods. The .NET server gets a full command registry, execution pipeline, and REST API.

**Tech Stack:** TypeScript (cli-core + cli packages), C# (.NET 8, ASP.NET Core), HTTP REST (fetch API)

---

### Task 1: Add Server Configuration Types to cli-core

**Files:**
- Modify: `projects/core/src/lib/models/index.ts` (after line 291, after CliOptions)

**Step 1: Add CliServerConfig and CliServerResponse types**

Add after the `CliOptions` type (after line 291):

```typescript
/**
 * Configuration for a remote CLI server
 */
export type CliServerConfig = {
    /** Unique identifier, used for namespacing commands */
    name: string;

    /** Base URL of the server, e.g. "https://api.example.com" */
    url: string;

    /** Whether this server is enabled. @default true */
    enabled?: boolean;

    /** Custom headers sent with every request (e.g. auth tokens) */
    headers?: Record<string, string>;

    /** Request timeout in milliseconds. @default 30000 */
    timeout?: number;
};

/**
 * A single output item in a server response
 */
export type CliServerOutput =
    | { type: 'text'; value: string; style?: 'success' | 'error' | 'info' | 'warning' }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'list'; items: string[]; ordered?: boolean }
    | { type: 'json'; value: any }
    | { type: 'key-value'; entries: { key: string; value: string }[] };

/**
 * Structured response from a server command execution
 */
export type CliServerResponse = {
    exitCode: number;
    outputs: CliServerOutput[];
};

/**
 * Metadata about a remote command processor, returned by GET /api/cli/commands
 */
export type CliServerCommandDescriptor = {
    command: string;
    description?: string;
    version?: string;
    parameters?: {
        name: string;
        aliases?: string[];
        description: string;
        required: boolean;
        type: string;
        defaultValue?: any;
    }[];
    processors?: CliServerCommandDescriptor[];
};
```

**Step 2: Add `servers` to CliOptions**

In the `CliOptions` type (around line 289, before the closing `};`), add:

```typescript
    /**
     * Remote CLI servers to connect to.
     * Commands from each server are discovered and registered as proxy processors.
     */
    servers?: CliServerConfig[];
```

**Step 3: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core"`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add projects/core/src/lib/models/index.ts
git commit -m "feat(core): add server configuration and response types to CliOptions"
```

---

### Task 2: Build .NET Command Registry and Execution Pipeline

**Files:**
- Create: `src/Qodalis.Cli/Services/ICliCommandRegistry.cs`
- Create: `src/Qodalis.Cli/Services/CliCommandRegistry.cs`
- Create: `src/Qodalis.Cli/Services/ICliResponseBuilder.cs`
- Create: `src/Qodalis.Cli/Services/CliResponseBuilder.cs`
- Create: `src/Qodalis.Cli/Services/ICliCommandExecutorService.cs`
- Create: `src/Qodalis.Cli/Services/CliCommandExecutorService.cs`
- Create: `src/Qodalis.Cli/Models/CliServerOutput.cs`
- Create: `src/Qodalis.Cli/Models/CliServerResponse.cs`
- Create: `src/Qodalis.Cli/Models/CliServerCommandDescriptor.cs`

All files are in the `cli-server-dotnet` repo at `/Users/nicolaelupei/Documents/Personal/cli-server-dotnet/`.

**Step 1: Create response models**

`src/Qodalis.Cli/Models/CliServerOutput.cs`:
```csharp
using System.Text.Json.Serialization;

namespace Qodalis.Cli.Models;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(TextOutput), "text")]
[JsonDerivedType(typeof(TableOutput), "table")]
[JsonDerivedType(typeof(ListOutput), "list")]
[JsonDerivedType(typeof(JsonOutput), "json")]
[JsonDerivedType(typeof(KeyValueOutput), "key-value")]
public abstract class CliServerOutput
{
}

public class TextOutput : CliServerOutput
{
    public required string Value { get; set; }
    public string? Style { get; set; }
}

public class TableOutput : CliServerOutput
{
    public required string[] Headers { get; set; }
    public required string[][] Rows { get; set; }
}

public class ListOutput : CliServerOutput
{
    public required string[] Items { get; set; }
    public bool? Ordered { get; set; }
}

public class JsonOutput : CliServerOutput
{
    public required object Value { get; set; }
}

public class KeyValueOutput : CliServerOutput
{
    public required KeyValueEntry[] Entries { get; set; }
}

public class KeyValueEntry
{
    public required string Key { get; set; }
    public required string Value { get; set; }
}
```

`src/Qodalis.Cli/Models/CliServerResponse.cs`:
```csharp
namespace Qodalis.Cli.Models;

public class CliServerResponse
{
    public int ExitCode { get; set; }
    public List<CliServerOutput> Outputs { get; set; } = [];
}
```

`src/Qodalis.Cli/Models/CliServerCommandDescriptor.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Models;

public class CliServerCommandDescriptor
{
    public required string Command { get; set; }
    public string? Description { get; set; }
    public string? Version { get; set; }
    public List<CliCommandParameterDescriptorDto>? Parameters { get; set; }
    public List<CliServerCommandDescriptor>? Processors { get; set; }
}

public class CliCommandParameterDescriptorDto
{
    public required string Name { get; set; }
    public IEnumerable<string>? Aliases { get; set; }
    public required string Description { get; set; }
    public bool Required { get; set; }
    public CommandParameterType Type { get; set; }
    public object? DefaultValue { get; set; }
}
```

**Step 2: Create ICliResponseBuilder and implementation**

`src/Qodalis.Cli/Services/ICliResponseBuilder.cs`:
```csharp
namespace Qodalis.Cli.Services;

public interface ICliResponseBuilder
{
    void WriteText(string text, string? style = null);
    void WriteTable(string[] headers, string[][] rows);
    void WriteList(string[] items, bool ordered = false);
    void WriteJson(object value);
    void WriteKeyValue(Dictionary<string, string> entries);
    void SetExitCode(int code);
    Models.CliServerResponse Build();
}
```

`src/Qodalis.Cli/Services/CliResponseBuilder.cs`:
```csharp
using Qodalis.Cli.Models;

namespace Qodalis.Cli.Services;

public class CliResponseBuilder : ICliResponseBuilder
{
    private readonly List<CliServerOutput> _outputs = [];
    private int _exitCode;

    public void WriteText(string text, string? style = null)
    {
        _outputs.Add(new TextOutput { Value = text, Style = style });
    }

    public void WriteTable(string[] headers, string[][] rows)
    {
        _outputs.Add(new TableOutput { Headers = headers, Rows = rows });
    }

    public void WriteList(string[] items, bool ordered = false)
    {
        _outputs.Add(new ListOutput { Items = items, Ordered = ordered });
    }

    public void WriteJson(object value)
    {
        _outputs.Add(new JsonOutput { Value = value });
    }

    public void WriteKeyValue(Dictionary<string, string> entries)
    {
        _outputs.Add(new KeyValueOutput
        {
            Entries = entries.Select(e => new KeyValueEntry { Key = e.Key, Value = e.Value }).ToArray()
        });
    }

    public void SetExitCode(int code) => _exitCode = code;

    public CliServerResponse Build() => new()
    {
        ExitCode = _exitCode,
        Outputs = [.. _outputs]
    };
}
```

**Step 3: Create command registry**

`src/Qodalis.Cli/Services/ICliCommandRegistry.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Services;

public interface ICliCommandRegistry
{
    IReadOnlyList<ICliCommandProcessor> Processors { get; }
    void Register(ICliCommandProcessor processor);
    ICliCommandProcessor? FindProcessor(string command, IEnumerable<string>? chainCommands = null);
}
```

`src/Qodalis.Cli/Services/CliCommandRegistry.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Services;

public class CliCommandRegistry : ICliCommandRegistry
{
    private readonly List<ICliCommandProcessor> _processors = [];

    public IReadOnlyList<ICliCommandProcessor> Processors => _processors;

    public void Register(ICliCommandProcessor processor)
    {
        // Replace existing processor with same command, or add new
        var existingIndex = _processors.FindIndex(
            p => string.Equals(p.Command, processor.Command, StringComparison.OrdinalIgnoreCase));

        if (existingIndex >= 0)
        {
            _processors[existingIndex] = processor;
        }
        else
        {
            _processors.Add(processor);
        }
    }

    public ICliCommandProcessor? FindProcessor(string command, IEnumerable<string>? chainCommands = null)
    {
        var processor = _processors.FirstOrDefault(
            p => string.Equals(p.Command, command, StringComparison.OrdinalIgnoreCase));

        if (processor == null || chainCommands == null)
            return processor;

        // Walk nested processors for chain commands
        var chain = chainCommands.ToList();
        foreach (var sub in chain)
        {
            var child = processor.Processors?.FirstOrDefault(
                p => string.Equals(p.Command, sub, StringComparison.OrdinalIgnoreCase));

            if (child == null) break;
            processor = child;
        }

        return processor;
    }
}
```

**Step 4: Create command executor service**

`src/Qodalis.Cli/Services/ICliCommandExecutorService.cs`:
```csharp
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;

namespace Qodalis.Cli.Services;

public interface ICliCommandExecutorService
{
    Task<CliServerResponse> ExecuteAsync(CliProcessCommand command, CancellationToken cancellationToken = default);
}
```

`src/Qodalis.Cli/Services/CliCommandExecutorService.cs`:
```csharp
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;

namespace Qodalis.Cli.Services;

public class CliCommandExecutorService : ICliCommandExecutorService
{
    private readonly ICliCommandRegistry _registry;

    public CliCommandExecutorService(ICliCommandRegistry registry)
    {
        _registry = registry;
    }

    public async Task<CliServerResponse> ExecuteAsync(
        CliProcessCommand command,
        CancellationToken cancellationToken = default)
    {
        var processor = _registry.FindProcessor(command.Command, command.ChainCommands);

        if (processor == null)
        {
            var builder = new CliResponseBuilder();
            builder.WriteText($"Unknown command: {command.Command}", "error");
            builder.SetExitCode(1);
            return builder.Build();
        }

        var responseBuilder = new CliResponseBuilder();

        try
        {
            var result = await processor.HandleAsync(command, cancellationToken);

            if (!string.IsNullOrEmpty(result))
            {
                responseBuilder.WriteText(result);
            }
        }
        catch (Exception ex)
        {
            responseBuilder.WriteText($"Error executing command: {ex.Message}", "error");
            responseBuilder.SetExitCode(1);
        }

        return responseBuilder.Build();
    }
}
```

**Step 5: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds

**Step 6: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add src/Qodalis.Cli/Services/ src/Qodalis.Cli/Models/
git commit -m "feat: add command registry, executor service, and response models"
```

---

### Task 3: Update .NET AddCli() to Support Builder Pattern and Wire DI

**Files:**
- Modify: `src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs`
- Create: `src/Qodalis.Cli/Extensions/CliBuilder.cs`

**Step 1: Create CliBuilder**

`src/Qodalis.Cli/Extensions/CliBuilder.cs`:
```csharp
using System.Reflection;
using Microsoft.Extensions.DependencyInjection;
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Extensions;

public class CliBuilder
{
    private readonly IServiceCollection _services;

    internal CliBuilder(IServiceCollection services)
    {
        _services = services;
    }

    public CliBuilder AddProcessor<T>() where T : class, ICliCommandProcessor
    {
        _services.AddSingleton<ICliCommandProcessor, T>();
        return this;
    }

    public CliBuilder AddProcessor(ICliCommandProcessor processor)
    {
        _services.AddSingleton(processor);
        return this;
    }

    public CliBuilder AddProcessorsFromAssembly(Assembly assembly)
    {
        var processorTypes = assembly.GetTypes()
            .Where(t => !t.IsAbstract && !t.IsInterface && typeof(ICliCommandProcessor).IsAssignableFrom(t));

        foreach (var type in processorTypes)
        {
            _services.AddSingleton(typeof(ICliCommandProcessor), type);
        }

        return this;
    }
}
```

**Step 2: Update MvcBuilderExtensions to wire DI**

Replace the entire content of `src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs`:

```csharp
using Microsoft.AspNetCore.Mvc.ApplicationParts;
using Microsoft.Extensions.DependencyInjection;
using Qodalis.Cli.Controllers;
using Qodalis.Cli.Services;

namespace Qodalis.Cli.Extensions;

public static class MvcBuilderExtensions
{
    public static IMvcBuilder AddCli(this IMvcBuilder builder, Action<CliBuilder>? configure = null)
    {
        builder.PartManager.ApplicationParts
            .Add(new AssemblyPart(typeof(CliController).Assembly));

        var cliBuilder = new CliBuilder(builder.Services);
        configure?.Invoke(cliBuilder);

        builder.Services.AddSingleton<ICliCommandRegistry>(sp =>
        {
            var registry = new CliCommandRegistry();
            var processors = sp.GetServices<ICliCommandProcessor>();
            foreach (var processor in processors)
            {
                registry.Register(processor);
            }
            return registry;
        });

        builder.Services.AddSingleton<ICliCommandExecutorService, CliCommandExecutorService>();

        return builder;
    }
}
```

Note: This adds a `using Qodalis.Cli.Abstractions;` — since `ICliCommandProcessor` is used via `GetServices`. Check if needed or if it comes transitively.

**Step 3: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add src/Qodalis.Cli/Extensions/
git commit -m "feat: add CliBuilder pattern and wire command registry into DI"
```

---

### Task 4: Implement .NET REST Endpoints (commands + execute)

**Files:**
- Modify: `src/Qodalis.Cli/Controllers/CliController.cs`

**Step 1: Replace CliController with full implementation**

```csharp
using Microsoft.AspNetCore.Mvc;
using Qodalis.Cli.Abstractions;
using Qodalis.Cli.Models;
using Qodalis.Cli.Services;

namespace Qodalis.Cli.Controllers;

[ApiController]
[Route("api/cli")]
public class CliController : ControllerBase
{
    private readonly ICliCommandRegistry _registry;
    private readonly ICliCommandExecutorService _executor;

    public CliController(ICliCommandRegistry registry, ICliCommandExecutorService executor)
    {
        _registry = registry;
        _executor = executor;
    }

    [HttpGet("version")]
    public IActionResult GetVersion()
    {
        return Ok(new { Version = "1.0.0" });
    }

    [HttpGet("commands")]
    public IActionResult GetCommands()
    {
        var descriptors = _registry.Processors.Select(MapToDescriptor).ToList();
        return Ok(descriptors);
    }

    [HttpPost("execute")]
    public async Task<IActionResult> ExecuteAsync(
        [FromBody] CliProcessCommand command,
        CancellationToken cancellationToken)
    {
        var response = await _executor.ExecuteAsync(command, cancellationToken);
        return Ok(response);
    }

    private static CliServerCommandDescriptor MapToDescriptor(ICliCommandProcessor processor)
    {
        return new CliServerCommandDescriptor
        {
            Command = processor.Command,
            Description = processor.Description,
            Version = processor.Version,
            Parameters = processor.Parameters?.Select(p => new CliCommandParameterDescriptorDto
            {
                Name = p.Name,
                Aliases = p.Aliases,
                Description = p.Description,
                Required = p.Required,
                Type = p.Type,
                DefaultValue = p.DefaultValue,
            }).ToList(),
            Processors = processor.Processors?.Select(MapToDescriptor).ToList(),
        };
    }
}
```

**Step 2: Configure JSON serialization in Program.cs**

Update `src/Qodalis.Cli.Server/Program.cs` to use camelCase JSON:

```csharp
using Qodalis.Cli.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddCli()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.UseCli();

app.Run();
```

**Step 3: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add src/Qodalis.Cli/Controllers/CliController.cs src/Qodalis.Cli.Server/Program.cs
git commit -m "feat: implement GET /commands and POST /execute REST endpoints"
```

---

### Task 5: Add Sample .NET Command Processors

**Files:**
- Create: `src/Qodalis.Cli.Server/Processors/EchoCommandProcessor.cs`
- Create: `src/Qodalis.Cli.Server/Processors/StatusCommandProcessor.cs`
- Create: `src/Qodalis.Cli.Server/Processors/GuidCommandProcessor.cs`
- Modify: `src/Qodalis.Cli.Server/Program.cs`

**Step 1: Create sample processors**

`src/Qodalis.Cli.Server/Processors/EchoCommandProcessor.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Server.Processors;

public class EchoCommandProcessor : Qodalis.Cli.CliCommandProcessor
{
    public override string Command { get; set; } = "echo";
    public override string Description { get; set; } = "Echoes back the input text";
    public override ICliCommandAuthor Author { get; set; } = null!;
    public override bool? AllowUnlistedCommands { get; set; }
    public override bool? ValueRequired { get; set; } = true;

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(command.Value ?? "");
    }
}
```

`src/Qodalis.Cli.Server/Processors/StatusCommandProcessor.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Server.Processors;

public class StatusCommandProcessor : Qodalis.Cli.CliCommandProcessor
{
    public override string Command { get; set; } = "status";
    public override string Description { get; set; } = "Shows server status information";
    public override ICliCommandAuthor Author { get; set; } = null!;
    public override bool? AllowUnlistedCommands { get; set; }
    public override bool? ValueRequired { get; set; }

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
    {
        var status = $"Server: Running\nUptime: {Environment.TickCount64 / 1000}s\nOS: {Environment.OSVersion}\n.NET: {Environment.Version}";
        return Task.FromResult(status);
    }
}
```

`src/Qodalis.Cli.Server/Processors/GuidCommandProcessor.cs`:
```csharp
using Qodalis.Cli.Abstractions;

namespace Qodalis.Cli.Server.Processors;

public class GuidCommandProcessor : Qodalis.Cli.CliCommandProcessor
{
    public override string Command { get; set; } = "guid";
    public override string Description { get; set; } = "Generates a new GUID";
    public override ICliCommandAuthor Author { get; set; } = null!;
    public override bool? AllowUnlistedCommands { get; set; }
    public override bool? ValueRequired { get; set; }

    public override IEnumerable<ICliCommandParameterDescriptor>? Parameters { get; set; } =
    [
        new CliCommandParameterDescriptor
        {
            Name = "uppercase",
            Aliases = ["u"],
            Description = "Output the GUID in uppercase",
            Required = false,
            Type = CommandParameterType.Boolean,
        }
    ];

    public override Task<string> HandleAsync(CliProcessCommand command, CancellationToken cancellationToken = default)
    {
        var guid = Guid.NewGuid().ToString();

        if (command.Args.TryGetValue("uppercase", out var val) && val is true or "true")
        {
            guid = guid.ToUpperInvariant();
        }

        return Task.FromResult(guid);
    }
}
```

Note: We need a concrete `CliCommandParameterDescriptor` class since the interface can't be instantiated directly.

**Step 2: Create CliCommandParameterDescriptor concrete class**

`src/Qodalis.Cli.Abstractions/CliCommandParameterDescriptor.cs`:
```csharp
namespace Qodalis.Cli.Abstractions;

public class CliCommandParameterDescriptor : ICliCommandParameterDescriptor
{
    public required string Name { get; set; }
    public IEnumerable<string>? Aliases { get; set; }
    public required string Description { get; set; }
    public bool Required { get; set; }
    public CommandParameterType Type { get; set; }
    public object? DefaultValue { get; set; }
    public CliProcessorMetadata? Metadata { get; set; }
}
```

**Step 3: Register processors in Program.cs**

Update the `AddCli()` call in `src/Qodalis.Cli.Server/Program.cs`:

```csharp
using Qodalis.Cli.Extensions;
using Qodalis.Cli.Server.Processors;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddCli(cli =>
    {
        cli.AddProcessor<EchoCommandProcessor>();
        cli.AddProcessor<StatusCommandProcessor>();
        cli.AddProcessor<GuidCommandProcessor>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.UseCli();

app.Run();
```

**Step 4: Build and manually test**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds

Optionally start the server and test:
```bash
dotnet run --project src/Qodalis.Cli.Server/Qodalis.Cli.Server.csproj &
curl http://localhost:8046/api/cli/commands
curl -X POST http://localhost:8046/api/cli/execute -H "Content-Type: application/json" -d '{"command":"guid","args":{},"chainCommands":[],"rawCommand":"guid"}'
```

**Step 5: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add src/Qodalis.Cli.Abstractions/CliCommandParameterDescriptor.cs src/Qodalis.Cli.Server/Processors/ src/Qodalis.Cli.Server/Program.cs
git commit -m "feat: add sample command processors (echo, status, guid) and register via builder"
```

---

### Task 6: Implement CliServerConnection in cli package

**Files:**
- Create: `projects/cli/src/lib/server/cli-server-connection.ts`

This lives in the `angular-web-cli` repo at `/Users/nicolaelupei/Documents/Personal/angular-web-cli/`.

**Step 1: Create CliServerConnection**

`projects/cli/src/lib/server/cli-server-connection.ts`:
```typescript
import {
    CliProcessCommand,
    CliServerConfig,
    CliServerResponse,
    CliServerCommandDescriptor,
} from '@qodalis/cli-core';

export class CliServerConnection {
    private _connected = false;
    private _commands: CliServerCommandDescriptor[] = [];

    constructor(private readonly _config: CliServerConfig) {}

    get config(): CliServerConfig {
        return this._config;
    }

    get connected(): boolean {
        return this._connected;
    }

    get commands(): CliServerCommandDescriptor[] {
        return this._commands;
    }

    async connect(): Promise<void> {
        try {
            this._commands = await this.fetchCommands();
            this._connected = true;
        } catch {
            this._connected = false;
            this._commands = [];
        }
    }

    async fetchCommands(): Promise<CliServerCommandDescriptor[]> {
        const url = `${this.normalizeUrl(this._config.url)}/api/cli/commands`;
        const response = await this.fetch(url);

        if (!response.ok) {
            throw new Error(`Server ${this._config.name} returned ${response.status}`);
        }

        return response.json();
    }

    async execute(command: CliProcessCommand): Promise<CliServerResponse> {
        const url = `${this.normalizeUrl(this._config.url)}/api/cli/execute`;
        const response = await this.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(command),
        });

        if (!response.ok) {
            return {
                exitCode: 1,
                outputs: [
                    {
                        type: 'text',
                        value: `Server error: ${response.status} ${response.statusText}`,
                        style: 'error',
                    },
                ],
            };
        }

        return response.json();
    }

    async ping(): Promise<boolean> {
        try {
            const url = `${this.normalizeUrl(this._config.url)}/api/cli/version`;
            const response = await this.fetch(url);
            return response.ok;
        } catch {
            return false;
        }
    }

    private fetch(url: string, init?: RequestInit): Promise<Response> {
        const timeout = this._config.timeout ?? 30000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
            ...(this._config.headers ?? {}),
            ...(init?.headers as Record<string, string> ?? {}),
        };

        return fetch(url, {
            ...init,
            headers,
            signal: controller.signal,
        }).finally(() => clearTimeout(timer));
    }

    private normalizeUrl(url: string): string {
        return url.endsWith('/') ? url.slice(0, -1) : url;
    }
}
```

**Step 2: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core" && npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git add projects/cli/src/lib/server/
git commit -m "feat(cli): add CliServerConnection for HTTP communication with servers"
```

---

### Task 7: Implement CliServerProxyProcessor

**Files:**
- Create: `projects/cli/src/lib/server/cli-server-proxy-processor.ts`

**Step 1: Create proxy processor**

`projects/cli/src/lib/server/cli-server-proxy-processor.ts`:
```typescript
import {
    CliProcessCommand,
    CliProcessorMetadata,
    CliServerCommandDescriptor,
    CliServerResponse,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';

export class CliServerProxyProcessor implements ICliCommandProcessor {
    command: string;
    description?: string;
    version?: string;
    metadata?: CliProcessorMetadata;
    parameters?: ICliCommandParameterDescriptor[];
    processors?: ICliCommandProcessor[];

    constructor(
        private readonly connection: CliServerConnection,
        private readonly descriptor: CliServerCommandDescriptor,
        private readonly serverName: string,
    ) {
        this.command = `${serverName}:${descriptor.command}`;
        this.description = descriptor.description;
        this.version = descriptor.version;
        this.metadata = {
            module: `server:${serverName}`,
            icon: '🖥',
            requireServer: true,
        };
        this.parameters = descriptor.parameters?.map(p => ({
            name: p.name,
            aliases: p.aliases,
            description: p.description,
            required: p.required,
            type: p.type,
            defaultValue: p.defaultValue,
        }));
        this.processors = descriptor.processors?.map(
            sub => new CliServerProxyProcessor(connection, sub, serverName),
        );
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        if (!this.connection.connected) {
            context.writer.writeError(
                `Server '${this.serverName}' is not reachable. Run 'server reconnect ${this.serverName}' to retry.`,
            );
            context.process.exit(1);
            return;
        }

        // Strip server prefix from command before sending to server
        const serverCommand: CliProcessCommand = {
            ...command,
            command: this.descriptor.command,
        };

        try {
            context.spinner?.show('Executing on server...');
            const response = await this.connection.execute(serverCommand);
            context.spinner?.hide();
            this.renderResponse(response, context);
        } catch (e: any) {
            context.spinner?.hide();
            if (e.name === 'AbortError') {
                context.writer.writeError(
                    `Request to server '${this.serverName}' timed out after ${this.connection.config.timeout ?? 30000}ms.`,
                );
            } else {
                context.writer.writeError(
                    `Error communicating with server '${this.serverName}': ${e.message}`,
                );
            }
            context.process.exit(1);
        }
    }

    private renderResponse(
        response: CliServerResponse,
        context: ICliExecutionContext,
    ): void {
        for (const output of response.outputs) {
            switch (output.type) {
                case 'text': {
                    const style = output.style;
                    if (style === 'success') context.writer.writeSuccess(output.value);
                    else if (style === 'error') context.writer.writeError(output.value);
                    else if (style === 'info') context.writer.writeInfo(output.value);
                    else if (style === 'warning') context.writer.writeWarning(output.value);
                    else context.writer.writeln(output.value);
                    break;
                }
                case 'table':
                    context.writer.writeTable(output.headers, output.rows);
                    break;
                case 'list':
                    context.writer.writeList(output.items, { ordered: output.ordered });
                    break;
                case 'json':
                    context.writer.writeJson(output.value);
                    break;
                case 'key-value':
                    context.writer.writeKeyValue(
                        output.entries.map(e => ({ key: e.key, value: e.value })),
                    );
                    break;
            }
        }

        if (response.exitCode !== 0) {
            context.process.exit(response.exitCode);
        }
    }
}
```

**Step 2: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core" && npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git add projects/cli/src/lib/server/cli-server-proxy-processor.ts
git commit -m "feat(cli): add CliServerProxyProcessor for delegating commands to remote servers"
```

---

### Task 8: Implement CliServerManager and Server Module

**Files:**
- Create: `projects/cli/src/lib/server/cli-server-manager.ts`
- Create: `projects/cli/src/lib/server/cli-server-module.ts`
- Create: `projects/cli/src/lib/server/index.ts`
- Modify: `projects/cli/src/lib/index.ts` (add export)

**Step 1: Create CliServerManager**

`projects/cli/src/lib/server/cli-server-manager.ts`:
```typescript
import {
    CliServerConfig,
    ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerProxyProcessor } from './cli-server-proxy-processor';

export const CliServerManager_TOKEN = 'cli-server-manager';

export class CliServerManager {
    readonly connections = new Map<string, CliServerConnection>();

    constructor(private readonly registry: ICliCommandProcessorRegistry) {}

    async connectAll(
        servers: CliServerConfig[],
        logger?: { warn(msg: string): void; info(msg: string): void },
    ): Promise<void> {
        for (const config of servers) {
            if (config.enabled === false) continue;

            const connection = new CliServerConnection(config);
            this.connections.set(config.name, connection);

            try {
                await connection.connect();
                logger?.info(`Connected to server '${config.name}' (${connection.commands.length} commands)`);
                this.registerProxyProcessors(connection, config.name);
            } catch {
                logger?.warn(`Could not connect to server '${config.name}' at ${config.url}. Commands from this server will not be available.`);
            }
        }

        this.registerBareAliases();
    }

    async reconnect(name: string): Promise<{ success: boolean; commandCount: number }> {
        const connection = this.connections.get(name);
        if (!connection) {
            return { success: false, commandCount: 0 };
        }

        // Unregister existing proxy processors for this server
        const prefix = `${name}:`;
        const existing = this.registry.processors.filter(p => p.command.startsWith(prefix));
        for (const p of existing) {
            this.registry.unregisterProcessor(p);
        }

        // Also unregister bare aliases
        for (const p of [...this.registry.processors]) {
            if (p.metadata?.module === `server:${name}`) {
                this.registry.unregisterProcessor(p);
            }
        }

        await connection.connect();

        if (connection.connected) {
            this.registerProxyProcessors(connection, name);
            this.registerBareAliases();
            return { success: true, commandCount: connection.commands.length };
        }

        return { success: false, commandCount: 0 };
    }

    getConnection(name: string): CliServerConnection | undefined {
        return this.connections.get(name);
    }

    private registerProxyProcessors(connection: CliServerConnection, serverName: string): void {
        for (const descriptor of connection.commands) {
            const proxy = new CliServerProxyProcessor(connection, descriptor, serverName);
            this.registry.registerProcessor(proxy);
        }
    }

    /**
     * For commands that are unique across all servers, register a bare alias
     * (without the server prefix) so users can type just the command name.
     */
    private registerBareAliases(): void {
        const commandCounts = new Map<string, string[]>();

        for (const [serverName, connection] of this.connections) {
            if (!connection.connected) continue;
            for (const cmd of connection.commands) {
                const existing = commandCounts.get(cmd.command) ?? [];
                existing.push(serverName);
                commandCounts.set(cmd.command, existing);
            }
        }

        for (const [command, servers] of commandCounts) {
            if (servers.length !== 1) continue;

            const serverName = servers[0];
            const namespacedCommand = `${serverName}:${command}`;
            const existingProcessor = this.registry.findProcessor(command, []);

            // Only register bare alias if no local processor owns this command
            if (existingProcessor && !existingProcessor.metadata?.requireServer) continue;

            const namespacedProcessor = this.registry.findProcessor(namespacedCommand, []);
            if (!namespacedProcessor) continue;

            // Create a thin alias processor
            const alias: any = {
                ...namespacedProcessor,
                command,
                aliases: [namespacedCommand],
            };

            this.registry.registerProcessor(alias);
        }
    }
}
```

**Step 2: Create CliServerModule**

`projects/cli/src/lib/server/cli-server-module.ts`:
```typescript
import { ICliModule, CliProvider } from '@qodalis/cli-core';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';
import { CliServerCommandProcessor } from './cli-server-command-processor';

export function createServerModule(): ICliModule {
    return {
        name: '@qodalis/cli-server',
        description: 'Remote server command integration',
        priority: -10, // Boot early so server commands are available to other modules
        processors: [new CliServerCommandProcessor()],
        services: [] as CliProvider[],
    };
}
```

**Step 3: Create the built-in `server` command processor**

Create `projects/cli/src/lib/server/cli-server-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliExecutionContext,
    CliIcon,
} from '@qodalis/cli-core';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';

export class CliServerCommandProcessor implements ICliCommandProcessor {
    command = 'server';
    description = 'Manage remote CLI server connections';
    metadata = { icon: CliIcon.Server, module: '@qodalis/cli-server', sealed: true };
    processors: ICliCommandChildProcessor[] = [
        new ServerListProcessor(),
        new ServerStatusProcessor(),
        new ServerReconnectProcessor(),
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        context.writer.writeln('Usage: server <list|status|reconnect>');
        context.writer.writeln('Run "help server" for details.');
    }
}

class ServerListProcessor implements ICliCommandChildProcessor {
    command = 'list';
    description = 'Show configured servers and their connection status';

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.get<CliServerManager>(CliServerManager_TOKEN);

        if (!manager || manager.connections.size === 0) {
            context.writer.writeInfo('No servers configured.');
            return;
        }

        const headers = ['Name', 'URL', 'Status', 'Commands'];
        const rows: string[][] = [];

        for (const [name, connection] of manager.connections) {
            rows.push([
                name,
                connection.config.url,
                connection.connected ? 'Connected' : 'Disconnected',
                connection.connected ? String(connection.commands.length) : '-',
            ]);
        }

        context.writer.writeTable(headers, rows);
    }
}

class ServerStatusProcessor implements ICliCommandChildProcessor {
    command = 'status';
    description = 'Ping a server and show its version';
    valueRequired = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const serverName = command.value;
        if (!serverName) {
            context.writer.writeError('Usage: server status <server-name>');
            context.process.exit(1);
            return;
        }

        const manager = context.services.get<CliServerManager>(CliServerManager_TOKEN);
        const connection = manager?.getConnection(serverName);

        if (!connection) {
            context.writer.writeError(`Unknown server: ${serverName}`);
            context.process.exit(1);
            return;
        }

        context.spinner?.show(`Pinging ${serverName}...`);
        const reachable = await connection.ping();
        context.spinner?.hide();

        if (reachable) {
            context.writer.writeSuccess(`Server '${serverName}' is reachable`);
            context.writer.writeKeyValue([
                { key: 'URL', value: connection.config.url },
                { key: 'Connected', value: String(connection.connected) },
                { key: 'Commands', value: String(connection.commands.length) },
            ]);
        } else {
            context.writer.writeError(`Server '${serverName}' is not reachable at ${connection.config.url}`);
        }
    }
}

class ServerReconnectProcessor implements ICliCommandChildProcessor {
    command = 'reconnect';
    description = 'Re-fetch commands from a server';
    valueRequired = true;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const serverName = command.value;
        if (!serverName) {
            context.writer.writeError('Usage: server reconnect <server-name>');
            context.process.exit(1);
            return;
        }

        const manager = context.services.get<CliServerManager>(CliServerManager_TOKEN);

        if (!manager) {
            context.writer.writeError('Server manager not available.');
            context.process.exit(1);
            return;
        }

        context.spinner?.show(`Reconnecting to ${serverName}...`);
        const result = await manager.reconnect(serverName);
        context.spinner?.hide();

        if (result.success) {
            context.writer.writeSuccess(
                `Reconnected to '${serverName}'. ${result.commandCount} commands available.`,
            );
        } else {
            context.writer.writeError(`Could not reconnect to '${serverName}'.`);
            context.process.exit(1);
        }
    }
}
```

**Step 4: Create barrel export**

`projects/cli/src/lib/server/index.ts`:
```typescript
export * from './cli-server-connection';
export * from './cli-server-proxy-processor';
export * from './cli-server-manager';
export * from './cli-server-module';
export * from './cli-server-command-processor';
```

**Step 5: Add export to cli package index**

Add to `projects/cli/src/lib/index.ts` (after the last export):
```typescript
export * from './server';
```

**Step 6: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core" && npm run "build cli"`
Expected: Build succeeds

**Step 7: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git add projects/cli/src/lib/server/ projects/cli/src/lib/index.ts
git commit -m "feat(cli): add CliServerManager, server module, and built-in server commands"
```

---

### Task 9: Integrate Server Module into CliEngine Boot

**Files:**
- Modify: `projects/cli/src/lib/engine/cli-engine.ts`

**Step 1: Update CliEngine.start() to boot servers**

In `projects/cli/src/lib/engine/cli-engine.ts`, add import at top:

```typescript
import { CliServerManager, CliServerManager_TOKEN } from '../server/cli-server-manager';
import { createServerModule } from '../server/cli-server-module';
```

Then in the `start()` method, after step 6 (line 156 `this.executionContext.initializeTerminalListeners();`) and before step 7 (line 158 `const allModules = ...`), add server connection logic:

```typescript
        // 6.5. Connect to configured servers (if any)
        const serverManager = new CliServerManager(this.registry);
        services.set([{ provide: CliServerManager_TOKEN, useValue: serverManager }]);

        if (this.options?.servers && this.options.servers.length > 0) {
            await serverManager.connectAll(this.options.servers, {
                warn: (msg) => console.warn(msg),
                info: (msg) => console.log(msg),
            });
        }
```

Update the allModules line to include the server module:

Change:
```typescript
        const allModules = [welcomeModule, ...this.userModules];
```

To:
```typescript
        const serverModule = createServerModule();
        const allModules = [welcomeModule, serverModule, ...this.userModules];
```

**Step 2: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core" && npm run "build cli"`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git add projects/cli/src/lib/engine/cli-engine.ts
git commit -m "feat(cli): integrate server module into CliEngine boot sequence"
```

---

### Task 10: Update Demo App to Connect to .NET Server

**Files:**
- Modify: `projects/demo-angular/src/app/app.component.ts`
- Modify: `proxy.conf.json` (add proxy for .NET server)

**Step 1: Add proxy for .NET server**

In `proxy.conf.json`, add entry for the .NET server (which runs on port 8046):

```json
{
  "/api/cli/*": {
    "target": "http://localhost:8046",
    "changeOrigin": true,
    "secure": false,
    "logLevel": "debug"
  }
}
```

(Keep existing entries.)

**Step 2: Update demo app options**

In `projects/demo-angular/src/app/app.component.ts`, update the `options` property to include a server:

```typescript
    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
        packageSources: {
            primary: 'local',
            sources: [
                { name: 'local', url: 'http://localhost:3000/', kind: 'file' },
            ],
        },
        servers: [
            { name: 'local', url: '' },  // Empty URL = same origin (proxied)
        ],
    };
```

**Step 3: Build all and test**

Run:
```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build all"
```
Expected: Build succeeds

**Step 4: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
git add proxy.conf.json projects/demo-angular/src/app/app.component.ts
git commit -m "feat(demo): configure demo app to connect to local .NET server"
```

---

### Task 11: Add CORS Support to .NET Server

**Files:**
- Modify: `src/Qodalis.Cli.Server/Program.cs`

For development, the Angular dev server and .NET server run on different ports. Add CORS support.

**Step 1: Update Program.cs**

```csharp
using Qodalis.Cli.Extensions;
using Qodalis.Cli.Server.Processors;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services
    .AddControllers()
    .AddCli(cli =>
    {
        cli.AddProcessor<EchoCommandProcessor>();
        cli.AddProcessor<StatusCommandProcessor>();
        cli.AddProcessor<GuidCommandProcessor>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseWebSockets();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();
app.UseCli();

app.Run();
```

**Step 2: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
git add src/Qodalis.Cli.Server/Program.cs
git commit -m "feat: add CORS support for development"
```

---

### Task 12: End-to-End Integration Test

**No files to create — manual verification.**

**Step 1: Start the .NET server**

```bash
cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet
dotnet run --project src/Qodalis.Cli.Server/Qodalis.Cli.Server.csproj
```

**Step 2: Test REST endpoints**

```bash
# Test version
curl http://localhost:8046/api/cli/version

# Test commands discovery
curl http://localhost:8046/api/cli/commands | jq .

# Test execution
curl -X POST http://localhost:8046/api/cli/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"guid","args":{},"chainCommands":[],"rawCommand":"guid","value":""}' | jq .

curl -X POST http://localhost:8046/api/cli/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"status","args":{},"chainCommands":[],"rawCommand":"status","value":""}' | jq .

curl -X POST http://localhost:8046/api/cli/execute \
  -H "Content-Type: application/json" \
  -d '{"command":"echo","args":{},"chainCommands":[],"rawCommand":"echo hello","value":"hello"}' | jq .
```

Expected: All return valid JSON responses.

**Step 3: Start Angular demo (in another terminal)**

```bash
cd /Users/nicolaelupei/Documents/Personal/angular-web-cli
npm run "start demo"
```

**Step 4: Test in browser**

Open `http://localhost:4300` and type:
- `server list` — should show the local server as connected
- `local:guid` — should return a GUID from the server
- `local:status` — should show server status
- `guid` — if no local guid conflict, should work as bare alias
- `help` — server commands should appear grouped under "Server: local"

---

### Summary of Changes

**cli-server-dotnet (8 new files, 3 modified):**
- Models: `CliServerOutput.cs`, `CliServerResponse.cs`, `CliServerCommandDescriptor.cs`
- Services: `ICliCommandRegistry.cs`, `CliCommandRegistry.cs`, `ICliResponseBuilder.cs`, `CliResponseBuilder.cs`, `ICliCommandExecutorService.cs`, `CliCommandExecutorService.cs`
- Extensions: `CliBuilder.cs`, modified `MvcBuilderExtensions.cs`
- Controller: modified `CliController.cs`
- Abstractions: `CliCommandParameterDescriptor.cs`
- Demo: 3 sample processors, modified `Program.cs`

**angular-web-cli (7 new files, 3 modified):**
- Core models: added types to `index.ts`
- Server package: `cli-server-connection.ts`, `cli-server-proxy-processor.ts`, `cli-server-manager.ts`, `cli-server-module.ts`, `cli-server-command-processor.ts`, `index.ts`
- Engine: modified `cli-engine.ts`
- Demo: modified `app.component.ts`, `proxy.conf.json`
