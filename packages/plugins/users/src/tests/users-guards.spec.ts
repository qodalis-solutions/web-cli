import { requireAuthGuard, requiredGroupsGuard, usersGuards } from '../lib/guards/users-guards';
import { usersModule } from '../public-api';

const cmd = (command: string) => ({ command }) as any;
const proc = (metadata: any, command = 'x') => ({ command, metadata }) as any;
const ctx = (user?: any) => ({ userSession: user ? { user, loginTime: 0, lastActivity: 0 } : undefined }) as any;
const ADMIN = { id: '1', name: 'root', groups: ['admin'] };
const BOB = { id: '2', name: 'bob', groups: ['dev'] };

describe('users guards', () => {
    it('are registered on the module', () => {
        expect(usersModule.guards).toBe(usersGuards);
        expect(usersGuards.map((g) => g.name)).toEqual(['users:require-auth', 'users:required-groups']);
    });

    describe('requireAuthGuard', () => {
        it('applies to requireAuth and requiredGroups commands only', () => {
            expect(requireAuthGuard.appliesTo!(proc({ requireAuth: true }), cmd('x'), ctx())).toBeTrue();
            expect(requireAuthGuard.appliesTo!(proc({ requiredGroups: ['admin'] }), cmd('x'), ctx())).toBeTrue();
            expect(requireAuthGuard.appliesTo!(proc({}), cmd('x'), ctx())).toBeFalse();
            expect(requireAuthGuard.appliesTo!(proc(undefined), cmd('x'), ctx())).toBeFalse();
        });

        it('blocks when nobody is signed in', () => {
            expect(requireAuthGuard.canActivate(cmd('passwd'), proc({ requireAuth: true }, 'passwd'), ctx()))
                .toBe('passwd: login required');
        });

        it('allows a signed-in user', () => {
            expect(requireAuthGuard.canActivate(cmd('passwd'), proc({ requireAuth: true }), ctx(BOB))).toBeTrue();
        });
    });

    describe('requiredGroupsGuard', () => {
        it('allows a member of a required group', () => {
            expect(requiredGroupsGuard.canActivate(cmd('adduser'), proc({ requiredGroups: ['admin'] }), ctx(ADMIN)))
                .toBeTrue();
        });

        it('denies a user outside the required groups', () => {
            expect(requiredGroupsGuard.canActivate(cmd('adduser'), proc({ requiredGroups: ['admin'] }, 'adduser'), ctx(BOB)))
                .toBe('adduser: permission denied (requires group: admin)');
        });

        it('accepts any one of several groups', () => {
            expect(requiredGroupsGuard.canActivate(cmd('deploy'), proc({ requiredGroups: ['ops', 'dev'] }), ctx(BOB)))
                .toBeTrue();
        });

        it('runs after the auth guard', () => {
            expect(requiredGroupsGuard.priority!).toBeGreaterThan(requireAuthGuard.priority!);
        });
    });

    it('admin-only users commands declare requiredGroups', () => {
        const adminOnly = ['adduser', 'userdel', 'usermod', 'groupadd', 'groupdel'];
        for (const name of adminOnly) {
            const p = usersModule.processors!.find((x) => x.command === name)!;
            expect(p.metadata?.['requiredGroups']).withContext(name).toEqual(['admin']);
        }
    });
});
