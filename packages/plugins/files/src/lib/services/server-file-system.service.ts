import { ICliOwnership, CliHeadersProvider, resolveHeaders } from '@qodalis/cli-core';
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService } from '../interfaces/i-file-system-service';

const DEFAULT_HOME = '/home/user';

/**
 * Configuration options for the ServerFileSystemService.
 */
export interface ServerFileSystemOptions {
    /** Base URL of the CLI server, e.g. 'http://localhost:8047' */
    baseUrl: string;
    /** Custom headers sent with every request (e.g. auth tokens) */
    headers?: CliHeadersProvider;
}

/**
 * Response shape from GET /api/qcli/fs/ls
 */
interface LsResponse {
    entries: Array<{
        name: string;
        type: 'file' | 'directory';
        size: number;
        modified: string;
        permissions?: string;
    }>;
}

/**
 * Response shape from GET /api/qcli/fs/cat
 */
interface CatResponse {
    content: string;
}

/**
 * Response shape from GET /api/qcli/fs/stat
 */
interface StatResponse {
    name: string;
    type: 'file' | 'directory';
    size: number;
    created: string;
    modified: string;
    permissions?: string;
}

/**
 * Creates a minimal root seed filesystem for initial local state.
 */
function createSeedFileSystem(): IFileNode {
    const now = Date.now();
    return {
        name: '',
        type: 'directory',
        children: [
            {
                name: 'home',
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
            },
            {
                name: 'tmp',
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxrwxrwx',
            },
            {
                name: 'etc',
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
            },
        ],
        createdAt: now,
        modifiedAt: now,
        size: 0,
        permissions: 'rwxr-xr-x',
    };
}

/**
 * IFileSystemService implementation that delegates operations to a CLI server's
 * `/api/qcli/fs/*` REST endpoints.
 *
 * Because the IFileSystemService interface is synchronous, this service maintains
 * an in-memory file tree that is returned immediately by read operations. Write
 * operations update the local tree first (for instant feedback) and then fire
 * asynchronous requests to the server for persistence. The `initialize()` method
 * fetches the initial directory listing from the server.
 */
export class ServerFileSystemService implements IFileSystemService {
    private root: IFileNode = createSeedFileSystem();
    private cwd: string = DEFAULT_HOME;
    private homePath: string = DEFAULT_HOME;
    private currentUid: string | null = null;
    private currentGroups: string[] = [];
    private readonly baseUrl: string;
    private readonly headersProvider: CliHeadersProvider | undefined;

    constructor(options: ServerFileSystemOptions) {
        // Strip trailing slash for consistent URL building
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.headersProvider = options.headers;
    }

    // --- User context ---

    setCurrentUser(uid: string, groups: string[]): void {
        this.currentUid = uid;
        this.currentGroups = groups;
    }

    private getDefaultOwnership(): ICliOwnership | undefined {
        if (!this.currentUid) return undefined;
        return {
            uid: this.currentUid,
            gid: this.currentGroups[0] || 'users',
        };
    }

    // --- Navigation ---

    getCurrentDirectory(): string {
        return this.cwd;
    }

