import { CliTestHarness } from '@qodalis/cli';
import { ICliPermissionRegistry, ICliPermissionRegistry_TOKEN } from '@qodalis/cli-core';
import { usersModule, usersPermissionDefinitions } from '../public-api';
import { createUsersRuntime, CliUsersRuntime } from '../lib/module/users-runtime';
import { bindSessionToContext, bindTermination, wrapProcessors } from '../lib/module/session-lifecycle';

async function setup(): Promise<{ h: CliTestHarness; rt: CliUsersRuntime; run: (cmd: string, ...answers: any[]) => Promise<{ out: string; err: string; code?: number }> }> {
    const h = new CliTestHarness();
    const ctx: any = {
        services: h.services,
        writer: { writeln() {}, writeWarning() {}, writeError() {}, writeInfo() {} },
        showPrompt() {},
    };
    const rt = await createUsersRuntime(ctx, { passwordHashIterations: 1000, requirePassword: true });
    await rt.local!.createUserInternal({ name: 'root', email: 'root@localhost', groups: ['admin'], password: 'root', skipPasswordPolicy: true });
    await rt.session.start(await rt.local!.startTrustedSession('root'));
    bindSessionToContext(ctx, rt);
    h.registerProcessors(wrapProcessors(usersModule.processors!, rt, bindTermination(ctx, rt)));
    h.services.get<ICliPermissionRegistry>(ICliPermissionRegistry_TOKEN)!.register(usersPermissionDefinitions, 'users');
    h.setUserSessionProvider(() => rt.session.current);
    const run = async (cmd: string, ...answers: any[]) => {
        if (answers.length) h.setReaderResponses(...answers);
        const r = await h.execute(cmd);
        return { out: r.stdout.join('\n'), err: r.stderr.map((l: string) => l.replace(/^\[error\] /, '')).join('\n'), code: r.exitCode };
    };
    return { h, rt, run };
}

describe('users commands (local mode)', () => {
    it('manages users end to end', async () => {
        const { run } = await setup();
        let r = await run('adduser alice --email=alice@x.io', 'password1', 'password1');
        expect(r.err).toBe('');
        expect(r.out).toContain("User 'alice' created (groups: users)");

        r = await run('listusers');
        expect(r.out).toContain('alice');
        expect(r.out).toContain('alice@x.io');

        r = await run('usermod alice --name=alicia --email=al@x.io');
        expect(r.out).toContain("User 'alicia' updated");

        r = await run('usermod alicia --disable');
        r = await run('listusers --query=ali');
        expect(r.out).toContain('disabled');

        r = await run('userdel alicia --force');
        expect(r.out).toContain("User 'alicia' deleted");
    });

    it('rejects passwords that do not match, without creating the user', async () => {
        const { run } = await setup();
        const r = await run('adduser bob --email=b@x.io', 'password1', 'password2');
        expect(r.err).toContain('passwords do not match');
        expect((await run('listusers')).out).not.toContain('bob');
    });

    it('enforces permissions through roles and applies grants immediately', async () => {
        const { run } = await setup();
        await run('groupadd helpdesk --permissions=users:read');
        await run('adduser hd --email=hd@x.io --groups=helpdesk', 'password1', 'password1');
        await run('su hd', 'password1');
        expect((await run('whoami')).out).toContain('hd (hd@x.io)');

        expect((await run('listusers')).out).toContain('root');
        let r = await run('adduser x --email=x@x.io');
        expect(r.err).toContain('adduser: permission denied (requires users:create)');
        r = await run('groupmod helpdesk --grant=users:create');
        expect(r.err).toContain('permission denied (requires groups:update)');

        await run('su root', 'root');
        r = await run('groupmod helpdesk --grant=users:create');
        expect(r.out).toContain('helpdesk: users:read, users:create');
        await run('su hd', 'password1');
        expect((await run('perms')).out).toContain('Effective: users:read, users:create');
    });

    it('reports protections from the backend as one line', async () => {
        const { run } = await setup();
        expect((await run('groupdel admin')).err).toBe('groupdel: cannot delete built-in group: admin');
        expect((await run('userdel root --force')).err).toBe('userdel: cannot delete your own account');
        expect((await run('usermod root --remove-groups=admin')).err).toContain('last administrator');
    });

    it('shows identity, groups and permissions', async () => {
        const { run } = await setup();
        expect((await run('id')).out).toBe('uid=root gid=admin groups=admin permissions=*');
        expect((await run('whoami --info')).out).toContain('*');
        const all = (await run('groups --all')).out;
        expect(all).toContain('admin *');
        expect(all).toContain('users *');
        const list = (await run('perms --list')).out;
        expect(list).toContain('users:create');
        expect(list).toContain('audit:clear');
    });

    it('lists and kicks sessions, and records it in the audit log', async () => {
        const { run, rt } = await setup();
        await run('adduser a --email=a@x.io', 'password1', 'password1');
        const other = await rt.local!.login('a', 'password1');
        let r = await run('sessions');
        expect(r.out).toContain(other.session.id);
        expect(r.out).toContain('(current)');
        r = await run(`session-kick ${other.session.id}`);
        expect(r.out).toContain('terminated');
        r = await run('audit --event=session_revoked');
        expect(r.out).toContain('session_revoked');
        r = await run('last a');
        expect(r.out).toContain('login');
    });

    it('logout leaves the CLI signed out and protected commands ask for login', async () => {
        const { run } = await setup();
        await run('logout');
        expect((await run('whoami')).out).toBe('Not logged in');
        expect((await run('listusers')).err).toBe('listusers: login required');
        expect((await run('id')).err).toBe('id: login required');
        const r = await run('login root', 'root');
        expect(r.out).toContain('Logged in as root');
    });

    it('wrong password on login is reported, session unchanged', async () => {
        const { run } = await setup();
        const r = await run('login root', 'nope');
        expect(r.err).toBe('login: invalid credentials');
        expect((await run('whoami')).out).toContain('root');
    });

    it('passwd asks non-privileged users for the current password', async () => {
        const { run } = await setup();
        await run('adduser a --email=a@x.io', 'password1', 'password1');
        await run('su a', 'password1');
        let r = await run('passwd', 'wrong', 'new-pass-1', 'new-pass-1');
        expect(r.err).toBe('passwd: current password is incorrect');
        r = await run('passwd', 'password1', 'new-pass-1', 'new-pass-1');
        expect(r.out).toContain('password updated for a');
        await run('su root', 'root');
        r = await run('passwd a', 'reset-pass', 'reset-pass');
        expect(r.out).toContain('password updated for a');
    });

    it('adduser accepts every email the backend accepts (root@localhost style)', async () => {
        const { run } = await setup();
        const r = await run('adduser ops --email=ops@localhost', 'password1', 'password1');
        expect(r.err).toBe('');
        expect(r.out).toContain("User 'ops' created");
    });
});
