import {
    CliOptions,
    CliServerConfig,
    ICliKeyValueStore,
    ICliSecretStore,
} from '@qodalis/cli-core';

// Servers the user links from the terminal (`server add`); spec:
// docs/superpowers/specs/2026-11-12-server-linking-design.md

/** A server linked with `server add` (its token is kept apart, in the secret store). */
export interface CliLinkedServer {
    name: string;
    url: string;
    /** Epoch milliseconds. */
    addedAt: number;
}

const SERVERS_KEY = 'qcli-linked-servers';
const tokenKey = (name: string) => `server-token:${name.toLowerCase()}`;

/** Server names: a letter or digit, then letters, digits, `-` and `_` (at most 32). */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

/** `https://` added when no scheme is given; trailing slashes dropped. Null for anything but http(s). */
export function normalizeServerUrl(input: string): string | null {
    const value = input.trim();
    if (!value) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    try {
        const url = new URL(withScheme);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (!url.hostname || url.username || url.password) return null;
        return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
        return null;
    }
}

/** Loopback, private (RFC 1918, link-local, ULA) or `.local` host names: http is allowed for them. */
export function isPrivateHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
    if (host.includes(':')) {
        // IPv6: loopback, unique local (fc00::/7), link-local (fe80::/10)
        return host === '::1' || /^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host);
    }
    const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!ip) return false;
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** What `server add` must check about a URL before using it. */
export interface CliServerUrlCheck {
    url: string;
    /** http to a private host: allowed after a confirmation. */
    insecure: boolean;
    /** An http server from an https page: the browser blocks the requests. */
    mixedContent: boolean;
}

/**
 * Normalises and checks a server URL: https anywhere, http only to private
 * hosts. Returns the reason as a string when refused.
 */
export function checkServerUrl(input: string, pageProtocol?: string): CliServerUrlCheck | string {
    const url = normalizeServerUrl(input);
    if (!url) return 'Not a valid http(s) URL';
    const { protocol, hostname } = new URL(url);
    if (protocol === 'http:' && !isPrivateHost(hostname)) {
        return 'Only https servers can be linked (http is accepted for localhost and private addresses)';
    }
    return {
        url,
        insecure: protocol === 'http:',
        mixedContent: protocol === 'http:' && pageProtocol === 'https:',
    };
}

/** Whether host options allow linking this URL (`userServers`). */
export function userServersAllow(options: CliOptions | undefined, url: string): boolean {
    const policy = options?.userServers;
    if (policy === false) return false;
    if (policy === undefined || policy === true) return true;
    const origin = new URL(url).origin.toLowerCase();
    return (policy.allowedOrigins ?? []).some((pattern) => {
        const escaped = pattern
            .toLowerCase()
            .replace(/\/+$/, '')
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '[^/]*');
        return new RegExp(`^${escaped}$`).test(origin);
    });
}

/** Whether linking is switched on at all. */
export function userServersEnabled(options: CliOptions | undefined): boolean {
    return options?.userServers !== false;
}

/** A name from the URL's host: `api.example.com` → `api`, `localhost:8047` → `localhost-8047`. */
export function suggestServerName(url: string, taken: (name: string) => boolean): string {
    const { hostname, port } = new URL(url);
    const host = hostname.replace(/^\[|\]$/g, '');
    const isIp = /^[\d.]+$/.test(host) || host.includes(':');
    const base = (isIp ? host.replace(/[.:]/g, '-') : host.split('.')[0]) + (port && (isIp || host === 'localhost') ? `-${port}` : '');
    let name = base.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^[-_]+/, '').slice(0, 28) || 'server';
    if (!SERVER_NAME_PATTERN.test(name)) name = 'server';
    let candidate = name;
    for (let i = 2; taken(candidate); i++) candidate = `${name}-${i}`;
    return candidate;
}

/** `qcli_pat_…abcd` → `••••abcd`. */
export function maskToken(token: string | undefined): string {
    if (!token) return '-';
    return `••••${token.slice(-4)}`;
}

/**
 * The command as kept in the history: values of `--token` and `--password`
 * replaced by `***`.
 */
export function redactSecrets(command: string): string {
    return command.replace(
        // A following flag (`--token --default`) is not a value
        /(--(?:token|password)(?:=|\s+))("[^"]*"|'[^']*'|(?!--)\S+)/gi,
        (_match, flag: string) => `${flag}***`,
    );
}

/**
 * The linked servers and their tokens: the list in the key-value store, each
 * token in the secret store.
 */
export class CliLinkedServers {
    constructor(
        private readonly kv: ICliKeyValueStore,
        private readonly secrets: ICliSecretStore,
    ) {}

    async list(): Promise<CliLinkedServer[]> {
        const saved = await this.kv.get<CliLinkedServer[]>(SERVERS_KEY);
        return Array.isArray(saved) ? saved.filter((s) => s && typeof s.name === 'string' && typeof s.url === 'string') : [];
    }

    async get(name: string): Promise<CliLinkedServer | undefined> {
        return (await this.list()).find((s) => s.name.toLowerCase() === name.toLowerCase());
    }

    /** Saves a server (replacing one with the same name) and its token (none: deleted). */
    async save(server: CliLinkedServer, token: string | undefined): Promise<void> {
        if (token) await this.secrets.set(tokenKey(server.name), token);
        else await this.secrets.delete(tokenKey(server.name));
        const others = (await this.list()).filter((s) => s.name.toLowerCase() !== server.name.toLowerCase());
        await this.kv.set(SERVERS_KEY, [...others, server]);
    }

    async setToken(name: string, token: string): Promise<void> {
        await this.secrets.set(tokenKey(name), token);
    }

    async token(name: string): Promise<string | undefined> {
        return this.secrets.get(tokenKey(name));
    }

    async remove(name: string): Promise<boolean> {
        const all = await this.list();
        const rest = all.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
        await this.secrets.delete(tokenKey(name));
        if (rest.length === all.length) return false;
        await this.kv.set(SERVERS_KEY, rest);
        return true;
    }

    /** Removes every linked server and every secret. */
    async clear(): Promise<void> {
        await this.kv.remove(SERVERS_KEY);
        await this.secrets.clear();
    }
}

/**
 * The connection config of a linked server: the token (kept in memory once
 * read) sent as a bearer header; sockets use the users plugin's tickets.
 */
export function linkedServerConfig(server: CliLinkedServer, token: string | undefined): CliServerConfig {
    return {
        name: server.name,
        url: server.url,
        ...(token ? { headers: () => ({ Authorization: `Bearer ${token}` }) } : {}),
    };
}
