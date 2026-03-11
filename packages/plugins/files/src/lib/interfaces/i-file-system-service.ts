import { ICliOwnership } from '@qodalis/cli-core';
import { IFileNode } from './i-file-node';

export const IFileSystemService_TOKEN = 'cli-file-system-service';

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

    // Persistence
    initialize(): Promise<void>;
    persist(): Promise<void>;
}
