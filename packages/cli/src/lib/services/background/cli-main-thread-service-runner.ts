import {
    ICliBackgroundService,
    ICliServiceContext,
    ICliManagedInterval,
    ICliManagedTimer,
    ICliServiceEvent,
    CliServiceExecutionMode,
    ICliStateStore,
    ICliServiceProvider,
} from '@qodalis/cli-core';
import { ServiceLogBuffer } from './service-log-buffer';

/**
 * Runs a background service on the main thread.
 */
export class CliMainThreadServiceRunner {
    readonly mode: CliServiceExecutionMode = 'main-thread';

    private readonly timers = new Set<{ clear(): void }>();
    private abortController: AbortController | null = null;

    constructor(
        private readonly service: ICliBackgroundService,
        private readonly logBuffer: ServiceLogBuffer,
        private readonly emitEvent: (event: ICliServiceEvent) => void,
        private readonly sharedState: ICliStateStore,
        private readonly sharedServices: ICliServiceProvider,
    ) {}

    async start(): Promise<void> {
        this.abortController = new AbortController();

        const context: ICliServiceContext = {
            signal: this.abortController.signal,
            emit: (event) => {
                this.emitEvent({ ...event, timestamp: new Date() });
            },
            log: (message, level = 'info') => {
                this.logBuffer.add(message, level);
            },
            createInterval: (callback, ms) => {
                let timerId = setInterval(callback, ms);
                const handle: ICliManagedInterval = {
                    clear: () => {
                        clearInterval(timerId);
                        this.timers.delete(handle);
                    },
                    setDelay: (newMs) => {
                        clearInterval(timerId);
                        timerId = setInterval(callback, newMs);
                    },
                };
                this.timers.add(handle);
                return handle;
            },
            createTimeout: (callback, ms) => {
                const timerId = setTimeout(() => {
                    this.timers.delete(handle);
                    callback();
                }, ms);
                const handle: ICliManagedTimer = {
                    clear: () => {
                        clearTimeout(timerId);
                        this.timers.delete(handle);
                    },
                };
                this.timers.add(handle);
                return handle;
            },
            state: this.sharedState,
            services: this.sharedServices,
        };

        await this.service.onStart(context);
    }

    async stop(): Promise<void> {
        this.clearAllTimers();
        this.abortController?.abort();

        if (this.service.onStop && this.abortController) {
            const ctx: ICliServiceContext = {
                signal: this.abortController.signal,
                emit: (event) => this.emitEvent({ ...event, timestamp: new Date() }),
                log: (message, level = 'info') => this.logBuffer.add(message, level),
                createInterval: () => { throw new Error('Cannot create timers during stop'); },
                createTimeout: () => { throw new Error('Cannot create timers during stop'); },
                state: this.sharedState,
                services: this.sharedServices,
            };
            await this.service.onStop(ctx);
        }

        this.abortController = null;
    }

    private clearAllTimers(): void {
        for (const timer of this.timers) {
            timer.clear();
        }
        this.timers.clear();
    }
}
