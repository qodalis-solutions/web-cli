import { Injectable } from '@angular/core';

export type CdnSourceName = 'unpkg' | 'jsdelivr';

const CDN_BASE_URLS: Record<CdnSourceName, string> = {
    unpkg: 'https://unpkg.com/',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/',
};

const DEFAULT_CDN_ORDER: CdnSourceName[] = ['unpkg', 'jsdelivr'];

@Injectable({
    providedIn: 'root',
})
export class ScriptLoaderService {
    private cdnOrder: CdnSourceName[] = [...DEFAULT_CDN_ORDER];

    constructor() {}

    /**
     * Sets the preferred CDN source. The other source becomes the fallback.
     */
    setCdnSource(preferred: CdnSourceName): void {
        const all: CdnSourceName[] = ['unpkg', 'jsdelivr'];
        this.cdnOrder = [preferred, ...all.filter((s) => s !== preferred)];
    }

    /**
     * Returns the current preferred CDN source name.
     */
    getCdnSource(): CdnSourceName {
        return this.cdnOrder[0];
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
     * The first entry is the primary CDN, the rest are fallbacks.
     */
    getCdnUrls(packagePath: string): string[] {
        return this.cdnOrder.map((name) => `${CDN_BASE_URLS[name]}${packagePath}`);
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
