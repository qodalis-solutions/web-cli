import { CliHeadersProvider, resolveHeaders } from '@qodalis/cli-core';
import { IScpFileEntry, IScpFileStat, IScpTransferService } from '../interfaces';

export class ScpTransferService implements IScpTransferService {
    async ls(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<IScpFileEntry[]> {
        const res = await this._fetch(`${serverUrl}/api/qcli/fs/ls?path=${encodeURIComponent(path)}`, {
            headers: resolveHeaders(headers),
        });
        const data = await res.json();
        return data.entries;
    }

    async cat(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<string> {
        const res = await this._fetch(`${serverUrl}/api/qcli/fs/cat?path=${encodeURIComponent(path)}`, {
            headers: resolveHeaders(headers),
        });
        const data = await res.json();
        return data.content;
    }

    async stat(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<IScpFileStat> {
        const res = await this._fetch(`${serverUrl}/api/qcli/fs/stat?path=${encodeURIComponent(path)}`, {
            headers: resolveHeaders(headers),
        });
        return await res.json();
    }

    async download(
        serverUrl: string,
        path: string,
        headers?: CliHeadersProvider,
        onProgress?: (received: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<{ content: string; size: number }> {
        const res = await this._fetch(`${serverUrl}/api/qcli/fs/download?path=${encodeURIComponent(path)}`, {
            headers: resolveHeaders(headers),
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
        headers?: CliHeadersProvider,
    ): Promise<void> {
        const formData = new FormData();
        formData.append('path', remotePath);
        formData.append('file', new Blob([content]), filename);

        await this._fetch(`${serverUrl}/api/qcli/fs/upload`, {
            method: 'POST',
            body: formData,
            headers: resolveHeaders(headers),
        });
    }

    async mkdir(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<void> {
        await this._fetch(`${serverUrl}/api/qcli/fs/mkdir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...resolveHeaders(headers) },
            body: JSON.stringify({ path }),
        });
    }

    async rm(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<void> {
        await this._fetch(`${serverUrl}/api/qcli/fs/rm?path=${encodeURIComponent(path)}`, {
            method: 'DELETE',
            headers: resolveHeaders(headers),
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
