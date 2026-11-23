/**
 * Client for a plugin marketplace: any server implementing the marketplace
 * HTTP API (`https://plugins.qodalis.com/` by default). The JSON
 * types follow the contract in
 * `docs/superpowers/plans/2026-11-23-plugin-marketplace.md`.
 */

import {
    CliOptions,
    ICliExecutionContext,
    LIBRARY_VERSION as CORE_VERSION,
    minVersionOfRange,
    satisfiesVersionRange,
} from '@qodalis/cli-core';
import { ScriptLoaderService } from '../../../services/script-loader';
import { API_VERSION } from '../../../version';
import { compareSemver } from './package-utils';

export type MarketplaceCategory =
    'tools' | 'data' | 'games' | 'language' | 'server' | 'other';

export type MarketplaceVersionStatus =
    'pending' | 'listed' | 'flagged' | 'unlisted' | 'rejected';

export interface MarketplacePublisher {
    id: string;
    name: string;
    verified: boolean;
}

export interface MarketplaceServerPackage {
    ecosystem: 'npm' | 'pypi' | 'nuget';
    name: string;
    install: string;
}

export interface MarketplaceVersion {
    version: string;
    apiVersion: number;
    coreRange: string | null;
    bundle: string;
    integrity: string;
    size: number;
    publishedAt: string;
    status: MarketplaceVersionStatus;
    note?: string;
    deprecated?: string;
}

export interface MarketplacePluginSummary {
    name: string;
    shortName: string;
    description: string;
    category: MarketplaceCategory;
    tags: string[];
    publisher: MarketplacePublisher;
    official: boolean;
    featured: boolean;
    icon?: string;
    downloads: { weekly: number };
    latest: string | null;
    compatible: boolean;
    version: string | null;
    reason?: string;
    updatedAt: string;
}

export interface MarketplacePlugin extends MarketplacePluginSummary {
    status: 'pending' | 'listed' | 'rejected' | 'unlisted';
    author?: string;
    homepage?: string;
    repository?: string;
    license?: string;
    screenshots: string[];
    serverPackages: MarketplaceServerPackage[];
    readme: string;
    versions: MarketplaceVersion[];
    createdAt: string;
}

export interface MarketplacePage<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MarketplaceSearchQuery {
    query?: string;
    category?: string;
    apiVersion?: number;
    coreVersion?: string;
    page?: number;
    pageSize?: number;
    sort?: 'relevance' | 'downloads' | 'updated' | 'name';
}

export interface MarketplaceSubmission {
    status: 'queued' | 'known';
    plugin?: { name: string; status: string };
}

/** What decides whether a plugin version fits: the module API and the core version. */
export interface MarketplaceRuntime {
    /** Module API of the running CLI (`API_VERSION`). */
    apiVersion: number;
    /** Version of the running `@qodalis/cli-core`. */
    coreVersion: string;
}

/** The running CLI. */
export const CLI_RUNTIME: MarketplaceRuntime = {
    apiVersion: API_VERSION,
    coreVersion: CORE_VERSION,
};

/** Every marketplace request gives up after this long. */
export const MARKETPLACE_TIMEOUT_MS = 4000;

/** The built-in marketplace source. */
export const DEFAULT_MARKETPLACE_NAME = 'qodalis';
export const DEFAULT_MARKETPLACE_URL = 'https://plugins.qodalis.com/';

/**
 * Apply `packageSources.marketplace` to the loader's sources: a URL replaces
 * the built-in `qodalis` marketplace, `false` removes it, and a source of
 * kind `marketplace` in `packageSources.sources` replaces it as well.
 */
export function applyMarketplaceOptions(
    loader: ScriptLoaderService,
    packageSources: CliOptions['packageSources'],
): void {
    const customMarketplace = (packageSources?.sources ?? []).some(
        (source) =>
            source.kind === 'marketplace' &&
            source.name !== DEFAULT_MARKETPLACE_NAME,
    );
    if (packageSources?.marketplace === false || customMarketplace) {
        loader.removeSource(DEFAULT_MARKETPLACE_NAME);
    }
    if (typeof packageSources?.marketplace === 'string') {
        loader.removeSource(DEFAULT_MARKETPLACE_NAME);
        loader.addSource(
            'marketplace',
            packageSources.marketplace,
            'marketplace',
        );
    }
}

/** The marketplace answered with an error (4xx): it is reachable, the request was refused. */
export class MarketplaceRequestError extends Error {
    constructor(
        readonly status: number,
        message: string,
    ) {
        super(message);
        this.name = 'MarketplaceRequestError';
    }
}

/** The marketplace did not answer (network error, timeout, 5xx, not JSON). */
export class MarketplaceUnreachableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MarketplaceUnreachableError';
    }
}

/** Thin HTTP client of the public marketplace API. */
export class MarketplaceClient {
    readonly apiRoot: string;

