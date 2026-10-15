import { ICliHttpClient, CliHttpError, CliHttpRequestOptions } from '@qodalis/cli-core';

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
     * Returns `true` when this request should NOT trigger the handler
     * (for example the login request, where 401 just means "wrong
     * credentials" rather than "session expired"). `options` are the
     * request options (e.g. to inspect which token the request carried).
     */
    ignore?: (url: string, method: string, options?: CliHttpRequestOptions) => boolean;
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
    const guard = async <T>(
        method: string,
        url: string,
        run: () => Promise<T>,
        requestOptions?: CliHttpRequestOptions,
    ): Promise<T> => {
        try {
            return await run();
        } catch (error) {
            if (isUnauthorizedError(error) && !options.ignore?.(url, method, requestOptions)) {
                await options.onUnauthorized(error as CliHttpError);
            }
            throw error;
        }
    };

    return {
        fetch: (url, init) => http.fetch(url, init),
        head: (url, opts) => http.head(url, opts),
        get: (url, opts) => guard('GET', url, () => http.get(url, opts), opts),
        post: (url, body, opts) => guard('POST', url, () => http.post(url, body, opts), opts),
        put: (url, body, opts) => guard('PUT', url, () => http.put(url, body, opts), opts),
        patch: (url, body, opts) => guard('PATCH', url, () => http.patch(url, body, opts), opts),
        delete: (url, opts) => guard('DELETE', url, () => http.delete(url, opts), opts),
        options: (url, opts) => guard('OPTIONS', url, () => http.options(url, opts), opts),
    };
}
