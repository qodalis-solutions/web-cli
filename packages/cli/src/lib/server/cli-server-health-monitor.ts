import {
    CliServerConfig,
    CliServerHealthCheckOptions,
    CliServiceLogLevel,
    ICliBackgroundServiceRegistry,
    ICliLogger,
} from '@qodalis/cli-core';

/** Defaults of `CliServerConfig.healthCheck`. */
export const DEFAULT_SERVER_HEALTH_CHECK: Required<CliServerHealthCheckOptions> = {
    interval: 30000,
    retryDelay: 5000,
    maxRetryDelay: 60000,
};

/** What the monitor needs from the connection it watches. */
export interface CliServerHealthTarget {
    readonly config: CliServerConfig;
    readonly connected: boolean;
    readonly needsSignIn: boolean;
    /** Whether the server answers: false on a network error, a timeout or a 5xx. */
    probe(): Promise<boolean>;
    /** Connect again; true once connected (fires `onReconnected`). */
    reconnectFromMonitor(): Promise<boolean>;
    /** Mark the server down: unregister its commands, emit `server:disconnected`. */
    markDisconnected(): void;
}

/**
 * Watches one server (`server-health:<name>` background service): pings it at
 * an interval while it is connected and marks it disconnected when it stops
 * answering; retries with a capped backoff, without a limit, while it is down
 * (also when it was down at startup) and connects it again once it answers.
 * Checks at once when a command fails with a network error, when the browser
 * comes back online and when the tab becomes visible; polls nothing while the
 * tab is hidden or the browser is offline. A server that needs a sign-in is up:
 * the auth layer connects it.
 */
export class CliServerHealthMonitor {
    private readonly options: Required<CliServerHealthCheckOptions>;
    /** Polling on a timer (`healthCheck: false` turns it off: checks then run only on events) */
    private readonly polling: boolean;
    private readonly serviceName: string;

    private active = false;
    private serviceRegistered = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private checking: Promise<void> | null = null;
    /** Failed checks in a row while disconnected (drives the backoff) */
    private failures = 0;
    private log: (message: string, level?: CliServiceLogLevel) => void = () => {};
    private detachListeners: (() => void) | null = null;

    constructor(
        private readonly target: CliServerHealthTarget,
        private readonly backgroundServices?: ICliBackgroundServiceRegistry,
        private readonly logger?: ICliLogger,
    ) {
        const config = target.config.healthCheck;
        this.polling = config !== false;
        this.options = {
            ...DEFAULT_SERVER_HEALTH_CHECK,
            ...(config && typeof config === 'object' ? stripUndefined(config) : {}),
        };
        this.serviceName = `server-health:${target.config.name}`;
    }

    /** Whether the monitor runs (as a service or, without one, on its own timers). */
    get running(): boolean {
        return this.active;
    }

    /** Start watching (no-op while running). */
    start(): void {
        if (this.active) return;
        if (!this.backgroundServices) {
            this.activate((message, level = 'info') => this.logDirect(message, level));
            return;
        }
        const registry = this.backgroundServices;
        try {
            if (!this.serviceRegistered) {
                if (registry.getStatus(this.serviceName)) {
                    // Another connection of the same name (a removed and re-added server) owns it
                    this.activate((message, level = 'info') => this.logDirect(message, level));
                    return;
                }
                registry.register({
                    name: this.serviceName,
                    description: `Health monitor for server '${this.target.config.name}'`,
                    type: 'daemon',
                    onStart: async (ctx) => {
                        this.activate((message, level) => ctx.log(message, level));
                    },
                    onStop: async () => {
                        this.deactivate();
                    },
                });
                this.serviceRegistered = true;
            }
            if (registry.getStatus(this.serviceName)?.status === 'running') {
                return;
            }
            registry.start(this.serviceName).catch((e) => {
                this.logger?.debug(`Health service failed for "${this.target.config.name}", running it directly: ${e}`);
                this.activate((message, level = 'info') => this.logDirect(message, level));
            });
        } catch (e) {
            this.logger?.debug(`Failed to register health service for "${this.target.config.name}", running it directly: ${e}`);
            this.activate((message, level = 'info') => this.logDirect(message, level));
        }
    }

