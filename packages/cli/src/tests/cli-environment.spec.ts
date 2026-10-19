import { applyEnvironmentChange, CliEnvironment } from '../lib/services/cli-environment';
import { parseAssignments } from '../lib/processors/cli-env-command-processor';

describe('CliEnvironment', () => {
    let env: CliEnvironment;

    beforeEach(() => {
        env = new CliEnvironment();
    });

    it('should seed standard variables', () => {
        expect(env.get('USER')).toBe('user');
        expect(env.get('HOME')).toBe('/home/user');
    });

    it('should read bound variables on every access', () => {
        let user: string | undefined = 'root';
        env.bind('USER', () => user);

        expect(env.get('USER')).toBe('root');
        expect(env.getAll()['USER']).toBe('root');
        user = 'bob';
        expect(env.get('USER')).toBe('bob');
    });

    it('should fall back to the seeded value while the binding has none', () => {
        env.bind('HOME', () => undefined);
        expect(env.get('HOME')).toBe('/home/user');
    });

    it('should let set and unset replace a binding', () => {
        env.bind('PWD', () => '/home/root');
        env.set('PWD', '/tmp');
        expect(env.get('PWD')).toBe('/tmp');

        env.bind('USER', () => 'root');
        env.unset('USER');
        expect(env.has('USER')).toBeFalse();
        expect('USER' in env.getAll()).toBeFalse();
    });

    it('should keep a separate set of variables per user', () => {
        let user = 'root';
        env.setProfileResolver(() => user);

        env.set('EDITOR', 'nano');
        env.unset('LANG');
        expect(env.get('EDITOR')).toBe('nano');
        expect(env.has('LANG')).toBeFalse();

        user = 'bob';
        expect(env.has('EDITOR')).toBeFalse();
        expect(env.get('LANG')).toBe('en_US.UTF-8');

        user = 'root';
        expect(env.get('EDITOR')).toBe('nano');
    });

    it('should let a user override a bound variable', () => {
        env.bind('HOME', () => '/home/root');
        env.set('HOME', '/data');
        expect(env.get('HOME')).toBe('/data');
    });

    it('should report every change and restore a saved snapshot', () => {
        let saved: any = {};
        env.setProfileResolver(() => 'root');
        env.onChange = (change) => (saved = applyEnvironmentChange(saved, change));

        env.set('A', '1');
        env.unset('SHELL');
        expect(saved.profiles).toEqual({ root: { vars: { A: '1' }, unset: ['SHELL'] } });

        const restored = new CliEnvironment();
        restored.setProfileResolver(() => 'root');
        restored.load(saved.profiles, saved.global);
        expect(restored.get('A')).toBe('1');
        expect(restored.has('SHELL')).toBeFalse();
    });
});

describe('CliEnvironment scopes', () => {
    let env: CliEnvironment;
    let user: string;

    beforeEach(() => {
        env = new CliEnvironment();
        user = 'ana';
        env.setProfileResolver(() => user);
    });

    it('resolves this terminal, then the user, then shared, then built-in', () => {
        env.set('API', 'shared', 'global');
        expect(env.get('API')).toBe('shared');
        expect(env.scopeOf('API')).toBe('global');

        env.set('API', 'mine');
        expect(env.get('API')).toBe('mine');
        expect(env.scopeOf('API')).toBe('user');

        env.set('API', 'here', 'session');
        expect(env.get('API')).toBe('here');
        expect(env.scopeOf('API')).toBe('session');

        user = 'bob';
        expect(env.get('API')).toBe('here'); // the terminal's own, whoever is signed in
        env.unset('API', 'session');
        expect(env.get('API')).toBe('shared');
        expect(env.scopeOf('SHELL')).toBe('builtin');
    });

    it('a saved value replaces the terminal one; session values are never reported', () => {
        const changes: any[] = [];
        env.onChange = (c) => changes.push(c);
        env.set('X', '1', 'session');
        expect(changes).toEqual([]);
        env.set('X', '2');
        expect(env.scopeOf('X')).toBe('user');
        expect(changes).toEqual([{ scope: 'user', profile: 'ana', name: 'X', value: '2' }]);
    });

    it('unset hides a shared value for this user only; --global removes it for all', () => {
        env.set('API', 'shared', 'global');
        env.unset('API');
        expect(env.has('API')).toBeFalse();
        user = 'bob';
        expect(env.get('API')).toBe('shared');
        env.unset('API', 'global');
        expect(env.has('API')).toBeFalse();
    });

    it('applies each change to the latest saved state, keeping other tabs and users', () => {
        // Two tabs started from the same saved state, each with a different user
        let saved: any = { profiles: {}, global: {} };
        const tab = (name: string) => {
            const e = new CliEnvironment();
            e.setProfileResolver(() => name);
            e.load(saved.profiles, saved.global);
            e.onChange = (c) => (saved = applyEnvironmentChange(saved, c));
            return e;
        };
        const a = tab('ana');
        const b = tab('bob');
        a.set('EDITOR', 'vim');
        b.set('EDITOR', 'nano');
        a.set('SHARED', '1', 'global');
        b.set('OTHER', 'x');
        expect(saved.profiles).toEqual({
            ana: { vars: { EDITOR: 'vim' }, unset: [] },
            bob: { vars: { EDITOR: 'nano', OTHER: 'x' }, unset: [] },
        });
        expect(saved.global).toEqual({ SHARED: '1' });
    });

    it('removes a profile that has nothing left', () => {
        let saved: any = {};
        env.onChange = (c) => (saved = applyEnvironmentChange(saved, c));
        env.set('T', '1');
        env.unset('T');
        expect(saved.profiles).toEqual({});
    });
});

describe('parseAssignments', () => {
    it('should parse several assignments with quoted values', () => {
        expect(parseAssignments(`A=1 B="two words" C='x y' D=`)).toEqual([
            { name: 'A', value: '1' },
            { name: 'B', value: 'two words' },
            { name: 'C', value: 'x y' },
            { name: 'D', value: '' },
        ]);
    });

    it('should accept bare names and reject invalid input', () => {
        expect(parseAssignments('EDITOR')).toEqual([{ name: 'EDITOR' }]);
        expect(parseAssignments('1A=x')).toBeNull();
        expect(parseAssignments('A-B=x')).toBeNull();
    });
});
