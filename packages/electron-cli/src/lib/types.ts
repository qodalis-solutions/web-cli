/**
 * API shape exposed to the renderer via contextBridge.
 * The preload script calls `exposeElectronCliApi()` which makes
 * `window.electronCliApi` available with these methods.
 */
export interface ElectronCliApi {
    // File dialogs
    showOpenDialog(options?: {
        accept?: string;
    }): Promise<{ name: string; content: string } | null>;
    showSaveDialog(
        filename: string,
        content: string,
    ): Promise<boolean>;

    // Real filesystem access
    readFile(path: string): Promise<string | null>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(
        path: string,
    ): Promise<{ name: string; type: 'file' | 'directory'; size: number; modified: string }[]>;
    fileExists(path: string): Promise<boolean>;

    // Clipboard
    readClipboard(): Promise<string>;
    writeClipboard(text: string): Promise<void>;

    // Shell
    openExternal(url: string): Promise<void>;

    // App info
    getAppPath(): Promise<string>;
}

declare global {
    interface Window {
        electronCliApi: ElectronCliApi;
    }
}
