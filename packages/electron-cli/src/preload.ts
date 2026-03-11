/**
 * Preload script helpers for @qodalis/electron-cli.
 *
 * Call `exposeElectronCliApi()` in your Electron preload script to expose
 * the IPC bridge that renderer-side services depend on.
 *
 * @example
 * ```ts
 * // preload.ts
 * import { exposeElectronCliApi } from '@qodalis/electron-cli/preload';
 * exposeElectronCliApi();
 * ```
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronCliApi } from './lib/types';

export type { ElectronCliApi } from './lib/types';

/**
 * Exposes the Electron CLI API to the renderer process via contextBridge.
 * After calling this, `window.electronCliApi` is available in the renderer.
 */
export function exposeElectronCliApi(): void {
    const api: ElectronCliApi = {
        // File dialogs
        showOpenDialog: (options) =>
            ipcRenderer.invoke('electron-cli:show-open-dialog', options),
        showSaveDialog: (filename, content) =>
            ipcRenderer.invoke('electron-cli:show-save-dialog', filename, content),

        // Filesystem
        readFile: (path) =>
            ipcRenderer.invoke('electron-cli:read-file', path),
        writeFile: (path, content) =>
            ipcRenderer.invoke('electron-cli:write-file', path, content),
        listFiles: (path) =>
            ipcRenderer.invoke('electron-cli:list-files', path),
        fileExists: (path) =>
            ipcRenderer.invoke('electron-cli:file-exists', path),

        // Clipboard
        readClipboard: () =>
            ipcRenderer.invoke('electron-cli:read-clipboard'),
        writeClipboard: (text) =>
            ipcRenderer.invoke('electron-cli:write-clipboard', text),

        // Shell
        openExternal: (url) =>
            ipcRenderer.invoke('electron-cli:open-external', url),

        // App info
        getAppPath: () =>
            ipcRenderer.invoke('electron-cli:get-app-path'),
    };

    contextBridge.exposeInMainWorld('electronCliApi', api);
}
