import { CliAccessAction, CliAccessDeniedError, ICliOwnership } from '@qodalis/cli-core';
import { IFileNode } from '../interfaces/i-file-node';
import { CliFileAccessPolicy, IFileSystemService } from '../interfaces/i-file-system-service';

const DB_NAME = 'qodalis-cli-filesystem';
const STORE_NAME = 'filesystem';
const ROOT_KEY = 'root';
const CWD_KEY = 'cwd';
const HOME_KEY = 'home';
const DEFAULT_HOME = '/';

/** Owner of system directories and of legacy nodes created without an owner */
export const SYSTEM_OWNERSHIP: ICliOwnership = { uid: 'root', gid: 'admin' };
/** Owner of files created while nobody is signed in */
export const ANONYMOUS_OWNERSHIP: ICliOwnership = { uid: 'nobody', gid: 'nogroup' };

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

export class IndexedDbFileSystemService implements IFileSystemService {
    private root: IFileNode = createSeedFileSystem();
    private cwd: string = DEFAULT_HOME;
    private homePath: string = DEFAULT_HOME;
    private currentUid: string | null = null;
    private currentGroups: string[] = [];
    private accessPolicy?: CliFileAccessPolicy;
    private systemDepth = 0;

    // --- Access control ---

    setAccessPolicy(policy?: CliFileAccessPolicy): void {
        this.accessPolicy = policy;
    }

    runAsSystem<T>(fn: () => T): T {
        this.systemDepth++;
        try {
            return fn();
        } finally {
            this.systemDepth--;
        }
    }

    canTraverse(path: string): boolean {
        try {
            this.assertTraverse(this.resolvePath(path), 'stat', path);
            return true;
        } catch {
            return false;
        }
    }

    private get enforcing(): boolean {
        return !!this.accessPolicy && this.systemDepth === 0;
    }

    private deny(op: string, path: string, reason = 'Permission denied'): never {
        throw new CliAccessDeniedError(`${op}: ${path}: ${reason}`);
    }

    /** `x` on every existing directory on the way to `resolved` (excluding the target). */
    private assertTraverse(resolved: string, op: string, display: string): void {
        if (!this.enforcing) return;
        const parts = resolved.split('/').filter(Boolean);
        let current: IFileNode | undefined = this.root;
        for (let i = 0; i < parts.length; i++) {
            if (!current || current.type !== 'directory') return;
            if (!this.accessPolicy!.canAccess(current, 'execute')) this.deny(op, display);
            current = current.children?.find((c) => c.name === parts[i]);
        }
    }

    private assertAccess(node: IFileNode, action: CliAccessAction, op: string, display: string): void {
        if (this.enforcing && !this.accessPolicy!.canAccess(node, action)) this.deny(op, display);
    }

    /** Recursive delete: every directory inside must allow removing its entries (`w` + `x`, readable). */
    private assertRemovableTree(dir: IFileNode, dirPath: string, display: string): void {
        if (!this.enforcing) return;
        this.assertAccess(dir, 'read', 'rm', display);
        this.assertAccess(dir, 'execute', 'rm', display);
        if ((dir.children?.length ?? 0) > 0) this.assertAccess(dir, 'write', 'rm', display);
        for (const child of dir.children ?? []) {
            if (child.type === 'directory') this.assertRemovableTree(child, `${dirPath}/${child.name}`, display);
        }
    }

    /** Creating/removing entries needs `w` and `x` on the containing directory. */
    private assertModifyDir(dir: IFileNode, dirPath: string, op: string, display: string): void {
        if (!this.enforcing) return;
        this.assertTraverse(dirPath, op, display);
        this.assertAccess(dir, 'execute', op, display);
        this.assertAccess(dir, 'write', op, display);
    }

    // --- User context ---

    setCurrentUser(uid: string, groups: string[]): void {
        this.currentUid = uid;
        this.currentGroups = groups;
    }

    private getDefaultOwnership(): ICliOwnership | undefined {
        if (!this.currentUid) {
            // With access control active, nothing is created ownerless
            return this.accessPolicy ? { ...ANONYMOUS_OWNERSHIP } : undefined;
        }
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
        this.assertTraverse(resolved, 'cd', path);
        this.assertAccess(node, 'execute', 'cd', path);
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

    // --- Read operations ---

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
        this.assertTraverse(this.resolvePath(path), 'ls', path);
        this.assertAccess(node, 'read', 'ls', path);
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
        this.assertTraverse(this.resolvePath(path), 'cat', path);
        this.assertAccess(node, 'read', 'cat', path);
        return node.content ?? '';
    }

