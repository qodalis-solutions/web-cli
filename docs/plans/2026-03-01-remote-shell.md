# Remote Shell (`ssh`) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SSH-like remote shell execution so users can type `ssh <server>` for an interactive PTY session or `ssh <server> <cmd>` for one-shot execution, across any server backend.

**Architecture:** A structured JSON WebSocket protocol over `/ws/cli/shell` connects the xterm.js full-screen mode on the client to a PTY process on the server. Capability discovery via `GET /api/cli/capabilities` tells the client which servers support shell access. The .NET server uses `Pty.Net` for cross-platform PTY allocation.

**Tech Stack:** TypeScript (xterm.js, WebSocket API), .NET 8 (ASP.NET Core WebSockets, Pty.Net NuGet)

**Design doc:** `docs/plans/2026-03-01-remote-shell-design.md`

---

## Task 1: Add `CliServerCapabilities` Type (core)

**Files:**
- Modify: `packages/core/src/lib/models/index.ts:320` (after `CliServerCommandDescriptor`)

**Step 1: Add the type**

After the `CliServerCommandDescriptor` type (line 320), add:

```typescript
/**
 * Server capabilities returned by GET /api/cli/capabilities
 */
export type CliServerCapabilities = {
    /** Whether this server supports remote shell access */
    shell: boolean;
    /** Server operating system (e.g. "linux", "win32", "darwin") */
    os?: string;
    /** Path to the shell binary on the server */
    shellPath?: string;
    /** Server version string */
    version?: string;
};
```

**Step 2: Build core**

