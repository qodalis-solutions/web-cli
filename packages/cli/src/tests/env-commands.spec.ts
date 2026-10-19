import { ICliAuthorizationService_TOKEN } from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing';
import { CliEnvironment, ICliEnvironment_TOKEN } from '../lib/services/cli-environment';
import {
    CliEchoCommandProcessor,
    CliEnvCommandProcessor,
    CliExportCommandProcessor,
    CliUnsetCommandProcessor,
} from '../lib/processors';

describe('env commands and scopes', () => {
    let harness: CliTestHarness;
    let env: CliEnvironment;

    beforeEach(() => {
        harness = new CliTestHarness();
        env = new CliEnvironment();
        harness.registerService(ICliEnvironment_TOKEN, env);
        harness.registerProcessors([
            new CliEchoCommandProcessor(),
            new CliExportCommandProcessor(),
            new CliUnsetCommandProcessor(),
            new CliEnvCommandProcessor(),
        ]);
    });

    it('NAME=value is for this terminal; export saves it for the user', async () => {
        await harness.execute('TMP=1');
        expect(env.scopeOf('TMP')).toBe('session');
        await harness.execute('export TMP');
        expect(env.scopeOf('TMP')).toBe('user');
        expect(env.get('TMP')).toBe('1');
    });

    it('export --global sets a shared value that a user value overrides', async () => {
        await harness.execute('export --global API=https://shared');
        expect(env.scopeOf('API')).toBe('global');
        await harness.execute('export API=http://mine');
        expect((await harness.execute('echo $API')).output).toBe('http://mine');
        await harness.execute('unset API');
        expect(env.has('API')).toBeFalse(); // hidden for this user
        await harness.execute('unset --global API');
        expect(env.globals()).toEqual({});
    });

    it('env shows where each variable comes from, piped output stays plain', async () => {
        await harness.execute('LOCAL=a');
        await harness.execute('export MINE=b');
        await harness.execute('export -g ALL=c');
        const out = (await harness.execute('env')).output;
        expect(out).toContain('LOCAL=a  \x1b[2m# this terminal');
        expect(out).toContain('MINE=b  \x1b[2m# user');
        expect(out).toContain('ALL=c  \x1b[2m# shared');
        const data = (await harness.execute('env')).data as string;
        expect(data.split('\n')).toContain('ALL=c');
    });

    it('needs system:env:global for shared variables when an auth module is loaded', async () => {
        harness.registerService(ICliAuthorizationService_TOKEN, {
            getPrincipal: () => ({ name: 'bob' }),
            can: (permission: string) => permission !== 'system:env:global',
            canAccess: () => true,
        });
        const set = await harness.execute('export --global API=x');
        expect(set.stderr.join('\n')).toContain('permission denied');
        expect(set.exitCode).toBe(1);
        expect(env.has('API')).toBeFalse();
        const unset = await harness.execute('unset --global PATH');
        expect(unset.exitCode).toBe(1);
        await harness.execute('export API=mine');
        expect(env.get('API')).toBe('mine');
    });
});
