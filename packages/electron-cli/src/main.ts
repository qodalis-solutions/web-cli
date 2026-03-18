/**
 * Main process helpers for @qodalis/electron-cli.
 *
 * Call `registerElectronCliIpcHandlers()` in your Electron main process
 * to register the IPC handlers that the preload bridge depends on.
 *
 * @example
 * ```ts
 * // main.ts (Electron main process)
 * import { registerElectronCliIpcHandlers } from '@qodalis/electron-cli/main';
 * registerElectronCliIpcHandlers();
 * ```
 */
import { app, ipcMain, dialog, clipboard, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface ElectronCliMainOptions {
    /** Restrict filesystem access to these directories. If empty, all paths are allowed. */
    allowedPaths?: string[];
}

/**
 * Registers all IPC handlers needed by the @qodalis/electron-cli preload bridge.
 * Call this once in your main process before creating any BrowserWindow.
 */
export function registerElectronCliIpcHandlers(
    options: ElectronCliMainOptions = {},
): void {
    const { allowedPaths = [] } = options;

    function validatePath(targetPath: string): void {
        if (allowedPaths.length === 0) return;
        const resolved = path.resolve(targetPath);
        const allowed = allowedPaths.some((p) =>
            resolved.startsWith(path.resolve(p)),
        );
        if (!allowed) {
            throw new Error(`Access denied: ${targetPath}`);
        }
    }

    // --- File dialogs ---

    ipcMain.handle(
        'electron-cli:show-open-dialog',
        async (
            _event,
            options?: {
                accept?: string;
                multiple?: boolean;
                directory?: boolean;
                readAs?: 'text' | 'arraybuffer';
            },
        ) => {
            const win = BrowserWindow.getFocusedWindow();
            const filters: { name: string; extensions: string[] }[] = [];
            if (options?.accept) {
                filters.push({
                    name: 'Files',
                    extensions: options.accept
                        .split(',')
                        .map((ext) => ext.trim().replace(/^\./, '')),
                });
            }

            const properties: ('openFile' | 'openDirectory' | 'multiSelections')[] =
                options?.directory ? ['openDirectory'] : ['openFile'];
            if (options?.multiple && !options?.directory) {
                properties.push('multiSelections');
            }

            const result = await dialog.showOpenDialog(win!, {
                properties,
                filters: filters.length > 0 ? filters : undefined,
            });
            if (result.canceled || result.filePaths.length === 0) return null;

            return result.filePaths.map((filePath) => {
                const stat = fs.statSync(filePath);
                let content: string | ArrayBuffer;
                if (options?.readAs === 'arraybuffer') {
                    const buf = fs.readFileSync(filePath);
                    content = buf.buffer.slice(
                        buf.byteOffset,
                        buf.byteOffset + buf.byteLength,
                    ) as ArrayBuffer;
                } else {
                    content = fs.readFileSync(filePath, 'utf-8');
                }
                return {
                    name: path.basename(filePath),
                    path: filePath,
                    content,
                    size: stat.size,
                    type: 'application/octet-stream',
                };
            });
        },
    );

    ipcMain.handle(
        'electron-cli:show-save-dialog',
        async (_event, filename: string, content: string) => {
            const win = BrowserWindow.getFocusedWindow();
            const result = await dialog.showSaveDialog(win!, {
                defaultPath: filename,
            });
            if (result.canceled || !result.filePath) return false;

            fs.writeFileSync(result.filePath, content, 'utf-8');
            return true;
        },
    );

    // --- Filesystem ---

    ipcMain.handle('electron-cli:read-file', async (_event, filePath: string) => {
        validatePath(filePath);
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return null;
        }
    });

    ipcMain.handle(
        'electron-cli:write-file',
        async (_event, filePath: string, content: string) => {
            validatePath(filePath);
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf-8');
        },
    );

    ipcMain.handle('electron-cli:list-files', async (_event, dirPath: string) => {
        validatePath(dirPath);
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map((entry) => {
            const fullPath = path.join(dirPath, entry.name);
            const stat = fs.statSync(fullPath);
            return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: stat.size,
                modified: stat.mtime.toISOString(),
            };
        });
    });

    ipcMain.handle('electron-cli:file-exists', async (_event, filePath: string) => {
        validatePath(filePath);
        return fs.existsSync(filePath);
    });

    // --- Clipboard ---

    ipcMain.handle('electron-cli:read-clipboard', async () => {
        return clipboard.readText();
    });

    ipcMain.handle('electron-cli:write-clipboard', async (_event, text: string) => {
        clipboard.writeText(text);
    });

    // --- Shell ---

    ipcMain.handle('electron-cli:open-external', async (_event, url: string) => {
        await shell.openExternal(url);
    });

    // --- App info ---

    ipcMain.handle('electron-cli:get-app-path', async () => {
        return app.getAppPath();
    });
}
