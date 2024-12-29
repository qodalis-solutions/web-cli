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
        },
    ): Promise<{
        xhr: XMLHttpRequest;
    }> {
        const { onProgress } = options || {};

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', src, true);

            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const progress = Math.round(
                        (event.loaded / event.total) * 100,
                    );
                    onProgress?.(progress);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const script = document.createElement('script');
                    script.text = xhr.responseText;
                    document.head.appendChild(script);
                    onProgress?.(100);
                    resolve({
                        xhr,
                    });
                } else {
                    reject(
                        new Error(
                            `Failed to load package: ${src}, Status: ${xhr.status}`,
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
}
