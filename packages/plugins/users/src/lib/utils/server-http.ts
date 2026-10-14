import { ICliHttpClient, CliHttpError } from '@qodalis/cli-core';

/**
 * Options for `withUnauthorizedHandler`.
 */
export interface CliUnauthorizedHandlerOptions {
    /**
     * Called when a request fails with HTTP 401. The error is re-thrown
     * after the handler runs so callers still see the failure.
     */
    onUnauthorized: (error: CliHttpError) => void | Promise<void>;
    /**
     * Returns `true` when a request to this URL should NOT trigger the
     * handler (for example the login endpoint, where 401 just means
     * "wrong credentials" rather than "session expired").
     */
    ignore?: (url: string) => boolean;
}

/**
 * Returns `true` when the error is an HTTP 401 response.
 */
export function isUnauthorizedError(error: unknown): error is CliHttpError {
    return (
        error instanceof CliHttpError && error.status === 401
    ) || (
        !!error &&
        typeof error === 'object' &&
        (error as { status?: unknown }).status === 401
    );
}

/**
 * Wraps an `ICliHttpClient` so that any JSON request answered with
 * HTTP 401 triggers `onUnauthorized` before the error propagates.
 *
 * Used by the users module in server mode to drop a stored session token
 * as soon as the server reports it expired or revoked.
 */
export function withUnauthorizedHandler(
    http: ICliHttpClient,
    options: CliUnauthorizedHandlerOptions,
): ICliHttpClient {
    const guard = async <T>(url: string, run: () => Promise<T>): Promise<T> => {
        try {
            return await run();
        } catch (error) {
            if (isUnauthorizedError(error) && !options.ignore?.(url)) {
                await options.onUnauthorized(error as CliHttpError);
            }
            throw error;
        }
    };

    return {
        fetch: (url, init) => http.fetch(url, init),
        head: (url, opts) => http.head(url, opts),
        get: (url, opts) => guard(url, () => http.get(url, opts)),
        post: (url, body, opts) => guard(url, () => http.post(url, body, opts)),
        put: (url, body, opts) => guard(url, () => http.put(url, body, opts)),
        patch: (url, body, opts) => guard(url, () => http.patch(url, body, opts)),
        delete: (url, opts) => guard(url, () => http.delete(url, opts)),
        options: (url, opts) => guard(url, () => http.options(url, opts)),
    };
}
