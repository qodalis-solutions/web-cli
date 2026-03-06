/** Ownership metadata attached to files, directories, or other resources */
export interface ICliOwnership {
    /** User ID of the owner */
    uid: string;
    /** Primary group name */
    gid: string;
}

/** Default file permissions: rw-r--r-- (644) */
export const DEFAULT_FILE_PERMISSIONS = 'rw-r--r--';

/** Default directory permissions: rwxr-xr-x (755) */
export const DEFAULT_DIR_PERMISSIONS = 'rwxr-xr-x';
