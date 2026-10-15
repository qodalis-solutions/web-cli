import {
    cliEvaluateAccess,
    cliHasPermission,
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliPrincipal,
    ICliUserSessionService_TOKEN,
} from '@qodalis/cli-core';
import { BehaviorSubject } from 'rxjs';
import { IndexedDbFileSystemService } from '../lib/services/indexed-db-file-system.service';
import { createFileAccessPolicy, followUserSession } from '../lib/services/files-access';

function contextFor(getPrincipal: () => ICliPrincipal | undefined, withAuth = true): any {
    const auth: ICliAuthorizationService = {
        getPrincipal,
        can: (perm) => cliHasPermission(getPrincipal()?.permissions, perm),
        canAccess: (r, a, bypass) => cliEvaluateAccess(getPrincipal(), r, a, bypass),
    };
    return {
        services: {
            get: (token: string) => (withAuth && token === ICliAuthorizationService_TOKEN ? auth : undefined),
        },
    };
}

const alice: ICliPrincipal = { id: 'a', name: 'alice', groups: ['dev'], permissions: [] };
const bob: ICliPrincipal = { id: 'b', name: 'bob', groups: ['dev'], permissions: [] };
const eve: ICliPrincipal = { id: 'e', name: 'eve', groups: ['users'], permissions: [] };
const admin: ICliPrincipal = { id: 'r', name: 'root', groups: ['admin'], permissions: ['*'] };

