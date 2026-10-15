import {
    cliEvaluateAccess,
    cliHasPermission,
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliPrincipal,
    ICliUserEvent,
    ICliUserEventService_TOKEN,
    ICliUserSessionService_TOKEN,
} from '@qodalis/cli-core';
import { BehaviorSubject, Subject } from 'rxjs';
import { IndexedDbFileSystemService } from '../lib/services/indexed-db-file-system.service';
import { createFileAccessPolicy, followUserAccounts, followUserSession } from '../lib/services/files-access';

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

    it('cp -r cannot copy out of subdirectories the user cannot read', () => {
        fs.runAsSystem(() => {
            fs.createDirectory('/tmp/shared/private', true);
            fs.chown('/tmp/shared', { uid: 'alice', gid: 'dev' });
            fs.chmod('/tmp/shared', 'rwxr-xr-x');
            fs.chown('/tmp/shared/private', { uid: 'alice', gid: 'dev' });
            fs.chmod('/tmp/shared/private', 'rwx------');
            fs.createFile('/tmp/shared/private/diary.txt', 'secret');
            fs.chown('/tmp/shared/private/diary.txt', { uid: 'alice', gid: 'dev' });
            fs.chmod('/tmp/shared/private/diary.txt', 'rw-------');
        });
        as(eve);
        expect(() => fs.copy('/tmp/shared', '/tmp/stolen', true)).toThrowError(/Permission denied/);
        expect(fs.exists('/tmp/stolen')).toBeFalse();
        as(alice);
        fs.copy('/tmp/shared', '/tmp/mine', true);
        expect(fs.readFile('/tmp/mine/private/diary.txt')).toBe('secret');
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

describe('followUserAccounts (ownership follows renames and deletions)', () => {
    const userNamed = (name: string): any => ({ id: `id-${name}`, name, email: `${name}@x.io`, groups: ['users'], createdAt: 1, updatedAt: 1 });

    function setup() {
        const fs = new IndexedDbFileSystemService();
        // The acting user (an administrator of users only) has no rights on alice's files
        const actor: ICliPrincipal = { id: 'o', name: 'ops', groups: ['ops'], permissions: ['users:*'] };
        const auth = contextFor(() => actor);
        fs.setAccessPolicy(createFileAccessPolicy(auth));
        fs.runAsSystem(() => {
            fs.createDirectory('/home/alice/docs', true);
            fs.chown('/home/alice', { uid: 'alice', gid: 'users' });
            fs.chmod('/home/alice', 'rwx------');
            fs.chown('/home/alice/docs', { uid: 'alice', gid: 'users' });
            fs.createFile('/home/alice/docs/a.txt', 'secret');
            fs.chown('/home/alice/docs/a.txt', { uid: 'Alice', gid: 'users' });
            fs.createFile('/tmp/bob.txt', 'b');
            fs.chown('/tmp/bob.txt', { uid: 'bob', gid: 'users' });
        });
        spyOn(fs, 'persist').and.resolveTo();
        const events$ = new Subject<ICliUserEvent>();
        const ctx: any = {
            services: {
                get: (token: string) =>
                    token === ICliUserEventService_TOKEN ? { events$, emit: (e: ICliUserEvent) => events$.next(e) } : auth.services.get(token),
            },
        };
        const sub = followUserAccounts(ctx, fs)!;
        const owner = (path: string) => fs.runAsSystem(() => fs.getNode(path)!.ownership!.uid);
        return { fs, events$, sub, owner };
    }

    it('a rename moves every file of the old name to the new name', () => {
        const { fs, events$, sub, owner } = setup();
        events$.next({ type: 'user_updated', user: userNamed('alicia'), previousName: 'alice', timestamp: 1 });
        expect(owner('/home/alice')).toBe('alicia');
        expect(owner('/home/alice/docs')).toBe('alicia');
        expect(owner('/home/alice/docs/a.txt')).toBe('alicia');
        expect(owner('/tmp/bob.txt')).toBe('bob');
        expect(fs.persist).toHaveBeenCalled();
        sub.unsubscribe();
    });

    it('a new account with the old name does not inherit the files', () => {
        const { events$, sub, owner } = setup();
        events$.next({ type: 'user_updated', user: userNamed('alicia'), previousName: 'alice', timestamp: 1 });
        events$.next({ type: 'user_created', user: userNamed('alice'), timestamp: 2 });
        expect(owner('/home/alice/docs/a.txt')).toBe('alicia');
        sub.unsubscribe();
    });

    it('deleting a user gives their files to root', () => {
        const { events$, sub, owner } = setup();
        events$.next({ type: 'user_deleted', user: userNamed('alice'), timestamp: 1 });
        expect(owner('/home/alice')).toBe('root');
        expect(owner('/home/alice/docs/a.txt')).toBe('root');
        expect(owner('/tmp/bob.txt')).toBe('bob');
        sub.unsubscribe();
    });

    it('ignores updates that are not renames', () => {
        const { fs, events$, sub, owner } = setup();
        events$.next({ type: 'user_updated', user: userNamed('alice'), timestamp: 1 });
        expect(owner('/home/alice')).toBe('alice');
        expect(fs.persist).not.toHaveBeenCalled();
        sub.unsubscribe();
    });

    it('is a no-op without a users module', () => {
        const fs = new IndexedDbFileSystemService();
        expect(followUserAccounts(contextFor(() => undefined, false), fs)).toBeUndefined();
    });
});
