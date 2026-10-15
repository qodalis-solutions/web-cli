/**
 * Permission strings are `resource:action` (for example `users:create`).
 * A segment may be `*` to match anything at that level and below:
 *
 * | granted       | matches                               |
 * |---------------|---------------------------------------|
 * | `*`           | every permission                      |
 * | `users:*`     | `users:create`, `users:delete`, ...   |
 * | `users:read`  | only `users:read`                     |
 *
 * Matching is case-insensitive.
 */
export function cliPermissionMatches(granted: string, required: string): boolean {
    const g = granted.trim().toLowerCase().split(':');
    const r = required.trim().toLowerCase().split(':');
    for (let i = 0; i < g.length; i++) {
        if (g[i] === '*') return true;
        if (i >= r.length || g[i] !== r[i]) return false;
    }
    return g.length === r.length;
}

/** True when any granted permission matches `required`. */
export function cliHasPermission(granted: readonly string[] | undefined, required: string): boolean {
    return !!granted?.some((p) => cliPermissionMatches(p, required));
}

/** The subset of `required` permissions not covered by `granted`. */
export function cliMissingPermissions(
    granted: readonly string[] | undefined,
    required: readonly string[],
): string[] {
    return required.filter((r) => !cliHasPermission(granted, r));
}

/** Union of permissions, de-duplicated, preserving first-seen order. */
export function cliMergePermissions(...lists: (readonly string[] | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const list of lists) {
        for (const p of list ?? []) {
            const key = p.trim();
            if (key && !seen.has(key.toLowerCase())) {
                seen.add(key.toLowerCase());
                out.push(key);
            }
        }
    }
    return out;
}

/**
 * Built-in permissions used by the users module. Other modules define their
 * own (e.g. `deploy:run`); any string in `resource:action` form works.
 */
/** Permissions for remote CLI server features. */
export const CliServerPermissions = {
    /** Open a remote shell on a server (`ssh`) */
    ShellExecute: 'shell:execute',
} as const;

export const CliUsersPermissions = {
    UsersRead: 'users:read',
    UsersCreate: 'users:create',
    UsersUpdate: 'users:update',
    UsersDelete: 'users:delete',
    GroupsRead: 'groups:read',
    GroupsCreate: 'groups:create',
    GroupsUpdate: 'groups:update',
    GroupsDelete: 'groups:delete',
    SessionsRead: 'sessions:read',
    SessionsRevoke: 'sessions:revoke',
    AuditRead: 'audit:read',
    AuditClear: 'audit:clear',
} as const;
