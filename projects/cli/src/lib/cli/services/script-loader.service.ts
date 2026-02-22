import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class ScriptLoaderService {
    constructor() {}

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
}
