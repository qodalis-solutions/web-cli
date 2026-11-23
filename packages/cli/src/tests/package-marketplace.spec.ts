import {
    CliModuleRegistry,
    ICliExecutionContext,
    ICliCommandProcessor,
    Package,
} from '@qodalis/cli-core';
import {
    applyMarketplaceOptions,
    chooseMarketplaceVersion,
    MarketplaceClient,
    MarketplacePlugin,
    MarketplacePluginSummary,
    MarketplaceSession,
    MarketplaceUnreachableError,
    MarketplaceVersion,
    pickResolvedPlugin,
    sha384Integrity,
} from '../lib/processors/system/packages/marketplace';
import { CliPackageInstaller } from '../lib/processors/system/packages/package-installer';
import { ScriptLoaderService } from '../lib/services/script-loader';
import { CliPackageManagerService } from '../lib/services/cli-package-manager';
import { CliPackagesCommandProcessor } from '../lib/processors/system/cli-packages-command-processor';

const BASE = 'https://plugins.example.com/';
const API = `${BASE}api/v1/qcli/marketplace`;

type Route = { status: number; body?: unknown } | 'hang' | 'network-error';

/**
 * Replace `window.fetch` with a fake marketplace answering `routes`
 * (`"GET /plugins?..."` -> answer); anything else is a 404.
 */
function fakeMarketplace(routes: Record<string, Route>): jasmine.Spy {
    return spyOn(window, 'fetch').and.callFake(((
        input: RequestInfo | URL,
        init?: RequestInit,
    ) => {
        const url = String(input);
        const key = `${init?.method ?? 'GET'} ${url.slice(API.length)}`;
        const route = routes[key] ?? {
            status: 404,
            body: { error: 'not found' },
        };
        if (route === 'network-error') {
            return Promise.reject(new TypeError('Failed to fetch'));
        }
        if (route === 'hang') {
            return new Promise((_, reject) => {
                init?.signal?.addEventListener('abort', () =>
                    reject(new DOMException('Aborted', 'AbortError')),
                );
            });
        }
        return Promise.resolve(
            new Response(JSON.stringify(route.body ?? {}), {
                status: route.status,
                headers: { 'Content-Type': 'application/json' },
            }),
        );
    }) as typeof fetch);
}

function version(
    v: string,
    extra: Partial<MarketplaceVersion> = {},
): MarketplaceVersion {
    return {
        version: v,
        apiVersion: 2,
        coreRange: '^2.0.0',
        bundle: 'umd/index.global.js',
        integrity: 'sha384-none',
        size: 10,
        publishedAt: '2026-11-01T00:00:00Z',
        status: 'listed',
        ...extra,
    };
}

