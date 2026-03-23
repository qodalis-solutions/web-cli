# Server Integration Resilience & Version Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make server connections resilient (auto-reconnect WebSocket, retry transient HTTP failures, periodic health checks for disconnected servers) and integrate the existing `ServerVersionNegotiator` so client and server properly negotiate API version v1.

**Architecture:** The `CliServerConnection` class is the single point of change for resilience and version negotiation. It gains: (1) exponential-backoff WebSocket reconnection, (2) a single HTTP retry on transient fetch errors, (3) a periodic health-check timer that auto-reconnects disconnected servers, and (4) version negotiation via the existing `ServerVersionNegotiator` to determine the API base path. All three backend servers are standardized to report `supportedVersions: [1]` and the client `API_VERSION` is set to `1`.

**Tech Stack:** TypeScript (web-cli frontend), Node.js/Express (cli-server-node), .NET 8 (cli-server-dotnet), Python/FastAPI (cli-server-python)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `web-cli/packages/core/src/lib/version.ts` | Modify | Change `API_VERSION` from `2` to `1` |
| `web-cli/packages/cli/src/lib/server/cli-server-module.ts` | Modify | Change module `apiVersion` from `2` to `1` |
| `web-cli/packages/cli/src/lib/server/cli-server-connection.ts` | Modify | Add version negotiation, WebSocket reconnect, HTTP retry, health check timer |
| `web-cli/packages/cli/src/lib/server/cli-server-manager.ts` | Modify | Wire health check start/stop, expose `apiVersion` from connections |
| `web-cli/packages/cli/src/lib/server/cli-server-command-processor.ts` | Modify | Show API version in `server list` and `server status` output |
| `cli-server-node/src/controllers/cli-version-controller.ts` | Modify | Change endpoint from `/version` to `/versions`, set `supportedVersions: [1]` |
| `cli-server-node/src/create-cli-server.ts` | No change | v2 routes kept for backward compat (harmless) |
| `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py` | Modify | Set `supportedVersions: [1]`, `preferredVersion: 1` |

---

### Task 1: Standardize API_VERSION to 1 in web-cli

**Files:**
- Modify: `web-cli/packages/core/src/lib/version.ts:4`
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-module.ts:7`

- [ ] **Step 1: Update API_VERSION**

In `web-cli/packages/core/src/lib/version.ts`, change line 4:

```typescript
export const API_VERSION = 1;
```

- [ ] **Step 2: Update server module apiVersion**

In `web-cli/packages/cli/src/lib/server/cli-server-module.ts`, change line 7:

```typescript
        apiVersion: 1,
```

- [ ] **Step 3: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build core && npx nx build cli
```
Expected: Both build successfully.

- [ ] **Step 4: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/core/src/lib/version.ts packages/cli/src/lib/server/cli-server-module.ts
git commit -m "fix: standardize API_VERSION to 1 across client"
```

---

### Task 2: Standardize server version endpoints (all 3 servers)

**Files:**
- Modify: `cli-server-node/src/controllers/cli-version-controller.ts`
- Modify: `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`

The .NET server is already correct (`supportedVersions: [1]`, endpoint `/versions`).

- [ ] **Step 1: Fix Node.js server — rename endpoint and set v1 only**

In `cli-server-node/src/controllers/cli-version-controller.ts`, change the route from `/version` to `/versions` and set `supportedVersions: [1]`:

```typescript
    router.get('/versions', (_req, res) => {
        res.json({
            supportedVersions: [1],
            preferredVersion: 1,
            serverVersion: SERVER_VERSION,
        });
    });
```

Also add a `/version` redirect for backward compatibility:

```typescript
    router.get('/version', (_req, res) => {
        res.redirect(301, 'versions');
    });
```

- [ ] **Step 2: Fix Python server — set v1 only**

In `cli-server-python/src/qodalis_cli/controllers/cli_version_controller.py`, change the `get_versions` function:

```python
    @router.get("/versions")
    async def get_versions() -> dict[str, Any]:
        return {
            "supportedVersions": [1],
            "preferredVersion": 1,
            "serverVersion": SERVER_VERSION,
        }
