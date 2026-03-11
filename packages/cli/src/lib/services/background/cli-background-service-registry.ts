import {
    ICliBackgroundService,
    ICliBackgroundServiceInfo,
    ICliBackgroundServiceRegistry,
    ICliServiceContext,
    ICliServiceEvent,
    ICliServiceLogEntry,
    CliBackgroundServiceStatus,
    CliServiceEventHandler,
    ICliStateStore,
    ICliServiceProvider,
    ICliTerminalWriter,
} from '@qodalis/cli-core';
import { ServiceLogBuffer } from './service-log-buffer';
import { CliMainThreadServiceRunner } from './cli-main-thread-service-runner';
import { CliWorkerServiceRunner } from './cli-worker-service-runner';

interface ServiceEntry {
    service: ICliBackgroundService;
    status: CliBackgroundServiceStatus;
    startedAt?: Date;
    stoppedAt?: Date;
    error?: string;
    logBuffer: ServiceLogBuffer;
    runner: CliMainThreadServiceRunner | CliWorkerServiceRunner | null;
}

/**
 * Per-session registry that manages background service lifecycle.
 */
export class CliBackgroundServiceRegistry implements ICliBackgroundServiceRegistry {
    private readonly entries = new Map<string, ServiceEntry>();
    private readonly handlers: Array<{
        handler: CliServiceEventHandler;
        filter?: { source?: string; type?: string };
    }> = [];
    private isFullScreen = false;
    private notificationQueue: ICliServiceEvent[] = [];

    constructor(
        private readonly state: ICliStateStore,
        private readonly services: ICliServiceProvider,
        private readonly writer?: ICliTerminalWriter,
    ) {}

    register(service: ICliBackgroundService): void {
        if (this.entries.has(service.name)) {
            throw new Error(`Service "${service.name}" is already registered`);
        }

        this.entries.set(service.name, {
            service,
            status: 'pending',
            logBuffer: new ServiceLogBuffer(),
            runner: null,
        });

        this.emitLifecycleEvent('service-registered', service.name, {
            name: service.name,
            type: service.type,
        });
    }

    async start(name: string): Promise<void> {
        const entry = this.getEntry(name);

        if (entry.status === 'running') {
            throw new Error(`Service "${name}" is already running`);
        }

        const useWorker =
            entry.service.workerCompatible &&
            entry.service.workerFactory &&
            typeof Worker !== 'undefined';

        if (useWorker) {
            const workerRunner = new CliWorkerServiceRunner(
                entry.service,
                entry.logBuffer,
                (event) => this.dispatchEvent(event),
                (status) => this.updateStatus(name, status),
                this.state,
            );
            entry.runner = workerRunner;
            entry.status = 'running';
            entry.startedAt = new Date();
            entry.stoppedAt = undefined;
            entry.error = undefined;

            try {
                await workerRunner.start();
                this.emitLifecycleEvent('service-started', name, {
                    name,
                    mode: 'worker',
                });
            } catch (e) {
                this.handleStartError(entry, name, e);
            }
        } else {
            const mainRunner = new CliMainThreadServiceRunner(
                entry.service,
                entry.logBuffer,
                (event) => this.dispatchEvent(event),
                this.state,
                this.services,
            );
            entry.runner = mainRunner;
            entry.status = 'running';
            entry.startedAt = new Date();
            entry.stoppedAt = undefined;
            entry.error = undefined;

            try {
                await mainRunner.start();
                this.emitLifecycleEvent('service-started', name, {
                    name,
                    mode: 'main-thread',
                });
            } catch (e) {
                this.handleStartError(entry, name, e);
            }
        }
    }

    async stop(name: string): Promise<void> {
        const entry = this.getEntry(name);

        if (entry.status !== 'running') {
            throw new Error(`Service "${name}" is not running (status: ${entry.status})`);
        }

        if (entry.runner) {
            await entry.runner.stop();
        }

        entry.status = 'stopped';
        entry.stoppedAt = new Date();
        entry.runner = null;

        this.emitLifecycleEvent('service-stopped', name, { name });
    }

    async restart(name: string): Promise<void> {
        const entry = this.getEntry(name);

        if (entry.service.type !== 'daemon') {
            throw new Error(`Cannot restart "${name}": only daemon services can be restarted`);
        }

        if (entry.status === 'running') {
            await this.stop(name);
        }

        await this.start(name);
    }

    startJob(
        name: string,
        task: (context: ICliServiceContext) => Promise<void>,
        _options?: { workerCompatible?: boolean },
    ): void {
        const jobService: ICliBackgroundService = {
            name,
            type: 'job',
            async onStart(ctx) {
                await task(ctx);
            },
        };

        this.register(jobService);

        this.start(name).then(() => {
            const entry = this.entries.get(name);
            if (entry && entry.status === 'running') {
                const duration = entry.startedAt
                    ? Date.now() - entry.startedAt.getTime()
                    : 0;
                entry.status = 'done';
                entry.stoppedAt = new Date();
                entry.runner = null;
                this.emitLifecycleEvent('service-completed', name, {
                    name,
                    duration,
                });
            }
        }).catch((e) => {
            const entry = this.entries.get(name);
            if (entry) {
                const error = e instanceof Error ? e : new Error(String(e));
                entry.status = 'failed';
                entry.error = error.message;
                entry.stoppedAt = new Date();
                entry.runner = null;
                this.emitLifecycleEvent('service-failed', name, {
                    name,
                    error: error.message,
                });
            }
        });
    }