Run: `cd web-cli && pnpm run build:core`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(core): add CliServerCapabilities type
```

---

## Task 2: Fetch Capabilities in `CliServerConnection`

**Files:**
- Modify: `packages/cli/src/lib/server/cli-server-connection.ts`

**Step 1: Add capabilities storage**

Add after line 10 (`private _commands`):

```typescript
private _capabilities: CliServerCapabilities | null = null;
```

Add a public getter after the `commands` getter (after line 27):

```typescript
get capabilities(): CliServerCapabilities | null {
    return this._capabilities;
}
```

Add the import for `CliServerCapabilities` to the existing import from `@qodalis/cli-core` (line 4).

**Step 2: Add `fetchCapabilities()` method**

Add after the `fetchCommands()` method (after line 57):

```typescript
async fetchCapabilities(): Promise<CliServerCapabilities | null> {
    try {
        const url = `${this.normalizeUrl(this._config.url)}/api/cli/capabilities`;
        const response = await this.httpFetch(url);
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}
```

**Step 3: Call it during `connect()`**

In the `connect()` method (line 29), after `this._connected = true;` add:

```typescript
this._capabilities = await this.fetchCapabilities();
```

Also reset in the failure path and in `disconnect()`:

In `connect()` catch block, add: `this._capabilities = null;`
In `disconnect()` (line 40), add: `this._capabilities = null;`

**Step 4: Build cli**

Run: `cd web-cli && pnpm run build:core && pnpm run build:cli`
Expected: BUILD SUCCESS

**Step 5: Commit**

```
feat(cli): fetch server capabilities during connection
```

---

## Task 3: Create `CliSshCommandProcessor` (Client)

**Files:**
- Create: `packages/cli/src/lib/server/cli-ssh-command-processor.ts`

**Step 1: Create the file**

```typescript
import {
    CliProcessCommand,
    CliProcessorMetadata,
    ICliCommandParameterDescriptor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliServerConnection } from './cli-server-connection';
import { CliServerManager, CliServerManager_TOKEN } from './cli-server-manager';

type ShellMessage =
    | { type: 'stdin'; data: string }
    | { type: 'resize'; cols: number; rows: number };

type ServerShellMessage =
    | { type: 'stdout'; data: string }
    | { type: 'stderr'; data: string }
    | { type: 'exit'; code: number }
    | { type: 'error'; message: string }
    | { type: 'ready'; shell: string; os: string };

export class CliSshCommandProcessor implements ICliCommandProcessor {
    command = 'ssh';
    description = 'Open a remote shell session on a server';
    metadata: CliProcessorMetadata = {
        module: '@qodalis/cli-server',
        icon: '\u{1F5A5}',
    };
    parameters?: ICliCommandParameterDescriptor[] = [
        {
            name: 'server',
            description: 'Name of the server to connect to',
            required: false,
            type: 'string',
        },
    ];

    private socket: WebSocket | null = null;
    private context: ICliExecutionContext | null = null;

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const manager = context.services.get<CliServerManager>(
            CliServerManager_TOKEN,
        );
        if (!manager) {
            context.writer.writeError('Server manager not available.');
            context.process.exit(1);
            return;
        }

        // Find shell-capable servers
        const shellServers: Array<{
            name: string;
            connection: CliServerConnection;
        }> = [];
        for (const [name, connection] of manager.connections) {
            if (connection.connected && connection.capabilities?.shell) {
                shellServers.push({ name, connection });
            }
        }

        if (shellServers.length === 0) {
            context.writer.writeError(
                'No servers with shell access are available.',
            );
            context.process.exit(1);
            return;
        }

        // Determine which server to connect to
        let serverName = command.value;
        let connection: CliServerConnection | undefined;

        if (serverName) {
            const entry = shellServers.find((s) => s.name === serverName);
            if (!entry) {
                context.writer.writeError(
                    `Server '${serverName}' not found or does not support shell access.`,
                );
                context.process.exit(1);
                return;
            }
            connection = entry.connection;
        } else if (shellServers.length === 1) {
            serverName = shellServers[0].name;
            connection = shellServers[0].connection;
        } else {
            const selected = await context.reader.readSelectInline(
                'Select a server for shell access:',
                shellServers.map((s) => ({
                    label: s.name,
                    value: s.name,
                })),
            );
            if (!selected) {
                context.writer.writeInfo('Shell cancelled.');
                return;
            }
            serverName = selected;
            connection = shellServers.find(
                (s) => s.name === selected,
            )!.connection;
        }

        // Check for one-shot mode: ssh <server> <command>
        const rawCmd = command.rawCommand ?? '';
        const oneShotCmd = this.extractOneShotCommand(rawCmd, serverName!);

        if (oneShotCmd) {
            await this.executeOneShot(
                connection!,
                serverName!,
                oneShotCmd,
                context,
            );
        } else {
            await this.executeInteractive(
                connection!,
                serverName!,
                context,
            );
        }
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.socket?.readyState === WebSocket.OPEN) {
            const msg: ShellMessage = { type: 'stdin', data };
            this.socket.send(JSON.stringify(msg));
        }
    }

    onResize(
        cols: number,
        rows: number,
        _context: ICliExecutionContext,
    ): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            const msg: ShellMessage = { type: 'resize', cols, rows };
            this.socket.send(JSON.stringify(msg));
        }
    }

    onDispose(_context: ICliExecutionContext): void {
        if (this.socket) {
            if (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            ) {
                this.socket.close();
            }
            this.socket = null;
        }
        this.context = null;
    }

    private extractOneShotCommand(
        rawCommand: string,
        serverName: string,
    ): string | null {
        // rawCommand is the full input, e.g. "ssh dotnet ls -la"
        // Strip "ssh" prefix and optional server name
        let rest = rawCommand.replace(/^ssh\s+/, '');
        if (rest.startsWith(serverName)) {
            rest = rest.slice(serverName.length).trim();
        }
        return rest.length > 0 ? rest : null;
    }

    private async executeInteractive(
        connection: CliServerConnection,
        serverName: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        this.context = context;

        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const wsUrl = this.buildShellUrl(connection, cols, rows);

        context.spinner?.show(`Connecting to ${serverName}...`);

        return new Promise<void>((resolve, reject) => {
            try {
                this.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1);
                resolve();
                return;
            }

            this.socket.onopen = () => {
                // Wait for 'ready' message before entering full-screen
            };

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data) as ServerShellMessage;

                switch (msg.type) {
                    case 'ready':
                        context.spinner?.hide();
                        context.writer.writeInfo(
                            `Connected to ${serverName} (${msg.os}, ${msg.shell})`,
                        );
                        context.enterFullScreenMode(this);
                        break;

                    case 'stdout':
                        context.terminal.write(msg.data);
                        break;

                    case 'stderr':
                        context.terminal.write(msg.data);
                        break;

                    case 'exit':
                        context.exitFullScreenMode();
                        context.writer.writeInfo(
                            `Shell exited with code ${msg.code}.`,
                        );
                        if (msg.code !== 0) {
                            context.process.exit(msg.code);
                        }
                        this.cleanup();
                        resolve();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.exitFullScreenMode();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1);
                        this.cleanup();
                        resolve();
                        break;
                }
            };

            this.socket.onclose = () => {
                context.spinner?.hide();
                if (this.context) {
                    context.exitFullScreenMode();
                    context.writer.writeWarning(
                        `Connection to '${serverName}' closed.`,
                    );
                }
                this.cleanup();
                resolve();
            };

            this.socket.onerror = () => {
                context.spinner?.hide();
                context.writer.writeError(
                    `WebSocket error connecting to '${serverName}'.`,
                );
                context.process.exit(1);
                this.cleanup();
                resolve();
            };
        });
    }

    private async executeOneShot(
        connection: CliServerConnection,
        serverName: string,
        cmd: string,
        context: ICliExecutionContext,
    ): Promise<void> {
        const cols = context.terminal.cols;
        const rows = context.terminal.rows;
        const wsUrl = this.buildShellUrl(
            connection,
            cols,
            rows,
            cmd,
        );

        context.spinner?.show(`Running on ${serverName}...`);

        return new Promise<void>((resolve) => {
            try {
                this.socket = new WebSocket(wsUrl);
            } catch (e: any) {
                context.spinner?.hide();
                context.writer.writeError(
                    `Failed to connect to '${serverName}': ${e.message}`,
                );
                context.process.exit(1);
                resolve();
                return;
            }

            this.socket.onmessage = (event) => {
                const msg = JSON.parse(event.data) as ServerShellMessage;

                switch (msg.type) {
                    case 'ready':
                        context.spinner?.hide();
                        break;

                    case 'stdout':
                        context.writer.writeln(msg.data);
                        break;

                    case 'stderr':
                        context.writer.writeError(msg.data);
                        break;

                    case 'exit':
                        if (msg.code !== 0) {
                            context.process.exit(msg.code);
                        }
                        this.cleanup();
                        resolve();
                        break;

                    case 'error':
                        context.spinner?.hide();
                        context.writer.writeError(
                            `Server error: ${msg.message}`,
                        );
                        context.process.exit(1);
                        this.cleanup();
                        resolve();
                        break;
                }
            };

            this.socket.onclose = () => {
                context.spinner?.hide();
                this.cleanup();
                resolve();
            };

            this.socket.onerror = () => {
                context.spinner?.hide();
                context.writer.writeError(
                    `WebSocket error connecting to '${serverName}'.`,
                );
                context.process.exit(1);
                this.cleanup();
                resolve();
            };
        });
    }

    private buildShellUrl(
        connection: CliServerConnection,
        cols: number,
        rows: number,
        cmd?: string,
    ): string {
        const baseUrl = connection.config.url.endsWith('/')
            ? connection.config.url.slice(0, -1)
            : connection.config.url;
        const wsBase = baseUrl
            .replace(/^https:/, 'wss:')
            .replace(/^http:/, 'ws:');

        let url = `${wsBase}/ws/cli/shell?cols=${cols}&rows=${rows}`;
        if (cmd) {
            url += `&cmd=${encodeURIComponent(cmd)}`;
        }
        return url;
    }

    private cleanup(): void {
        if (this.socket) {
            this.socket.onmessage = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            if (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            ) {
                this.socket.close();
            }
            this.socket = null;
        }
        this.context = null;
    }
}
```

**Step 2: Export from index.ts**

In `packages/cli/src/lib/server/index.ts`, add:

```typescript
export * from './cli-ssh-command-processor';
```

**Step 3: Register in server module**

In `packages/cli/src/lib/server/cli-server-module.ts`, import and add:

```typescript
import { CliSshCommandProcessor } from './cli-ssh-command-processor';
```

Add to the `processors` array:

```typescript
processors: [new CliServerCommandProcessor(), new CliSshCommandProcessor()],
```

**Step 4: Build**

Run: `cd web-cli && pnpm run build:core && pnpm run build:cli`
Expected: BUILD SUCCESS

**Step 5: Commit**

```
feat(cli): add ssh command processor for remote shell sessions
```

---

## Task 4: Add `/api/cli/capabilities` Endpoint (.NET)

**Files:**
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Controllers/CliVersionController.cs`