```

- [ ] **Step 3: Verify Node.js server builds**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit both servers**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add src/controllers/cli-version-controller.ts
git commit -m "fix: standardize version endpoint to /versions with v1 only"

cd /home/nicolae/work/cli-workspace/cli-server-python
git add src/qodalis_cli/controllers/cli_version_controller.py
git commit -m "fix: standardize version endpoint to v1 only"
```

---

### Task 3: Integrate ServerVersionNegotiator into CliServerConnection

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`

This is the core change. The connection will:
1. Call `ServerVersionNegotiator.discover()` during `connect()`
2. Store the negotiated `apiVersion` and `basePath`
3. Use the negotiated `basePath` for all HTTP requests (commands, execute, capabilities)
4. Fall back to `/api/v1/qcli` if version discovery fails (backward compat)

- [ ] **Step 1: Add version negotiation fields and import**

At the top of `cli-server-connection.ts`, add `ServerVersionNegotiator` to imports:

```typescript
import {
    CliProcessCommand,
    CliServerCapabilities,
    CliServerConfig,
    CliServerResponse,
    CliServerCommandDescriptor,
    ICliBackgroundServiceRegistry,
    ICliLogger,
    ServerVersionNegotiator,
} from '@qodalis/cli-core';
```

Add private fields after existing ones:

```typescript
    private _apiVersion: number = 1;
    private _basePath: string = '';
```

Add public getter:

```typescript
    get apiVersion(): number {
        return this._apiVersion;
    }
```

- [ ] **Step 2: Update connect() to negotiate version first**

Replace the `connect()` method:

```typescript
    async connect(): Promise<void> {
        try {
            const baseUrl = this.normalizeUrl(this._config.url);

            // Negotiate API version
            const negotiated = await ServerVersionNegotiator.discover(baseUrl);
            if (negotiated) {
                this._apiVersion = negotiated.apiVersion;
                this._basePath = negotiated.basePath;
            } else {
                // Fallback: server doesn't support version discovery
                this._apiVersion = 1;
                this._basePath = `${baseUrl}/api/v1/qcli`;
            }

            this._commands = await this.fetchCommands();
            this._connected = true;
            this._capabilities = await this.fetchCapabilities();
            this.connectEventSocket();
        } catch (e) {
            this._logger?.warn(`Failed to connect to server "${this._config.name}": ${e}`);
            this._connected = false;
            this._commands = [];
            this._capabilities = null;
        }
    }