    constructor(
        readonly baseUrl: string,
        private readonly timeoutMs = MARKETPLACE_TIMEOUT_MS,
    ) {
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        this.apiRoot = `${base}api/v1/qcli/marketplace`;
    }

    /** Listed plugins matching the query. */
    search(
        query: MarketplaceSearchQuery,
        signal?: AbortSignal,
    ): Promise<MarketplacePage<MarketplacePluginSummary>> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') {
                params.set(key, String(value));
            }
        }
        const qs = params.toString();
        return this.request(`/plugins${qs ? `?${qs}` : ''}`, { signal });
    }

    /** One listed plugin, or `null` when the marketplace does not list it. */
    async plugin(
        name: string,
        runtime?: MarketplaceRuntime,
        signal?: AbortSignal,
    ): Promise<MarketplacePlugin | null> {
        const qs = runtime
            ? `?apiVersion=${runtime.apiVersion}&coreVersion=${encodeURIComponent(runtime.coreVersion)}`
            : '';
        try {
            return await this.request<MarketplacePlugin>(
                `/plugins/${encodeURIComponent(name)}${qs}`,
                { signal },
            );
        } catch (e) {
            if (e instanceof MarketplaceRequestError && e.status === 404) {
                return null;
            }
            throw e;
        }
    }

    /** Listed plugins whose name or short name is `name` (an official one first). */
    async resolve(
        name: string,
        signal?: AbortSignal,
    ): Promise<MarketplacePluginSummary[]> {
        const result = await this.request<{
            matches?: MarketplacePluginSummary[];
        }>(`/resolve?name=${encodeURIComponent(name)}`, { signal });
        return result.matches ?? [];
    }

    /** Queue a package for indexing and review. */
    submit(name: string, signal?: AbortSignal): Promise<MarketplaceSubmission> {
        return this.request('/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
            signal,
        });
    }

    private async request<T>(path: string, init: RequestInit): Promise<T> {
        const controller = new AbortController();
        const outer = init.signal;
        const onAbort = () => controller.abort();
        if (outer?.aborted) controller.abort();
        outer?.addEventListener('abort', onAbort);
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            let response: Response;
            try {
                response = await fetch(`${this.apiRoot}${path}`, {
                    ...init,
                    credentials: 'omit',
                    signal: controller.signal,
                });
            } catch (e: any) {
                if (outer?.aborted) throw e;
                throw new MarketplaceUnreachableError(
                    controller.signal.aborted
                        ? `no answer within ${this.timeoutMs / 1000} s`
                        : (e?.message ?? String(e)),
                );
            }

            let body: any;
            try {
                body = await response.json();
            } catch {
                body = undefined;
            }

            if (response.status >= 400 && response.status < 500) {
                throw new MarketplaceRequestError(
                    response.status,
                    body?.error ?? `HTTP ${response.status}`,
                );
            }
            if (!response.ok || body === undefined) {
                throw new MarketplaceUnreachableError(
                    body?.error ?? `HTTP ${response.status}`,
                );
            }
            return body as T;
        } finally {
            clearTimeout(timer);
            outer?.removeEventListener('abort', onAbort);
        }
    }
}

/**
 * The marketplace as one `pkg` command sees it: the first failure prints one
 * line (`Marketplace unreachable, searching npm`) and every later call in the
 * same command skips the marketplace, so the npm path runs without waiting
 * again.
 */
export class MarketplaceSession {
    private down = false;

    constructor(
        readonly client: MarketplaceClient | undefined,
        readonly marketplaceOnly: boolean,
        private readonly context: ICliExecutionContext,
    ) {}

    /** Whether a marketplace is configured and has not failed in this command. */
    get available(): boolean {
        return !!this.client && !this.down;
    }

    /**
     * Run a marketplace request. Returns `undefined` when the marketplace is
     * off, unreachable or the user aborted; request errors (4xx other than
     * the ones the client handles) propagate.
     */
    async run<T>(
        fn: (client: MarketplaceClient) => Promise<T>,
        fallback: 'searching npm' | 'using npm' = 'using npm',
        signal?: AbortSignal,
    ): Promise<T | undefined> {
        if (!this.client || this.down) return undefined;
        try {
            return await fn(this.client);
        } catch (e) {
            if (signal?.aborted) return undefined;
            if (e instanceof MarketplaceRequestError) throw e;
            this.markDown(fallback, e);
            return undefined;
        }
    }

    private markDown(fallback: string, error: unknown): void {
        if (this.down) return;
        this.down = true;
        this.context.logger?.warn?.(
            `Marketplace ${this.client?.baseUrl} unreachable: ${(error as any)?.message ?? error}`,
        );
        this.context.writer.writeWarning(
            `Marketplace unreachable, ${fallback}`,
        );
    }
}

