import {
    ICliBackgroundService,
    ICliServiceEvent,
    CliServiceExecutionMode,
    CliBackgroundServiceStatus,
    CliWorkerInboundMessage,
    CliWorkerOutboundMessage,
    ICliStateStore,
} from '@qodalis/cli-core';
import { ServiceLogBuffer } from './service-log-buffer';

/**
 * Runs a background service in a dedicated Web Worker.
 */
export class CliWorkerServiceRunner {
    readonly mode: CliServiceExecutionMode = 'worker';

    private worker: Worker | null = null;

    constructor(
        private readonly service: ICliBackgroundService,
        private readonly logBuffer: ServiceLogBuffer,
        private readonly emitEvent: (event: ICliServiceEvent) => void,
        private readonly onStatusChange: (status: CliBackgroundServiceStatus) => void,
        private readonly sharedState: ICliStateStore,
    ) {}

    async start(config?: Record<string, unknown>): Promise<void> {
        if (!this.service.workerFactory) {
            throw new Error(
                `Service "${this.service.name}" is workerCompatible but has no workerFactory`,
            );
        }

        this.worker = this.service.workerFactory();

        this.worker.onmessage = (ev: MessageEvent<CliWorkerOutboundMessage>) => {
            const msg = ev.data;

            switch (msg.type) {
                case 'log':
                    this.logBuffer.add(msg.message, msg.level);
                    break;

                case 'event':
                    this.emitEvent({
                        ...msg.event,
                        timestamp: new Date(),
                    });
                    break;

                case 'state-update':
                    this.sharedState.updateState(msg.patch);
                    break;

                case 'status':
                    this.onStatusChange(msg.status);
                    break;

                case 'error':
                    this.logBuffer.add(msg.message, 'error');
                    this.emitEvent({
                        source: this.service.name,
                        type: 'service-error',
                        data: { error: msg.message, stack: msg.stack },
                        timestamp: new Date(),
                    });
                    this.onStatusChange('failed');
                    break;
            }
        };

        this.worker.onerror = (ev) => {
            this.logBuffer.add(`Worker error: ${ev.message}`, 'error');
            this.onStatusChange('failed');
        };

        const startMsg: CliWorkerInboundMessage = { type: 'start', config };
        this.worker.postMessage(startMsg);
    }

    async stop(): Promise<void> {
        if (!this.worker) return;

        const worker = this.worker;
        const stopMsg: CliWorkerInboundMessage = { type: 'stop' };
        worker.postMessage(stopMsg);

        // Give the worker 5 seconds to clean up, then terminate
        await Promise.race([
            new Promise<void>((resolve) => {
                const originalOnMessage = worker.onmessage;
                worker.onmessage = (ev: MessageEvent<CliWorkerOutboundMessage>) => {
                    // Delegate to original handler first (for log/event processing)
                    if (originalOnMessage) {
                        (originalOnMessage as (ev: MessageEvent) => void)(ev);
                    }
                    if (ev.data.type === 'status' && ev.data.status === 'stopped') {
                        resolve();
                    }
                };
            }),
            new Promise<void>((resolve) => setTimeout(resolve, 5000)),
        ]);

        this.terminate();
    }

    terminate(): void {
        if (this.worker) {
            this.worker.onmessage = null;
            this.worker.onerror = null;
            this.worker.terminate();
            this.worker = null;
        }
    }
}
