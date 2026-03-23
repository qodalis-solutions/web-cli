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

export class CliServerConnection {
    private _connected = false;
    private _commands: CliServerCommandDescriptor[] = [];
    private _capabilities: CliServerCapabilities | null = null;
    private _eventSocket: WebSocket | null = null;
    private _apiVersion: number = 1;
    private _basePath: string = '';
    private _wsReconnectAttempts = 0;
    private _wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly WS_MAX_RECONNECT_ATTEMPTS = 5;
    private static readonly WS_MAX_RECONNECT_DELAY_MS = 30000;

    private _healthCheckTimer: ReturnType<typeof setTimeout> | null = null;
    private _healthCheckAttempts = 0;
    private static readonly HEALTH_CHECK_INTERVAL_MS = 30000;
    private static readonly HEALTH_CHECK_MAX_ATTEMPTS = 5;

    onDisconnect?: () => void;
    onReconnected?: () => void;

    constructor(
        private readonly _config: CliServerConfig,
        private readonly _backgroundServices?: ICliBackgroundServiceRegistry,
        private readonly _logger?: ICliLogger,
    ) {}

    get config(): CliServerConfig {
        return this._config;
    }

    get connected(): boolean {
        return this._connected;
    }

    get commands(): CliServerCommandDescriptor[] {
        return this._commands;
    }

    get capabilities(): CliServerCapabilities | null {
        return this._capabilities;
    }

    get apiVersion(): number {
        return this._apiVersion;
    }

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
            this.stopHealthCheck();
        } catch (e) {
            this._logger?.warn(`Failed to connect to server "${this._config.name}": ${e}`);
            this._connected = false;
            this._commands = [];
            this._capabilities = null;
        }
    }

    disconnect(): void {
        if (this._wsReconnectTimer) {
            clearTimeout(this._wsReconnectTimer);
            this._wsReconnectTimer = null;
        }
        this._wsReconnectAttempts = 0;
        this.stopHealthCheck();
        this._connected = false;
        this._commands = [];
        this._capabilities = null;
        this._apiVersion = 1;
        this._basePath = '';
        this.closeEventSocket();
    }

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

    private connectEventSocket(): void {
        if (!this._backgroundServices) {
            this.connectEventSocketDirect();
            return;
        }

        const serviceName = `server-events:${this._config.name}`;

        try {
            this._backgroundServices.register({
                name: serviceName,
                description: `Event stream for server '${this._config.name}'`,
                type: 'daemon',
                onStart: async (ctx) => {
                    const baseUrl = this.normalizeUrl(this._config.url);
                    const wsUrl = this.toWebSocketUrl(baseUrl) + '/ws/v1/qcli/events';
                    ctx.log(`Connecting to ${wsUrl}`);

                    this._eventSocket = new WebSocket(wsUrl);

                    this._eventSocket.onopen = () => {
                        this._wsReconnectAttempts = 0;
                        if (this._wsReconnectTimer) {
                            clearTimeout(this._wsReconnectTimer);
                            this._wsReconnectTimer = null;
                        }
                    };

                    this._eventSocket.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            ctx.emit({
                                source: serviceName,
                                type: data.type || 'server-event',
                                data,
                            });
                            if (data.type === 'disconnect') {
                                this.handleServerDisconnect();
                            }
                        } catch { /* ignore malformed */ }
                    };

                    this._eventSocket.onclose = () => {
                        if (this._connected) {
                            ctx.log('WebSocket closed unexpectedly, scheduling reconnect', 'warn');
                            this.scheduleWsReconnect();
                        }
                    };

                    this._eventSocket.onerror = () => {
                        ctx.log('WebSocket error', 'error');
                    };
                },
                onStop: async () => {
                    this.closeEventSocketDirect();
                },
            });

            this._backgroundServices.start(serviceName).catch((e) => {
                this._logger?.debug(`Background event service failed for "${this._config.name}", falling back to direct: ${e}`);
                this.connectEventSocketDirect();
            });
        } catch (e) {
            this._logger?.debug(`Failed to register event service for "${this._config.name}", falling back to direct: ${e}`);
            this.connectEventSocketDirect();
        }
    }

    private connectEventSocketDirect(): void {
        try {
            const baseUrl = this.normalizeUrl(this._config.url);
            const wsUrl = this.toWebSocketUrl(baseUrl) + '/ws/v1/qcli/events';
            this._eventSocket = new WebSocket(wsUrl);

            this._eventSocket.onopen = () => {
                this._wsReconnectAttempts = 0;
                if (this._wsReconnectTimer) {
                    clearTimeout(this._wsReconnectTimer);
                    this._wsReconnectTimer = null;
                }
            };

            this._eventSocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'disconnect') {
                        this.handleServerDisconnect();
                    }
                } catch {
                    // Ignore malformed messages
                }
            };

            this._eventSocket.onclose = () => {
                if (this._connected) {
                    this.scheduleWsReconnect();
                }
            };

            this._eventSocket.onerror = () => {
                // onclose will fire after onerror
            };
        } catch (e) {
            this._logger?.debug(`WebSocket not available for "${this._config.name}": ${e}`);
        }
    }

    private handleServerDisconnect(): void {
        this._connected = false;
        this._commands = [];
        this._capabilities = null;
        this.closeEventSocket();
        this.onDisconnect?.();
    }

    private closeEventSocket(): void {
        if (this._backgroundServices) {
            const serviceName = `server-events:${this._config.name}`;
            const info = this._backgroundServices.getStatus(serviceName);
            if (info && info.status === 'running') {
                this._backgroundServices.stop(serviceName).catch(() => {});
                return; // onStop calls closeEventSocketDirect()
            }
        }
        this.closeEventSocketDirect();
    }

    private closeEventSocketDirect(): void {
        if (this._wsReconnectTimer) {
            clearTimeout(this._wsReconnectTimer);
            this._wsReconnectTimer = null;
        }
        if (this._eventSocket) {
            this._eventSocket.onclose = null;
            this._eventSocket.onmessage = null;
            this._eventSocket.onerror = null;
            if (
                this._eventSocket.readyState === WebSocket.OPEN ||
                this._eventSocket.readyState === WebSocket.CONNECTING
            ) {
                this._eventSocket.close();
            }
            this._eventSocket = null;
        }
    }

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

    private httpFetch(url: string, init?: RequestInit): Promise<Response> {
        const timeout = this._config.timeout ?? 30000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const headers: Record<string, string> = {
            ...(this._config.headers ?? {}),
            ...((init?.headers as Record<string, string>) ?? {}),
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

    private toWebSocketUrl(httpUrl: string): string {
        if (!httpUrl || httpUrl.startsWith('/')) {
            // Relative URL — derive from current location
            const protocol =
                typeof location !== 'undefined' &&
                location.protocol === 'https:'
                    ? 'wss:'
                    : 'ws:';
            const host =
                typeof location !== 'undefined' ? location.host : 'localhost';
            return `${protocol}//${host}`;
        }
        return httpUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    }
}
