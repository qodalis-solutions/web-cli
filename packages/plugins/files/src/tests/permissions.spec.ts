import { IndexedDbFileSystemService } from '../lib/services';

describe('Filesystem permissions', () => {
    let fs: IndexedDbFileSystemService;

    beforeEach(() => {
        fs = new IndexedDbFileSystemService();
    });

    describe('default ownership', () => {
        it('should not set ownership when no current user', () => {
            fs.createFile('/tmp/nouser.txt', 'hello');
            const node = fs.getNode('/tmp/nouser.txt');
            expect(node!.ownership).toBeUndefined();
        });

        it('should set ownership on new files when current user is set', () => {
            fs.setCurrentUser('alice', ['dev', 'staff']);
            fs.createFile('/tmp/owned.txt', 'hello');
            const node = fs.getNode('/tmp/owned.txt');
            expect(node!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
        });

        it('should set ownership on new directories when current user is set', () => {
            fs.setCurrentUser('bob', ['admin']);
            fs.createDirectory('/tmp/mydir');
            const node = fs.getNode('/tmp/mydir');
            expect(node!.ownership).toEqual({ uid: 'bob', gid: 'admin' });
        });

        it('should set ownership on recursively created directories', () => {
            fs.setCurrentUser('carol', ['ops']);
            fs.createDirectory('/tmp/a/b/c', true);
            const nodeA = fs.getNode('/tmp/a');
            const nodeC = fs.getNode('/tmp/a/b/c');
            expect(nodeA!.ownership).toEqual({ uid: 'carol', gid: 'ops' });
            expect(nodeC!.ownership).toEqual({ uid: 'carol', gid: 'ops' });
        });

        it('should use "users" as default group when user has no groups', () => {
            fs.setCurrentUser('dave', []);
            fs.createFile('/tmp/nogroup.txt', 'hello');
            const node = fs.getNode('/tmp/nogroup.txt');
            expect(node!.ownership).toEqual({ uid: 'dave', gid: 'users' });
        });
    });

    describe('default permissions', () => {
        it('should set rw-r--r-- on new files', () => {
            fs.createFile('/tmp/file.txt', 'hello');
            const node = fs.getNode('/tmp/file.txt');
            expect(node!.permissions).toBe('rw-r--r--');
        });

        it('should set rwxr-xr-x on new directories', () => {
            fs.createDirectory('/tmp/dir');
            const node = fs.getNode('/tmp/dir');
            expect(node!.permissions).toBe('rwxr-xr-x');
        });
    });

    describe('chmod', () => {
        it('should change permissions on a file', () => {
            fs.createFile('/tmp/file.txt', 'hello');
            fs.chmod('/tmp/file.txt', 'rwxrwxrwx');
            const node = fs.getNode('/tmp/file.txt');
            expect(node!.permissions).toBe('rwxrwxrwx');
        });

        it('should throw on nonexistent path', () => {
            expect(() => fs.chmod('/nonexistent', 'rwxr-xr-x'))
                .toThrowError(/No such file or directory/);
        });
    });

    describe('chown', () => {
        it('should change ownership on a file', () => {
            fs.createFile('/tmp/file.txt', 'hello');
            fs.chown('/tmp/file.txt', { uid: 'bob', gid: 'staff' });
            const node = fs.getNode('/tmp/file.txt');
            expect(node!.ownership).toEqual({ uid: 'bob', gid: 'staff' });
        });

        it('should throw on nonexistent path', () => {
            expect(() => fs.chown('/nonexistent', { uid: 'bob', gid: 'staff' }))
                .toThrowError(/No such file or directory/);
        });
    });

    describe('clone preserves ownership', () => {
        it('should preserve ownership on copy', () => {
            fs.setCurrentUser('alice', ['dev']);
            fs.createFile('/tmp/original.txt', 'content');
            fs.copy('/tmp/original.txt', '/tmp/copied.txt');
            const node = fs.getNode('/tmp/copied.txt');
            expect(node!.ownership).toEqual({ uid: 'alice', gid: 'dev' });
        });
    });
});