```

- [ ] **Step 3: Update fetchCommands, fetchCapabilities, execute, and ping to use _basePath**

```typescript
    async fetchCommands(): Promise<CliServerCommandDescriptor[]> {
        const url = `${this._basePath}/commands`;
        const response = await this.httpFetch(url);

        if (!response.ok) {
            throw new Error(
                `Server ${this._config.name} returned ${response.status}`,
            );
        }

        return response.json();
    }

    async fetchCapabilities(): Promise<CliServerCapabilities | null> {
        try {
            const url = `${this._basePath}/capabilities`;
            const response = await this.httpFetch(url);
            if (!response.ok) return null;
            return response.json();
        } catch (e) {
            this._logger?.debug(`Failed to fetch capabilities for "${this._config.name}": ${e}`);
            return null;
        }
    }

    async execute(command: CliProcessCommand): Promise<CliServerResponse> {
        const url = `${this._basePath}/execute`;
        const response = await this.httpFetch(url, {
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
            const baseUrl = this.normalizeUrl(this._config.url);
            const url = `${baseUrl}/api/qcli/versions`;
            const response = await this.httpFetch(url);
            return response.ok;
        } catch (e) {
            this._logger?.debug(`Ping failed for "${this._config.name}": ${e}`);
            return false;
        }
    }
```

- [ ] **Step 4: Reset version state in disconnect()**

Update `disconnect()`:

```typescript
    disconnect(): void {
        this._connected = false;
        this._commands = [];
        this._capabilities = null;
        this._apiVersion = 1;
        this._basePath = '';
        this.closeEventSocket();
    }
```

`handleServerDisconnect()` keeps its existing `closeEventSocket()` call — no changes needed there (it already cleans up the socket before notifying the manager).

- [ ] **Step 5: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-connection.ts
git commit -m "feat: integrate ServerVersionNegotiator into CliServerConnection"
```

---

### Task 4: Add WebSocket auto-reconnect with exponential backoff

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`

When the event WebSocket closes unexpectedly, retry with exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s). Stop after 5 failed attempts.

- [ ] **Step 1: Add reconnect state fields**

Add after the existing private fields:

```typescript
    private _wsReconnectAttempts = 0;
    private _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly WS_MAX_RECONNECT_ATTEMPTS = 5;
    private static readonly WS_MAX_RECONNECT_DELAY_MS = 30000;
```

- [ ] **Step 2: Add scheduleWsReconnect method**

Add after `closeEventSocketDirect()`:

```typescript
    private scheduleWsReconnect(): void {
        if (this._wsReconnectAttempts >= CliServerConnection.WS_MAX_RECONNECT_ATTEMPTS) {
            this._logger?.warn(
                `WebSocket reconnect failed after ${this._wsReconnectAttempts} attempts for "${this._config.name}". Marking disconnected.`,
            );
            this.handleServerDisconnect();
            return;
        }

        // Clean up the dead socket before scheduling a new connection
        this.closeEventSocketDirect();

        const delay = Math.min(
            1000 * Math.pow(2, this._wsReconnectAttempts),
            CliServerConnection.WS_MAX_RECONNECT_DELAY_MS,
        );

        this._wsReconnectTimer = setTimeout(() => {
            this._wsReconnectAttempts++;
            this._logger?.debug(
                `WebSocket reconnect attempt ${this._wsReconnectAttempts} for "${this._config.name}"...`,
            );
            this.connectEventSocket();
        }, delay);
    }
```

- [ ] **Step 3: Update onclose handlers to trigger reconnect instead of disconnect**

In `connectEventSocket()`, update the `onclose` handler inside `onStart`:

```typescript
                    this._eventSocket.onclose = () => {
                        if (this._connected) {
                            ctx.log('WebSocket closed unexpectedly, scheduling reconnect', 'warn');
                            this.scheduleWsReconnect();
                        }
                    };
```

In `connectEventSocketDirect()`, update the `onclose` handler:

```typescript
            this._eventSocket.onclose = () => {
                if (this._connected) {
                    this.scheduleWsReconnect();
                }
            };
```

- [ ] **Step 4: Reset reconnect state on successful WebSocket connection**

In both `connectEventSocket()` (inside `onStart`) and `connectEventSocketDirect()`, add after `this._eventSocket = new WebSocket(wsUrl);`:

```typescript
                    this._eventSocket.onopen = () => {
                        this._wsReconnectAttempts = 0;
                        if (this._wsReconnectTimer) {
                            clearTimeout(this._wsReconnectTimer);
                            this._wsReconnectTimer = null;
                        }
                    };
```

- [ ] **Step 5: Clean up reconnect timer in disconnect and closeEventSocketDirect**

Add at the top of `disconnect()`:

```typescript
        if (this._wsReconnectTimer) {
            clearTimeout(this._wsReconnectTimer);
            this._wsReconnectTimer = null;
        }
        this._wsReconnectAttempts = 0;
```

Add the same cleanup at the top of `closeEventSocketDirect()`:

```typescript
        if (this._wsReconnectTimer) {
            clearTimeout(this._wsReconnectTimer);
            this._wsReconnectTimer = null;
        }
```

- [ ] **Step 6: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-connection.ts
git commit -m "feat: add WebSocket auto-reconnect with exponential backoff"
```

---

### Task 5: Add HTTP retry on transient fetch failures

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`

Wrap `execute()` with a single retry on transient network errors (not timeouts, not HTTP error status codes — only `TypeError: Failed to fetch` type errors).

- [ ] **Step 1: Add a retryable fetch helper**

Add after `httpFetch()`:

```typescript
    private async httpFetchWithRetry(
        url: string,
        init?: RequestInit,
        retries = 1,
    ): Promise<Response> {
        try {
            return await this.httpFetch(url, init);
        } catch (e: any) {
            if (retries > 0 && e.name !== 'AbortError') {
                this._logger?.debug(
                    `Transient fetch error for "${this._config.name}", retrying in 1s: ${e.message}`,
                );
                await new Promise((r) => setTimeout(r, 1000));
                return this.httpFetchWithRetry(url, init, retries - 1);
            }
            throw e;
        }
    }
```

- [ ] **Step 2: Use httpFetchWithRetry in execute()**

In `execute()`, change `this.httpFetch(url, ...)` to `this.httpFetchWithRetry(url, ...)`:

```typescript
    async execute(command: CliProcessCommand): Promise<CliServerResponse> {
        const url = `${this._basePath}/execute`;
        const response = await this.httpFetchWithRetry(url, {
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
```

- [ ] **Step 3: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-connection.ts
git commit -m "feat: add single HTTP retry on transient fetch failures"
```

---

### Task 6: Add periodic health check for disconnected servers

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-connection.ts`
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-manager.ts`

When a server disconnects, start pinging it every 30s. After 5 failed pings, stop checking. If a ping succeeds, auto-reconnect (re-fetch commands, re-register processors).

- [ ] **Step 1: Add health check fields and methods to CliServerConnection**

Add fields:

```typescript
    private _healthCheckTimer: ReturnType<typeof setTimeout> | null = null;
    private _healthCheckAttempts = 0;
    private static readonly HEALTH_CHECK_INTERVAL_MS = 30000;
    private static readonly HEALTH_CHECK_MAX_ATTEMPTS = 5;

    onReconnected?: () => void;
```

Add method (uses `setTimeout` chaining instead of `setInterval` to prevent overlapping async checks):

```typescript
    startHealthCheck(): void {
        this.stopHealthCheck();
        this._healthCheckAttempts = 0;
        this.scheduleNextHealthCheck();
    }

    private scheduleNextHealthCheck(): void {
        this._healthCheckTimer = setTimeout(async () => {
            this._healthCheckAttempts++;

            if (this._healthCheckAttempts > CliServerConnection.HEALTH_CHECK_MAX_ATTEMPTS) {
                this._logger?.debug(
                    `Health check gave up for "${this._config.name}" after ${CliServerConnection.HEALTH_CHECK_MAX_ATTEMPTS} attempts.`,
                );
                this.stopHealthCheck();
                return;
            }

            this._logger?.debug(
                `Health check ${this._healthCheckAttempts}/${CliServerConnection.HEALTH_CHECK_MAX_ATTEMPTS} for "${this._config.name}"...`,
            );

            const alive = await this.ping();
            if (alive) {
                this._logger?.debug(`Server "${this._config.name}" is back online, reconnecting...`);
                this.stopHealthCheck();
                await this.connect();
                if (this._connected) {
                    this.onReconnected?.();
                }
            } else {
                // Schedule next check only after current one completes
                this.scheduleNextHealthCheck();
            }
        }, CliServerConnection.HEALTH_CHECK_INTERVAL_MS);
    }

    stopHealthCheck(): void {
        if (this._healthCheckTimer) {
            clearTimeout(this._healthCheckTimer);
            this._healthCheckTimer = null;
        }
        this._healthCheckAttempts = 0;
    }
```

- [ ] **Step 2: Stop health check on explicit disconnect and successful connect**

Add in `disconnect()` (after the ws timer cleanup):

```typescript
        this.stopHealthCheck();
```

Add at the end of the `try` block in `connect()`, after `this.connectEventSocket();`:

```typescript
            this.stopHealthCheck();
```

> **Note:** `ServerVersionNegotiator.discover()` uses raw `fetch()` internally, bypassing the connection's custom headers and timeout. This means version discovery won't include auth tokens if the server requires them. For now this is acceptable since the `/api/qcli/versions` endpoint is typically unauthenticated. If auth is needed in the future, `ServerVersionNegotiator` can be updated to accept `RequestInit` options.

- [ ] **Step 3: Update CliServerManager to wire health checks**

In `cli-server-manager.ts`, update `handleDisconnect()`:

```typescript
    private handleDisconnect(name: string): void {
        this._logger?.warn(
            `Server '${name}' disconnected. Its commands are no longer available. Starting health check...`,
        );
        this.unregisterServerProcessors(name);

        const connection = this.connections.get(name);
        if (connection) {
            connection.startHealthCheck();
        }
    }
```

In `connectAll()`, after setting `connection.onDisconnect`, also set `connection.onReconnected`:

```typescript
            connection.onReconnected = () => {
                logger?.info(
                    `Server '${config.name}' reconnected (${connection.commands.length} commands, API v${connection.apiVersion}).`,
                );
                this.registerProxyProcessors(connection, config.name);
                this.unregisterBareAliases();
                this.registerBareAliases();
            };
```

Also update the `reconnect()` method to set the `onReconnected` callback:

```typescript
    async reconnect(
        name: string,
    ): Promise<{ success: boolean; commandCount: number }> {
        const connection = this.connections.get(name);
        if (!connection) {
            return { success: false, commandCount: 0 };
        }

        connection.stopHealthCheck();
        this.unregisterServerProcessors(name);

        connection.onDisconnect = () => {
            this.handleDisconnect(name);
        };

        connection.onReconnected = () => {
            this._logger?.info(
                `Server '${name}' reconnected (${connection.commands.length} commands, API v${connection.apiVersion}).`,
            );
            this.registerProxyProcessors(connection, name);
            this.unregisterBareAliases();
            this.registerBareAliases();
        };

        await connection.connect();

        if (connection.connected) {
            this.registerProxyProcessors(connection, name);
            this.registerBareAliases();
            return { success: true, commandCount: connection.commands.length };
        }

        return { success: false, commandCount: 0 };
    }
```

- [ ] **Step 4: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-connection.ts packages/cli/src/lib/server/cli-server-manager.ts
git commit -m "feat: add periodic health check with auto-reconnect for disconnected servers"
```

---

### Task 7: Show API version in server list and server status

**Files:**
- Modify: `web-cli/packages/cli/src/lib/server/cli-server-command-processor.ts`

- [ ] **Step 1: Update ServerListProcessor to show API version**

In `ServerListProcessor.processCommand()`, update the table:

```typescript
        const headers = ['Name', 'URL', 'Status', 'API', 'Commands'];
        const rows: string[][] = [];
        const defaultServer = manager.defaultServer;

        for (const [name, connection] of manager.connections) {
            const isDefault = name === defaultServer;
            rows.push([
                isDefault ? `${name} *` : name,
                connection.config.url,
                connection.connected ? 'Connected' : 'Disconnected',
                connection.connected ? `v${connection.apiVersion}` : '-',
                connection.connected ? String(connection.commands.length) : '-',
            ]);
        }
```

- [ ] **Step 2: Update ServerStatusProcessor to show API version**

In `ServerStatusProcessor.processCommand()`, update the key-value output when reachable:

```typescript
            context.writer.writeKeyValue({
                URL: connection.config.url,
                Connected: String(connection.connected),
                'API Version': connection.connected ? `v${connection.apiVersion}` : 'unknown',
                Commands: String(connection.commands.length),
            });
```

- [ ] **Step 3: Expose apiVersion from CliServerConnection**

This was already done in Task 3 (the `get apiVersion()` getter). Verify it's accessible.

- [ ] **Step 4: Verify build**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && npx nx build cli
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/cli/src/lib/server/cli-server-command-processor.ts
git commit -m "feat: show API version in server list and server status output"
```

---

### Task 8: Build and verify all projects

- [ ] **Step 1: Build web-cli**

```bash
cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build
```
Expected: All 31 projects build successfully.

- [ ] **Step 2: Build cli-server-node**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build && npm test
```
Expected: Build and tests pass.

- [ ] **Step 3: Verify cli-server-python tests**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-python && pytest
```
Expected: All tests pass.

- [ ] **Step 4: Verify cli-server-dotnet builds**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln
```
Expected: Build succeeds (no changes needed for .NET, it was already correct).
