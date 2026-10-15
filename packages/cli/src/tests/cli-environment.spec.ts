import { CliEnvironment } from '../lib/services/cli-environment';
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
        let saved: any;
        env.setProfileResolver(() => 'root');
        env.onChange = (snapshot) => (saved = snapshot);

        env.set('A', '1');
        env.unset('SHELL');
        expect(saved).toEqual({ root: { vars: { A: '1' }, unset: ['SHELL'] } });

        const restored = new CliEnvironment();
        restored.setProfileResolver(() => 'root');
        restored.load(saved);
        expect(restored.get('A')).toBe('1');
        expect(restored.has('SHELL')).toBeFalse();
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
