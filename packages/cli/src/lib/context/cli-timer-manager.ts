import { ICliManagedTimer, ICliManagedInterval } from '@qodalis/cli-core';

/**
 * Manages timers and intervals with automatic cleanup.
 * All managed timers are cleared when the execution context is disposed.
 */
export class CliTimerManager {
    private readonly managedTimers = new Set<{ clear(): void }>();

    /**
     * Create a managed interval that will be automatically cleared on dispose.
     */
    createInterval(callback: () => void, ms: number): ICliManagedInterval {
        let timerId = setInterval(callback, ms);

        const handle: ICliManagedInterval = {
            clear: () => {
                clearInterval(timerId);
                this.managedTimers.delete(handle);
            },
            setDelay: (newMs: number) => {
                clearInterval(timerId);
                timerId = setInterval(callback, newMs);
            },
        };

        this.managedTimers.add(handle);
        return handle;
    }

    /**
     * Create a managed timeout that will be automatically cleared on dispose.
     */
    createTimeout(callback: () => void, ms: number): ICliManagedTimer {
        const timerId = setTimeout(() => {
            this.managedTimers.delete(handle);
            callback();
        }, ms);

        const handle: ICliManagedTimer = {
            clear: () => {
                clearTimeout(timerId);
                this.managedTimers.delete(handle);
            },
        };

        this.managedTimers.add(handle);
        return handle;
    }

    /**
     * Clear all managed timers and intervals.
     */
    clearAll(): void {
        for (const timer of this.managedTimers) {
            timer.clear();
        }
        this.managedTimers.clear();
    }
}
