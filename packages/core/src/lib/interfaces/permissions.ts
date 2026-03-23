import type { ICliUser } from '../models';
import type { ICliOwnership } from '../models/permissions';

// Re-export from central tokens for backward compatibility
export { ICliPermissionService_TOKEN } from '../tokens';

/**
 * Abstract permission service for checking rwx permissions on resources.
 * The default implementation lives in @qodalis/cli-users; consumers can
 * replace it via the DI container.
 */
export interface ICliPermissionService {
    /**
     * Check whether a user may perform an action on a resource.
     * @param user        The acting user.
     * @param action      The requested operation.
     * @param ownership   Owner/group of the resource.
     * @param permissions Permission string (e.g. "rwxr-xr-x").
     * @returns true if allowed.
     */
    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean;

    /** Parse octal (e.g. "755") to a permission string (e.g. "rwxr-xr-x"). */
    parseOctal(octal: string): string;

    /** Convert a permission string (e.g. "rwxr-xr-x") to octal (e.g. "755"). */
    toOctal(permissions: string): string;
}
