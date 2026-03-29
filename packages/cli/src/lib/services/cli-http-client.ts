import { ICliHttpClient, CliHttpRequestOptions } from '@qodalis/cli-core';

/**
 * Default HTTP client implementation.
 *
 * Wraps the global `fetch()` and automatically merges an abort signal
 * so that in-flight requests are cancelled when the user presses Ctrl+C.
 *
 * Created per-command by the executor — each instance is bound to the
 * command's own AbortSignal.
 */
export class CliHttpClient implements ICliHttpClient {
    constructor(private readonly signal?: AbortSignal) {}

    async fetch(url: string, init?: RequestInit): Promise<Response> {
        return fetch(url, {
            ...init,
            signal: this.mergeSignal(init?.signal),
        });
    }

    async get<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('GET', url, undefined, options);
    }

    async post<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('POST', url, body, options);
    }

    async put<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('PUT', url, body, options);
    }

    async patch<T = any>(url: string, body?: any, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('PATCH', url, body, options);
    }

    async delete<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('DELETE', url, undefined, options);
    }

    async head(url: string, options?: CliHttpRequestOptions): Promise<Response> {
        const { timeout, signal: callerSignal, ...fetchOptions } = options ?? {};
        let timeoutController: AbortController | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        if (timeout) {
            timeoutController = new AbortController();
            timeoutId = setTimeout(() => timeoutController!.abort(), timeout);
        }
        try {
            return await fetch(url, {
                ...fetchOptions,
                method: 'HEAD',
                signal: this.mergeSignal(callerSignal, timeoutController?.signal),
            });
        } finally {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
        }
    }

    async options<T = any>(url: string, options?: CliHttpRequestOptions): Promise<T> {
        return this.jsonRequest<T>('OPTIONS', url, undefined, options);
    }

    // ── Internals ────────────────────────────────────────────────────

    private async jsonRequest<T>(
        method: string,
        url: string,
        body: any,
        options?: CliHttpRequestOptions,
    ): Promise<T> {
        const { timeout, ...fetchOptions } = options ?? {};

        const headers: Record<string, string> = {
            ...((fetchOptions.headers as Record<string, string>) ?? {}),
        };

        let resolvedBody: BodyInit | undefined;
        if (body !== undefined && body !== null) {
            if (this.isRawBody(body)) {
                resolvedBody = body;
            } else {
                resolvedBody = JSON.stringify(body);
                if (!headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
            }
        }

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let timeoutController: AbortController | undefined;

        if (timeout) {
            timeoutController = new AbortController();
            timeoutId = setTimeout(() => timeoutController!.abort(), timeout);
        }

        const signal = this.mergeSignal(
            fetchOptions.signal,
            timeoutController?.signal,
        );

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                method,
                headers,
                body: resolvedBody,
                signal,
            });

            if (!response.ok) {
                let errorMessage = `${response.status} ${response.statusText}`;
                try {
                    const errorBody = await response.json();
                    if (errorBody.error) {
                        errorMessage = errorBody.error;
                    } else if (errorBody.message) {
                        errorMessage = errorBody.message;
                    }
                } catch {
                    // use default error message
                }
                throw new Error(errorMessage);
            }

            const text = await response.text();
            if (!text) {
                return undefined as T;
            }
            return JSON.parse(text) as T;
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }

    private isRawBody(body: any): body is BodyInit {
        return (
            typeof body === 'string' ||
            body instanceof FormData ||
            body instanceof Blob ||
            body instanceof ArrayBuffer ||
            body instanceof URLSearchParams ||
            body instanceof ReadableStream
        );
    }

    /**
     * Merge the command signal with any additional signals (caller, timeout).
     * Uses AbortSignal.any() when available, falls back to a manual composite
     * controller for older browsers (pre-Chrome 116 / Safari 17.4).
     */
    private mergeSignal(...additional: (AbortSignal | undefined | null)[]): AbortSignal | undefined {
        const signals: AbortSignal[] = [];
        if (this.signal) signals.push(this.signal);
        for (const s of additional) {
            if (s) signals.push(s);
        }
        if (signals.length === 0) return undefined;
        if (signals.length === 1) return signals[0];

        if (typeof AbortSignal.any === 'function') {
            return AbortSignal.any(signals);
        }

        // Fallback for older browsers
        const controller = new AbortController();
        for (const s of signals) {
            if (s.aborted) {
                controller.abort(s.reason);
                return controller.signal;
            }
            s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
        }
        return controller.signal;
    }
}
