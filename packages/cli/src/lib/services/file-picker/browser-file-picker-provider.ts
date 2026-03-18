import { ICliFilePickerProvider, CliFilePickerOptions, CliFileResult } from '@qodalis/cli-core';

/**
 * Browser-based file picker provider using the native HTML file input element.
 * Supported in any environment where `document` is available.
 */
export class BrowserFilePickerProvider implements ICliFilePickerProvider {
    readonly isSupported = typeof document !== 'undefined';

    async pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        if (!this.isSupported) return null;

        if (options?.directory) {
            const dir = await this.pickDirectory();
            return dir ? [dir] : null;
        }

        return new Promise<CliFileResult[] | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.style.display = 'none';
            if (options?.accept) input.accept = options.accept;
            if (options?.multiple) input.multiple = true;

            input.addEventListener('change', async () => {
                const files = input.files;
                if (!files || files.length === 0) {
                    resolve(null);
                    input.remove();
                    return;
                }
                const readAs = options?.readAs ?? 'text';
                const results: CliFileResult[] = [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const content = await this.readFile(file, readAs);
                    results.push({
                        name: file.name,
                        content,
                        size: file.size,
                        type: file.type || 'application/octet-stream',
                    });
                }
                resolve(results);
                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    async pickDirectory(): Promise<CliFileResult | null> {
        if (!this.isSupported) return null;

        return new Promise<CliFileResult | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.style.display = 'none';
            (input as any).webkitdirectory = true;

            input.addEventListener('change', () => {
                const files = input.files;
                if (!files || files.length === 0) {
                    resolve(null);
                } else {
                    const pathParts = (files[0] as any).webkitRelativePath?.split('/') ?? [];
                    resolve({
                        name: pathParts[0] || 'selected-directory',
                        content: '',
                        size: 0,
                        type: 'inode/directory',
                    });
                }
                input.remove();
            });

            input.addEventListener('cancel', () => {
                resolve(null);
                input.remove();
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    private readFile(file: File, readAs: 'text' | 'arraybuffer'): Promise<string | ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string | ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            if (readAs === 'arraybuffer') {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }
}