    exists(path: string): boolean {
        return this.getNode(path) !== null;
    }

    isDirectory(path: string): boolean {
        const node = this.getNode(path);
        return node !== null && node.type === 'directory';
    }

    // --- Write operations ---

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
                    if (this.enforcing) {
                        this.assertAccess(current, 'execute', 'mkdir', path);
                        this.assertAccess(current, 'write', 'mkdir', path);
                    }
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
                } else {
                    this.assertAccess(child, 'execute', 'mkdir', path);
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
            this.assertModifyDir(parent, parentPath, 'mkdir', path);

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
            this.assertTraverse(resolved, 'touch', path);
            this.assertAccess(existing, 'write', 'touch', path);
        } else {
            this.assertModifyDir(parent, parentPath, 'touch', path);
        }

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
    }

    writeFile(path: string, content: string, append = false): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);

        if (node) {
            if (node.type === 'directory') {
                throw new Error(`write: ${path}: Is a directory`);
            }
            this.assertTraverse(resolved, 'write', path);
            this.assertAccess(node, 'write', 'write', path);
            const now = Date.now();
            node.content = append ? (node.content ?? '') + content : content;
            node.size = new Blob([node.content]).size;
            node.modifiedAt = now;
        } else {
            this.createFile(resolved, content);
        }
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
        this.assertModifyDir(parent, parentPath, 'rm', path);
        if (target.type === 'directory') this.assertRemovableTree(target, resolved, path);

        parent.children.splice(index, 1);
        parent.modifiedAt = Date.now();
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
        this.assertTraverse(srcResolved, 'cp', src);
        this.assertAccess(srcNode, 'read', 'cp', src);

        const destResolved = this.resolvePath(dest);
        const destNode = this.getNode(destResolved);

        if (destNode && destNode.type === 'directory') {
            this.assertModifyDir(destNode, destResolved, 'cp', dest);
            const clone = this.ownedByCurrentUser(this.cloneNode(srcNode));
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
            this.assertModifyDir(parent, parentPath, 'cp', dest);

            const clone = this.ownedByCurrentUser(this.cloneNode(srcNode));
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
        this.assertModifyDir(srcParent, srcParentPath, 'mv', src);

        const srcIndex = srcParent.children.findIndex(
            (c) => c.name === srcNode.name,
        );

        if (destNode && destNode.type === 'directory') {
            this.assertModifyDir(destNode, destResolved, 'mv', dest);
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
            this.assertModifyDir(destParent, destParentPath, 'mv', dest);

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
    }

    // --- Permissions ---

    chmod(path: string, permissions: string): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`chmod: ${path}: No such file or directory`);
        }
        if (this.enforcing && !this.accessPolicy!.canChangeOwnership(node)) {
            this.deny('chmod', path, 'Operation not permitted');
        }
        node.permissions = permissions;
    }

    chown(path: string, ownership: ICliOwnership): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`chown: ${path}: No such file or directory`);
        }
        if (this.enforcing && !this.accessPolicy!.canChangeOwnership(node, ownership)) {
            this.deny('chown', path, 'Operation not permitted');
        }
        node.ownership = ownership;
    }

    // --- Persistence ---

    async initialize(): Promise<void> {
        const db = await this.openDb();
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            const rootData = await this.idbGet<IFileNode>(store, ROOT_KEY);
            const cwdData = await this.idbGet<string>(store, CWD_KEY);
            const homeData = await this.idbGet<string>(store, HOME_KEY);

            if (rootData) {
                this.root = rootData;
            }
            if (cwdData) {
                this.cwd = cwdData;
            }
            if (homeData) {
                this.homePath = homeData;
            }
        } finally {
            db.close();
        }
    }

    async persist(): Promise<void> {
        const db = await this.openDb();
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            store.put(this.root, ROOT_KEY);
            store.put(this.cwd, CWD_KEY);
            store.put(this.homePath, HOME_KEY);

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    }

    // --- Private helpers ---

    /** A copy belongs to whoever made it (like `cp` without `-p`) */
    private ownedByCurrentUser(node: IFileNode): IFileNode {
        const owner = this.getDefaultOwnership();
        if (owner) {
            const apply = (n: IFileNode) => {
                n.ownership = { ...owner };
                n.children?.forEach(apply);
            };
            apply(node);
        }
        return node;
    }

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

    private openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private idbGet<T>(store: IDBObjectStore, key: string): Promise<T | null> {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }
}
