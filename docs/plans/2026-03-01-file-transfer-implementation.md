# File Transfer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SCP-like file transfer and wget-style URL downloads to the Qodalis web CLI, with server-side filesystem API across .NET, Node.js, and Python servers.

**Architecture:** File abstraction layer in `@qodalis/cli-core` with default browser implementation, overridden by `@qodalis/cli-files` when loaded. Two browser plugins (`@qodalis/cli-scp`, `@qodalis/cli-wget`) consume the abstraction. Three servers expose identical `/api/cli/fs/*` REST endpoints.

**Tech Stack:** TypeScript (browser plugins + Node.js server), C# (.NET server), Python/FastAPI (Python server), IndexedDB (virtual FS), browser `fetch()` API.

**Design doc:** `docs/plans/2026-03-01-file-transfer-design.md`

---

## Task 1: Add ICliFileTransferService to @qodalis/cli-core

**Files:**
- Create: `packages/core/src/lib/interfaces/file-transfer.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`
- Modify: `packages/core/src/lib/tokens.ts`
- Create: `packages/core/src/lib/services/browser-file-transfer.service.ts`
- Create: `packages/core/src/lib/services/index.ts`
- Modify: `packages/core/src/public-api.ts`

**Step 1: Create the interface and token**

Create `packages/core/src/lib/interfaces/file-transfer.ts`:

```typescript
/**
 * Represents an entry in a file listing.
 */
export interface ICliFileEntry {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
}

/**
 * Token for the file transfer service.
 */
export const ICliFileTransferService_TOKEN = 'cli-file-transfer-service';

/**
 * Abstraction for file transfer operations.
 * Default implementation uses browser-native APIs (file picker, download dialog).
 * @qodalis/cli-files overrides with virtual FS backed by IndexedDB.
 */
export interface ICliFileTransferService {
    /**
     * Read a file's content by path.
     * Default: opens browser file picker (path is used as suggested name).
     */
    readFile(path: string): Promise<string | null>;

    /**
     * Write content to a file at the given path.
     * Default: triggers browser "Save As" download.
     */
    writeFile(path: string, content: string): Promise<void>;

    /**
     * List files in a directory.
     * Default: returns empty array (no filesystem).
     */
    listFiles(path: string): Promise<ICliFileEntry[]>;

    /**
     * Check if a file or directory exists.
     * Default: returns false (no filesystem).
     */
    exists(path: string): Promise<boolean>;

    /**
     * Download content to the user's real disk via browser download dialog.
     * Always available, even when virtual FS is active.
     */
    downloadToBrowser(filename: string, content: string | Blob): void;

    /**
     * Open browser file picker to upload a file.
     * Always available, even when virtual FS is active.
     * Returns null if user cancels the picker.
     */
    uploadFromBrowser(accept?: string): Promise<{ name: string; content: string } | null>;
}
```

**Step 2: Create the default browser implementation**

Create `packages/core/src/lib/services/browser-file-transfer.service.ts`:

```typescript
import { ICliFileEntry, ICliFileTransferService } from '../interfaces/file-transfer';

/**
 * Default file transfer service using browser-native APIs.
 * Used when @qodalis/cli-files is not loaded.
 */
export class BrowserFileTransferService implements ICliFileTransferService {
    async readFile(_path: string): Promise<string | null> {
        return this._pickFile();
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
```

Create `packages/core/src/lib/services/index.ts`:

```typescript
export * from './browser-file-transfer.service';
```

**Step 3: Wire up exports**

Add to `packages/core/src/lib/interfaces/index.ts` (at end):

```typescript
export * from './file-transfer';
```

Add to `packages/core/src/lib/tokens.ts` (at end):

```typescript
/**
 * Framework-agnostic token for the CLI file transfer service.
 * Used as a key in the service provider to retrieve the file transfer service.
 */
export const ICliFileTransferService_TOKEN = 'cli-file-transfer-service';
```

Add to `packages/core/src/public-api.ts` (at end):

```typescript
export * from './lib/services';
```

