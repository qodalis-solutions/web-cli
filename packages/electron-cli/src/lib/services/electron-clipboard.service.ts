import type { ICliClipboard } from '@qodalis/cli-core';

/**
 * Electron-native clipboard service.
 *
 * Uses `window.electronCliApi` (exposed via the preload script) to access
 * the Electron clipboard module, which is more reliable than the browser
 * `navigator.clipboard` API (no focus requirements, no permissions prompts).
 */
export class ElectronClipboardService implements ICliClipboard {
    private get api() {
        if (!window.electronCliApi) {
            throw new Error(
                'ElectronClipboardService: window.electronCliApi is not available. ' +
                'Make sure exposeElectronCliApi() is called in your preload script.',
            );
        }
        return window.electronCliApi;
    }

    async write(text: string): Promise<void> {
        return this.api.writeClipboard(text);
    }

    async read(): Promise<string> {
        return this.api.readClipboard();
    }
}
