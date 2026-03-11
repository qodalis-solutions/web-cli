import type {
    ICliFileTransferService,
    ICliFileEntry,
} from '@qodalis/cli-core';

/**
 * Electron-native file transfer service.
 *
 * Uses `window.electronCliApi` (exposed via the preload script) to access
 * native file dialogs and the real filesystem instead of browser-only APIs.
 */
export class ElectronFileTransferService implements ICliFileTransferService {
    private get api() {
        if (!window.electronCliApi) {
            throw new Error(
                'ElectronFileTransferService: window.electronCliApi is not available. ' +
                'Make sure exposeElectronCliApi() is called in your preload script.',
            );
        }
        return window.electronCliApi;
    }

    async readFile(path: string): Promise<string | null> {
        return this.api.readFile(path);
    }

    async writeFile(path: string, content: string): Promise<void> {
        return this.api.writeFile(path, content);
    }

    async listFiles(path: string): Promise<ICliFileEntry[]> {
        return this.api.listFiles(path);
    }

    async exists(path: string): Promise<boolean> {
        return this.api.fileExists(path);
    }

    downloadToBrowser(filename: string, content: string | Blob): void {
        const text =
            content instanceof Blob
                ? '[Blob downloads not supported in Electron — use writeFile instead]'
                : content;
        // Fire-and-forget: show native save dialog
        this.api.showSaveDialog(filename, text);
    }

    async uploadFromBrowser(
        accept?: string,
    ): Promise<{ name: string; content: string } | null> {
        return this.api.showOpenDialog({ accept });
    }
}
