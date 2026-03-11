import { ICliFileEntry, ICliFileTransferService } from '../interfaces/file-transfer';

export class BrowserFileTransferService implements ICliFileTransferService {
    async readFile(_path: string): Promise<string | null> {
        return this._pickFile().then(r => r?.content ?? null);
    }

    async writeFile(path: string, content: string): Promise<void> {
        const filename = path.split('/').pop() || 'download';
        this.downloadToBrowser(filename, content);
    }

    async listFiles(_path: string): Promise<ICliFileEntry[]> {
        return [];
    }

    async exists(_path: string): Promise<boolean> {
        return false;
    }

    downloadToBrowser(filename: string, content: string | Blob): void {
        const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async uploadFromBrowser(accept?: string): Promise<{ name: string; content: string } | null> {
        return this._pickFile(accept);
    }

    private _pickFile(accept?: string): Promise<{ name: string; content: string } | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (accept) {
                input.accept = accept;
            }
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                    resolve({ name: file.name, content: reader.result as string });
                };
                reader.onerror = () => resolve(null);
                reader.readAsText(file);
            };
            input.oncancel = () => resolve(null);
            input.click();
        });
    }
}
