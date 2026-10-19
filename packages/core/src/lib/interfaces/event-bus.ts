import { Observable } from 'rxjs';

/**
 * One event on the CLI event bus.
 */
export interface CliEvent<T = unknown> {
    /** Namespaced type, e.g. `package:installed` or `todo:added`. */
    type: string;
    /** Event payload. */
    data: T;
    /** Who emitted it (module or command name), when known. */
    source?: string;
    /** When it was emitted (ms since epoch). */
    timestamp: number;
}

export type CliEventHandler<T = unknown> = (event: CliEvent<T>) => void;

/**
 * Payload types of the known events, keyed by event type. The built-in
 * events are listed here; plugins add their own with declaration merging:
 *
 * ```ts
 * declare module '@qodalis/cli-core' {
 *     interface CliEventMap {
 *         'todo:added': { id: number; text: string };
 *     }
 * }
 * ```
 *
 * Events not listed can still be emitted and received; their payload is
 * then `unknown`.
 */
export interface CliEventMap {
    /** Boot finished: modules are set up and the terminal accepts input. */
    'boot:completed': { durationMs: number; modules: number; commands: number };

    /** A command line finished running (typed, or run with `engine.execute`). */
    'command:executed': {
        command: string;
        exitCode: number;
        durationMs: number;
    };

    /** A module (plugin) was booted, at startup or later (e.g. `pkg add`). */
    'module:loaded': { name: string; version?: string; commands: number };
    /** A module was unloaded (e.g. `pkg remove`, or before `pkg update`). */
    'module:unloaded': { name: string };

    /** `pkg add` installed a package. */
    'package:installed': { name: string; version: string };
    /** `pkg update` changed a package's version. */
    'package:updated': {
        name: string;
        version: string;
        previousVersion: string;
    };
    /** `pkg remove` removed a package. */
    'package:removed': { name: string; version: string };

    /** A server connected (at boot, or after a reconnect). */
    'server:connected': {
        name: string;
        url: string;
        commands: number;
        reconnected: boolean;
    };
    /** A server could not be reached at boot. */
    'server:unavailable': { name: string; url: string };
    /** A connected server went away. */
    'server:disconnected': { name: string };
    /** An event pushed by a server over its event socket. */
    'server:event': { server: string; type: string; data: unknown };

    /** Background service lifecycle (`service:registered`, `service:started`, ...). */
    'service:registered': { name: string; [key: string]: unknown };
    'service:started': { name: string; [key: string]: unknown };
    'service:stopped': { name: string; [key: string]: unknown };
    'service:completed': { name: string; [key: string]: unknown };
    'service:failed': { name: string; error?: string; [key: string]: unknown };
    'service:status': { name: string; [key: string]: unknown };
    /** A custom event emitted by a background service with `context.emit()`. */
    'service:event': { service: string; type: string; data: unknown };

    /** A setting changed with `configure` (`category` is `system` or a plugin key). */
    'config:changed': { category: string; key: string; value: unknown };
    /** A configuration category was reset to its defaults. */
    'config:reset': { category: string };

    /** The signed-in user changed (sign-in, sign-out, `su`). */
    'session:changed': { user?: string };
}

/** Event types with a known payload. */
export type CliEventType = keyof CliEventMap;

/** Payload of event `K`: from {@link CliEventMap}, or `unknown`. */
export type CliEventData<K extends string> = K extends CliEventType
    ? CliEventMap[K]
    : unknown;

/**
 * Publish/subscribe bus shared by the system, modules and commands of one
 * terminal. Handlers run synchronously in subscription order; a failing
 * handler is logged and does not affect the others or the emitter.
 *
 * Patterns: an exact type (`package:installed`), a namespace wildcard
 * (`package:*`) or `*` for everything.
 *
 * Events live in memory: each terminal has its own bus for its lifetime,
 * with a short recent history, and nothing is persisted.
 *
 * Get it from a command or module with `context.events`, or from the
 * services container with {@link ICliEventBus_TOKEN}.
 */
export interface ICliEventBus {
    /**
     * Emit an event to every matching handler.
     *
     * ```ts
     * bus.emit('package:installed', { name, version }); // checked against CliEventMap
     * bus.emit<TodoAdded>('todo:added', { id, text });   // explicit payload type
     * bus.emit('todo:refresh');                          // custom event, no payload
     * ```
     */
    emit<K extends CliEventType>(
        type: K,
        data: CliEventMap[K],
        options?: CliEmitOptions,
    ): void;
    emit<T = unknown, K extends string = string>(
        type: K & CustomEventType<K>,
        data?: T,
        options?: CliEmitOptions,
    ): void;

    /**
     * Handle events matching `pattern`. Returns a function that unsubscribes.
     *
     * ```ts
     * bus.on('package:installed', (e) => e.data.version); // typed from CliEventMap
     * bus.on<TodoAdded>('todo:added', (e) => e.data.text); // explicit payload type
     * bus.on('server:*', (e) => console.log(e.type));      // anonymous: data is unknown
     * ```
     */
    on<K extends CliEventType>(
        pattern: K,
        handler: CliEventHandler<CliEventMap[K]>,
    ): () => void;
    on<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;

    /** Like `on`, but only for the next matching event. */
    once<K extends CliEventType>(
        pattern: K,
        handler: CliEventHandler<CliEventMap[K]>,
    ): () => void;
    once<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;

    /**
     * Recent events matching `pattern`, oldest first. The bus keeps the last
     * events in memory only: events are not persisted across reloads (state
     * that must survive a reload belongs in a state store).
     */
    history<K extends CliEventType>(
        pattern: K,
        limit?: number,
    ): CliEvent<CliEventMap[K]>[];
    history<T = unknown>(pattern?: string, limit?: number): CliEvent<T>[];

    /** Matching events as an observable (completes when the bus is disposed). */
    events$<K extends CliEventType>(
        pattern: K,
    ): Observable<CliEvent<CliEventMap[K]>>;
    events$<T = unknown>(pattern?: string): Observable<CliEvent<T>>;
}

export interface CliEmitOptions {
    /** Who emits the event (module or command name). */
    source?: string;
}

/**
 * A type that is not a key of {@link CliEventMap}. Keeps `emit` from accepting
 * a known event with an unchecked payload.
 */
export type CustomEventType<K extends string> = K extends CliEventType
    ? never
    : K;

/** Service token of the terminal's {@link ICliEventBus}. */
export const ICliEventBus_TOKEN = 'cli-event-bus';
