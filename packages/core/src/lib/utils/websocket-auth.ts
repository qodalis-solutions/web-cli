import { CliHeadersProvider, resolveHeaders, resolveServerHeaders } from '../models/server';
import type { ICliServerAuthService, ICliServiceProvider } from '../interfaces/services';
import { ICliServerAuthService_TOKEN } from '../interfaces/services';

/**
 * Copies headers into a WebSocket URL as `_header_<name>` query params.
 *
 * **Unsafe:** query parameters are visible in browser history and in server,
 * proxy and CDN access logs. Used only for servers configured with
 * `unsafeHeadersInWebSocketUrl: true`; everything else goes through
 * {@link buildServerWebSocketUrl}, which keeps headers out of the URL.
 *
 * @param wsUrl  The base WebSocket URL (may already contain query parameters)
 * @param headers  The headers provider from CliServerConfig (may include Authorization, etc.)
 * @returns The WebSocket URL with the headers appended as query parameters
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

/** Options for {@link buildServerWebSocketUrl} and {@link resolveServerWebSocketUrl}. */
export interface CliWebSocketAuthOptions {
    /** See `CliServerConfig.unsafeHeadersInWebSocketUrl` */
    unsafeHeadersInWebSocketUrl?: boolean;
}

/** Ticket endpoint of the users plugin, relative to the server root */
export const CLI_WS_TICKET_PATH = '/api/v1/qcli/sessions/ws-ticket';

/** Servers already warned about, so each warns once per page */
const warnedServers = new Set<string>();

/**
 * Authenticates a WebSocket URL with headers without putting them in it:
 * fetches a single-use ticket from `POST /api/v1/qcli/sessions/ws-ticket`
 * with the headers and appends `?ticket=`. When no ticket can be had, the
 * socket connects without credentials and a warning is logged once.
 * Headers are copied into the URL only with `unsafeHeadersInWebSocketUrl`.
 */
export async function buildServerWebSocketUrl(
    wsUrl: string,
    headers?: CliHeadersProvider,
    options?: CliWebSocketAuthOptions,
): Promise<string> {
    const resolved = resolveHeaders(headers);
    if (Object.keys(resolved).length === 0) {
        return wsUrl;
    }
    if (options?.unsafeHeadersInWebSocketUrl) {
        return buildAuthenticatedWebSocketUrl(wsUrl, resolved);
    }

    const httpBase = toHttpBaseUrl(wsUrl);
    const ticket = await fetchWebSocketTicket(httpBase, resolved);
    if (ticket) {
        return appendQueryParams(wsUrl, { ticket });
    }

    if (!warnedServers.has(httpBase)) {
        warnedServers.add(httpBase);
        console.warn(
            `[qodalis-cli] ${httpBase} issued no WebSocket ticket (${CLI_WS_TICKET_PATH}), ` +
                'so its sockets connect without credentials. Configured headers are never copied ' +
                'into WebSocket URLs; enable the users plugin on the server, or set ' +
                '`unsafeHeadersInWebSocketUrl: true` on the server config to keep the old behaviour.',
        );
    }
    return wsUrl;
}

/**
 * Build the WebSocket URL for a configured server. Prefers upgrade params
 * from auth providers (e.g. a single-use ticket from the users module);
 * otherwise authenticates with the server's headers through
 * {@link buildServerWebSocketUrl}.
 */
export async function resolveServerWebSocketUrl(
    services: ICliServiceProvider | undefined,
    serverName: string,
    wsUrl: string,
    configHeaders?: CliHeadersProvider,
    options?: CliWebSocketAuthOptions,
): Promise<string> {
    const authService = services?.get<ICliServerAuthService>(ICliServerAuthService_TOKEN);
    const params = await authService?.getWebSocketParams?.(serverName);
    if (params) {
        return appendQueryParams(wsUrl, params);
    }
    return buildServerWebSocketUrl(
        wsUrl,
        () => resolveServerHeaders(services, serverName, configHeaders),
        options,
    );
}

/** `ws://host/base/ws/v1/qcli/events?x` -> `http://host/base` */
function toHttpBaseUrl(wsUrl: string): string {
    const url = new URL(wsUrl);
    const wsSegment = url.pathname.indexOf('/ws/');
    const basePath = wsSegment >= 0 ? url.pathname.slice(0, wsSegment) : '';
    const protocol = url.protocol === 'wss:' || url.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${url.host}${basePath}`;
}

async function fetchWebSocketTicket(
    httpBase: string,
    headers: Record<string, string>,
): Promise<string | undefined> {
    try {
        const response = await fetch(`${httpBase}${CLI_WS_TICKET_PATH}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: '{}',
        });
        if (!response.ok) return undefined;
        const body = await response.json();
        return typeof body?.ticket === 'string' && body.ticket ? body.ticket : undefined;
    } catch {
        return undefined;
    }
}

/** Append query params to a URL that may already have some. */
export function appendQueryParams(url: string, params: Record<string, string>): string {
    const entries = Object.entries(params);
    if (!entries.length) return url;
    const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${url}${url.includes('?') ? '&' : '?'}${query}`;
}
