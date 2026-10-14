import { CliHeadersProvider, resolveHeaders, resolveServerHeaders } from '../models/server';
import type { ICliServerAuthService, ICliServiceProvider } from '../interfaces/services';
import { ICliServerAuthService_TOKEN } from '../interfaces/services';

/**
 * Builds a WebSocket URL that includes authentication credentials from headers
 * as query parameters. Since the browser WebSocket API does not support custom
 * request headers, this allows the host server's auth middleware to validate
 * the connection during the HTTP upgrade handshake.
 *
 * All configured headers are forwarded as query parameters prefixed with
 * `_header_` to avoid collisions with application-level query params.
 *
 * Accepts both static header maps and dynamic provider functions.
 *
 * **Security note:** Query parameters are visible in browser history, server
 * access logs, proxy/CDN logs, and the `Referer` header. Tokens placed in the
 * URL are therefore more exposed than those sent via HTTP headers. This is an
 * inherent limitation of the browser WebSocket API (no custom headers).
 * Server-side middleware that reads `_header_*` params should strip them from
 * logs and avoid forwarding them in redirects.
 *
 * @param wsUrl  The base WebSocket URL (may already contain query parameters)
 * @param headers  The headers provider from CliServerConfig (may include Authorization, etc.)
 * @returns The WebSocket URL with auth credentials appended as query parameters
 */
export function buildAuthenticatedWebSocketUrl(
    wsUrl: string,
    headers?: CliHeadersProvider,
): string {
    const resolved = resolveHeaders(headers);
    if (Object.keys(resolved).length === 0) {
        return wsUrl;
    }

    const separator = wsUrl.includes('?') ? '&' : '?';
    const params = Object.entries(resolved)
        .map(
            ([key, value]) =>
                `_header_${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        )
        .join('&');

    return `${wsUrl}${separator}${params}`;
}

/**
 * Build the WebSocket URL for a configured server. Prefers upgrade params
 * from auth providers (e.g. a single-use ticket from the users module); only
 * when no provider handles the server are headers copied into the URL
 * (legacy behaviour, see {@link buildAuthenticatedWebSocketUrl}).
 */
export async function resolveServerWebSocketUrl(
    services: ICliServiceProvider | undefined,
    serverName: string,
    wsUrl: string,
    configHeaders?: CliHeadersProvider,
): Promise<string> {
    const authService = services?.get<ICliServerAuthService>(ICliServerAuthService_TOKEN);
    const params = await authService?.getWebSocketParams?.(serverName);
    if (params) {
        return appendQueryParams(wsUrl, params);
    }
    return buildAuthenticatedWebSocketUrl(wsUrl, () => resolveServerHeaders(services, serverName, configHeaders));
}

/** Append query params to a URL that may already have some. */
export function appendQueryParams(url: string, params: Record<string, string>): string {
    const entries = Object.entries(params);
    if (!entries.length) return url;
    const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}