    setCurrentDirectory(path: string): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`cd: ${path}: No such file or directory`);
        }
        if (node.type !== 'directory') {
            throw new Error(`cd: ${path}: Not a directory`);
        }
        this.cwd = resolved;
    }

    getHomePath(): string {
        return this.homePath;
    }

    setHomePath(path: string): void {
        this.homePath = path;
    }

    resolvePath(path: string): string {
        if (path === '~' || path === '') {
            return this.homePath;
        }
        if (path.startsWith('~/')) {
            path = this.homePath + path.substring(1);
        }

        const parts = path.startsWith('/')
            ? path.split('/')
            : (this.cwd + '/' + path).split('/');

        const resolved: string[] = [];
        for (const part of parts) {
            if (part === '' || part === '.') {
                continue;
            } else if (part === '..') {
                resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return '/' + resolved.join('/');
    }

    // --- Read operations (synchronous, from local cache) ---

    getNode(path: string): IFileNode | null {
        const resolved = path === '/' ? '/' : this.resolvePath(path);
        if (resolved === '/') {
            return this.root;
        }

        const parts = resolved.split('/').filter(Boolean);
        let current = this.root;

        for (const part of parts) {
            if (current.type !== 'directory' || !current.children) {
                return null;
            }
            const child = current.children.find((c) => c.name === part);
            if (!child) {
                return null;
            }
            current = child;
        }

        return current;
    }

    listDirectory(path: string): IFileNode[] {
        const node = this.getNode(path);
        if (!node) {
            throw new Error(`ls: ${path}: No such file or directory`);
        }
        if (node.type !== 'directory') {
            throw new Error(`ls: ${path}: Not a directory`);
        }
        return node.children || [];
    }

    readFile(path: string): string | null {
        const node = this.getNode(path);
        if (!node) {
            throw new Error(`cat: ${path}: No such file or directory`);
        }
        if (node.type === 'directory') {
            throw new Error(`cat: ${path}: Is a directory`);
        }
        return node.content ?? '';
    }

    exists(path: string): boolean {
        return this.getNode(path) !== null;
    }

    isDirectory(path: string): boolean {
        const node = this.getNode(path);
        return node !== null && node.type === 'directory';
    }

    // --- Write operations (update local cache + fire-and-forget server call) ---

    createDirectory(path: string, recursive = false): void {
        const resolved = this.resolvePath(path);
        const parts = resolved.split('/').filter(Boolean);

        if (parts.length === 0) {
            throw new Error(`mkdir: cannot create directory '/': File exists`);
        }

        if (recursive) {
            let current = this.root;
            for (const part of parts) {
                if (!current.children) {
                    current.children = [];
                }
                let child = current.children.find((c) => c.name === part);
                if (!child) {
                    const now = Date.now();
                    child = {
                        name: part,
                        type: 'directory',
                        children: [],
                        createdAt: now,
                        modifiedAt: now,
                        size: 0,
                        permissions: 'rwxr-xr-x',
                        ownership: this.getDefaultOwnership(),
                    };
                    current.children.push(child);
                    current.modifiedAt = now;
                } else if (child.type !== 'directory') {
                    throw new Error(`mkdir: ${part}: Not a directory`);
                }
                current = child;
            }
        } else {
            const parentPath = '/' + parts.slice(0, -1).join('/');
            const dirName = parts[parts.length - 1];
            const parent = this.getNode(parentPath);

            if (!parent) {
                throw new Error(
                    `mkdir: ${parentPath}: No such file or directory`,
                );
            }
            if (parent.type !== 'directory') {
                throw new Error(`mkdir: ${parentPath}: Not a directory`);
            }
            if (parent.children?.find((c) => c.name === dirName)) {
                throw new Error(`mkdir: ${path}: File exists`);
            }

            const now = Date.now();
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push({
                name: dirName,
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
                ownership: this.getDefaultOwnership(),
            });
            parent.modifiedAt = now;
        }

        // Fire-and-forget server call
        this.serverMkdir(resolved).catch((err) =>
            console.error('[ServerFS] mkdir failed:', err),
        );
    }

    createFile(path: string, content = ''): void {
        const resolved = this.resolvePath(path);
        const parts = resolved.split('/').filter(Boolean);

        if (parts.length === 0) {
            throw new Error(`touch: cannot create file at root`);
        }

        const parentPath = '/' + parts.slice(0, -1).join('/');
        const fileName = parts[parts.length - 1];
        const parent = this.getNode(parentPath);

        if (!parent) {
            throw new Error(`touch: ${parentPath}: No such file or directory`);
        }
        if (parent.type !== 'directory') {
            throw new Error(`touch: ${parentPath}: Not a directory`);
        }

        const existing = parent.children?.find((c) => c.name === fileName);
        const now = Date.now();

        if (existing) {
            existing.modifiedAt = now;
        } else {
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push({
                name: fileName,
                type: 'file',
                content,
                createdAt: now,
                modifiedAt: now,
                size: new Blob([content]).size,
                permissions: 'rw-r--r--',
                ownership: this.getDefaultOwnership(),
            });
            parent.modifiedAt = now;
        }

        // Fire-and-forget server upload
        this.serverUpload(resolved, content).catch((err) =>
            console.error('[ServerFS] createFile upload failed:', err),
        );
    }

    writeFile(path: string, content: string, append = false): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);

        if (node) {
            if (node.type === 'directory') {
                throw new Error(`write: ${path}: Is a directory`);
            }
            const now = Date.now();
            node.content = append ? (node.content ?? '') + content : content;
            node.size = new Blob([node.content]).size;
            node.modifiedAt = now;
        } else {
            this.createFile(resolved, content);
            return; // createFile already handles server upload
        }

        // Fire-and-forget server upload with full content
        this.serverUpload(resolved, node.content!).catch((err) =>
            console.error('[ServerFS] writeFile upload failed:', err),
        );
    }

    remove(path: string, recursive = false): void {
        const resolved = this.resolvePath(path);
        if (resolved === '/') {
            throw new Error(`rm: cannot remove root directory`);
        }

        const parts = resolved.split('/').filter(Boolean);
        const parentPath = '/' + parts.slice(0, -1).join('/');
        const name = parts[parts.length - 1];
        const parent = this.getNode(parentPath);

        if (!parent || !parent.children) {
            throw new Error(`rm: ${path}: No such file or directory`);
        }

        const index = parent.children.findIndex((c) => c.name === name);
        if (index === -1) {
            throw new Error(`rm: ${path}: No such file or directory`);
        }

        const target = parent.children[index];
        if (target.type === 'directory' && !recursive) {
            throw new Error(`rm: ${path}: Is a directory`);
        }

        parent.children.splice(index, 1);
        parent.modifiedAt = Date.now();

        // Fire-and-forget server call
        this.serverRm(resolved).catch((err) =>
            console.error('[ServerFS] rm failed:', err),
        );
    }

    copy(src: string, dest: string, recursive = false): void {
        const srcResolved = this.resolvePath(src);
        const srcNode = this.getNode(srcResolved);

        if (!srcNode) {
            throw new Error(`cp: ${src}: No such file or directory`);
        }
        if (srcNode.type === 'directory' && !recursive) {
            throw new Error(
                `cp: -r not specified; omitting directory '${src}'`,
            );
        }

        const destResolved = this.resolvePath(dest);
        const destNode = this.getNode(destResolved);

        if (destNode && destNode.type === 'directory') {
            const clone = this.cloneNode(srcNode);
            if (!destNode.children) {
                destNode.children = [];
            }
            const existingIdx = destNode.children.findIndex(
                (c) => c.name === clone.name,
            );
            if (existingIdx !== -1) {
                destNode.children.splice(existingIdx, 1);
            }
            destNode.children.push(clone);
            destNode.modifiedAt = Date.now();
        } else {
            const parts = destResolved.split('/').filter(Boolean);
            const parentPath = '/' + parts.slice(0, -1).join('/');
            const newName = parts[parts.length - 1];
            const parent = this.getNode(parentPath);

            if (!parent || parent.type !== 'directory') {
                throw new Error(`cp: ${parentPath}: No such file or directory`);
            }

            const clone = this.cloneNode(srcNode);
            clone.name = newName;
            if (!parent.children) {
                parent.children = [];
            }
            const existingIdx = parent.children.findIndex(
                (c) => c.name === newName,
            );
            if (existingIdx !== -1) {
                parent.children.splice(existingIdx, 1);
            }
            parent.children.push(clone);
            parent.modifiedAt = Date.now();
        }

        // Sync copied files to server (upload all file nodes in the clone)
        this.syncTreeToServer(destResolved).catch((err) =>
            console.error('[ServerFS] copy sync failed:', err),
        );
    }

    move(src: string, dest: string): void {
        const srcResolved = this.resolvePath(src);
        if (srcResolved === '/') {
            throw new Error(`mv: cannot move root directory`);
        }

        const srcNode = this.getNode(srcResolved);
        if (!srcNode) {
            throw new Error(`mv: ${src}: No such file or directory`);
        }

        const destResolved = this.resolvePath(dest);
        const destNode = this.getNode(destResolved);

        const srcParts = srcResolved.split('/').filter(Boolean);
        const srcParentPath = '/' + srcParts.slice(0, -1).join('/');
        const srcParent = this.getNode(srcParentPath);

        if (!srcParent || !srcParent.children) {
            throw new Error(`mv: ${src}: No such file or directory`);
        }

        const srcIndex = srcParent.children.findIndex(
            (c) => c.name === srcNode.name,
        );

        if (destNode && destNode.type === 'directory') {
            if (!destNode.children) {
                destNode.children = [];
            }
            const existingIdx = destNode.children.findIndex(
                (c) => c.name === srcNode.name,
            );
            if (existingIdx !== -1) {
                destNode.children.splice(existingIdx, 1);
            }
            srcParent.children.splice(srcIndex, 1);
            destNode.children.push(srcNode);
            destNode.modifiedAt = Date.now();
        } else {
            const destParts = destResolved.split('/').filter(Boolean);
            const destParentPath = '/' + destParts.slice(0, -1).join('/');
            const newName = destParts[destParts.length - 1];
            const destParent = this.getNode(destParentPath);

            if (!destParent || destParent.type !== 'directory') {
                throw new Error(
                    `mv: ${destParentPath}: No such file or directory`,
                );
            }

            srcParent.children.splice(srcIndex, 1);
            srcNode.name = newName;
            if (!destParent.children) {
                destParent.children = [];
            }
            const existingIdx = destParent.children.findIndex(
                (c) => c.name === newName,
            );
            if (existingIdx !== -1) {
                destParent.children.splice(existingIdx, 1);
            }
            destParent.children.push(srcNode);
            destParent.modifiedAt = Date.now();
        }

        srcParent.modifiedAt = Date.now();

        // Server-side: remove old, upload to new location
        this.serverRm(srcResolved)
            .then(() => this.syncTreeToServer(destResolved))
            .catch((err) =>
                console.error('[ServerFS] move sync failed:', err),
            );
    }

    // --- Permissions (local-only, server has no endpoints) ---

    chmod(path: string, permissions: string): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`chmod: ${path}: No such file or directory`);
        }
        node.permissions = permissions;
    }

    chown(path: string, ownership: ICliOwnership): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`chown: ${path}: No such file or directory`);
        }
        node.ownership = ownership;
    }

    // --- Persistence ---

    /**
     * Fetches the root directory listing from the server and populates the
     * local in-memory file tree. Recursively loads subdirectories.
     */
    async initialize(): Promise<void> {
        try {
            await this.loadDirectoryFromServer('/', this.root);
        } catch (err) {
            console.error(
                '[ServerFS] Failed to initialize from server, using seed filesystem:',
                err,
            );
        }
    }

    /**
     * No-op for server-backed storage — the server persists automatically.
     */
    async persist(): Promise<void> {
        // Server handles persistence; nothing to do locally.
    }

    // --- Private: server communication ---

    private async serverFetch<T>(
        endpoint: string,
        options?: RequestInit,
    ): Promise<T> {
        const url = `${this.baseUrl}/api/qcli/fs${endpoint}`;
        const mergedHeaders: Record<string, string> = {
            ...resolveHeaders(this.headersProvider),
            ...((options?.headers as Record<string, string>) ?? {}),
        };
        const response = await fetch(url, {
            ...options,
            headers: mergedHeaders,
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(
                `Server responded with ${response.status}: ${body}`,
            );
        }
        return response.json();
    }

    private async serverLs(path: string): Promise<LsResponse> {
        return this.serverFetch<LsResponse>(
            `/ls?path=${encodeURIComponent(path)}`,
        );
    }

    private async serverCat(path: string): Promise<CatResponse> {
        return this.serverFetch<CatResponse>(
            `/cat?path=${encodeURIComponent(path)}`,
        );
    }

    private async serverStat(path: string): Promise<StatResponse> {
        return this.serverFetch<StatResponse>(
            `/stat?path=${encodeURIComponent(path)}`,
        );
    }

    private async serverMkdir(path: string): Promise<void> {
        await this.serverFetch<{ path: string }>('/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path }),
        });
    }

    private async serverUpload(path: string, content: string): Promise<void> {
        const formData = new FormData();
        formData.append('path', path);
        formData.append(
            'file',
            new Blob([content], { type: 'application/octet-stream' }),
            path.split('/').pop() || 'file',
        );
        await this.serverFetch<{ path: string; size: number }>('/upload', {
            method: 'POST',
            body: formData,
        });
    }

    private async serverRm(path: string): Promise<void> {
        await this.serverFetch<{ deleted: string }>(
            `/rm?path=${encodeURIComponent(path)}`,
            { method: 'DELETE' },
        );
    }

    /**
     * Recursively loads directory contents from the server into a local node.
     */
    private async loadDirectoryFromServer(
        path: string,
        node: IFileNode,
    ): Promise<void> {
        const response = await this.serverLs(path);
        const now = Date.now();

        node.children = [];

        for (const entry of response.entries) {
            const childPath =
                path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;

            if (entry.type === 'directory') {
                const dirNode: IFileNode = {
                    name: entry.name,
                    type: 'directory',
                    children: [],
                    createdAt: new Date(entry.modified).getTime() || now,
                    modifiedAt: new Date(entry.modified).getTime() || now,
                    size: entry.size,
                    permissions: entry.permissions || 'rwxr-xr-x',
                };
                node.children.push(dirNode);

                // Recursively load subdirectory contents
                try {
                    await this.loadDirectoryFromServer(childPath, dirNode);
                } catch {
                    // If a subdirectory fails to load, keep it empty
                }
            } else {
                // For files, fetch content eagerly so readFile() works synchronously
                let content = '';
                try {
                    const catResponse = await this.serverCat(childPath);
                    content = catResponse.content;
                } catch {
                    // If content fetch fails, store empty string
                }

                node.children.push({
                    name: entry.name,
                    type: 'file',
                    content,
                    createdAt: new Date(entry.modified).getTime() || now,
                    modifiedAt: new Date(entry.modified).getTime() || now,
                    size: entry.size,
                    permissions: entry.permissions || 'rw-r--r--',
                });
            }
        }
    }

    /**
     * Uploads all file nodes under the given path to the server.
     * Used after copy/move to sync the local tree to the server.
     */
    private async syncTreeToServer(path: string): Promise<void> {
        const node = this.getNode(path);
        if (!node) return;

        if (node.type === 'file') {
            await this.serverUpload(path, node.content ?? '');
        } else if (node.type === 'directory') {
            await this.serverMkdir(path);
            if (node.children) {
                for (const child of node.children) {
                    const childPath = path === '/'
                        ? `/${child.name}`
                        : `${path}/${child.name}`;
                    await this.syncTreeToServer(childPath);
                }
            }
        }
    }

    // --- Private: tree helpers ---

    private cloneNode(node: IFileNode): IFileNode {
        const now = Date.now();
        const clone: IFileNode = {
            name: node.name,
            type: node.type,
            createdAt: now,
            modifiedAt: now,
            size: node.size,
            permissions: node.permissions,
            ownership: node.ownership ? { ...node.ownership } : undefined,
        };

        if (node.type === 'file') {
            clone.content = node.content;
        } else {
            clone.children = (node.children || []).map((c) =>
                this.cloneNode(c),
            );
        }

        return clone;
    }
}
