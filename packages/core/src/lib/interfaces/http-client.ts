/**
 * Options for HTTP client requests.
 * Extends standard RequestInit with convenience fields.
 */
export interface CliHttpRequestOptions extends Omit<RequestInit, 'method' | 'body'> {
    /**
     * Request timeout in milliseconds. When set, the request is automatically
     * aborted after this duration. Combines with any existing abort signal.
     */
    timeout?: number;
}

/**
 * HTTP client for making requests from command processors.
 *
 * Automatically merges the command's abort signal so that requests are
 * cancelled when the user presses Ctrl+C. Provides typed convenience
 * methods for common HTTP verbs as well as a raw `fetch()` for cases
 * that need full Response access (streaming, progress, etc.).
 *
 * Available on the execution context as `context.http`.
 *
 * @example
 * ```ts
 * // Typed JSON response
 * const users = await context.http.get<User[]>('https://api.example.com/users');
 *
 * // POST with body
 * await context.http.post('https://api.example.com/users', { name: 'John' });
 *
 * // Raw fetch for streaming
 * const response = await context.http.fetch('https://example.com/file.zip');
 * const reader = response.body?.getReader();
 * ```
 */
export interface ICliHttpClient {
    /**
     * Make a raw HTTP request. Returns the full Response object for cases
     * that need streaming, headers, or status inspection.
     * The command's abort signal is automatically merged.
     */
    fetch(url: string, init?: RequestInit): Promise<Response>;

    /**
     * HTTP GET request. Returns the parsed JSON response body.
     */
    get<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;

    /**
     * HTTP POST request. Automatically serializes the body as JSON
     * (unless body is FormData, Blob, string, or ArrayBuffer).
     * Returns the parsed JSON response body.
     */
    post<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;

    /**
     * HTTP PUT request. Automatically serializes the body as JSON.
     * Returns the parsed JSON response body.
     */
    put<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;

    /**
     * HTTP PATCH request. Automatically serializes the body as JSON.
     * Returns the parsed JSON response body.
     */
    patch<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T>;

    /**
     * HTTP DELETE request. Returns the parsed JSON response body (if any).
     */
    delete<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;

    /**
     * HTTP HEAD request. Returns the full Response (no body parsing).
     */
    head(url: string, options?: CliHttpRequestOptions): Promise<Response>;

    /**
     * HTTP OPTIONS request. Returns the parsed JSON response body.
     */
    options<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T>;
}
