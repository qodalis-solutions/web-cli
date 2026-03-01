import { CliBackgroundServiceStatus, ICliServiceEvent } from './background-service';

/**
 * Messages sent from the main thread to a background service Worker.
 */
export type CliWorkerInboundMessage =
    | { type: 'start'; config?: Record<string, unknown> }
    | { type: 'stop' }
    | { type: 'abort' };

/**
 * Messages sent from a background service Worker to the main thread.
 */
export type CliWorkerOutboundMessage =
    | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
    | { type: 'event'; event: Omit<ICliServiceEvent, 'timestamp'> }
    | { type: 'state-update'; patch: Record<string, unknown> }
    | { type: 'status'; status: CliBackgroundServiceStatus }
    | { type: 'error'; message: string; stack?: string };