    getStatus(name: string): ICliBackgroundServiceInfo | undefined {
        const entry = this.entries.get(name);
        if (!entry) return undefined;
        return this.toInfo(entry);
    }

    list(): ICliBackgroundServiceInfo[] {
        return Array.from(this.entries.values()).map((e) => this.toInfo(e));
    }

    getLogs(name: string, limit?: number): ICliServiceLogEntry[] {
        const entry = this.getEntry(name);
        return entry.logBuffer.get(limit);
    }

    on(
        handler: CliServiceEventHandler,
        filter?: { source?: string; type?: string },
    ): () => void {
        const registration = { handler, filter };
        this.handlers.push(registration);
        return () => {
            const idx = this.handlers.indexOf(registration);
            if (idx >= 0) {
                this.handlers.splice(idx, 1);
            }
        };
    }

    async destroyAll(): Promise<void> {
        const running = Array.from(this.entries.values()).filter(
            (e) => e.status === 'running',
        );

        await Promise.allSettled(
            running.map(async (entry) => {
                try {
                    if (entry.runner) {
                        await Promise.race([
                            entry.runner.stop(),
                            new Promise<void>((resolve) => setTimeout(resolve, 5000)),
                        ]);

                        if (entry.runner instanceof CliWorkerServiceRunner) {
                            entry.runner.terminate();
                        }
                    }
                } catch {
                    // Best effort during teardown
                }
                entry.status = 'stopped';
                entry.stoppedAt = new Date();
                entry.runner = null;
            }),
        );

        this.entries.clear();
        this.handlers.length = 0;
    }

    /** Called by the execution context when entering/exiting full-screen mode */
    setFullScreen(isFullScreen: boolean): void {
        this.isFullScreen = isFullScreen;
        if (!isFullScreen) {
            this.flushNotificationQueue();
        }
    }

    // --- Private ---

    private getEntry(name: string): ServiceEntry {
        const entry = this.entries.get(name);
        if (!entry) {
            throw new Error(`No service registered with name "${name}"`);
        }
        return entry;
    }

    private toInfo(entry: ServiceEntry): ICliBackgroundServiceInfo {
        const executionMode = entry.runner
            ? entry.runner.mode
            : 'main-thread';

        const uptime =
            entry.status === 'running' && entry.startedAt
                ? Date.now() - entry.startedAt.getTime()
                : undefined;

        return {
            name: entry.service.name,
            description: entry.service.description,
            type: entry.service.type,
            status: entry.status,
            executionMode,
            startedAt: entry.startedAt,
            stoppedAt: entry.stoppedAt,
            error: entry.error,
            uptime,
        };
    }

    private updateStatus(name: string, status: CliBackgroundServiceStatus): void {
        const entry = this.entries.get(name);
        if (!entry) return;

        const from = entry.status;
        entry.status = status;

        if (status === 'stopped' || status === 'failed' || status === 'done') {
            entry.stoppedAt = new Date();
            entry.runner = null;
        }

        this.emitLifecycleEvent('status-change', name, { name, from, to: status });
    }

    private handleStartError(entry: ServiceEntry, name: string, e: unknown): void {
        const error = e instanceof Error ? e : new Error(String(e));
        entry.status = 'failed';
        entry.error = error.message;
        entry.stoppedAt = new Date();
        entry.runner = null;
        entry.logBuffer.add(`Failed to start: ${error.message}`, 'error');

        if (entry.service.onError) {
            entry.service.onError(error, {} as ICliServiceContext);
        }

        this.emitLifecycleEvent('service-failed', name, {
            name,
            error: error.message,
        });
    }

    private dispatchEvent(event: ICliServiceEvent): void {
        const eventWithTimestamp = event.timestamp ? event : { ...event, timestamp: new Date() };

        for (const { handler, filter } of this.handlers) {
            if (filter?.source && filter.source !== eventWithTimestamp.source) continue;
            if (filter?.type && filter.type !== eventWithTimestamp.type) continue;
            try {
                handler(eventWithTimestamp);
            } catch {
                // Don't let a handler error break event dispatch
            }
        }

        const data = eventWithTimestamp.data as Record<string, unknown> | undefined;
        if (data?.['notify']) {
            this.notify(eventWithTimestamp);
        }
    }

    private emitLifecycleEvent(type: string, source: string, data: unknown): void {
        this.dispatchEvent({
            source,
            type,
            data,
            timestamp: new Date(),
        });
    }

    private notify(event: ICliServiceEvent): void {
        if (this.isFullScreen) {
            this.notificationQueue.push(event);
            return;
        }
        this.writeNotification(event);
    }

    private flushNotificationQueue(): void {
        for (const event of this.notificationQueue) {
            this.writeNotification(event);
        }
        this.notificationQueue = [];
    }

    private writeNotification(event: ICliServiceEvent): void {
        if (!this.writer) return;

        const data = event.data as Record<string, unknown> | undefined;
        const message = data?.['message'] ?? data?.['error'] ?? event.type;
        this.writer.writeln('');
        this.writer.writeln(`\u250C\u2500 [${event.source}] ${message}`);
        this.writer.writeln('\u2514' + '\u2500'.repeat(40));
    }
}