function summary(
    name: string,
    extra: Partial<MarketplacePluginSummary> = {},
): MarketplacePluginSummary {
    const shortName = name.replace(/^@[^/]+\//, '').replace(/^cli-/, '');
    return {
        name,
        shortName,
        description: `${shortName} plugin`,
        category: 'tools',
        tags: [],
        publisher: { id: '@acme', name: 'acme', verified: false },
        official: name.startsWith('@qodalis/'),
        featured: false,
        downloads: { weekly: 5 },
        latest: '1.0.0',
        compatible: true,
        version: '1.0.0',
        updatedAt: '2026-11-01T00:00:00Z',
        ...extra,
    };
}

function plugin(
    name: string,
    versions: MarketplaceVersion[],
    extra: Partial<MarketplacePlugin> = {},
): MarketplacePlugin {
    return {
        ...summary(name),
        status: 'listed',
        screenshots: [],
        serverPackages: [],
        readme: '',
        versions,
        createdAt: '2026-11-01T00:00:00Z',
        ...extra,
    };
}

/** A context whose writer records every line as plain text. */
function fakeContext(cols = 120): {
    context: ICliExecutionContext;
    lines: string[];
    errors: string[];
    warnings: string[];
} {
    const lines: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const writer = {
        writeln: (text = '') => lines.push(text),
        write: (text: string) => lines.push(text),
        writeInfo: (text: string) => lines.push(text),
        writeSuccess: (text: string) => lines.push(text),
        writeWarning: (text: string) => {
            warnings.push(text);
            lines.push(text);
        },
        writeError: (text: string) => {
            errors.push(text);
            lines.push(text);
        },
        wrapInColor: (text: string) => text,
    };
    const context = {
        writer,
        terminal: { cols },
        translator: {
            t: (_key: string, fallback: string, params?: any) =>
                params
                    ? fallback.replace(/\{(\w+)\}/g, (_, k) => params[k])
                    : fallback,
        },
        notifier: { info: () => {} },
        onAbort: { subscribe: () => ({ unsubscribe: () => {} }) },
        services: { get: () => undefined },
        progressBar: jasmine.createSpyObj('progressBar', [
            'show',
            'hide',
            'complete',
            'setText',
            'setProgress',
        ]),
        logger: jasmine.createSpyObj('logger', [
            'info',
            'warn',
            'error',
            'debug',
            'log',
        ]),
    } as unknown as ICliExecutionContext;
    return { context, lines, errors, warnings };
}

describe('pkg marketplace', () => {
    describe('MarketplaceClient', () => {
        it('gives up after the timeout', async () => {
            fakeMarketplace({ 'GET /resolve?name=guid': 'hang' });
            const client = new MarketplaceClient(BASE, 30);

            await expectAsync(client.resolve('guid')).toBeRejectedWithError(
                MarketplaceUnreachableError,
                /no answer within/,
            );
        });

        it('sends the API version and maps a 404 plugin to null', async () => {
            const fetchSpy = fakeMarketplace({
                'GET /plugins?query=chart&apiVersion=2': {
                    status: 200,
                    body: { items: [], total: 0, page: 1, pageSize: 24 },
                },
            });
            const client = new MarketplaceClient(BASE);

            await client.search({ query: 'chart', apiVersion: 2 });
            expect(await client.plugin('@acme/cli-x', 2)).toBeNull();
            expect(String(fetchSpy.calls.mostRecent().args[0])).toBe(
                `${API}/plugins/%40acme%2Fcli-x?apiVersion=2`,
            );
        });

        it('reports the marketplace down once per command, then skips it', async () => {
            const fetchSpy = fakeMarketplace({
                'GET /resolve?name=a': 'network-error',
            });
            const { context, warnings } = fakeContext();
            const session = new MarketplaceSession(
                new MarketplaceClient(BASE),
                false,
                context,
            );

            expect(
                await session.run((c) => c.resolve('a'), 'searching npm'),
            ).toBeUndefined();
            expect(
                await session.run((c) => c.resolve('b'), 'searching npm'),
            ).toBeUndefined();

            expect(warnings).toEqual([
                'Marketplace unreachable, searching npm',
            ]);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(session.available).toBeFalse();
        });
    });

    describe('version choice', () => {
        const p = plugin('@acme/cli-x', [
            version('3.0.0', { apiVersion: 3 }),
            version('2.1.0', { status: 'flagged', note: 'leaks tokens' }),
            version('2.0.0'),
            version('1.0.0', { apiVersion: 1 }),
        ]);

        it('picks the newest listed version that fits', () => {
            const choice = chooseMarketplaceVersion(p, undefined, 2);
            expect(choice.ok && choice.version.version).toBe('2.0.0');
        });

        it('refuses an incompatible version with the newest working one', () => {
            const choice = chooseMarketplaceVersion(p, '3.0.0', 2);
            expect(choice.ok).toBeFalse();
            if (!choice.ok) {
                expect(choice.reason).toContain(
                    'needs CLI API 3 (this CLI has 2)',
                );
                expect(choice.suggestion?.version).toBe('2.0.0');
            }
        });

        it('refuses flagged and unlisted versions', () => {
            const flagged = chooseMarketplaceVersion(p, '2.1.0', 2);
            const missing = chooseMarketplaceVersion(p, '0.9.0', 2);
            expect(!flagged.ok && flagged.reason).toContain('leaks tokens');
            expect(!missing.ok && missing.reason).toContain('not listed');
        });

        it('resolves names: exact, single, the official one, else ambiguous', () => {
            const official = summary('@qodalis/cli-guid', { official: true });
            const acme = summary('@acme/cli-guid');
            const other = summary('@other/cli-guid');
            expect(pickResolvedPlugin('guid', [official, acme])).toBe(official);
            expect(pickResolvedPlugin('@acme/cli-guid', [official, acme])).toBe(
                acme,
            );
            expect(pickResolvedPlugin('guid', [acme])).toBe(acme);
            expect(pickResolvedPlugin('guid', [acme, other])).toBeUndefined();
        });

        it('computes SRI hashes like the indexer', async () => {
            expect(await sha384Integrity('')).toBe(
                'sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb',
            );
        });
    });

    describe('options', () => {
        it('turns the built-in marketplace off or replaces it', () => {
            const off = new ScriptLoaderService();
            applyMarketplaceOptions(off, { marketplace: false });
            expect(off.getSourcesByKind('marketplace')).toEqual([]);

            const replaced = new ScriptLoaderService();
            applyMarketplaceOptions(replaced, { marketplace: BASE });
            expect(replaced.getSourcesByKind('marketplace')).toEqual([
                { name: 'marketplace', url: BASE },
            ]);

            const builtIn = new ScriptLoaderService();
            applyMarketplaceOptions(builtIn, {});
            expect(builtIn.getSourcesByKind('marketplace')).toEqual([
                { name: 'qodalis', url: 'https://plugins.qodalis.com/' },
            ]);
            // A marketplace is never a download source
            builtIn.setCdnSource('qodalis');
            expect(builtIn.getCdnSource()).toBe('unpkg');
        });
    });

    describe('installer', () => {
        const CODE = 'window.__acmeX = true;';
        let installed: Package[];
        let manager: jasmine.SpyObj<CliPackageManagerService>;
        let loader: ScriptLoaderService;
        let installer: CliPackageInstaller;

        beforeEach(() => {
            installed = [];
            manager = jasmine.createSpyObj<CliPackageManagerService>(
                'CliPackageManagerService',
                [
                    'getPackages',
                    'getPackage',
                    'hasPackage',
                    'addPackage',
                    'updatePackage',
                    'removePackage',
                ],
            );
            (manager as any).QODALIS_COMMAND_PREFIX = '@qodalis/cli-';
            manager.getPackages.and.callFake(async () => installed);
            manager.getPackage.and.callFake(async (name: string) =>
                installed.find(
                    (p) => p.name === name || p.name === `@qodalis/cli-${name}`,
                ),
            );

            loader = new ScriptLoaderService();
            applyMarketplaceOptions(loader, { marketplace: BASE });
            spyOn(loader, 'getScriptWithFallback').and.callFake(
                async (path: string) => {
                    if (path.endsWith('package.json')) {
                        throw new Error('404');
                    }
                    return {
                        xhr: {
                            responseURL: `https://unpkg.com/${path}`,
                        } as XMLHttpRequest,
                        content: CODE,
                    };
                },
            );
            spyOn(loader, 'injectBodyScript');
            spyOn(loader, 'injectScriptWithFallback').and.resolveTo();

            installer = new CliPackageInstaller(loader, manager);
            installer.attach(
                jasmine.createSpyObj('registry', ['unregisterProcessor']),
                new CliModuleRegistry(),
            );
        });

        async function listed(
            name: string,
            versions: MarketplaceVersion[],
        ): Promise<void> {
            fakeMarketplace({
                [`GET /resolve?name=${encodeURIComponent('x')}`]: {
                    status: 200,
                    body: { matches: [summary(name)] },
                },
                [`GET /plugins/${encodeURIComponent(name)}?apiVersion=2`]: {
                    status: 200,
                    body: plugin(name, versions),
                },
            });
        }

        it('installs a listed version whose bundle matches the hash', async () => {
            await listed('@acme/cli-x', [
                version('1.0.0', { integrity: await sha384Integrity(CODE) }),
            ]);
            const { context, errors } = fakeContext();

            await installer.install('x', context);

            expect(errors).toEqual([]);
            expect(loader.getScriptWithFallback).toHaveBeenCalledWith(
                '@acme/cli-x@1.0.0/umd/index.global.js',
                jasmine.anything(),
            );
            expect(loader.injectBodyScript).toHaveBeenCalledWith(CODE);
            expect(manager.addPackage).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    name: '@acme/cli-x',
                    version: '1.0.0',
                    integrity: await sha384Integrity(CODE),
                }),
            );
        });

        it('injects nothing when the bundle differs from the recorded hash', async () => {
            await listed('@acme/cli-x', [
                version('1.0.0', {
                    integrity: await sha384Integrity('something else'),
                }),
            ]);
            const { context, errors } = fakeContext();

            await installer.install('x', context);

            expect(errors[0]).toContain('Integrity check failed');
            expect(loader.injectBodyScript).not.toHaveBeenCalled();
            expect(manager.addPackage).not.toHaveBeenCalled();
        });

        it('refuses a version that needs a newer CLI', async () => {
            await listed('@acme/cli-x', [
                version('2.0.0', { apiVersion: 3 }),
                version('1.0.0'),
            ]);
            const { context, errors, lines } = fakeContext();

            await installer.install('x', context, undefined, '2.0.0');

            expect(errors[0]).toContain('needs CLI API 3 (this CLI has 2)');
            expect(lines.join('\n')).toContain('pkg add @acme/cli-x@1.0.0');
            expect(loader.getScriptWithFallback).not.toHaveBeenCalled();
        });

        it('lists the candidates of an ambiguous short name', async () => {
            fakeMarketplace({
                'GET /resolve?name=x': {
                    status: 200,
                    body: {
                        matches: [
                            summary('@acme/cli-x'),
                            summary('@other/cli-x'),
                        ],
                    },
                },
            });
            const { context, lines } = fakeContext();

            await installer.install('x', context);

            const output = lines.join('\n');
            expect(output).toContain('Several plugins are called x');
            expect(output).toContain('@acme/cli-x');
            expect(output).toContain('@other/cli-x');
            expect(loader.getScriptWithFallback).not.toHaveBeenCalled();
        });

        it('warns about a package the marketplace does not list', async () => {
            fakeMarketplace({
                'GET /resolve?name=x': { status: 200, body: { matches: [] } },
            });
            spyOn(installer, 'fetchInfo').and.resolveTo({
                name: '@qodalis/cli-x',
                version: '1.0.0',
                unpkg: 'umd/index.js',
            });
            const { context, warnings } = fakeContext();

            await installer.install('x', context);

            expect(warnings).toEqual([
                '@qodalis/cli-x is not listed in the marketplace and has not been reviewed',
            ]);
            expect(manager.addPackage).toHaveBeenCalledWith(
                jasmine.objectContaining({ name: '@qodalis/cli-x' }),
            );
        });

        it('falls back to npm when the marketplace is unreachable', async () => {
            fakeMarketplace({ 'GET /resolve?name=x': 'network-error' });
            spyOn(installer, 'fetchInfo').and.resolveTo({
                name: '@qodalis/cli-x',
                version: '1.0.0',
                unpkg: 'umd/index.js',
            });
            const { context, warnings } = fakeContext();

            await installer.install('x', context);

            expect(warnings).toEqual(['Marketplace unreachable, using npm']);
            expect(manager.addPackage).toHaveBeenCalled();
        });

        it('refuses unlisted packages and an unreachable marketplace with marketplaceOnly', async () => {
            installer.marketplaceOnly = true;
            fakeMarketplace({
                'GET /resolve?name=x': { status: 200, body: { matches: [] } },
                'GET /resolve?name=y': 'network-error',
            });
            const { context, errors } = fakeContext();

            await installer.install('x', context);
            await installer.install('y', context);

            expect(errors[0]).toContain('not listed in the marketplace');
            expect(errors[1]).toContain('marketplace is unreachable');
            expect(loader.getScriptWithFallback).not.toHaveBeenCalled();
            expect(manager.addPackage).not.toHaveBeenCalled();
        });

        it('checks against the newest fitting version and warns about a flagged one', async () => {
            installed = [
                {
                    name: '@acme/cli-x',
                    version: '1.0.0',
                    url: '',
                    integrity: 'sha384-a',
                },
            ];
            fakeMarketplace({
                'GET /plugins/%40acme%2Fcli-x?apiVersion=2': {
                    status: 200,
                    body: plugin('@acme/cli-x', [
                        version('3.0.0', { apiVersion: 3 }),
                        version('1.1.0'),
                        version('1.0.0', {
                            status: 'flagged',
                            note: 'malware',
                        }),
                    ]),
                },
            });
            const { context } = fakeContext();
            const session = installer.marketplaceSession(context);

            const result = await installer.checkPackage(installed[0], session);

            expect(result.latest).toBe('1.1.0');
            expect(result.warning).toContain('flagged');
            expect(result.warning).toContain('malware');
        });

        it('updates to the newest fitting version with an integrity check', async () => {
            installed = [{ name: '@acme/cli-x', version: '1.0.0', url: '' }];
            fakeMarketplace({
                'GET /plugins/%40acme%2Fcli-x?apiVersion=2': {
                    status: 200,
                    body: plugin('@acme/cli-x', [
                        version('3.0.0', { apiVersion: 3 }),
                        version('1.1.0', {
                            integrity: await sha384Integrity(CODE),
                        }),
                        version('1.0.0'),
                    ]),
                },
            });
            const { context, errors } = fakeContext();

            const result = await installer.update('@acme/cli-x', context);

            expect(errors).toEqual([]);
            expect(result).toBe('updated');
            expect(manager.updatePackage).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    version: '1.1.0',
                    integrity: await sha384Integrity(CODE),
                }),
            );
        });

        it('loads saved packages with their integrity, and skips one that fails', async () => {
            installed = [
                {
                    name: '@acme/cli-x',
                    version: '1.0.0',
                    url: 'https://unpkg.com/@acme/cli-x@1.0.0/umd/index.global.js',
                    integrity: 'sha384-abc',
                },
                {
                    name: '@acme/cli-y',
                    version: '1.0.0',
                    url: 'https://unpkg.com/@acme/cli-y@1.0.0/umd/index.global.js',
                },
            ];
            (loader.injectScriptWithFallback as jasmine.Spy).and.callFake(
                async (_path: string, integrity?: string) => {
                    if (integrity) throw new Error('integrity mismatch');
                },
            );
            const { context } = fakeContext();

            await installer.loadInstalled(context);

            expect(loader.injectScriptWithFallback).toHaveBeenCalledWith(
                '@acme/cli-x@1.0.0/umd/index.global.js',
                'sha384-abc',
            );
            expect(loader.injectScriptWithFallback).toHaveBeenCalledWith(
                '@acme/cli-y@1.0.0/umd/index.global.js',
                undefined,
            );
            expect(context.logger.error).toHaveBeenCalledWith(
                jasmine.stringMatching(/Could not load package @acme\/cli-x/),
            );
        });
    });

    describe('script loader', () => {
        it('sets integrity and crossorigin on an injected script', async () => {
            const loader = new ScriptLoaderService();
            let script: HTMLScriptElement | undefined;
            spyOn(document.head, 'appendChild').and.callFake(
                <T extends Node>(node: T): T => {
                    script = node as unknown as HTMLScriptElement;
                    setTimeout(() => script!.onload?.(new Event('load')));
                    return node;
                },
            );

            await loader.injectScript('https://unpkg.com/x.js', 'sha384-abc');

            expect(script?.integrity).toBe('sha384-abc');
            expect(script?.crossOrigin).toBe('anonymous');
        });
    });

    describe('pkg commands', () => {
        let processor: CliPackagesCommandProcessor;

        function sub(name: string): ICliCommandProcessor {
            return processor.processors.find((p) => p.command === name)!;
        }

        beforeEach(() => {
            processor = new CliPackagesCommandProcessor();
            const loader: ScriptLoaderService = (processor as any).loader;
            applyMarketplaceOptions(loader, { marketplace: BASE });
            const manager: CliPackageManagerService = (processor as any)
                .manager;
            manager.setStore({
                get: async () => [],
                set: async () => {},
            } as any);
        });

        it('pkg search lists plugins with version, category, verified mark and fit', async () => {
            fakeMarketplace({
                'GET /plugins?query=chart&apiVersion=2&pageSize=50': {
                    status: 200,
                    body: {
                        items: [
                            summary('@qodalis/cli-chart', {
                                version: '2.8.0',
                                publisher: {
                                    id: '@qodalis',
                                    name: 'qodalis',
                                    verified: true,
                                },
                            }),
                            summary('@acme/cli-chart3', {
                                category: 'data',
                                compatible: false,
                                version: null,
                                latest: '3.0.0',
                                reason: 'needs CLI API 3 (this CLI has 2)',
                            }),
                        ],
                        total: 2,
                        page: 1,
                        pageSize: 50,
                    },
                },
            });
            const { context, lines } = fakeContext(120);

            await sub('search').processCommand(
                { value: 'chart' } as any,
                context,
            );

            const output = lines.join('\n');
            expect(output).toContain('Plugins matching "chart" (2)');
            expect(output).toMatch(
                /chart ✓\s+v2\.8\.0\s+\[tools\]\s+📥 not installed/,
            );
            expect(output).toMatch(
                /@acme\/cli-chart3\s+v3\.0\.0\s+\[data\]\s+✖ needs CLI API 3/,
            );
        });

        it('pkg browse writes one block per plugin on a narrow terminal', async () => {
            fakeMarketplace({
                'GET /plugins?apiVersion=2&page=1&pageSize=100&sort=name': {
                    status: 200,
                    body: {
                        items: [summary('@qodalis/cli-guid')],
                        total: 1,
                        page: 1,
                        pageSize: 100,
                    },
                },
            });
            const { context, lines } = fakeContext(40);

            await sub('browse').processCommand({} as any, context);

            expect(lines).toContain('  guid  📥 not installed');
            expect(lines).toContain('    v1.0.0  [tools]');
        });

        it('pkg search falls back to npm with one line', async () => {
            fakeMarketplace({
                'GET /plugins?query=guid&apiVersion=2&pageSize=50':
                    'network-error',
            });
            const loader: ScriptLoaderService = (processor as any).loader;
            spyOn(loader, 'getScript').and.callFake(async (url: string) => {
                if (url.startsWith('https://registry.npmjs.org/-/v1/search')) {
                    return {
                        xhr: {} as XMLHttpRequest,
                        content: JSON.stringify({
                            objects: [
                                {
                                    package: {
                                        name: '@qodalis/cli-guid',
                                        version: '2.8.0',
                                        description: 'GUIDs',
                                    },
                                },
                                {
                                    package: {
                                        name: '@qodalis/cli-qr',
                                        version: '2.8.0',
                                        description: 'QR codes',
                                    },
                                },
                            ],
                        }),
                    };
                }
                throw new Error('404');
            });
            const { context, lines, warnings } = fakeContext();

            await sub('search').processCommand(
                { value: 'guid' } as any,
                context,
            );

            expect(warnings).toEqual([
                'Marketplace unreachable, searching npm',
            ]);
            const output = lines.join('\n');
            expect(output).toContain('Packages matching "guid" (1)');
            expect(output).not.toContain('qr');
        });

        it('pkg info shows the marketplace record', async () => {
            fakeMarketplace({
                'GET /resolve?name=x': {
                    status: 200,
                    body: { matches: [summary('@acme/cli-x')] },
                },
                'GET /plugins/%40acme%2Fcli-x?apiVersion=2': {
                    status: 200,
                    body: plugin(
                        '@acme/cli-x',
                        [version('2.0.0', { apiVersion: 3 }), version('1.0.0')],
                        {
                            repository: 'https://github.com/acme/x',
                            serverPackages: [
                                {
                                    ecosystem: 'npm',
                                    name: '@acme/server-x',
                                    install: 'npm install @acme/server-x',
                                },
                            ],
                        },
                    ),
                },
            });
            const { context, lines } = fakeContext();

            await sub('info').processCommand({ value: 'x' } as any, context);

            const output = lines.join('\n');
            expect(output).toContain('@acme/cli-x v1.0.0');
            expect(output).toContain('(not verified)');
            expect(output).toContain('needs CLI API 3');
            expect(output).toContain('npm install @acme/server-x');
            expect(output).toContain('pkg add @acme/cli-x');
        });

        it('pkg publish submits the name and prints the next steps', async () => {
            const fetchSpy = fakeMarketplace({
                'POST /submissions': {
                    status: 202,
                    body: { status: 'queued' },
                },
            });
            const { context, lines } = fakeContext();

            await sub('publish').processCommand(
                { value: '@acme/cli-x' } as any,
                context,
            );

            expect(fetchSpy.calls.mostRecent().args[1]?.body).toBe(
                JSON.stringify({ name: '@acme/cli-x' }),
            );
            const output = lines.join('\n');
            expect(output).toContain(`Submitted @acme/cli-x to ${BASE}`);
            expect(output).toContain('A moderator reviews it');
            expect(output).toContain('publishing-plugins');
        });

        it('pkg publish reports a rate limit', async () => {
            fakeMarketplace({
                'POST /submissions': {
                    status: 429,
                    body: { error: 'rate limited' },
                },
            });
            const { context, errors } = fakeContext();

            await sub('publish').processCommand(
                { value: '@acme/cli-x' } as any,
                context,
            );

            expect(errors[0]).toContain('Too many submissions');
        });
    });
});
