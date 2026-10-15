import {
    cliHasPermission,
    ICliAuthorizationService,
    ICliPermissionService,
    ICliUser,
    ICliOwnership,
} from '@qodalis/cli-core';

const sameName = (a?: string, b?: string): boolean => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * Default Linux-style permission service.
 *
 * Permission strings use the standard 9-character format: "rwxr-xr-x"
 * (3 chars each for owner, group, other). Owners are login names (as the
 * files module stores them); names and groups match case-insensitively, like
 * the files access policy.
 */
export class CliDefaultPermissionService implements ICliPermissionService {
    /** Optional: lets a signed-in principal holding `*` act as admin */
    constructor(private readonly authorization?: ICliAuthorizationService) {}

    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean {
        // Administrators are always allowed
        if (this.isAdmin(user)) return true;

        // Determine which 3-char scope applies
        let offset: number;
        if (sameName(user.name, ownership.uid)) {
            offset = 0; // owner
        } else if ((user.groups ?? []).some((g) => sameName(g, ownership.gid))) {
            offset = 3; // group
        } else {
            offset = 6; // other
        }

        const charIndex =
            action === 'read' ? offset :
            action === 'write' ? offset + 1 :
            offset + 2;

        return permissions.charAt(charIndex) !== '-';
    }

    parseOctal(octal: string): string {
        if (!/^[0-7]{3}$/.test(octal)) {
            throw new Error(`Invalid octal mode: ${octal}`);
        }
        return (
            this.digitToRwx(parseInt(octal[0], 10)) +
            this.digitToRwx(parseInt(octal[1], 10)) +
            this.digitToRwx(parseInt(octal[2], 10))
        );
    }

    toOctal(permissions: string): string {
        if (permissions.length !== 9) {
            throw new Error(`Invalid permission string: ${permissions}`);
        }
        return (
            String(this.rwxToDigit(permissions.substring(0, 3))) +
            String(this.rwxToDigit(permissions.substring(3, 6))) +
            String(this.rwxToDigit(permissions.substring(6, 9)))
        );
    }

    /** Member of `admin`, or the signed-in principal holding `*` */
    private isAdmin(user: ICliUser): boolean {
        if ((user.groups ?? []).some((g) => sameName(g, 'admin'))) return true;
        const principal = this.authorization?.getPrincipal();
        return !!principal && principal.id === user.id && sameName(principal.name, user.name) &&
            cliHasPermission(principal.permissions, '*');
    }

    private digitToRwx(d: number): string {
        return (
            ((d & 4) ? 'r' : '-') +
            ((d & 2) ? 'w' : '-') +
            ((d & 1) ? 'x' : '-')
        );
    }

    private rwxToDigit(rwx: string): number {
        let val = 0;
        if (rwx[0] === 'r') val += 4;
        if (rwx[1] === 'w') val += 2;
        if (rwx[2] === 'x') val += 1;
        return val;
    }
}
