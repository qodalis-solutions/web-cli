import {
    CliProcessCommand,
    CliServerCapabilities,
    CliServerConfig,
    CliServerResponse,
    CliServerCommandDescriptor,
    ICliBackgroundServiceRegistry,
    ICliLogger,
} from '@qodalis/cli-core';

export class CliServerConnection {
    private _connected = false;
    private _commands: CliServerCommandDescriptor[] = [];
    private _capabilities: CliServerCapabilities | null = null;
    private _eventSocket: WebSocket | null = null;

    onDisconnect?: () => void;

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

    async connect(): Promise<void> {
        try {
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

    disconnect(): void {
        this._connected = false;
        this._commands = [];
        this._capabilities = null;
        this.closeEventSocket();
    }

    async fetchCommands(): Promise<CliServerCommandDescriptor[]> {
        const url = `${this.normalizeUrl(this._config.url)}/api/v1/qcli/commands`;
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
            const url = `${this.normalizeUrl(this._config.url)}/api/v1/qcli/capabilities`;
            const response = await this.httpFetch(url);
            if (!response.ok) return null;
            return response.json();
        } catch (e) {
            this._logger?.debug(`Failed to fetch capabilities for "${this._config.name}": ${e}`);
            return null;
        }
    }

    async execute(command: CliProcessCommand): Promise<CliServerResponse> {
        const url = `${this.normalizeUrl(this._config.url)}/api/v1/qcli/execute`;
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
            const url = `${this.normalizeUrl(this._config.url)}/api/v1/qcli/version`;
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
                            ctx.log('WebSocket closed unexpectedly', 'warn');
                            this.handleServerDisconnect();
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
                    this.handleServerDisconnect();
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
