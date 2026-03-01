import {
    CliWorkerInboundMessage,
    CliWorkerOutboundMessage,
} from '../interfaces/worker-protocol';
import { ICliServiceEvent } from '../interfaces/background-service';
import { ICliManagedInterval, ICliManagedTimer } from '../interfaces/execution-context';

/**
 * Context provided to worker service handlers inside a Web Worker.
 */
export interface WorkerServiceContext {
    /** Emit an event to the main thread */
    emit(event: Omit<ICliServiceEvent, 'timestamp'>): void;
    /** Log a message (forwarded to the main-thread log buffer) */
    log(message: string, level?: 'info' | 'warn' | 'error'): void;
    /** Update state on the main thread */
    updateState(patch: Record<string, unknown>): void;
    /** Create an interval that is auto-cleared on stop */
    createInterval(callback: () => void, ms: number): ICliManagedInterval;
    /** Create a timeout that is auto-cleared on stop */
    createTimeout(callback: () => void, ms: number): ICliManagedTimer;
    /** AbortSignal scoped to this service */
    signal: AbortSignal;
}

/**
 * Lightweight helper for authoring worker-compatible background services.
 * Call this at the top level of your worker script.
 */
export function createWorkerService(handlers: {
    onStart(ctx: WorkerServiceContext): Promise<void>;
    onStop?(): Promise<void>;
}): void {
    const abortController = new AbortController();
    const timers = new Set<{ clear(): void }>();

    function post(msg: CliWorkerOutboundMessage): void {
        (self as unknown as { postMessage(msg: unknown): void }).postMessage(msg);
    }

    const ctx: WorkerServiceContext = {
        signal: abortController.signal,

        emit(event) {
            post({ type: 'event', event });
        },

        log(message, level = 'info') {
            post({ type: 'log', level, message });
        },

        updateState(patch) {
            post({ type: 'state-update', patch });
        },

        createInterval(callback, ms) {
            let timerId = setInterval(callback, ms);
            const handle: ICliManagedInterval = {
                clear() {
                    clearInterval(timerId);
                    timers.delete(handle);
                },
                setDelay(newMs) {
                    clearInterval(timerId);
                    timerId = setInterval(callback, newMs);
                },
            };
            timers.add(handle);
            return handle;
        },

        createTimeout(callback, ms) {
            const timerId = setTimeout(() => {
                timers.delete(handle);
                callback();
            }, ms);
            const handle: ICliManagedTimer = {
                clear() {
                    clearTimeout(timerId);
                    timers.delete(handle);
                },
            };
            timers.add(handle);
            return handle;
        },
    };

    function clearAllTimers(): void {
        for (const timer of timers) {
            timer.clear();
        }
        timers.clear();
    }

    (self as unknown as { onmessage: ((ev: MessageEvent) => void) | null }).onmessage =
        async (ev: MessageEvent<CliWorkerInboundMessage>) => {
            const msg = ev.data;

            switch (msg.type) {
                case 'start':
                    try {
                        post({ type: 'status', status: 'running' });
                        await handlers.onStart(ctx);
                    } catch (e) {
                        const error = e instanceof Error ? e : new Error(String(e));
                        post({ type: 'error', message: error.message, stack: error.stack });
                    }
                    break;

                case 'stop':
                    clearAllTimers();
                    abortController.abort();
                    if (handlers.onStop) {
                        await handlers.onStop();
                    }
                    post({ type: 'status', status: 'stopped' });
                    break;

                case 'abort':
                    clearAllTimers();
                    abortController.abort();
                    post({ type: 'status', status: 'stopped' });
                    break;
            }
        };
}