**Step 4: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build core`
Expected: Build succeeds, `dist/core/` contains new exports.

**Step 5: Commit**

```bash
git add packages/core/src/lib/interfaces/file-transfer.ts \
       packages/core/src/lib/services/browser-file-transfer.service.ts \
       packages/core/src/lib/services/index.ts \
       packages/core/src/lib/interfaces/index.ts \
       packages/core/src/lib/tokens.ts \
       packages/core/src/public-api.ts
git commit -m "feat(core): add ICliFileTransferService interface and browser default implementation"
```

---

## Task 2: Override file transfer in @qodalis/cli-files

**Files:**
- Create: `packages/plugins/files/src/lib/services/virtual-fs-file-transfer.service.ts`
- Modify: `packages/plugins/files/src/lib/services/index.ts`
- Modify: `packages/plugins/files/src/public-api.ts`

**Step 1: Create the virtual FS file transfer implementation**

Create `packages/plugins/files/src/lib/services/virtual-fs-file-transfer.service.ts`:

```typescript
import {
    ICliFileTransferService,
    ICliFileEntry,
    BrowserFileTransferService,
} from '@qodalis/cli-core';
import { IFileSystemService } from '../interfaces';

/**
 * File transfer service backed by the virtual filesystem (IndexedDB).
 * Delegates browser-native operations to BrowserFileTransferService.
 */
export class VirtualFsFileTransferService implements ICliFileTransferService {
    private readonly _browserService = new BrowserFileTransferService();

    constructor(private readonly _fs: IFileSystemService) {}

    async readFile(path: string): Promise<string | null> {
        const resolved = this._fs.resolvePath(path);
        return this._fs.readFile(resolved);
    }

    async writeFile(path: string, content: string): Promise<void> {
        const resolved = this._fs.resolvePath(path);
        this._fs.writeFile(resolved, content);
        await this._fs.persist();
    }

    async listFiles(path: string): Promise<ICliFileEntry[]> {
        const resolved = this._fs.resolvePath(path);
        const nodes = this._fs.listDirectory(resolved);
        return nodes.map((node) => ({
            name: node.name,
            type: node.type === 'directory' ? 'directory' as const : 'file' as const,
            size: node.size || 0,
            modified: node.modifiedAt?.toISOString() || new Date().toISOString(),
        }));
    }

    async exists(path: string): Promise<boolean> {
        const resolved = this._fs.resolvePath(path);
        return this._fs.exists(resolved);
    }

    downloadToBrowser(filename: string, content: string | Blob): void {
        this._browserService.downloadToBrowser(filename, content);
    }

    async uploadFromBrowser(accept?: string): Promise<{ name: string; content: string } | null> {
        return this._browserService.uploadFromBrowser(accept);
    }
}
```

**Step 2: Export the service**

Add to `packages/plugins/files/src/lib/services/index.ts`:

```typescript
export * from './virtual-fs-file-transfer.service';
```

**Step 3: Register the override in the module**

In `packages/plugins/files/src/public-api.ts`, add the import and service registration:

Add import at top:

```typescript
import { ICliFileTransferService_TOKEN } from '@qodalis/cli-core';
import { VirtualFsFileTransferService } from './lib/services/virtual-fs-file-transfer.service';
```

Add to the `services` array in `filesModule`:

```typescript
{
    provide: ICliFileTransferService_TOKEN,
    useValue: new VirtualFsFileTransferService(fsService),
},
```

**Step 4: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build files`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/plugins/files/src/lib/services/virtual-fs-file-transfer.service.ts \
       packages/plugins/files/src/lib/services/index.ts \
       packages/plugins/files/src/public-api.ts
