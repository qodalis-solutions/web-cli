import { CliTestHarness } from '@qodalis/cli';
import { ICliPermissionRegistry, ICliPermissionRegistry_TOKEN, ICliUser, ICliUsersStoreService, ICliUsersStoreService_TOKEN } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { usersModule, usersPermissionDefinitions } from '../public-api';
import { createUsersRuntime, CliUsersRuntime, LOCAL_TOKEN_KEY } from '../lib/module/users-runtime';
import { bindSessionToContext, bindTermination, wrapProcessors } from '../lib/module/session-lifecycle';
import { CliUserSessionService } from '../lib/services/cli-user-session.service';

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

function userNamed(h: CliTestHarness, name: string): Promise<ICliUser | undefined> {
    return firstValueFrom(h.services.get<ICliUsersStoreService>(ICliUsersStoreService_TOKEN)!.getUser(name));
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

    it('adduser without --email walks through every field', async () => {
        const { run, h } = await setup();
        await run('groupadd dev');
        // name, email, full name, groups, home (Enter keeps the default), enabled?, password x2
        const r = await run('adduser', 'carol', 'carol@x.io', 'Carol King', ['users', 'dev'], '', true, 'password1', 'password1');
        expect(r.err).toBe('');
        expect(r.out).toContain("User 'carol' created (groups: users, dev)");
        const carol = await userNamed(h, 'carol');
        expect(carol?.homeDir).toBe('/home/carol');
        expect(carol?.data?.['fullName']).toBe('Carol King');
        expect(carol?.disabled).toBeFalsy();
        const list = (await run('listusers')).out;
        expect(list).toContain('FULL NAME');
        expect(list).toContain('Carol King');
    });

    it('adduser re-asks for an invalid email before anything else', async () => {
        const { run, h } = await setup();
        const r = await run('adduser dave', 'not-an-email', 'dave@x.io', '', ['users'], '/srv/dave', false, 'password1', 'password1');
        expect(r.err).toBe('Invalid email format');
        expect(r.out).toContain("User 'dave' created");
        const dave = await userNamed(h, 'dave');
        expect(dave?.homeDir).toBe('/srv/dave');
        expect(dave?.disabled).toBeTrue();
        expect(dave?.data?.['fullName']).toBeUndefined();
    });

    it('usermod sets and clears the full name', async () => {
        const { run, h } = await setup();
        await run('adduser gina --email=g@x.io --full-name="Gina Lee"', 'password1', 'password1');
        expect((await userNamed(h, 'gina'))?.data?.['fullName']).toBe('Gina Lee');
        await run('usermod gina --full-name="Gina Park"');
        expect((await userNamed(h, 'gina'))?.data?.['fullName']).toBe('Gina Park');
        await run('usermod gina --full-name=""');
        expect((await userNamed(h, 'gina'))?.data?.['fullName']).toBeUndefined();
    });

    it('adduser reports a taken name or email before asking anything else', async () => {
        const { run } = await setup();
        // Given on the command line: fails at once, no password prompt
        let r = await run('adduser root', 'password1', 'password1');
        expect(r.err).toBe('user already exists: root');
        // Interactive: the taken name and email are asked again
        r = await run('adduser', 'root', 'mia', 'root@localhost', 'mia@x.io', '', ['users'], '', true, 'password1', 'password1');
        expect(r.err).toBe('user already exists: root\na user with email already exists: root@localhost');
        expect(r.out).toContain("User 'mia' created");
        // --email that is taken: fails before the password
        r = await run('adduser zed --email=mia@x.io', 'password1', 'password1');
        expect(r.err).toBe('a user with email already exists: mia@x.io');
    });

    it('adduser re-asks for a password that breaks the policy or does not match', async () => {
        const { run } = await setup();
        const r = await run('adduser erin --email=e@x.io', 'abc', 'password1', 'password2', 'password1', 'password1');
        expect(r.err).toContain('at least 8 characters');
        expect(r.err).toContain('passwords do not match');
        expect(r.out).toContain("User 'erin' created");
    });

    it('adduser gives up after three bad emails without creating the user', async () => {
        const { run } = await setup();
        const r = await run('adduser frank', 'a', 'b', 'c', 'password1', 'password1');
        expect(r.err.split('\n').length).toBe(3);
        expect((await run('listusers')).out).not.toContain('frank');
    });

    it('adduser accepts every email the backend accepts (root@localhost style)', async () => {
        const { run } = await setup();
        const r = await run('adduser ops --email=ops@localhost', 'password1', 'password1');
        expect(r.err).toBe('');
        expect(r.out).toContain("User 'ops' created");
    });

    it('reads quoted user names without their quotes', async () => {
        const { h, run } = await setup();
        const r = await run(`adduser "carol" --email=carol@x.io`, 'password1', 'password1');
        expect(r.err).toBe('');
        expect(r.out).toContain("User 'carol' created");
        expect(await userNamed(h, 'carol')).toBeDefined();
        expect((await run(`userdel 'carol' --force`)).out).toContain("User 'carol' deleted");
    });
});