    /** Stop watching. */
    stop(): void {
        if (this.serviceRegistered && this.backgroundServices?.getStatus(this.serviceName)?.status === 'running') {
            // onStop deactivates
            this.backgroundServices.stop(this.serviceName).catch(() => {});
        }
        this.deactivate();
    }

    /**
     * Check right away, without waiting for the next tick (a command failed
     * with a network error, the browser came online, the tab became visible).
     */
    checkNow(reason: string): Promise<void> {
        if (!this.active) return Promise.resolve();
        if (this.checking) return this.checking;
        this.log(`Checking now: ${reason}`);
        return this.runCheck();
    }

    /** The connection connected (any path: the monitor, `server reconnect`, a sign-in). */
    notifyConnected(): void {
        this.failures = 0;
        if (this.active && !this.checking) this.scheduleNext();
    }

    private activate(log: (message: string, level?: CliServiceLogLevel) => void): void {
        if (this.active) return;
        this.active = true;
        this.log = log;
        this.failures = this.target.connected ? 0 : 1;
        this.attachListeners();
        this.log(
            this.target.connected
                ? `Watching ${this.target.config.url} (connected)`
                : `Watching ${this.target.config.url} (not connected)`,
        );
        this.scheduleNext();
    }

    private deactivate(): void {
        this.active = false;
        this.clearTimer();
        this.detachListeners?.();
        this.detachListeners = null;
    }

    private runCheck(): Promise<void> {
        this.clearTimer();
        this.checking = this.check()
            .catch((e) => this.log(`Check failed: ${e}`, 'error'))
            .finally(() => {
                this.checking = null;
                if (this.active) this.scheduleNext();
            });
        return this.checking;
    }

    private async check(): Promise<void> {
        const name = this.target.config.name;
        if (this.target.connected) {
            const up = await this.target.probe();
            if (!this.active || !this.target.connected) return;
            if (up) {
                this.failures = 0;
                this.log('Check: up');
                return;
            }
            this.failures = 1;
            this.log('Check: no answer, marking the server disconnected', 'warn');
            this.logger?.debug(`Health check: server "${name}" is not responding. Marking disconnected.`);
            this.target.markDisconnected();
            return;
        }

        // Up, but signed out: the auth layer connects it
        if (this.target.needsSignIn) return;

        const up = await this.target.probe();
        if (!this.active || this.target.connected) return;
        if (!up) {
            this.failures++;
            this.log(`Check: still down (${this.failures} failed checks)`);
            return;
        }
        this.log('Check: answering again, connecting');
        const connected = await this.target.reconnectFromMonitor();
        if (connected) {
            this.failures = 0;
            this.log('Connected');
        } else if (this.target.needsSignIn) {
            this.log('Connected, but its commands need a sign-in');
        } else {
            this.failures++;
            this.log('Connect failed', 'warn');
        }
    }

    /** The next tick: the interval while connected, the backoff while down. */
    private scheduleNext(): void {
        this.clearTimer();
        if (!this.active || !this.polling || this.paused()) return;
        let delay: number;
        if (this.target.connected) {
            delay = this.options.interval;
        } else if (this.target.needsSignIn) {
            return;
        } else {
            const exponent = Math.max(0, this.failures - 1);
            delay = Math.min(
                this.options.retryDelay * Math.pow(2, exponent),
                this.options.maxRetryDelay,
            );
        }
        if (!(delay > 0)) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            if (this.paused()) return;
            void this.runCheck();
        }, delay);
    }

    private clearTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /** No polling while the tab is hidden or the browser is offline. */
    private paused(): boolean {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
        return false;
    }

    private attachListeners(): void {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        const onOnline = () => void this.checkNow('the browser is online');
        const onOffline = () => {
            this.log('Paused: the browser is offline');
            this.clearTimer();
        };
        const onVisibility = () => {
            if (typeof document === 'undefined') return;
            if (document.visibilityState === 'visible') {
                void this.checkNow('the tab is visible');
            } else {
                this.clearTimer();
            }
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }
        this.detachListeners = () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
        };
    }

    private logDirect(message: string, level: CliServiceLogLevel): void {
        const text = `[${this.serviceName}] ${message}`;
        if (level === 'error') this.logger?.error(text);
        else if (level === 'warn') this.logger?.warn(text);
        else this.logger?.debug(text);
    }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
}