/**
 * Whether a version can run in this CLI: its module API equals the
 * runtime's and its `@qodalis/cli-core` peer range accepts the running core.
 */
export function versionFits(
    version: Pick<MarketplaceVersion, 'apiVersion' | 'coreRange'>,
    runtime: MarketplaceRuntime = CLI_RUNTIME,
): boolean {
    return (
        version.apiVersion === runtime.apiVersion &&
        coreRangeFits(version.coreRange, runtime.coreVersion)
    );
}

/** Whether the running core satisfies a version's core peer range (none: yes). */
export function coreRangeFits(
    coreRange: string | null | undefined,
    coreVersion: string,
): boolean {
    if (!coreRange || coreRange.trim() === '*') return true;
    return satisfiesVersionRange(coreVersion, coreRange);
}

/**
 * Why a version does not fit this CLI, e.g. `needs CLI API 3 (this CLI has 2)`
 * or `needs CLI 2.9.0 or newer (this CLI has 2.8.0)`.
 */
export function incompatibilityReason(
    version: Pick<MarketplaceVersion, 'apiVersion' | 'coreRange'>,
    runtime: MarketplaceRuntime = CLI_RUNTIME,
): string {
    if (version.apiVersion > runtime.apiVersion) {
        return `needs CLI API ${version.apiVersion} (this CLI has ${runtime.apiVersion})`;
    }
    if (version.apiVersion < runtime.apiVersion) {
        return `built for CLI API ${version.apiVersion} (this CLI has ${runtime.apiVersion})`;
    }
    const range = version.coreRange ?? '';
    const min = minVersionOfRange(range);
    return min && compareSemver(min, runtime.coreVersion) === 1
        ? `needs CLI ${min} or newer (this CLI has ${runtime.coreVersion})`
        : `needs CLI ${range} (this CLI has ${runtime.coreVersion})`;
}

/** The newest listed version that fits this CLI. */
export function newestWorkingVersion(
    plugin: Pick<MarketplacePlugin, 'versions'>,
    runtime: MarketplaceRuntime = CLI_RUNTIME,
): MarketplaceVersion | undefined {
    return [...plugin.versions]
        .filter((v) => v.status === 'listed' && versionFits(v, runtime))
        .sort((a, b) => compareSemver(b.version, a.version) ?? 0)[0];
}

export type VersionChoice =
    | { ok: true; version: MarketplaceVersion }
    | { ok: false; reason: string; suggestion?: MarketplaceVersion };

/**
 * Pick the version to install: the requested one, or the newest listed one
 * that fits. A requested version that is flagged, unlisted or needs another
 * CLI API is refused with the reason and the newest version that works.
 */
export function chooseMarketplaceVersion(
    plugin: MarketplacePlugin,
    requested?: string,
    runtime: MarketplaceRuntime = CLI_RUNTIME,
): VersionChoice {
    const suggestion = newestWorkingVersion(plugin, runtime);
    if (!requested || requested === 'latest') {
        if (suggestion) return { ok: true, version: suggestion };
        const newest = plugin.versions.find((v) => v.status === 'listed');
        return {
            ok: false,
            reason:
                plugin.reason ??
                (newest
                    ? incompatibilityReason(newest, runtime)
                    : 'no listed version'),
        };
    }

    const version = plugin.versions.find((v) => v.version === requested);
    if (!version || version.status === 'unlisted') {
        return {
            ok: false,
            reason: `version ${requested} is not listed in the marketplace`,
            suggestion,
        };
    }
    if (version.status === 'flagged') {
        return {
            ok: false,
            reason: `version ${requested} has been flagged${version.note ? `: ${version.note}` : ''}`,
            suggestion,
        };
    }
    if (version.status !== 'listed') {
        return {
            ok: false,
            reason: `version ${requested} is ${version.status}`,
            suggestion,
        };
    }
    if (!versionFits(version, runtime)) {
        return {
            ok: false,
            reason: `version ${requested} ${incompatibilityReason(version, runtime)}`,
            suggestion,
        };
    }
    return { ok: true, version };
}

/**
 * Pick one plugin out of `/resolve` matches: an exact name match, else the
 * only match, else the only official match (so `pkg add guid` keeps meaning
 * `@qodalis/cli-guid`). `undefined` when the name is ambiguous.
 */
export function pickResolvedPlugin(
    name: string,
    matches: MarketplacePluginSummary[],
): MarketplacePluginSummary | undefined {
    const exact = matches.find((m) => m.name === name);
    if (exact) return exact;
    if (matches.length === 1) return matches[0];
    const official = matches.filter((m) => m.official);
    return official.length === 1 ? official[0] : undefined;
}

/** `sha384-<base64>` of `text` encoded as UTF-8 (the marketplace's `integrity`). */
export async function sha384Integrity(text: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-384',
        new TextEncoder().encode(text),
    );
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return `sha384-${btoa(binary)}`;
}