describe('su sessions (nested like Unix shells)', () => {
    async function withUser(run: (cmd: string, ...answers: any[]) => Promise<any>, name: string): Promise<void> {
        await run(`adduser ${name} --email=${name}@x.io`, 'password1', 'password1');
    }

    it('exit after su returns to the previous user', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        await withUser(run, 'b');
        expect((await run('su a', 'password1')).out).toContain("Switched to a. Use 'exit' to return.");
        await run('su b', 'password1');
        expect(rt.session.depth).toBe(2);
        expect((await run('whoami')).out).toContain('b (b@x.io)');

        expect((await run('exit')).out).toContain('Logged out b. Back to a.');
        expect((await run('whoami')).out).toContain('a (a@x.io)');
        expect((await run('logout')).out).toContain('Logged out a. Back to root.');
        expect((await run('whoami')).out).toContain('root');
        expect(rt.session.depth).toBe(0);

        expect((await run('exit')).out).toContain("Logged out root. Use 'login' to sign in again.");
        expect((await run('whoami')).out).toBe('Not logged in');
    });

    it('keeps the suspended session open and ends the su session on exit', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        const rootToken = rt.session.getToken()!;
        await run('su a', 'password1');
        const aToken = rt.session.getToken()!;
        await expectAsync(rt.backend.currentSession(rootToken)).toBeResolved();
        await run('exit');
        expect(rt.session.getToken()).toBe(rootToken);
        await expectAsync(rt.backend.currentSession(aToken)).toBeRejected();
    });

    it('a wrong password leaves the current session as it was', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        expect((await run('su a', 'nope')).err).toBe('su: invalid credentials');
        expect(rt.session.depth).toBe(0);
        expect((await run('whoami')).out).toContain('root');
    });

    it('login replaces every session, including the suspended ones', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        const rootToken = rt.session.getToken()!;
        await run('su a', 'password1');
        await run('login a', 'password1');
        expect(rt.session.depth).toBe(0);
        await expectAsync(rt.backend.currentSession(rootToken)).toBeRejected();
        await run('exit');
        expect((await run('whoami')).out).toBe('Not logged in');
    });

    it('exit skips suspended sessions that ended meanwhile', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        const rootToken = rt.session.getToken()!;
        await run('su a', 'password1');
        await rt.backend.logout(rootToken);
        expect((await run('exit')).out).toContain("Logged out a. Use 'login' to sign in again.");
        expect((await run('whoami')).out).toBe('Not logged in');
    });

    it('su -c runs one command as the user and switches back', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        const r = await run('su -c whoami a', 'password1');
        expect(r.out).toContain('a (a@x.io)');
        expect(r.out).not.toContain('Switched to');
        expect(rt.session.depth).toBe(0);
        expect((await run('whoami')).out).toContain('root');
    });

    it('su -c exits with the status of the command', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        const failed = await run('su -c nosuchcommand a', 'password1');
        expect(failed.code).not.toBe(0);
        expect(rt.session.depth).toBe(0);
        const ok = await run('su -c whoami a', 'password1');
        expect(ok.code ?? 0).toBe(0);
    });

    it('exit and logout while signed out say so', async () => {
        const { run } = await setup();
        await run('logout');
        expect((await run('exit')).err).toBe('exit: not logged in');
        expect((await run('logout')).err).toBe('logout: not logged in');
    });

    it('accepts `su - <user>`', async () => {
        const { run } = await setup();
        await withUser(run, 'a');
        await run('su - a', 'password1');
        expect((await run('whoami')).out).toContain('a (a@x.io)');
    });

    it('restores the stack after a reload', async () => {
        const { run, rt } = await setup();
        await withUser(run, 'a');
        await run('su a', 'password1');
        // A second session service over the same storage, as after a page reload
        const reloaded = new CliUserSessionService(rt.backend, rt.kv, LOCAL_TOKEN_KEY);
        expect((await reloaded.restoreSession())?.user.name).toBe('a');
        expect(reloaded.depth).toBe(1);
        expect((await reloaded.pop())?.user.name).toBe('root');
        expect(reloaded.depth).toBe(0);
    });
});
