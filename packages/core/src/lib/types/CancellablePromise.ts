export class CancellablePromise<T> {
    private hasCancelled = false;

    private abortController = new AbortController();

    constructor(
        private executor: (
            resolve: (value: T) => void,
            reject: (reason?: any) => void,
        ) => void,
    ) {}

    public execute(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.abortController.signal.onabort = () => {
                reject(new Error('Promise cancelled'));
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

    cancel() {
        this.hasCancelled = true;
        this.abortController.abort();
    }
}
