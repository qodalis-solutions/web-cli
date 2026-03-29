import { CliHeadersProvider, resolveHeaders } from '../models/server';

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
