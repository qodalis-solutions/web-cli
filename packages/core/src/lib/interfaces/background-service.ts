import {
    ICliManagedInterval,
    ICliManagedTimer,
} from './execution-context';

import type { ICliStateStore, ICliServiceProvider } from '.';

/**
 * Whether a background service is a long-running daemon or a one-shot job.
 */
export type CliBackgroundServiceType = 'daemon' | 'job';

/**
 * Lifecycle status of a background service.
 */
export type CliBackgroundServiceStatus =
    | 'pending'
    | 'running'
    | 'stopped'
    | 'failed'
    | 'done';

/**
 * Where the service code is executing.
 */
export type CliServiceExecutionMode = 'main-thread' | 'worker';

/**
 * An event emitted by a background service.
 * Services control terminal notification visibility by setting `data.notify: true`.
 */
export interface ICliServiceEvent {
    /** Name of the service that emitted this event */
    source: string;
    /** Event type — services define their own, registry emits lifecycle events */
    type: string;
    /** Arbitrary payload */
    data?: unknown;
    /** Set automatically by the registry */
    timestamp?: Date;
}

/**
 * Handler function for service events.
 */
export type CliServiceEventHandler = (event: ICliServiceEvent) => void;

/**
 * A single log entry from a background service.
 */
export interface ICliServiceLogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
}

/**
 * Per-service runtime context.
 * Each background service receives its own context with an independent abort signal
 * and scoped timers (not shared with the full-screen timer set).
 */
export interface ICliServiceContext {
    /** AbortSignal scoped to this service — independent of Ctrl+C */
    signal: AbortSignal;
    /** Emit an event from this service */
    emit(event: ICliServiceEvent): void;
    /** Log a message to this service's private log buffer */
    log(message: string, level?: 'info' | 'warn' | 'error'): void;
    /** Create an interval scoped to this service (auto-cleared on stop) */
    createInterval(callback: () => void, ms: number): ICliManagedInterval;
    /** Create a timeout scoped to this service (auto-cleared on stop) */
    createTimeout(callback: () => void, ms: number): ICliManagedTimer;
    /** Access the shared state store */
    state: ICliStateStore;
    /** Access the shared service container */
    services: ICliServiceProvider;
}

/**
 * A background service that can run as a daemon or job.
 */
export interface ICliBackgroundService {
    /** Unique name for this service */
    name: string;
    /** Human-readable description */
    description?: string;
    /** 'daemon' for long-running, 'job' for run-to-completion */
    type: CliBackgroundServiceType;
    /** Whether this service can run in a Web Worker */
    workerCompatible?: boolean;
    /** Factory that creates the Worker instance (when workerCompatible) */
    workerFactory?: () => Worker;
    /** Called when the service starts */
    onStart(context: ICliServiceContext): Promise<void>;
    /** Called for graceful shutdown */
    onStop?(context: ICliServiceContext): Promise<void>;
    /** Called on unrecoverable error */
    onError?(error: Error, context: ICliServiceContext): void;
}

/**
 * Read-only snapshot of a background service's current state.
 */
export interface ICliBackgroundServiceInfo {
    /** Process ID assigned by the process registry */
    pid?: number;
    name: string;
    description?: string;
    type: CliBackgroundServiceType;
    status: CliBackgroundServiceStatus;
    executionMode: CliServiceExecutionMode;
    startedAt?: Date;
    stoppedAt?: Date;
    error?: string;
    /** Uptime in milliseconds (only when running) */
    uptime?: number;
}

/**
 * Registry that manages background service lifecycle.
 * Exposed on `ICliExecutionContext.backgroundServices`.
 */
export interface ICliBackgroundServiceRegistry {
    register(service: ICliBackgroundService): void;
    start(name: string): Promise<void>;
    stop(name: string): Promise<void>;
    restart(name: string): Promise<void>;
    startJob(
        name: string,
        task: (context: ICliServiceContext) => Promise<void>,
        options?: { workerCompatible?: boolean },
    ): void;
    getStatus(name: string): ICliBackgroundServiceInfo | undefined;
    list(): ICliBackgroundServiceInfo[];
    getLogs(name: string, limit?: number): ICliServiceLogEntry[];
    on(
        handler: CliServiceEventHandler,
        filter?: { source?: string; type?: string },
    ): () => void;
    destroyAll(): Promise<void>;
}