git commit -m "feat(files): add VirtualFsFileTransferService overriding core default"
```

---

## Task 3: Implement @qodalis/cli-wget plugin

**Files:**
- Modify: `packages/plugins/wget/src/lib/processors/cli-wget-command-processor.ts`
- Modify: `packages/plugins/wget/src/public-api.ts`

**Step 1: Implement the wget command processor**

Replace `packages/plugins/wget/src/lib/processors/cli-wget-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliCommandParameterDescriptor,
    ICliExecutionContext,
    ICliFileTransferService,
    ICliFileTransferService_TOKEN,
    BrowserFileTransferService,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliWgetCommandCommandProcessor implements ICliCommandProcessor {
    command = 'wget';

    description = 'Download files from any HTTP/HTTPS URL';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    acceptsRawInput = true;

    valueRequired = true;

    metadata = {
        icon: '⬇',
    };

    parameters: ICliCommandParameterDescriptor[] = [
        {
            name: 'output',
            aliases: ['o'],
            type: 'string',
            description: 'Output filename (default: derived from URL)',
            required: false,
        },
        {
            name: 'header',
            aliases: ['H'],
            type: 'array',
            description: 'Custom HTTP header (can be repeated)',
            required: false,
        },
        {
            name: 'no-progress',
            type: 'boolean',
            description: 'Suppress progress bar',
            required: false,
        },
        {
            name: 'save',
            type: 'boolean',
            description: 'Save to browser downloads instead of virtual filesystem',
            required: false,
        },
    ];

    processors: ICliCommandProcessor[] = [];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const url = command.value?.trim();
        if (!url) {
            context.writer.writeError('Usage: wget <url> [-o filename] [--header "Name: Value"]');
            context.process.exit(1);
            return;
        }

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            context.writer.writeError(`Invalid URL: ${url}`);
            context.process.exit(1);
            return;
        }

        // Resolve output filename
        const outputName = command.args['output'] || command.args['o']
            || this._filenameFromUrl(parsedUrl);

        // Build headers
        const headers: Record<string, string> = {};
        const rawHeaders = command.args['header'] || command.args['H'];
        if (rawHeaders) {
            const headerList = Array.isArray(rawHeaders) ? rawHeaders : [rawHeaders];
            for (const h of headerList) {
                const colonIdx = h.indexOf(':');
                if (colonIdx > 0) {
                    headers[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
                }
            }
        }

        const showProgress = !command.args['no-progress'];
        const saveToBrowser = !!command.args['save'];

        // Get file transfer service
        const fileTransfer = this._getFileTransferService(context);

        // Set up abort controller
        const abortController = new AbortController();
        const abortSub = context.onAbort.subscribe(() => abortController.abort());

        try {
            if (showProgress) {
                context.spinner?.show(`Connecting to ${parsedUrl.hostname}...`);
            }

            const response = await fetch(url, {
                headers,
                signal: abortController.signal,
            });

            if (!response.ok) {
                context.spinner?.hide();
                context.writer.writeError(`HTTP ${response.status}: ${response.statusText}`);
                context.process.exit(1);
                return;
            }

            const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
            const contentType = response.headers.get('content-type') || '';

            context.spinner?.hide();

            if (showProgress && contentLength > 0) {
                context.progressBar.show(`Downloading ${outputName}`);
            } else if (showProgress) {
                context.spinner?.show(`Downloading ${outputName}...`);
            }

            // Stream the response
            const reader = response.body?.getReader();
            if (!reader) {
                const text = await response.text();
                if (saveToBrowser) {
                    fileTransfer.downloadToBrowser(outputName, text);
                } else {
                    await fileTransfer.writeFile(outputName, text);
                }
                context.spinner?.hide();
                context.writer.writeSuccess(`Saved: ${outputName}`);
                return;
            }

            const chunks: Uint8Array[] = [];
            let receivedBytes = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.length;

                if (showProgress && contentLength > 0) {
                    const progress = receivedBytes / contentLength;
                    context.progressBar.update(progress, {
                        text: `${outputName} (${this._formatBytes(receivedBytes)}/${this._formatBytes(contentLength)})`,
                    });
                } else if (showProgress) {
                    context.spinner?.setText(`Downloading ${outputName}... ${this._formatBytes(receivedBytes)}`);
                }
            }

            // Combine chunks
            const combined = new Uint8Array(receivedBytes);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            if (showProgress && contentLength > 0) {
                context.progressBar.complete();
                context.progressBar.hide();
            } else {
                context.spinner?.hide();
            }

            // Determine if content is text or binary
            const isText = contentType.includes('text') || contentType.includes('json') || contentType.includes('xml');

            if (saveToBrowser) {
                const blob = new Blob([combined]);
                fileTransfer.downloadToBrowser(outputName, blob);
            } else if (isText) {
                const text = new TextDecoder().decode(combined);
                await fileTransfer.writeFile(outputName, text);
            } else {
                // Binary: save as base64 to virtual FS or download to browser
                const blob = new Blob([combined]);
                fileTransfer.downloadToBrowser(outputName, blob);
                context.writer.writeInfo('Binary file saved to browser downloads.');
            }

            context.writer.writeSuccess(`Downloaded: ${outputName} (${this._formatBytes(receivedBytes)})`);
        } catch (err: any) {
            context.spinner?.hide();
            context.progressBar.hide();

            if (err.name === 'AbortError') {
                context.writer.writeWarning('Download cancelled.');
            } else {
                context.writer.writeError(`Download failed: ${err.message}`);
            }
            context.process.exit(1);
        } finally {
            abortSub.unsubscribe();
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }

    private _getFileTransferService(context: ICliExecutionContext): ICliFileTransferService {
        try {
            return context.services.get<ICliFileTransferService>(ICliFileTransferService_TOKEN);
        } catch {
            return new BrowserFileTransferService();
        }
    }

    private _filenameFromUrl(url: URL): string {
        const pathname = url.pathname;
        const segments = pathname.split('/').filter(Boolean);
        return segments.length > 0 ? segments[segments.length - 1] : 'download';
    }

    private _formatBytes(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
}
```

**Step 2: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build wget`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/plugins/wget/
git commit -m "feat(wget): implement wget command with streaming download and progress"
```

---

## Task 4: Implement @qodalis/cli-scp plugin — transfer service and interfaces

**Files:**
- Create: `packages/plugins/scp/src/lib/interfaces/index.ts`
- Create: `packages/plugins/scp/src/lib/services/scp-transfer.service.ts`

**Step 1: Create interfaces and types**

Create `packages/plugins/scp/src/lib/interfaces/index.ts`:

```typescript
export const IScpTransferService_TOKEN = 'scp-transfer-service';

