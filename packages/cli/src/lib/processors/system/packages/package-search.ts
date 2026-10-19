import { ScriptLoaderService } from '../../../services/script-loader';
import { isNewerVersion, KNOWN_PLUGIN_SHORT_NAMES } from './package-utils';

export interface AvailablePackage {
    name: string;
    shortName: string;
    version: string;
    description: string;
    /** Source names, comma separated when several serve the same version. */
    source: string;
}

/** Registry document of a package (`GET <registry>/<name>`). */
export interface PackageRegistryDocument {
    versions?: Record<string, unknown>;
    time?: Record<string, string>;
    'dist-tags'?: Record<string, string>;
}

const FALLBACK_REGISTRY = { name: 'npm', url: 'https://registry.npmjs.org/' };

/**
 * Collect the plugins available across all sources: registry sources are
 * searched, file sources are probed for the known official plugins.
 * The newest version wins when sources disagree.
 */
export async function collectAvailablePackages(
    loader: ScriptLoaderService,
    prefix: string,
    signal: AbortSignal,
    onProgress: (text: string) => void,
): Promise<AvailablePackage[]> {
    const found = new Map<string, AvailablePackage>();

    const merge = (candidate: AvailablePackage) => {
        const existing = found.get(candidate.name);
        if (!existing) {
            found.set(candidate.name, candidate);
        } else if (isNewerVersion(candidate.version, existing.version)) {
            found.set(candidate.name, {
                ...candidate,
                description: candidate.description || existing.description,
            });
        } else if (
            candidate.version === existing.version &&
            !existing.source.includes(candidate.source)
        ) {
            existing.source += `, ${candidate.source}`;
        }
    };

    for (const registry of loader.getSourcesByKind('registry')) {
        if (signal.aborted) break;
        onProgress(`Searching ${registry.name} registry`);
        try {
            const response = await loader.getScript(
                `${registry.url}-/v1/search?text=${encodeURIComponent(prefix)}&size=250`,
                { signal },
            );
            const data = JSON.parse(response.content || '{}');
            for (const { package: pkg } of data.objects || []) {
                if (
                    !pkg?.name?.startsWith(prefix) ||
                    pkg.name === `${prefix}core`
                )
                    continue;
                merge({
                    name: pkg.name,
                    shortName: pkg.name.slice(prefix.length),
                    version: pkg.version,
                    description: pkg.description || '',
                    source: registry.name,
                });
            }
        } catch {
            // Registry unavailable, continue with other sources
        }
    }

    for (const fileSource of loader.getSourcesByKind('file')) {
        if (signal.aborted) break;
        onProgress(`Scanning ${fileSource.name}`);
        const probes = await Promise.all(
            KNOWN_PLUGIN_SHORT_NAMES.map(async (shortName) => {
                try {
                    const response = await loader.getScript(
                        `${fileSource.url}${prefix}${shortName}/package.json`,
                        { signal },
                    );
                    const info = JSON.parse(response.content || '{}');
                    return {
                        name: `${prefix}${shortName}`,
                        shortName,
                        version: info.version || 'latest',
                        description: info.description || '',
                        source: fileSource.name,
                    } satisfies AvailablePackage;
                } catch {
                    return null; // Not available on this source
                }
            }),
        );
        if (signal.aborted) break;
        probes.forEach((probe) => probe && merge(probe));
    }

    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch a package's registry document from the first registry source that
 * knows it (npm by default, or a configured one such as Verdaccio).
 * Returns `undefined` when no registry has the package.
 */
export async function fetchRegistryDocument(
    loader: ScriptLoaderService,
    fullName: string,
    signal: AbortSignal,
): Promise<PackageRegistryDocument | undefined> {
    const registries = loader.getSourcesByKind('registry');
    let lastError: unknown;

    for (const registry of registries.length
        ? registries
        : [FALLBACK_REGISTRY]) {
        if (signal.aborted) return undefined;
        try {
            const response = await loader.getScript(
                `${registry.url}${encodeURIComponent(fullName)}`,
                {
                    signal,
                },
            );
            const data: PackageRegistryDocument = JSON.parse(
                response.content || '{}',
            );
            if (data.versions) return data;
        } catch (e) {
            lastError = e;
        }
    }

    if (lastError) throw lastError;
    return undefined;
}
