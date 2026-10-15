import { CliAccessAction, ICliOwnership } from '@qodalis/cli-core';
import { IFileNode } from './i-file-node';

export const IFileSystemService_TOKEN = 'cli-file-system-service';

/**
 * Decides whether the current principal may act on a node. Set by the files
 * module from the generic authorization layer (`cliCanAccess`); when no policy
 * is set (no auth module loaded) every operation is allowed.
 */
export interface CliFileAccessPolicy {
    /** rwx check on a file or directory */
    canAccess(node: IFileNode, action: CliAccessAction): boolean;
    /** May the principal chmod/chown this node (owner, or `files:chown` / `files:admin`) */
    canChangeOwnership(node: IFileNode, newOwnership?: ICliOwnership): boolean;
}

/**
 * Abstraction for virtual filesystem operations.
 */
export interface IFileSystemService {
    // Navigation
    getCurrentDirectory(): string;
    setCurrentDirectory(path: string): void;
    resolvePath(path: string): string;

    // Home directory (used for ~ resolution)
    getHomePath(): string;
    setHomePath(path: string): void;

    // User context (used for ownership defaults and permission checks)
    setCurrentUser(uid: string, groups: string[]): void;

    // Read operations
    getNode(path: string): IFileNode | null;
    listDirectory(path: string): IFileNode[];
    readFile(path: string): string | null;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;

    // Write operations
    createDirectory(path: string, recursive?: boolean): void;
    createFile(path: string, content?: string): void;
    writeFile(path: string, content: string, append?: boolean): void;
    remove(path: string, recursive?: boolean): void;
    copy(src: string, dest: string, recursive?: boolean): void;
    move(src: string, dest: string): void;

    // Permissions
    chmod(path: string, permissions: string): void;
    chown(path: string, ownership: ICliOwnership): void;

    // Access control (optional; implementations without it are unrestricted)
    setAccessPolicy?(policy?: CliFileAccessPolicy): void;
    /** False when the current principal may not reach `path` (needs `x` on every parent) */
    canTraverse?(path: string): boolean;
    /** Run `fn` without access checks (system tasks such as creating home directories) */
    runAsSystem?<T>(fn: () => T): T;
    /**
     * System task (no access checks): give every node owned by `fromUid`
     * (case-insensitive) to `toUid`, e.g. after a user was renamed or deleted.
     * Returns the number of nodes changed.
     */
    reassignOwner?(fromUid: string, toUid: string): number;

    // Persistence
    initialize(): Promise<void>;
    persist(): Promise<void>;
}
