import { ScriptLoaderService } from '../lib/services/script-loader';
import {
    collectAvailablePackages,
    fetchRegistryDocument,
} from '../lib/processors/system/packages/package-search';
import { resolveBundlePath } from '../lib/processors/system/packages/package-installer';

const PREFIX = '@qodalis/cli-';

/** A loader whose `getScript` answers from a URL -> JSON map (404 otherwise). */
function fakeLoader(responses: Record<string, unknown>): ScriptLoaderService {
    const loader = new ScriptLoaderService();
    spyOn(loader, 'getScript').and.callFake(async (url: string) => {
        if (!(url in responses)) throw new Error(`404 ${url}`);
        return {
            xhr: {} as XMLHttpRequest,
            content: JSON.stringify(responses[url]),
        };
    });
    return loader;
}

describe('pkg package-search', () => {
    describe('collectAvailablePackages', () => {
        it('merges registry and file sources, keeping the newest version', async () => {
            const loader = fakeLoader({
                [`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(PREFIX)}&size=250`]:
                    {
                        objects: [
                            {
                                package: {
                                    name: '@qodalis/cli-guid',
                                    version: '2.0.0-beta.17',
                                    description: 'UUIDs',
                                },
                            },
                            {
                                package: {
                                    name: '@qodalis/cli-core',
                                    version: '2.0.0',
                                },
                            },
                            {
                                package: {
                                    name: 'unrelated',
                                    version: '1.0.0',
                                },
                            },
                        ],
                    },
                'https://unpkg.com/@qodalis/cli-guid/package.json': {
                    version: '2.0.0-beta.18',
                },
                'https://cdn.jsdelivr.net/npm/@qodalis/cli-guid/package.json': {
                    version: '2.0.0-beta.18',
                },
                'https://unpkg.com/@qodalis/cli-qr/package.json': {
                    version: '1.0.0',
                    description: 'QR codes',
                },
            });

            const result = await collectAvailablePackages(
                loader,
                PREFIX,
                new AbortController().signal,
                () => {},
            );

            expect(result.map((p) => p.name)).toEqual([
                '@qodalis/cli-guid',
                '@qodalis/cli-qr',
            ]);
            const guid = result[0];
            expect(guid.version).toBe('2.0.0-beta.18');
            expect(guid.description).toBe('UUIDs');
            expect(guid.source).toBe('unpkg, jsdelivr');
            expect(result[1].shortName).toBe('qr');
        });

        it('returns an empty list when no source answers', async () => {
            const result = await collectAvailablePackages(
                fakeLoader({}),
                PREFIX,
                new AbortController().signal,
                () => {},
            );
            expect(result).toEqual([]);
        });
    });

    describe('fetchRegistryDocument', () => {
        it('falls through to the next registry when the first lacks the package', async () => {
            const loader = fakeLoader({
                'https://registry.npmjs.org/%40qodalis%2Fcli-guid': {},
                'https://verdaccio.local/%40qodalis%2Fcli-guid': {
                    versions: { '1.0.0': {} },
                },
            });
            loader.addSource(
                'verdaccio',
                'https://verdaccio.local/',
                'registry',
            );

            const doc = await fetchRegistryDocument(
                loader,
                '@qodalis/cli-guid',
                new AbortController().signal,
            );
            expect(Object.keys(doc!.versions!)).toEqual(['1.0.0']);
        });

        it('returns undefined when no registry knows the package', async () => {
            const loader = fakeLoader({
                'https://registry.npmjs.org/%40qodalis%2Fcli-nope': {},
            });
            const doc = await fetchRegistryDocument(
                loader,
                '@qodalis/cli-nope',
                new AbortController().signal,
            );
            expect(doc).toBeUndefined();
        });
    });

    describe('resolveBundlePath', () => {
        it('prefers unpkg, then umd, then main, with an optional version', () => {
            expect(
                resolveBundlePath({
                    name: 'a',
                    unpkg: './umd/index.global.js',
                    main: './x.js',
                }),
            ).toBe('a/umd/index.global.js');
            expect(
                resolveBundlePath({ name: 'a', umd: 'umd/i.js' }, '@1.0.0'),
            ).toBe('a@1.0.0/umd/i.js');
            expect(resolveBundlePath({ name: 'a' })).toBe('a');
        });
    });
});
