import {
    CliProcessCommand,
    ICliCommandGuard,
    ICliCommandGuard_TOKEN,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing';

/**
 * Scenario tests for global command guards through the real service container
 * and executor (CliTestHarness). Covers setups with and without a module that
 * enforces auth/permission metadata — the users module is optional.
 */

function processor(command: string, metadata?: Record<string, any>): ICliCommandProcessor & { runs: number } {
    const p = {
        command,
        description: command,
        metadata,
        runs: 0,
        async processCommand(_c: CliProcessCommand, ctx: ICliExecutionContext) {
            p.runs++;
            ctx.writer.writeln(`${command} ran`);
        },
    };
    return p as any;
}

/** Same shape the users module uses, but defined here to keep cli tests independent of it. */
const authGuard: ICliCommandGuard = {
    name: 'test:require-auth',
    appliesTo: (p) => p.metadata?.['requireAuth'] === true,
    canActivate: (_c, p, ctx) => (ctx.userSession ? true : `${p.command}: login required`),
};

function addGuard(harness: CliTestHarness, guard: ICliCommandGuard) {
    harness.services.set({ provide: ICliCommandGuard_TOKEN, useValue: guard, multi: true });
}

describe('Global command guards (scenarios)', () => {
    describe('without any guard-providing module (no users module)', () => {
        it('runs plain commands', async () => {
            const h = new CliTestHarness();
            const p = processor('plain');
            h.registerProcessor(p);

            const result = await h.execute('plain');

            expect(p.runs).toBe(1);
            expect(result.exitCode ?? 0).toBe(0);
        });

        it('treats requireAuth / requiredGroups metadata as informational', async () => {
            const h = new CliTestHarness();
            const authOnly = processor('secret', { requireAuth: true });
            const adminOnly = processor('admin-task', { requiredGroups: ['admin'] });
            h.registerProcessors([authOnly, adminOnly]);

            await h.execute('secret');
            await h.execute('admin-task');

            expect(authOnly.runs).toBe(1);
            expect(adminOnly.runs).toBe(1);
        });
    });

    describe('with a guard-providing module', () => {
        it('blocks protected commands when signed out and leaves others alone', async () => {
            const h = new CliTestHarness();
            const open = processor('open');
            const secret = processor('secret', { requireAuth: true });
            h.registerProcessors([open, secret]);
            addGuard(h, authGuard);

            const blocked = await h.execute('secret');
            await h.execute('open');

            expect(secret.runs).toBe(0);
            expect(blocked.stderr.join('\n')).toContain('secret: login required');
            expect(blocked.exitCode).toBe(-1);
            expect(open.runs).toBe(1);
        });

        it('allows protected commands once a session exists', async () => {
            const h = new CliTestHarness();
            const secret = processor('secret', { requireAuth: true });
            h.registerProcessor(secret);
            addGuard(h, authGuard);
            h.setUserSession({
                user: { id: '1', name: 'alice', email: 'a@b.c', groups: [], createdAt: 0, updatedAt: 0 },
                loginTime: 0,
                lastActivity: 0,
            });

            await h.execute('secret');

            expect(secret.runs).toBe(1);
        });

        it('combines guards from several modules', async () => {
            const h = new CliTestHarness();
            const deploy = processor('deploy');
            h.registerProcessor(deploy);
            addGuard(h, { name: 'maintenance', priority: -10, canActivate: () => true });
            addGuard(h, {
                name: 'business-hours',
                appliesTo: (p) => p.command === 'deploy',
                canActivate: () => 'deploy: not allowed outside business hours',
            });

            const result = await h.execute('deploy');

            expect(deploy.runs).toBe(0);
            expect(result.stderr.join('\n')).toContain('outside business hours');
        });

        it('lets guards resolve services from the context to decide what to guard', async () => {
            // A "policy" service registered by some module decides which commands are locked
            const POLICY_TOKEN = 'test-command-policy';
            const h = new CliTestHarness();
            const deploy = processor('deploy');
            const status = processor('status');
            h.registerProcessors([deploy, status]);
            h.registerService(POLICY_TOKEN, { locked: ['deploy'], reason: 'release freeze' });

            const seen: any[] = [];
            addGuard(h, {
                name: 'policy',
                appliesTo: (p, _cmd, ctx) => {
                    seen.push(ctx);
                    const policy = ctx.services.get<any>(POLICY_TOKEN);
                    return !!policy?.locked.includes(p.command);
                },
                canActivate: (_cmd, p, ctx) =>
                    `${p.command}: ${ctx.services.getRequired<any>(POLICY_TOKEN).reason}`,
            });

            const blocked = await h.execute('deploy');
            await h.execute('status');

            expect(seen.length).toBe(2);
            expect(seen.every((c) => !!c?.services)).toBeTrue();
            expect(deploy.runs).toBe(0);
            expect(blocked.stderr.join('\n')).toContain('deploy: release freeze');
            expect(status.runs).toBe(1);
        });

        it('supports async appliesTo', async () => {
            const h = new CliTestHarness();
            const secret = processor('secret');
            h.registerProcessor(secret);
            addGuard(h, {
                name: 'async-filter',
                appliesTo: async () => true,
                canActivate: async () => ({ allowed: false, message: 'secret: nope' }),
            });

            const result = await h.execute('secret');

            expect(secret.runs).toBe(0);
            expect(result.stderr.join('\n')).toContain('secret: nope');
        });

        it('fails closed when appliesTo throws', async () => {
            const h = new CliTestHarness();
            const secret = processor('secret');
            h.registerProcessor(secret);
            addGuard(h, {
                name: 'broken',
                appliesTo: () => {
                    throw new Error('policy service unavailable');
                },
                canActivate: () => true,
            });

            const result = await h.execute('secret');

            expect(secret.runs).toBe(0);
            expect(result.stderr.join('\n')).toContain("blocked by guard 'broken'");
        });

        it('still serves --help for a blocked command', async () => {
            const h = new CliTestHarness();
            const secret = processor('secret', { requireAuth: true });
            (secret as any).writeDescription = (ctx: ICliExecutionContext) => ctx.writer.writeln('secret help');
            h.registerProcessor(secret);
            addGuard(h, authGuard);

            const result = await h.execute('secret --help');

            expect(secret.runs).toBe(0);
            expect(result.stderr.join('\n')).not.toContain('login required');
        });
    });
});