**Step 1: Add the capabilities endpoint**

The `CliVersionController` already has the unversioned `/api/cli` route. Add after the `GetVersions` method:

```csharp
[HttpGet("capabilities")]
public IActionResult GetCapabilities()
{
    var os = Environment.OSVersion.Platform switch
    {
        PlatformID.Win32NT => "win32",
        PlatformID.Unix => OperatingSystem.IsMacOS() ? "darwin" : "linux",
        _ => "unknown",
    };

    var shell = Environment.OSVersion.Platform == PlatformID.Win32NT
        ? "powershell"
        : "bash";

    var shellPath = Environment.OSVersion.Platform == PlatformID.Win32NT
        ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        : "/bin/bash";

    return Ok(new
    {
        Shell = true,
        Os = os,
        ShellPath = shellPath,
        Version = "1.0.0",
    });
}
```

**Step 2: Build**

Run: `cd cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: BUILD SUCCESS

**Step 3: Commit**

```
feat(server): add /api/cli/capabilities endpoint
```

---

## Task 5: Add `/ws/cli/shell` WebSocket Endpoint (.NET)

**Files:**
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Qodalis.Cli.csproj` (add Pty.Net)
- Create: `cli-server-dotnet/src/Qodalis.Cli/Services/ShellSessionManager.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Extensions/WebApplicationExtensions.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs` (register service)

