/**
 * Represents an entry in a file listing.
 */
export interface ICliFileEntry {
    name: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
}

// Re-export from central tokens for backward compatibility
export { ICliFileTransferService_TOKEN } from '../tokens';

/**
 * Abstraction for file transfer operations.
 * Default implementation uses browser-native APIs (file picker, download dialog).
 * @qodalis/cli-files overrides with virtual FS backed by IndexedDB.
 */
export interface ICliFileTransferService {
    readFile(path: string): Promise<string | null>;
    writeFile(path: string, content: string): Promise<void>;
    listFiles(path: string): Promise<ICliFileEntry[]>;
    exists(path: string): Promise<boolean>;
    downloadToBrowser(filename: string, content: string | Blob): void;
    uploadFromBrowser(accept?: string): Promise<{ name: string; content: string } | null>;
}
