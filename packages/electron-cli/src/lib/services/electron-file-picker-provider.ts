import {
    ICliFilePickerProvider,
    CliFilePickerOptions,
    CliFileResult,
} from '@qodalis/cli-core';

/**
 * Electron-native file picker provider.
 *
 * Uses `window.electronCliApi.showOpenDialog` (exposed via contextBridge in the
 * preload script) to open a native file/directory dialog.
 *
 * This provider is automatically active when `window.electronCliApi` is present.
 * Register it via the `electronModule` or supply it directly to the CLI config.
 */
export class ElectronFilePickerProvider implements ICliFilePickerProvider {
    /** True when running inside an Electron renderer that exposes the API bridge. */
    readonly isSupported =
        typeof window !== 'undefined' && !!(window as any).electronCliApi;

    /**
     * Open a native file picker dialog and return the selected files.
     * @returns Array of selected files, or null if the user cancelled.
     */
    async pickFiles(options?: CliFilePickerOptions): Promise<CliFileResult[] | null> {
        const api = (window as any).electronCliApi;
        if (!api) return null;

        const results = await api.showOpenDialog({
            accept: options?.accept,
            multiple: options?.multiple,
            directory: options?.directory,
            readAs: options?.readAs,
        });
        if (!results) return null;

        return results.map((r: any) => ({
            name: r.name,
            path: r.path,
            content: r.content,
            size: r.size,
            type: r.type || 'application/octet-stream',
        }));
    }

    /**
     * Open a native directory picker dialog and return the selected directory.
     * @returns The selected directory result, or null if the user cancelled.
     */
    async pickDirectory(): Promise<CliFileResult | null> {
        const results = await this.pickFiles({ directory: true });
        return results?.[0] ?? null;
    }
}