**Step 1: Add Pty.Net NuGet package**

In `Qodalis.Cli.csproj`, add to the `<ItemGroup>` at line 36:

```xml
<PackageReference Include="Pty.Net" Version="0.5.133" />
```

**Step 2: Create `ShellSessionManager.cs`**

Create `cli-server-dotnet/src/Qodalis.Cli/Services/ShellSessionManager.cs`:

```csharp
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using Pty.Net;

namespace Qodalis.Cli.Services;

public class ShellSessionManager
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public async Task HandleShellSessionAsync(
        WebSocket webSocket,
        int cols,
        int rows,
        string? command,
        CancellationToken cancellationToken)
    {
        var (shell, shellArgs) = GetShellInfo(command);
        IPtyConnection? pty = null;

        try
        {
            var options = new PtyOptions
            {
                Name = "qodalis-shell",
                Cols = cols,
                Rows = rows,
                Cwd = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                App = shell,
                CommandLine = shellArgs,
                Environment = GetEnvironment(),
            };

            pty = await PtyProvider.SpawnAsync(options, cancellationToken);

            // Send ready message
            var os = Environment.OSVersion.Platform switch
            {
                PlatformID.Win32NT => "win32",
                PlatformID.Unix => OperatingSystem.IsMacOS() ? "darwin" : "linux",
                _ => "unknown",
            };

            await SendJsonAsync(webSocket, new
            {
                type = "ready",
                shell = Path.GetFileName(shell),
                os,
            }, cancellationToken);

            // Start reading PTY output
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var outputTask = ReadPtyOutputAsync(pty, webSocket, cts.Token);
            var inputTask = ReadWebSocketInputAsync(webSocket, pty, cts.Token);
            var exitTask = WaitForExitAsync(pty, webSocket, cts);

            await Task.WhenAny(outputTask, inputTask, exitTask);
            cts.Cancel();

            // Wait briefly for remaining tasks to finish
            try
            {
                await Task.WhenAll(outputTask, inputTask, exitTask)
                    .WaitAsync(TimeSpan.FromSeconds(2));
            }
            catch (OperationCanceledException) { }
            catch (Exception) { }
        }
        catch (Exception ex)
        {
            await SendJsonAsync(webSocket, new
            {
                type = "error",
                message = ex.Message,
            }, cancellationToken);
        }
        finally
        {
            pty?.Kill();
            pty?.Dispose();

            if (webSocket.State == WebSocketState.Open)
            {
                try
                {
                    await webSocket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "Shell session ended",
                        CancellationToken.None);
                }
                catch { }
            }
        }
    }

    private async Task ReadPtyOutputAsync(
        IPtyConnection pty,
        WebSocket webSocket,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[4096];
        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                   webSocket.State == WebSocketState.Open)
            {
                var bytesRead = await pty.ReaderStream.ReadAsync(
                    buffer, cancellationToken);
                if (bytesRead == 0) break;

                var data = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                await SendJsonAsync(webSocket, new
                {
                    type = "stdout",
                    data,
                }, cancellationToken);
            }
        }
        catch (OperationCanceledException) { }
        catch (IOException) { }
    }

    private async Task ReadWebSocketInputAsync(
        WebSocket webSocket,
        IPtyConnection pty,
        CancellationToken cancellationToken)
    {
        var buffer = new byte[4096];
        try
        {
            while (!cancellationToken.IsCancellationRequested &&
                   webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                using var doc = JsonDocument.Parse(json);
                var msgType = doc.RootElement.GetProperty("type").GetString();

                switch (msgType)
                {
                    case "stdin":
                        var data = doc.RootElement.GetProperty("data").GetString();
                        if (data != null)
                        {
                            var bytes = Encoding.UTF8.GetBytes(data);
                            await pty.WriterStream.WriteAsync(bytes, cancellationToken);
                            await pty.WriterStream.FlushAsync(cancellationToken);
                        }
                        break;

                    case "resize":
                        var newCols = doc.RootElement.GetProperty("cols").GetInt32();
                        var newRows = doc.RootElement.GetProperty("rows").GetInt32();
                        pty.Resize(newCols, newRows);
                        break;
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (WebSocketException) { }
    }

    private async Task WaitForExitAsync(
        IPtyConnection pty,
        WebSocket webSocket,
        CancellationTokenSource cts)
    {
        try
        {
            await pty.WaitForExit(cts.Token);

            if (webSocket.State == WebSocketState.Open)
            {
                await SendJsonAsync(webSocket, new
                {
                    type = "exit",
                    code = pty.ExitCode,
                }, CancellationToken.None);
            }
        }
        catch (OperationCanceledException) { }

        cts.Cancel();
    }

    private static async Task SendJsonAsync(
        WebSocket webSocket,
        object message,
        CancellationToken cancellationToken)
    {
        if (webSocket.State != WebSocketState.Open) return;

        var json = JsonSerializer.Serialize(message, JsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        await webSocket.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            cancellationToken);
    }

    private static (string shell, string[] args) GetShellInfo(string? command)
    {
        if (Environment.OSVersion.Platform == PlatformID.Win32NT)
        {
            var shell = "powershell.exe";
            return command != null
                ? (shell, new[] { "-Command", command })
                : (shell, Array.Empty<string>());
        }
        else
        {
            var shell = "/bin/bash";
            return command != null
                ? (shell, new[] { "-c", command })
                : (shell, Array.Empty<string>());
        }
    }

    private static Dictionary<string, string> GetEnvironment()
    {
        var env = new Dictionary<string, string>();
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            if (entry.Key is string key && entry.Value is string value)
            {
                env[key] = value;
            }
        }

        env["TERM"] = "xterm-256color";
        return env;
    }
}
```

