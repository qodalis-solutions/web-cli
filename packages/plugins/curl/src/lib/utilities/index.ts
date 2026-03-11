export interface CurlRequestOptions {
    method: string;
    headers: Record<string, string>;
    body?: string;
    followRedirects: boolean;
}

export interface CurlResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    timing: number;
    url: string;
    redirected: boolean;
}

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function inferMethod(explicitMethod?: string, hasBody?: boolean): string {
    if (explicitMethod) {
        const upper = explicitMethod.toUpperCase();
        if (!VALID_METHODS.includes(upper)) {
            throw new Error(`Invalid HTTP method: ${explicitMethod}. Valid methods: ${VALID_METHODS.join(', ')}`);
        }
        return upper;
    }
    return hasBody ? 'POST' : 'GET';
}

export function parseHeaders(headerArgs: string | string[] | undefined): Record<string, string> {
    if (!headerArgs) return {};
    const arr = Array.isArray(headerArgs) ? headerArgs : [headerArgs];
    const result: Record<string, string> = {};
    for (const header of arr) {
        const colonIndex = header.indexOf(':');
        if (colonIndex === -1) continue;
        const key = header.substring(0, colonIndex).trim();
        const value = header.substring(colonIndex + 1).trim();
        if (key) result[key] = value;
    }
    return result;
}

export function resolveBody(data?: string, dataRaw?: string): string | undefined {
    if (dataRaw != null) return dataRaw;
    if (data == null) return undefined;
    try {
        return JSON.stringify(JSON.parse(data));
    } catch {
        return data;
    }
}

export function isJsonBody(body?: string): boolean {
    if (!body) return false;
    try {
        JSON.parse(body);
        return true;
    } catch {
        return false;
    }
}

export function buildFetchOptions(options: CurlRequestOptions): RequestInit {
    const headers = { ...options.headers };

    if (options.body && !headers['Content-Type'] && isJsonBody(options.body)) {
        headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
        method: options.method,
        headers,
    };

    if (options.body && options.method !== 'GET' && options.method !== 'HEAD') {
        init.body = options.body;
    }

    if (!options.followRedirects) {
        init.redirect = 'manual';
    }

    return init;
}

export function formatResponseBody(body: string, pretty: boolean): string {
    if (!pretty) return body;
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

export function rewriteUrlToProxy(originalUrl: string): string {
    const match = originalUrl.match(/^(https?):\/\/([^\/]+)(\/.*)?$/i);
    if (!match) {
        throw new Error(`Invalid URL: ${originalUrl}`);
    }
    const scheme = match[1];
    const domain = match[2];
    const path = match[3] || '/';
    return `https://proxy.qodalis.com/proxy/${scheme}/${domain}${path}`;
}

export function buildCurlEquivalent(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
): string {
    const parts = ['curl'];
    if (method !== 'GET') {
        parts.push(`-X ${method}`);
    }
    for (const [key, value] of Object.entries(headers)) {
        parts.push(`-H '${key}: ${value}'`);
    }
    if (body) {
        parts.push(`-d '${body}'`);
    }
    parts.push(`'${url}'`);
    return parts.join(' ');
}

export function extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });
    return headers;
}
