export type CdnSourceName = string;

export type SourceKind = 'registry' | 'file';

export interface SourceEntry {
    url: string;
    kind: SourceKind;
}

const BUILTIN_SOURCES: Record<string, SourceEntry> = {
    unpkg: { url: 'https://unpkg.com/', kind: 'file' },
    jsdelivr: { url: 'https://cdn.jsdelivr.net/npm/', kind: 'file' },
    npm: { url: 'https://registry.npmjs.org/', kind: 'registry' },
};

export class ScriptLoaderService {
    private sources: Map<string, SourceEntry> = new Map(
        Object.entries(BUILTIN_SOURCES),
    );
    private primary: string = 'unpkg';

    constructor() {}

    /**
     * Registers a custom package source.
     */
    addSource(name: string, url: string, kind: SourceKind = 'file'): void {
        // Ensure trailing slash
        this.sources.set(name, {
            url: url.endsWith('/') ? url : url + '/',
            kind,
        });
    }

    /**
     * Returns all registered source names.
     */
    getSources(): string[] {
        return Array.from(this.sources.keys());
    }

    /**
     * Returns the full source entry for a given name, or undefined if not found.
     */
    getSource(name: string): SourceEntry | undefined {
        return this.sources.get(name);
    }

    /**
     * Returns the base URL for a given source name, or undefined if not found.
     */
    getSourceUrl(name: string): string | undefined {
        return this.sources.get(name)?.url;
    }

    /**
     * Returns all sources of a given kind.
     */
    getSourcesByKind(kind: SourceKind): { name: string; url: string }[] {
        const result: { name: string; url: string }[] = [];
        for (const [name, entry] of this.sources) {
            if (entry.kind === kind) {
                result.push({ name, url: entry.url });
            }
        }
        return result;
    }

    /**
     * Sets the preferred CDN source. The other sources become fallbacks.
     */
    setCdnSource(preferred: CdnSourceName): void {
        if (this.sources.has(preferred)) {
            this.primary = preferred;
        }
    }

    /**
     * Returns the current preferred CDN source name.
     */
    getCdnSource(): CdnSourceName {
        return this.primary;
    }

    injectScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () =>
                reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    getScript(
        src: string,
        options?: {
            onProgress?: (progress: number) => void;
            signal?: AbortSignal;
        },
    ): Promise<{
        xhr: XMLHttpRequest;
        content?: string;
        error?: any;
    }> {
        const { onProgress, signal } = options || {};

        let fetchProgress = 0;

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', src, true);

            if (signal) {
                if (signal.aborted) {
                    reject(new Error('Aborted'));
                    return;
                }

                signal.addEventListener('abort', () => {
                    xhr.abort();
                    reject(new Error('Aborted'));
                });
            }

            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round(
                        (event.loaded / event.total) * 100,
                    );
                    fetchProgress = progress;

                    onProgress?.(progress);
                } else {
                    fetchProgress += 20;
                    onProgress?.(fetchProgress);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    onProgress?.(100);
                    fetchProgress = 100;
                    resolve({
                        xhr,
                        content: xhr.responseText,
                    });
                } else {
                    reject(
                        new Error(
                            `Failed to load package: ${src}, Status: ${xhr.status}, Message: ${xhr.responseText}`,
                        ),
                    );
                }
            };

            xhr.onerror = () => {
                reject(new Error(`Failed to load package: ${src}`));
            };

            xhr.send();
        });
    }

    injectBodyScript(code: string): void {
        const script = document.createElement('script');
        script.text = code;
        document.head.appendChild(script);
    }

    /**
     * Returns CDN URLs for a given npm package path.
     * The first entry is the primary source, the rest are fallbacks.
     * Only includes 'file' kind sources (CDNs and file servers).
     */
    getCdnUrls(packagePath: string): string[] {
        const urls: string[] = [];
        const primaryEntry = this.sources.get(this.primary);
        if (primaryEntry && primaryEntry.kind === 'file') {
            urls.push(`${primaryEntry.url}${packagePath}`);
        }
        for (const [name, entry] of this.sources) {
            if (name !== this.primary && entry.kind === 'file') {
                urls.push(`${entry.url}${packagePath}`);
            }
        }
        return urls;
    }

    /**
     * Tries to fetch a script from multiple CDN sources, falling back on failure.
     */
    getScriptWithFallback(
        packagePath: string,
        options?: {
            onProgress?: (progress: number) => void;
            signal?: AbortSignal;
        },
    ): Promise<{
        xhr: XMLHttpRequest;
        content?: string;
        error?: any;
    }> {
        const urls = this.getCdnUrls(packagePath);
        return this.getScriptFromUrls(urls, options);
    }

    /**
     * Tries to inject a script tag from multiple CDN sources, falling back on failure.
     */
    injectScriptWithFallback(packagePath: string): Promise<void> {
        const urls = this.getCdnUrls(packagePath);
        return this.injectScriptFromUrls(urls);
    }

    private async getScriptFromUrls(
        urls: string[],
        options?: {
            onProgress?: (progress: number) => void;
            signal?: AbortSignal;
        },
    ): Promise<{
        xhr: XMLHttpRequest;
        content?: string;
        error?: any;
    }> {
        let lastError: any;
        for (const url of urls) {
            try {
                return await this.getScript(url, options);
            } catch (e: any) {
                if (e?.message === 'Aborted') throw e;
                lastError = e;
            }
        }
        throw lastError;
    }

    private async injectScriptFromUrls(urls: string[]): Promise<void> {
        let lastError: any;
        for (const url of urls) {
            try {
                return await this.injectScript(url);
            } catch (e) {
                lastError = e;
            }
        }
        throw lastError;
    }
}
