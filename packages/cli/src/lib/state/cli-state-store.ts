import {
    CliState,
    ICliServiceProvider,
    ICliKeyValueStore,
    ICliStateStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

export class CliStateStore implements ICliStateStore {
    private state$: BehaviorSubject<CliState>;

    private storageKey: string;

    constructor(
        private readonly services: ICliServiceProvider,
        public readonly name: string,
        private readonly initialState: CliState,
    ) {
        this.state$ = new BehaviorSubject<CliState>(initialState);

        this.storageKey = `store-state-${name}`;
    }

    getState<T extends CliState = CliState>(): T {
        return this.state$.getValue() as T;
    }

    updateState(newState: Partial<CliState>): void {
        this.state$.next({ ...this.getState(), ...newState });
    }

    select<K>(selector: (state: CliState) => K): Observable<K> {
        return this.state$.asObservable().pipe(
            map(selector),
            distinctUntilChanged(), // Emit only when the selected value changes
        );
    }

    subscribe(callback: (state: CliState) => void): Subscription {
        return this.state$.asObservable().subscribe(callback);
    }

    reset(): void {
        this.state$.next(this.initialState);
    }

    async persist(): Promise<void> {
        const keyValueStore = this.services.get<ICliKeyValueStore>(
            'cli-key-value-store',
        );

        await keyValueStore.set(this.storageKey, this.getState());
    }

    async initialize(): Promise<void> {
        try {
            const keyValueStore = this.services.get<ICliKeyValueStore>(
                'cli-key-value-store',
            );

            const state = await keyValueStore.get<CliState>(this.storageKey);

            if (state) {
                this.state$.next(state);
            }
        } catch (e) {
            console.error(
                `CliStateStore: Failed to load state for "${this.name}":`,
                e,
            );
        }
    }
}
