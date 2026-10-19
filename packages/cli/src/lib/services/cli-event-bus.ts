import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
    CliEmitOptions,
    CliEvent,
    CliEventHandler,
    CliEventMap,
    CliEventType,
    CustomEventType,
    ICliEventBus,
} from '@qodalis/cli-core';

/** How many recent events the bus keeps in memory. */
export const CLI_EVENT_HISTORY_SIZE = 200;

/**
 * Whether `type` matches `pattern`: `*` matches everything, `ns:*` every
 * type in namespace `ns` (at any depth), anything else must be equal.
 */
export function matchesEventPattern(type: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith(':*')) {
        return type.startsWith(pattern.slice(0, -1));
    }
    return type === pattern;
}

/**
 * In-memory publish/subscribe bus of one terminal. Handlers run
 * synchronously in subscription order; a throwing handler is reported to
 * `onHandlerError` and does not stop delivery. Keeps the last
 * {@link CLI_EVENT_HISTORY_SIZE} events; nothing is persisted.
 */
export class CliEventBus implements ICliEventBus {
    private readonly subject = new Subject<CliEvent>();
    private readonly recent: CliEvent[] = [];
    private disposed = false;

    constructor(
        private readonly onHandlerError: (
            error: unknown,
            event: CliEvent,
        ) => void = (error) =>
            console.error('[CLI] Event handler failed:', error),
        private readonly historySize = CLI_EVENT_HISTORY_SIZE,
    ) {}

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
    emit(type: string, data?: unknown, options?: CliEmitOptions): void {
        if (this.disposed) return;
        const event: CliEvent = {
            type,
            data,
            source: options?.source,
            timestamp: Date.now(),
        };
        this.recent.push(event);
        if (this.recent.length > this.historySize) {
            this.recent.shift();
        }
        this.subject.next(event);
    }

    on<K extends CliEventType>(
        pattern: K,
        handler: CliEventHandler<CliEventMap[K]>,
    ): () => void;
    on<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;
    on(pattern: string, handler: CliEventHandler<any>): () => void {
        const subscription = this.events$(pattern).subscribe((event) => {
            try {
                handler(event);
            } catch (error) {
                this.onHandlerError(error, event);
            }
        });
        return () => subscription.unsubscribe();
    }

    once<K extends CliEventType>(
        pattern: K,
        handler: CliEventHandler<CliEventMap[K]>,
    ): () => void;
    once<T = unknown>(pattern: string, handler: CliEventHandler<T>): () => void;
    once(pattern: string, handler: CliEventHandler<any>): () => void {
        let done = false;
        const unsubscribe = this.on(pattern, (event) => {
            if (done) return;
            done = true;
            unsubscribe();
            handler(event);
        });
        return unsubscribe;
    }

    events$<K extends CliEventType>(
        pattern: K,
    ): Observable<CliEvent<CliEventMap[K]>>;
    events$<T = unknown>(pattern?: string): Observable<CliEvent<T>>;
    events$(pattern = '*'): Observable<CliEvent> {
        return this.subject
            .asObservable()
            .pipe(filter((event) => matchesEventPattern(event.type, pattern)));
    }

    history<K extends CliEventType>(
        pattern: K,
        limit?: number,
    ): CliEvent<CliEventMap[K]>[];
    history<T = unknown>(pattern?: string, limit?: number): CliEvent<T>[];
    history(pattern = '*', limit?: number): CliEvent[] {
        const matching = this.recent.filter((event) =>
            matchesEventPattern(event.type, pattern),
        );
        return limit !== undefined ? matching.slice(-limit) : matching;
    }

    /** Stop delivering events and complete all observables. */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.subject.complete();
        this.recent.length = 0;
    }
}
