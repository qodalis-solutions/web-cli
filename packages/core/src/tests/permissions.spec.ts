import {
    cliHasPermission,
    cliMergePermissions,
    cliMissingPermissions,
    cliPermissionMatches,
} from '../lib/utils/permissions';

describe('permission utils', () => {
    it('matches exact permissions case-insensitively', () => {
        expect(cliPermissionMatches('users:create', 'users:create')).toBeTrue();
        expect(cliPermissionMatches('Users:Create', 'users:create')).toBeTrue();
        expect(cliPermissionMatches('users:create', 'users:delete')).toBeFalse();
    });

    it('supports wildcards', () => {
        expect(cliPermissionMatches('*', 'anything:at:all')).toBeTrue();
        expect(cliPermissionMatches('users:*', 'users:delete')).toBeTrue();
        expect(cliPermissionMatches('users:*', 'groups:delete')).toBeFalse();
    });

    it('a non-terminal wildcard matches one segment only', () => {
        // `*:read` is read access everywhere, not every permission
        expect(cliPermissionMatches('*:read', 'users:read')).toBeTrue();
        expect(cliPermissionMatches('*:read', 'users:delete')).toBeFalse();
        expect(cliPermissionMatches('*:read', '*')).toBeFalse();
        expect(cliHasPermission(['*:read'], '*')).toBeFalse();
        expect(cliPermissionMatches('files:*:read', 'files:etc:write')).toBeFalse();
        expect(cliPermissionMatches('files:*:read', 'files:etc:read')).toBeTrue();
        expect(cliPermissionMatches('files:*', 'files:etc:write')).toBeTrue();
    });

    it('does not treat a prefix as a grant', () => {
        expect(cliPermissionMatches('users', 'users:create')).toBeFalse();
        expect(cliPermissionMatches('users:create', 'users')).toBeFalse();
    });

    it('checks lists', () => {
        expect(cliHasPermission(['groups:read', 'users:*'], 'users:update')).toBeTrue();
        expect(cliHasPermission(undefined, 'users:update')).toBeFalse();
        expect(cliMissingPermissions(['users:read'], ['users:read', 'users:delete'])).toEqual(['users:delete']);
    });

    it('merges without duplicates', () => {
        expect(cliMergePermissions(['a:b', 'c:d'], undefined, ['A:B', 'e:f'])).toEqual(['a:b', 'c:d', 'e:f']);
    });
});
