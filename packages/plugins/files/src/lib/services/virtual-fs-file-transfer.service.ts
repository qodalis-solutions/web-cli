import {
    ICliFileTransferService,
    ICliFileEntry,
    BrowserFileTransferService,
} from '@qodalis/cli-core';
import { IFileSystemService } from '../interfaces';

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
            type: node.type === 'directory' ? ('directory' as const) : ('file' as const),
            size: node.size || 0,
            modified: node.modifiedAt
                ? new Date(node.modifiedAt).toISOString()
                : new Date().toISOString(),
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
