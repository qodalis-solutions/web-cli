/** Error message used when a `CancellablePromise` is cancelled. */
export const CANCELLATION_ERROR_MESSAGE = 'Promise cancelled';

/**
 * A promise wrapper that supports cooperative cancellation.
 *
 * Create with an executor (like `new Promise`), then call `execute()` to run.
 * Call `cancel()` to reject with a cancellation error and prevent further
 * resolve/reject callbacks from firing.
 *
 * @example
 * ```ts
 * const cp = new CancellablePromise<string>((resolve) => {
 *     setTimeout(() => resolve('done'), 5000);
 * });
 * cp.execute().catch(e => console.log(e.message)); // 'Promise cancelled'
 * cp.cancel();
 * ```
 */
export class CancellablePromise<T> {
    private hasCancelled = false;

    private abortController = new AbortController();

    constructor(
        private executor: (
            resolve: (value: T) => void,
            reject: (reason?: any) => void,
        ) => void,
    ) {}

    /**
     * Run the executor and return a promise for its result.
     * If `cancel()` has been called, the promise rejects immediately.
     */
    public execute(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.abortController.signal.onabort = () => {
                reject(new Error(CANCELLATION_ERROR_MESSAGE));
            };

            this.executor(
                (value) => {
                    if (!this.hasCancelled) {
                        resolve(value);
                    }
                },
                (reason) => {
                    if (!this.hasCancelled) {
                        reject(reason);
                    }
                },
            );
        });
    }

    /**
     * Cancel the promise. The executing promise rejects with
     * `Error('Promise cancelled')` and subsequent resolve/reject calls are ignored.
     */
    cancel() {
        this.hasCancelled = true;
        this.abortController.abort();
    }
}
