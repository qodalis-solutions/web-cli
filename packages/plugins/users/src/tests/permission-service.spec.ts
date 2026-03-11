import { ICliUser } from '@qodalis/cli-core';
import { CliDefaultPermissionService } from '../lib/services/cli-default-permission.service';

describe('CliDefaultPermissionService', () => {
    let service: CliDefaultPermissionService;

    beforeEach(() => {
        service = new CliDefaultPermissionService();
    });

    function makeUser(overrides: Partial<ICliUser> = {}): ICliUser {
        return {
            id: 'u1',
            name: 'alice',
            email: 'alice@test.com',
            groups: ['dev'],
            createdAt: 1000,
            updatedAt: 1000,
            ...overrides,
        };
    }

    const ownership = { uid: 'u1', gid: 'dev' };

    // ---------- check ----------

    describe('check', () => {
        it('should always allow admin users', () => {
            const admin = makeUser({ id: 'root', groups: ['admin'] });
            expect(service.check(admin, 'read', ownership, '---------')).toBe(true);
            expect(service.check(admin, 'write', ownership, '---------')).toBe(true);
            expect(service.check(admin, 'execute', ownership, '---------')).toBe(true);
        });

        it('should check owner bits when user is owner', () => {
            const owner = makeUser({ id: 'u1', groups: [] });
            expect(service.check(owner, 'read', ownership, 'r--------')).toBe(true);
            expect(service.check(owner, 'write', ownership, '-w-------')).toBe(true);
            expect(service.check(owner, 'execute', ownership, '--x------')).toBe(true);
            expect(service.check(owner, 'read', ownership, '---------')).toBe(false);
            expect(service.check(owner, 'write', ownership, 'r-x------')).toBe(false);
        });

        it('should check group bits when user shares group', () => {
            const groupMember = makeUser({ id: 'u2', groups: ['dev'] });
            expect(service.check(groupMember, 'read', ownership, '---r-----')).toBe(true);
            expect(service.check(groupMember, 'write', ownership, '----w----')).toBe(true);
            expect(service.check(groupMember, 'execute', ownership, '-----x---')).toBe(true);
            expect(service.check(groupMember, 'read', ownership, '---------')).toBe(false);
        });

        it('should check other bits when user is neither owner nor in group', () => {
            const other = makeUser({ id: 'u3', groups: ['marketing'] });
            expect(service.check(other, 'read', ownership, '------r--')).toBe(true);
            expect(service.check(other, 'write', ownership, '-------w-')).toBe(true);
            expect(service.check(other, 'execute', ownership, '--------x')).toBe(true);
            expect(service.check(other, 'read', ownership, '---------')).toBe(false);
        });

        it('should work with standard permission strings', () => {
            const owner = makeUser({ id: 'u1', groups: [] });
            const other = makeUser({ id: 'u3', groups: ['marketing'] });

            // rw-r--r-- (644)
            expect(service.check(owner, 'read', ownership, 'rw-r--r--')).toBe(true);
            expect(service.check(owner, 'write', ownership, 'rw-r--r--')).toBe(true);
            expect(service.check(owner, 'execute', ownership, 'rw-r--r--')).toBe(false);
            expect(service.check(other, 'read', ownership, 'rw-r--r--')).toBe(true);
            expect(service.check(other, 'write', ownership, 'rw-r--r--')).toBe(false);
        });
    });

    // ---------- parseOctal ----------

    describe('parseOctal', () => {
        it('should parse 755 to rwxr-xr-x', () => {
            expect(service.parseOctal('755')).toBe('rwxr-xr-x');
        });

        it('should parse 644 to rw-r--r--', () => {
            expect(service.parseOctal('644')).toBe('rw-r--r--');
        });

        it('should parse 000 to ---------', () => {
            expect(service.parseOctal('000')).toBe('---------');
        });

        it('should parse 777 to rwxrwxrwx', () => {
            expect(service.parseOctal('777')).toBe('rwxrwxrwx');
        });

        it('should throw on invalid octal', () => {
            expect(() => service.parseOctal('999')).toThrowError(/Invalid octal/);
            expect(() => service.parseOctal('75')).toThrowError(/Invalid octal/);
        });
    });

    // ---------- toOctal ----------

    describe('toOctal', () => {
        it('should convert rwxr-xr-x to 755', () => {
            expect(service.toOctal('rwxr-xr-x')).toBe('755');
        });

        it('should convert rw-r--r-- to 644', () => {
            expect(service.toOctal('rw-r--r--')).toBe('644');
        });

        it('should convert --------- to 000', () => {
            expect(service.toOctal('---------')).toBe('000');
        });

        it('should convert rwxrwxrwx to 777', () => {
            expect(service.toOctal('rwxrwxrwx')).toBe('777');
        });

        it('should throw on invalid string length', () => {
            expect(() => service.toOctal('rwx')).toThrowError(/Invalid permission/);
        });

        it('should round-trip with parseOctal', () => {
            for (const octal of ['755', '644', '000', '777', '400', '750']) {
                expect(service.toOctal(service.parseOctal(octal))).toBe(octal);
            }
        });
    });
});