export interface IScpFileEntry {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    permissions?: string;
}

export interface IScpFileStat {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    created: string;
    permissions?: string;
}

export interface IScpTransferService {
    ls(serverUrl: string, path: string, headers?: Record<string, string>): Promise<IScpFileEntry[]>;
    cat(serverUrl: string, path: string, headers?: Record<string, string>): Promise<string>;
    stat(serverUrl: string, path: string, headers?: Record<string, string>): Promise<IScpFileStat>;
    download(
        serverUrl: string,
        path: string,
        headers?: Record<string, string>,
        onProgress?: (received: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<{ content: string; size: number }>;
    upload(
        serverUrl: string,
        remotePath: string,
        content: string,
        filename: string,
        headers?: Record<string, string>,
        onProgress?: (sent: number, total: number) => void,
    ): Promise<void>;
    mkdir(serverUrl: string, path: string, headers?: Record<string, string>): Promise<void>;
    rm(serverUrl: string, path: string, headers?: Record<string, string>): Promise<void>;
}
```

**Step 2: Create transfer service**

Create `packages/plugins/scp/src/lib/services/scp-transfer.service.ts`:

```typescript
import { IScpFileEntry, IScpFileStat, IScpTransferService } from '../interfaces';

export class ScpTransferService implements IScpTransferService {
    async ls(serverUrl: string, path: string, headers?: Record<string, string>): Promise<IScpFileEntry[]> {
        const res = await this._fetch(`${serverUrl}/api/cli/fs/ls?path=${encodeURIComponent(path)}`, {
            headers,
        });
        const data = await res.json();
        return data.entries;
    }

    async cat(serverUrl: string, path: string, headers?: Record<string, string>): Promise<string> {
        const res = await this._fetch(`${serverUrl}/api/cli/fs/cat?path=${encodeURIComponent(path)}`, {
            headers,
        });
        const data = await res.json();
        return data.content;
    }

    async stat(serverUrl: string, path: string, headers?: Record<string, string>): Promise<IScpFileStat> {
        const res = await this._fetch(`${serverUrl}/api/cli/fs/stat?path=${encodeURIComponent(path)}`, {
            headers,
        });
        return await res.json();
    }

    async download(
        serverUrl: string,
        path: string,
        headers?: Record<string, string>,
        onProgress?: (received: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<{ content: string; size: number }> {
        const res = await this._fetch(`${serverUrl}/api/cli/fs/download?path=${encodeURIComponent(path)}`, {
            headers,
            signal,
        });

        const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
        const reader = res.body?.getReader();

        if (!reader) {
            const text = await res.text();
            return { content: text, size: text.length };
        }

        const chunks: Uint8Array[] = [];
        let receivedBytes = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedBytes += value.length;
            onProgress?.(receivedBytes, contentLength);
        }

        const combined = new Uint8Array(receivedBytes);
        let offset = 0;
        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        return {
            content: new TextDecoder().decode(combined),
            size: receivedBytes,
        };
    }

    async upload(
        serverUrl: string,
        remotePath: string,
        content: string,
        filename: string,
        headers?: Record<string, string>,
    ): Promise<void> {
        const formData = new FormData();
        formData.append('path', remotePath);
        formData.append('file', new Blob([content]), filename);

        await this._fetch(`${serverUrl}/api/cli/fs/upload`, {
            method: 'POST',
            body: formData,
            headers,
        });
    }

    async mkdir(serverUrl: string, path: string, headers?: Record<string, string>): Promise<void> {
        await this._fetch(`${serverUrl}/api/cli/fs/mkdir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ path }),
        });
    }

    async rm(serverUrl: string, path: string, headers?: Record<string, string>): Promise<void> {
        await this._fetch(`${serverUrl}/api/cli/fs/rm?path=${encodeURIComponent(path)}`, {
            method: 'DELETE',
            headers,
        });
    }

    private async _fetch(url: string, init?: RequestInit): Promise<Response> {
        const res = await fetch(url, init);
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            if (res.status === 403) {
                throw new Error(`Permission denied: ${body || 'path is not in server\'s allowed paths'}`);
            }
            if (res.status === 404) {
                throw new Error(`Not found: ${body || 'file or directory does not exist'}`);
            }
            throw new Error(`Server error (${res.status}): ${body || res.statusText}`);
        }
        return res;
    }
}
```

**Step 3: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build scp`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/plugins/scp/src/lib/interfaces/ packages/plugins/scp/src/lib/services/
git commit -m "feat(scp): add ScpTransferService and interfaces for server filesystem API"
```

---

## Task 5: Implement @qodalis/cli-scp plugin — sub-command processors

**Files:**
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-ls-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-cat-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-download-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-upload-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-rm-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-mkdir-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/cli-scp-stat-processor.ts`
- Create: `packages/plugins/scp/src/lib/processors/scp-utils.ts`

**Step 1: Create shared utilities**

Create `packages/plugins/scp/src/lib/processors/scp-utils.ts`:

```typescript
import {
    ICliExecutionContext,
    CliServerConfig,
} from '@qodalis/cli-core';

/**
 * Resolve a server by name from context.options.servers.
 * If only one server exists and no name given, uses that one.
 */
export function resolveServer(
    serverName: string | undefined,
    context: ICliExecutionContext,
): CliServerConfig | null {
    const servers = context.options?.servers;
    if (!servers || servers.length === 0) {
        context.writer.writeError('No servers configured. Add servers to CLI options.');
        return null;
    }

    if (!serverName) {
        if (servers.length === 1) {
            return servers[0];
        }
        context.writer.writeError('Multiple servers configured. Specify server name.');
        context.writer.writeInfo('Available servers: ' + servers.map(s => s.name).join(', '));
        return null;
    }

    const server = servers.find(
        (s) => s.name.toLowerCase() === serverName.toLowerCase(),
    );

    if (!server) {
        context.writer.writeError(`Unknown server: ${serverName}`);
        context.writer.writeInfo('Available servers: ' + servers.map(s => s.name).join(', '));
        return null;
    }

    return server;
}

/**
 * Normalize server URL (strip trailing slash).
 */
export function serverUrl(server: CliServerConfig): string {
    return server.url.replace(/\/+$/, '');
}

/**
 * Format bytes for display.
 */
export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
```

**Step 2: Create all sub-command processors**

Create each sub-processor file. Each follows the same pattern — implements `ICliCommandProcessor` with `processCommand`. All use `resolveServer()` from scp-utils and the `ScpTransferService` from the services layer.

Reference the design doc for each sub-command's behavior. Each processor:
- Takes `command.value` as `<server> <path>` (split by first space)
- Uses `resolveServer()` to find the server config
- Calls the appropriate `ScpTransferService` method
- Renders output via `context.writer`

See design doc section "Plugin 1: @qodalis/cli-scp > Commands" for the exact command signatures.

The processors are straightforward CRUD wrappers around `ScpTransferService`. The `download` and `upload` processors additionally use `ICliFileTransferService` for local file I/O and show progress via `context.progressBar`.

**Step 3: Update the main scp command processor**

Modify `packages/plugins/scp/src/lib/processors/cli-scp-command-processor.ts` to:
- Import and register all sub-processors in the `processors` array
- Add shorthand parsing in `processCommand()`: detect `server:path` pattern and delegate to download/upload

**Step 4: Update module exports**

Modify `packages/plugins/scp/src/lib/index.ts` to export all new files.
Modify `packages/plugins/scp/src/public-api.ts` to register `ScpTransferService` in the module's `services` array.

**Step 5: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm nx build scp`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/plugins/scp/
git commit -m "feat(scp): implement all sub-command processors (ls, cat, download, upload, rm, mkdir, stat)"
```

---

## Task 6: .NET server — File System API

**Files:**
- Create: `cli-server-dotnet/src/Qodalis.Cli/FileSystem/FileSystemOptions.cs`
- Create: `cli-server-dotnet/src/Qodalis.Cli/FileSystem/FileSystemPathValidator.cs`
- Create: `cli-server-dotnet/src/Qodalis.Cli/Controllers/FileSystemController.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Extensions/MvcBuilderExtensions.cs`
- Modify: `cli-server-dotnet/src/Qodalis.Cli/Extensions/CliBuilder.cs`

**Step 1: Create FileSystemOptions**

Create `cli-server-dotnet/src/Qodalis.Cli/FileSystem/FileSystemOptions.cs`:

```csharp
namespace Qodalis.Cli.FileSystem;

public class FileSystemOptions
{
    /// <summary>
    /// Whitelisted paths the server can access. Empty = nothing accessible.
    /// </summary>
    public List<string> AllowedPaths { get; set; } = [];
}
```

**Step 2: Create path validator**

Create `cli-server-dotnet/src/Qodalis.Cli/FileSystem/FileSystemPathValidator.cs`:

```csharp
namespace Qodalis.Cli.FileSystem;

public class FileSystemPathValidator
{
    private readonly FileSystemOptions _options;

    public FileSystemPathValidator(FileSystemOptions options)
    {
        _options = options;
    }

    public bool IsPathAllowed(string path)
    {
        var fullPath = Path.GetFullPath(path);

        // Block path traversal
        if (fullPath.Contains(".."))
            return false;

        // Resolve symlinks
        if (File.Exists(fullPath) || Directory.Exists(fullPath))
        {
            var resolved = Path.GetFullPath(fullPath);
            return _options.AllowedPaths.Any(
                allowed => resolved.StartsWith(Path.GetFullPath(allowed), StringComparison.OrdinalIgnoreCase));
        }

        // For non-existent paths, check parent
        return _options.AllowedPaths.Any(
            allowed => fullPath.StartsWith(Path.GetFullPath(allowed), StringComparison.OrdinalIgnoreCase));
    }
}
```

**Step 3: Create FileSystemController**

Create `cli-server-dotnet/src/Qodalis.Cli/Controllers/FileSystemController.cs` with:
- `[Route("api/cli/fs")]` attribute
- `GET ls`, `GET cat`, `GET stat`, `GET download`, `POST upload`, `POST mkdir`, `DELETE rm`
- Each endpoint validates path via `FileSystemPathValidator` before accessing the filesystem
- Returns 403 for disallowed paths, 404 for missing files
- `download` streams file with `Content-Disposition: attachment`
- `upload` accepts `IFormFile` + path string

**Step 4: Add registration to CliBuilder**

Add to `cli-server-dotnet/src/Qodalis.Cli/Extensions/CliBuilder.cs`:

```csharp
public CliBuilder AddFileSystem(Action<FileSystemOptions>? configure = null)
{
    var options = new FileSystemOptions();
    configure?.Invoke(options);
    _services.AddSingleton(options);
    _services.AddSingleton<FileSystemPathValidator>();
    return this;
}
```

**Step 5: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-dotnet && dotnet build src/Qodalis.Cli.sln`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add cli-server-dotnet/src/Qodalis.Cli/FileSystem/ \
       cli-server-dotnet/src/Qodalis.Cli/Controllers/FileSystemController.cs \
       cli-server-dotnet/src/Qodalis.Cli/Extensions/CliBuilder.cs
git commit -m "feat(server-dotnet): add filesystem API endpoints with path whitelisting"
```

---

## Task 7: Node.js server — File System API

**Files:**
- Create: `cli-server-node/src/filesystem/filesystem-options.ts`
- Create: `cli-server-node/src/filesystem/filesystem-path-validator.ts`
- Create: `cli-server-node/src/controllers/filesystem-controller.ts`
- Create: `cli-server-node/src/filesystem/index.ts`
- Modify: `cli-server-node/src/extensions/cli-builder.ts`
- Modify: `cli-server-node/src/create-cli-server.ts`
- Modify: `cli-server-node/src/index.ts`

**Step 1: Create filesystem options and path validator**

Same logic as .NET: `AllowedPaths` array, path traversal check, symlink resolution via `fs.realpathSync`.

**Step 2: Create filesystem Express router**

Create `cli-server-node/src/controllers/filesystem-controller.ts`:

```typescript
export function createFilesystemRouter(validator: FileSystemPathValidator): Router {
    const router = Router();
    // GET /ls, /cat, /stat, /download
    // POST /upload (multer for multipart), /mkdir
    // DELETE /rm
    return router;
}
```

Use `multer` for file upload parsing (add as dependency). Each route validates with `validator.isPathAllowed()`.

**Step 3: Wire into builder and server factory**

Add `addFileSystem(options)` to `CliBuilder`.
In `createCliServer()`, if filesystem is configured, mount `app.use('/api/cli/fs', createFilesystemRouter(validator))`.

**Step 4: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-node && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add cli-server-node/src/filesystem/ cli-server-node/src/controllers/filesystem-controller.ts \
       cli-server-node/src/extensions/cli-builder.ts cli-server-node/src/create-cli-server.ts
git commit -m "feat(server-node): add filesystem API endpoints with path whitelisting"
```

---

## Task 8: Python server — File System API

**Files:**
- Create: `cli-server-python/src/qodalis_cli/filesystem/filesystem_options.py`
- Create: `cli-server-python/src/qodalis_cli/filesystem/filesystem_path_validator.py`
- Create: `cli-server-python/src/qodalis_cli/controllers/filesystem_controller.py`
- Create: `cli-server-python/src/qodalis_cli/filesystem/__init__.py`
- Modify: `cli-server-python/src/qodalis_cli/extensions/cli_builder.py`
- Modify: `cli-server-python/src/qodalis_cli/create_cli_server.py`

**Step 1: Create filesystem options and path validator**

Same logic: `allowed_paths` list, `os.path.realpath()` for symlink resolution, path traversal check.

**Step 2: Create filesystem FastAPI router**

Create `cli-server-python/src/qodalis_cli/controllers/filesystem_controller.py`:

```python
def create_filesystem_router(validator: FileSystemPathValidator) -> APIRouter:
    router = APIRouter()
    # GET /ls, /cat, /stat, /download
    # POST /upload (UploadFile), /mkdir
    # DELETE /rm
    return router
```

Use FastAPI's `UploadFile` for multipart upload. `FileResponse` or `StreamingResponse` for download.

**Step 3: Wire into builder and server factory**

Add `add_filesystem(options)` to `CliBuilder`.
In `create_cli_server()`, if filesystem is configured, `app.include_router(fs_router, prefix="/api/cli/fs")`.

**Step 4: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/cli-server-python && python -c "from qodalis_cli import create_cli_server; print('OK')"`
Expected: Imports successfully.

**Step 5: Commit**

```bash
git add cli-server-python/src/qodalis_cli/filesystem/ \
       cli-server-python/src/qodalis_cli/controllers/filesystem_controller.py \
       cli-server-python/src/qodalis_cli/extensions/cli_builder.py \
       cli-server-python/src/qodalis_cli/create_cli_server.py
git commit -m "feat(server-python): add filesystem API endpoints with path whitelisting"
```

---

## Task 9: Integration — wire plugins into demo apps

**Files:**
- Modify: `web-cli/apps/demo-angular/` — import scp + wget modules
- Modify: `web-cli/apps/demo-react/` — import scp + wget modules
- Modify: `web-cli/apps/demo-vue/` — import scp + wget modules
- Modify: `cli-server-dotnet/src/Qodalis.Cli.Server/Program.cs` — enable filesystem
- Modify: `cli-server-node/demo/src/index.ts` — enable filesystem
- Modify: `cli-server-python/demo/main.py` — enable filesystem

**Step 1: Add plugins to Angular demo**

In the Angular demo's main module/component, import `scpModule` and `wgetModule` and register them alongside existing modules.

**Step 2: Add plugins to React and Vue demos**

Same pattern — import and register the modules.

**Step 3: Enable filesystem on all server demos**

Add `cli.AddFileSystem(o => o.AllowedPaths.Add("/tmp"))` to .NET demo.
Add `builder.addFileSystem({ allowedPaths: ['/tmp'] })` to Node.js demo.
Add `filesystem=FileSystemOptions(allowed_paths=['/tmp'])` to Python demo.

**Step 4: Build all**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`
Expected: Full monorepo build succeeds.

**Step 5: Commit**

```bash
git add apps/ cli-server-dotnet/ cli-server-node/ cli-server-python/
git commit -m "feat: wire scp and wget plugins into demo apps, enable filesystem on all servers"
```

---

## Task 10: Manual integration test

**Step 1: Start a server demo**

Start the .NET demo server (or Node/Python) with filesystem enabled pointing to `/tmp`.

**Step 2: Start the Angular demo**

Run `pnpm run serve:angular-demo` and open `localhost:4303`.

**Step 3: Test wget**

```
wget https://httpbin.org/json
cat json
```

**Step 4: Test scp**

```
scp ls myserver /tmp
scp upload myserver ./json /tmp/test.json
scp cat myserver /tmp/test.json
scp download myserver /tmp/test.json ./downloaded.json
scp stat myserver /tmp/test.json
scp rm myserver /tmp/test.json
scp mkdir myserver /tmp/testdir
```

**Step 5: Test shorthand**

```
scp myserver:/tmp/test.json ./local-copy.json
```

**Step 6: Kill all processes**

```bash
pkill -f "nx.js\|karma\|dotnet"
```

**Step 7: Commit any fixes**

---

## Execution Summary

| Task | Scope | Depends on |
|---|---|---|
| 1 | Core abstraction layer | — |
| 2 | Files plugin override | Task 1 |
| 3 | wget plugin | Task 1 |
| 4 | scp services + interfaces | Task 1 |
| 5 | scp sub-commands | Task 4 |
| 6 | .NET server filesystem API | — |
| 7 | Node.js server filesystem API | — |
| 8 | Python server filesystem API | — |
| 9 | Demo integration | Tasks 2-8 |
| 10 | Manual testing | Task 9 |

Tasks 1, 6, 7, 8 can run in parallel. Tasks 3, 4 depend on 1 and can run in parallel with each other. Task 5 depends on 4. Task 2 depends on 1. Task 9 depends on all. Task 10 depends on 9.
