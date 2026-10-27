import { IndexedDbFileSystemService } from '../lib/services/indexed-db-file-system.service';

describe('IndexedDbFileSystemService saved directory', () => {
    it("keeps the signed-out directory and never saves a signed-in user's", async () => {
        const fs = new IndexedDbFileSystemService();
        await fs.initialize();
        fs.createDirectory('/tmp/anon', true);
        fs.createDirectory('/home/alice', true);

        // The database is shared with the other specs (Karma runs them in one
        // browser, in random order), so set the signed-out state explicitly
        fs.setHomePath('/tmp/anon');
        fs.setCurrentDirectory('/tmp/anon');
        await fs.persist();

        fs.setCurrentUser('alice', ['users']);
        fs.setHomePath('/home/alice');
        fs.setCurrentDirectory('/home/alice');
        await fs.persist();

        // The next start (signed out, or without a users module) is where the signed-out session was
        const next = new IndexedDbFileSystemService();
        await next.initialize();
        expect(next.getCurrentDirectory()).toBe('/tmp/anon');
        expect(next.getHomePath()).toBe('/tmp/anon');
        // The tree itself is still saved while signed in
        expect(next.exists('/home/alice')).toBeTrue();
    });
});