describe('files access policy', () => {
    let fs: IndexedDbFileSystemService;
    let current: ICliPrincipal | undefined;

    beforeEach(() => {
        fs = new IndexedDbFileSystemService();
        current = alice;
        fs.setAccessPolicy(createFileAccessPolicy(contextFor(() => current)));
        const as = (p: ICliPrincipal) => {
            current = p;
            fs.setCurrentUser(p.name, p.groups);
        };
        as(alice);
        fs.runAsSystem(() => {
            fs.createDirectory('/home/alice', true);
            fs.chown('/home/alice', { uid: 'alice', gid: 'dev' });
            fs.chmod('/home/alice', 'rwxr-x---');
        });
        fs.createFile('/home/alice/notes.txt', 'secret');
        fs.chmod('/home/alice/notes.txt', 'rw-r-----');
        (fs as any).as = as;
    });

    const as = (p: ICliPrincipal) => (fs as any).as(p);

    it('owner has full access to their files', () => {
        expect(fs.readFile('/home/alice/notes.txt')).toBe('secret');
        fs.writeFile('/home/alice/notes.txt', 'v2');
        expect(fs.getNode('/home/alice/notes.txt')!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
    });

    it('group members get the group bits', () => {
        as(bob);
        expect(fs.readFile('/home/alice/notes.txt')).toBe('secret');
        expect(() => fs.writeFile('/home/alice/notes.txt', 'x')).toThrowError(/Permission denied/);
        expect(() => fs.createFile('/home/alice/new.txt')).toThrowError(/Permission denied/);
        expect(() => fs.remove('/home/alice/notes.txt')).toThrowError(/Permission denied/);
    });

    it('others cannot traverse, list or read', () => {
        as(eve);
        expect(() => fs.listDirectory('/home/alice')).toThrowError(/ls: \/home\/alice: Permission denied/);
        expect(() => fs.readFile('/home/alice/notes.txt')).toThrowError(/Permission denied/);
        expect(() => fs.setCurrentDirectory('/home/alice')).toThrowError(/Permission denied/);
        expect(() => fs.copy('/home/alice/notes.txt', '/tmp/stolen.txt')).toThrowError(/Permission denied/);
        expect(() => fs.move('/home/alice/notes.txt', '/tmp/stolen.txt')).toThrowError(/Permission denied/);
    });

    it('only owners (or files:chown / admins) may chmod and chown', () => {
        as(bob);
        expect(() => fs.chmod('/home/alice/notes.txt', 'rwxrwxrwx')).toThrowError(/Operation not permitted/);
        as(alice);
        expect(() => fs.chown('/home/alice/notes.txt', { uid: 'bob', gid: 'dev' })).toThrowError(/Operation not permitted/);
        fs.chown('/home/alice/notes.txt', { uid: 'alice', gid: 'users' });
        as(admin);
        fs.chown('/home/alice/notes.txt', { uid: 'bob', gid: 'dev' });
        expect(fs.getNode('/home/alice/notes.txt')!.ownership!.uid).toBe('bob');
    });

    it('admins bypass checks', () => {
        as(admin);
        expect(fs.readFile('/home/alice/notes.txt')).toBe('secret');
        fs.remove('/home/alice/notes.txt');
    });

    it('signed-out callers only get "other" access', () => {
        current = undefined;
        fs.setCurrentUser('', []);
        expect(() => fs.readFile('/home/alice/notes.txt')).toThrowError(/Permission denied/);
        fs.createFile('/tmp/public.txt', 'hi'); // /tmp is world-writable
        expect(fs.getNode('/tmp/public.txt')!.ownership).toEqual({ uid: 'nobody', gid: 'nogroup' });
    });

    it('without an auth module nothing is restricted', () => {
        const open = new IndexedDbFileSystemService();
        open.setAccessPolicy(createFileAccessPolicy(contextFor(() => undefined, false)));
        open.runAsSystem(() => {
            open.createDirectory('/home/x', true);
            open.chown('/home/x', { uid: 'x', gid: 'x' });
            open.chmod('/home/x', 'rwx------');
        });
        open.createFile('/home/x/a.txt', 'ok');
        expect(open.readFile('/home/x/a.txt')).toBe('ok');
    });

    it('system directories without an owner belong to root', () => {
        as(eve);
        expect(() => fs.createDirectory('/home/eve')).toThrowError(/Permission denied/);
        expect(() => fs.remove('/home', true)).toThrowError(/Permission denied/);
        expect(() => fs.chown('/home', { uid: 'eve', gid: 'users' })).toThrowError(/Operation not permitted/);
    });

    it('rm -r checks every directory in the subtree', () => {
        fs.runAsSystem(() => {
            fs.createDirectory('/tmp/shared/private', true);
            fs.chown('/tmp/shared', { uid: 'bob', gid: 'dev' });
            fs.chmod('/tmp/shared', 'rwxrwx---');
            fs.chown('/tmp/shared/private', { uid: 'alice', gid: 'dev' });
            fs.chmod('/tmp/shared/private', 'rwx------');
            fs.createFile('/tmp/shared/private/diary.txt', 'x');
        });
        as(bob);
        expect(() => fs.remove('/tmp/shared/private', true)).toThrowError(/Permission denied/);
        as(alice);
        fs.remove('/tmp/shared/private', true);
    });

    it('copies belong to the copier', () => {
        as(bob);
        fs.copy('/home/alice/notes.txt', '/tmp/copy.txt');
        expect(fs.getNode('/tmp/copy.txt')!.ownership).toEqual({ uid: 'bob', gid: 'dev' });
    });

    it('stat and listing commands cannot see into private directories', () => {
        as(eve);
        expect(fs.canTraverse('/home/alice/notes.txt')).toBeFalse();
        as(alice);
        expect(fs.canTraverse('/home/alice/notes.txt')).toBeTrue();
    });
});

describe('followUserSession', () => {
    it('moves to the home on sign-in and back to / on sign-out', () => {
        const fs = new IndexedDbFileSystemService();
        const session$ = new BehaviorSubject<any>(undefined);
        const ctx: any = {
            services: {
                get: (token: string) =>
                    token === ICliUserSessionService_TOKEN ? { getUserSession: () => session$.asObservable() } : undefined,
            },
        };
        const sub = followUserSession(ctx, fs)!;
        session$.next({ user: { id: 'a', name: 'alice', groups: ['users'], homeDir: '/home/alice' } });
        expect(fs.getCurrentDirectory()).toBe('/home/alice');
        session$.next(undefined);
        expect(fs.getCurrentDirectory()).toBe('/');
        sub.unsubscribe();
    });

    it('a signed-out start inside an inaccessible home moves to /', () => {
        const fs = new IndexedDbFileSystemService();
        fs.runAsSystem(() => {
            fs.createDirectory('/home/alice', true);
            fs.chown('/home/alice', { uid: 'alice', gid: 'users' });
            fs.chmod('/home/alice', 'rwxr-x---');
        });
        fs.setCurrentDirectory('/home/alice'); // restored cwd from the last session
        fs.setAccessPolicy(createFileAccessPolicy(contextFor(() => undefined)));
        const session$ = new BehaviorSubject<any>(undefined);
        const ctx: any = {
            services: {
                get: (token: string) =>
                    token === ICliUserSessionService_TOKEN
                        ? { getUserSession: () => session$.asObservable() }
                        : contextFor(() => undefined).services.get(token),
            },
        };
        const sub = followUserSession(ctx, fs)!;
        expect(fs.getCurrentDirectory()).toBe('/');
        sub.unsubscribe();
    });
});
