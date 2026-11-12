import { CliServerCapabilities } from '@qodalis/cli-core';

// Talking to a server before it is linked: is it a Qodalis CLI server, and the
// link request (browser approval), password sign-in and token creation.

export type CliFetch = (input: string, init?: RequestInit) => Promise<Response>;

/** What `server add` shows about a server before linking it. */
export interface CliServerProbe {
    /** The server's version (capabilities), when it says. */
    version?: string;
    capabilities: CliServerCapabilities | null;
    /** Whether the commands need a sign-in (401/403 without a token). */
    needsSignIn: boolean;
}

/** A link request: the code to compare and the page where the user approves it. */
export interface CliLinkRequest {
    linkId: string;
    userCode: string;
    /** Absolute (resolved against the server URL). */
    verificationUrl: string;
    expiresIn: number;
    interval: number;
}

export type CliLinkPoll =
    | { status: 'pending' }
    | { status: 'denied' }
    | { status: 'expired' }
    | { status: 'approved'; token: string; userName?: string };

const V1 = '/api/v1/qcli';

/** Text from a server, safe to print: control characters (terminal escapes) dropped. */
export function plainText(value: unknown): string {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
}

async function readJson<T>(response: Response): Promise<T | null> {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

/**
 * Whether `url` is a Qodalis CLI server: `GET /api/qcli/versions` answers with
 * its supported versions. Throws with the reason when not.
 */
export async function probeServer(fetchFn: CliFetch, url: string): Promise<CliServerProbe> {
    let versions: Response;
    try {
        versions = await fetchFn(`${url}/api/qcli/versions`, { headers: { Accept: 'application/json' } });
    } catch (e) {
        throw new Error(`Cannot reach ${url}: ${(e as Error).message || 'network error'}`, { cause: e });
    }
    const body = versions.ok ? await readJson<{ supportedVersions?: unknown }>(versions) : null;
    if (!body || !Array.isArray(body.supportedVersions)) {
        throw new Error(`${url} is not a Qodalis CLI server (no version discovery at /api/qcli/versions)`);
    }
    let capabilities: CliServerCapabilities | null = null;
    try {
        const res = await fetchFn(`${url}${V1}/capabilities`, { headers: { Accept: 'application/json' } });
        if (res.ok) capabilities = await readJson<CliServerCapabilities>(res);
    } catch {
        // Older servers: no capabilities
    }
    let needsSignIn = false;
    try {
        const res = await fetchFn(`${url}${V1}/commands`, { headers: { Accept: 'application/json' } });
        needsSignIn = res.status === 401 || res.status === 403;
    } catch {
        // The commands load when connecting
    }
    return { version: capabilities?.version, capabilities, needsSignIn };
}

/** Starts a link request; null when the server has no link endpoint (older servers, no users plugin). */
export async function requestLink(
    fetchFn: CliFetch,
    url: string,
    client: string,
): Promise<CliLinkRequest | null> {
    const res = await fetchFn(`${url}${V1}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client }),
    });
    if (res.status === 404 || res.status === 405) return null;
    const body = await readJson<CliLinkRequest & { error?: string }>(res);
    if (!res.ok || !body?.linkId) {
        throw new Error(body?.error ? plainText(body.error) : `The server refused the link request (${res.status})`);
    }
    // Opened and printed as a link: http(s) only, never `javascript:` or `data:`
    let verificationUrl: URL;
    try {
        verificationUrl = new URL(String(body.verificationUrl), `${url}/`);
    } catch {
        throw new Error('The server sent an invalid approval page address');
    }
    if (verificationUrl.protocol !== 'https:' && verificationUrl.protocol !== 'http:') {
        throw new Error('The server sent an invalid approval page address');
    }
    return {
        linkId: String(body.linkId),
        userCode: plainText(body.userCode),
        verificationUrl: verificationUrl.toString(),
        interval: Math.max(1, Number(body.interval) || 2),
        expiresIn: Number(body.expiresIn) || 600,
    };
}

/** One poll of a link request. */
export async function pollLink(fetchFn: CliFetch, url: string, linkId: string): Promise<CliLinkPoll> {
    const res = await fetchFn(`${url}${V1}/link/${encodeURIComponent(linkId)}`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) return { status: 'expired' };
    const body = await readJson<{ status?: string; token?: string; userName?: string }>(res);
    if (!res.ok || !body) throw new Error(`Link status unavailable (${res.status})`);
    if (body.status === 'approved' && body.token) return { status: 'approved', token: body.token, userName: body.userName };
    if (body.status === 'denied') return { status: 'denied' };
    if (body.status === 'expired') return { status: 'expired' };
    return { status: 'pending' };
}

/**
 * Signs in with a password, creates an API token named `tokenName` with that
 * session, then ends the session: only the token is kept.
 */
export async function createTokenWithPassword(
    fetchFn: CliFetch,
    url: string,
    username: string,
    password: string,
    tokenName: string,
): Promise<string> {
    const login = await fetchFn(`${url}${V1}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const session = await readJson<{ token?: string; error?: string }>(login);
    if (!login.ok || !session?.token) {
        throw new Error(login.status === 404 ? 'This server has no user sign-in' : plainText(session?.error ?? 'Sign-in failed'));
    }
    const auth = { Authorization: `Bearer ${session.token}` };
    try {
        for (let suffix = 1; ; suffix++) {
            const name = suffix === 1 ? tokenName : `${tokenName.slice(0, 60)} ${suffix}`;
            const created = await fetchFn(`${url}${V1}/tokens`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...auth },
                body: JSON.stringify({ name }),
            });
            const body = await readJson<{ token?: string; error?: string }>(created);
            if (created.status === 409 && suffix < 20) continue;
            if (!created.ok || !body?.token) throw new Error(body?.error ? plainText(body.error) : `Could not create a token (${created.status})`);
            return body.token;
        }
    } finally {
        await fetchFn(`${url}${V1}/sessions/current`, { method: 'DELETE', headers: auth }).catch(() => undefined);
    }
}

/** "Qodalis CLI on <platform>" for link requests and token names (`[A-Za-z0-9._ -]` only). */
export function deviceName(appName = 'Qodalis CLI'): string {
    const nav = (globalThis as { navigator?: Navigator & { userAgentData?: { platform?: string } } }).navigator;
    const ua = nav?.userAgent ?? '';
    const platform =
        nav?.userAgentData?.platform ||
        (/Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : '');
    const name = platform ? `${appName} on ${platform}` : appName;
    return name.replace(/[^A-Za-z0-9._ -]/g, '-').slice(0, 64);
}
