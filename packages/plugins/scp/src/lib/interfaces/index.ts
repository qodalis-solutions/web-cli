import { CliHeadersProvider } from '@qodalis/cli-core';

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
    ls(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<IScpFileEntry[]>;
    cat(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<string>;
    stat(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<IScpFileStat>;
    download(
        serverUrl: string,
        path: string,
        headers?: CliHeadersProvider,
        onProgress?: (received: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<{ content: string; size: number }>;
    upload(
        serverUrl: string,
        remotePath: string,
        content: string,
        filename: string,
        headers?: CliHeadersProvider,
    ): Promise<void>;
    mkdir(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<void>;
    rm(serverUrl: string, path: string, headers?: CliHeadersProvider): Promise<void>;
}