**Step 3: Register `ShellSessionManager` in DI**

In `cli-server-dotnet/src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs`, add after `builder.Services.AddSingleton<CliEventSocketManager>();`:

```csharp
builder.Services.AddSingleton<ShellSessionManager>();
```

**Step 4: Add `/ws/cli/shell` route in `WebApplicationExtensions.cs`**

In `WebApplicationExtensions.cs`, add a new path check **before** the existing `/ws/cli` block (before line 32). Insert after the `/ws/cli/events` block (after line 30):

```csharp
var shellPath = context.Request.Path.Value;
if (shellPath == "/ws/cli/shell" || shellPath == "/ws/v1/cli/shell" || shellPath == "/ws/v2/cli/shell")
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var shellManager = context.RequestServices.GetRequiredService<ShellSessionManager>();
        var webSocket = await context.WebSockets.AcceptWebSocketAsync();

        var query = context.Request.Query;
        int.TryParse(query["cols"], out var cols);
        int.TryParse(query["rows"], out var rows);
        if (cols <= 0) cols = 80;
        if (rows <= 0) rows = 24;
        var cmd = query["cmd"].FirstOrDefault();

        await shellManager.HandleShellSessionAsync(
            webSocket, cols, rows, cmd, context.RequestAborted);
    }
    else
    {
        context.Response.StatusCode = 400;
    }

    return;
}
```

**Step 5: Build**

Run: `cd cli-server-dotnet && dotnet restore src/Qodalis.Cli.sln && dotnet build src/Qodalis.Cli.sln`
Expected: BUILD SUCCESS

**Step 6: Commit**

```
feat(server): add /ws/cli/shell WebSocket endpoint with PTY support
```

---

## Task 6: End-to-End Verification

**Step 1: Build everything (client)**

Run: `cd web-cli && pnpm run build:core && pnpm run build:cli`
Expected: BUILD SUCCESS

**Step 2: Build server**

Run: `cd cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: BUILD SUCCESS

**Step 3: Manual test plan**

1. Start the .NET server: `dotnet run --project cli-server-dotnet/src/Qodalis.Cli.Server`
2. Serve the Angular demo: `cd web-cli && pnpm run serve:angular-demo`
3. Verify `server list` shows the server as connected
4. Run `ssh` — should auto-select the only shell-capable server, open interactive shell
5. Type `ls`, `whoami`, `echo hello` — output renders in terminal
6. Type `exit` — returns to local CLI prompt
7. Run `ssh dotnet ls -la` — one-shot mode, output inline
8. Resize browser window during interactive session — verify terminal adapts

**Step 4: Commit any fixes**

```
fix: address issues found during e2e testing
```
