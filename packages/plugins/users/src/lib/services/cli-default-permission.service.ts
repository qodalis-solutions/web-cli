import {
    ICliPermissionService,
    ICliUser,
    ICliOwnership,
} from '@qodalis/cli-core';

/**
 * Default Linux-style permission service.
 *
 * Permission strings use the standard 9-character format: "rwxr-xr-x"
 * (3 chars each for owner, group, other).
 */
export class CliDefaultPermissionService implements ICliPermissionService {
    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: string,
    ): boolean {
        // Admin (root) always allowed
        if (user.groups.includes('admin')) return true;

        // Determine which 3-char scope applies
        let offset: number;
        if (user.id === ownership.uid) {
            offset = 0; // owner
        } else if (user.groups.includes(ownership.gid)) {
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
