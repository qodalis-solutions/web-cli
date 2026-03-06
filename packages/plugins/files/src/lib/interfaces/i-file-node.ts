/**
 * Represents a node in the virtual filesystem (file or directory).
 */
export interface IFileNode {
    /** Name of the file or directory */
    name: string;

    /** Node type */
    type: 'file' | 'directory';

    /** File content (text only, undefined for directories) */
    content?: string;

    /** Child nodes (only for directories) */
    children?: IFileNode[];

    /** Creation timestamp (ms since epoch) */
    createdAt: number;

    /** Last modification timestamp (ms since epoch) */
    modifiedAt: number;

    /** Size in bytes (content length for files, 0 for directories) */
    size: number;

    /** Unix-style permission string (display only, e.g. "rwxr-xr-x") */
    permissions?: string;

    /** Target path for symbolic links */
    linkTarget?: string;
}
