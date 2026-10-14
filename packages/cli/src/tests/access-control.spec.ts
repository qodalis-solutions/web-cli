import {
    CliAccessDeniedError,
    cliEvaluateAccess,
    ICliAuthorizationService,
    ICliAuthorizationService_TOKEN,
    ICliCommandProcessor,
    ICliPermissionRegistry,
    ICliPermissionRegistry_TOKEN,
    ICliPrincipal,
} from '@qodalis/cli-core';
import { CliTestHarness } from '../lib/testing';
import { CliBoot } from '../lib/services/cli-boot';

function proc(command: string, metadata?: Record<string, any>, body?: () => void): ICliCommandProcessor & { runs: number } {
    const p: any = {
        command,
        description: command,
        metadata,
        runs: 0,
        async processCommand(_c: any, ctx: any) {
            p.runs++;
            body?.();
            ctx.writer.writeln(`${command} ran`);
        },
    };
    return p;
}

function authorization(principal?: ICliPrincipal): ICliAuthorizationService {
    return {
        getPrincipal: () => principal,
        can: (perm) => !!principal && principal.permissions.some((p) => p === '*' || p === perm || (p.endsWith(':*') && perm.startsWith(p.slice(0, -1)))),
        canAccess: (resource, action, bypass) => cliEvaluateAccess(principal, resource, action, bypass),
    };
}

const ALICE: ICliPrincipal = { id: '1', name: 'alice', groups: ['dev'], permissions: ['deploy:run'] };

describe('Access control (generic layer)', () => {
    describe('without an auth module', () => {
        it('access metadata is informational: every command runs', async () => {
            const h = new CliTestHarness();
            const a = proc('a', { requireAuth: true });
            const b = proc('b', { requiredGroups: ['ops'] });
            const c = proc('c', { requiredPermissions: ['deploy:run'] });
            h.registerProcessors([a, b, c]);
            await h.execute('a');
            await h.execute('b');
            await h.execute('c');
            expect([a.runs, b.runs, c.runs]).toEqual([1, 1, 1]);
        });
    });

    describe('with an authorization service', () => {
        it('requireAuth blocks anonymous callers', async () => {
            const h = new CliTestHarness();
            const a = proc('a', { requireAuth: true });
            h.registerProcessor(a);
            h.registerService(ICliAuthorizationService_TOKEN, authorization(undefined));
            const r = await h.execute('a');
            expect(a.runs).toBe(0);
            expect(r.stderr.join()).toContain('a: login required');
            expect(r.stderr.join()).not.toContain('failed');
        });

        it('requiredPermissions needs all permissions; requiredGroups any group', async () => {
            const h = new CliTestHarness();
            const deploy = proc('deploy', { requiredPermissions: ['deploy:run'] });
            const both = proc('both', { requiredPermissions: ['deploy:run', 'deploy:rollback'] });
            const ops = proc('ops', { requiredGroups: ['ops', 'dev'] });
            const admins = proc('admins', { requiredGroups: ['admin'] });
            h.registerProcessors([deploy, both, ops, admins]);
            h.registerService(ICliAuthorizationService_TOKEN, authorization(ALICE));

            await h.execute('deploy');
            const r1 = await h.execute('both');
            await h.execute('ops');
            const r2 = await h.execute('admins');
            expect([deploy.runs, both.runs, ops.runs, admins.runs]).toEqual([1, 0, 1, 0]);
            expect(r1.stderr.join()).toContain('both: permission denied (requires deploy:rollback)');
            expect(r2.stderr.join()).toContain('admins: permission denied (requires group: admin)');
        });

        it('wildcard * satisfies groups and permissions', async () => {
            const h = new CliTestHarness();
            const x = proc('x', { requiredGroups: ['ops'], requiredPermissions: ['a:b'] });
            h.registerProcessor(x);
            h.registerService(ICliAuthorizationService_TOKEN, authorization({ ...ALICE, groups: ['admin'], permissions: ['*'] }));
            await h.execute('x');
            expect(x.runs).toBe(1);
        });

        it('guards also protect commands reached through chaining and pipes', async () => {
            const h = new CliTestHarness();
            const open = proc('open');
            const secret = proc('secret', { requiredPermissions: ['top:secret'] });
            h.registerProcessors([open, secret]);
            h.registerService(ICliAuthorizationService_TOKEN, authorization(ALICE));
            await h.execute('open && secret');
            await h.execute('open ; secret');
            await h.execute('open | secret');
            expect(secret.runs).toBe(0);
        });
    });

    it('CliAccessDeniedError thrown by a command prints only its message', async () => {
        const h = new CliTestHarness();
        h.registerProcessor(proc('read', undefined, () => {
            throw new CliAccessDeniedError('read: /secret: Permission denied');
        }));
        const r = await h.execute('read');
        expect(r.stderr.join('\n')).toContain('read: /secret: Permission denied');
        expect(r.stderr.join('\n')).not.toContain('Error executing command');
    });

    it('module permissions are registered at boot', async () => {
        const h = new CliTestHarness();
        const registry = h.services.get<ICliPermissionRegistry>(ICliPermissionRegistry_TOKEN)!;
        const boot = new CliBoot(h.registry, h.services);
        const context: any = {
            services: h.services,
            logger: { info() {}, warn() {}, error() {} },
            translator: { addTranslations() {} },
            writer: { writeWarning() {} },
        };
        await (boot as any).bootModule(
            {
                name: 'deploy-module',
                apiVersion: 2,
                version: '1.0.0',
                description: 'x',
                permissions: [{ name: 'deploy:run', description: 'Run deployments' }],
                processors: [],
            },
            context,
        );
        expect(registry.get('DEPLOY:RUN')).toEqual({ name: 'deploy:run', description: 'Run deployments', module: 'deploy-module' });
    });

    describe('cliEvaluateAccess (rwx)', () => {
        const file = { ownership: { uid: 'alice', gid: 'dev' }, permissions: 'rw-r-----' };
        it('owner / group / other bits', () => {
            expect(cliEvaluateAccess(ALICE, file, 'write')).toBeTrue();
            const bob = { id: '2', name: 'bob', groups: ['dev'], permissions: [] };
            expect(cliEvaluateAccess(bob, file, 'read')).toBeTrue();
            expect(cliEvaluateAccess(bob, file, 'write')).toBeFalse();
            const eve = { id: '3', name: 'eve', groups: [], permissions: [] };
            expect(cliEvaluateAccess(eve, file, 'read')).toBeFalse();
            expect(cliEvaluateAccess(undefined, file, 'read')).toBeFalse();
        });
        it('bypass permissions and unowned resources', () => {
            const eve = { id: '3', name: 'eve', groups: [], permissions: ['files:admin'] };
            expect(cliEvaluateAccess(eve, file, 'write', ['files:admin'])).toBeTrue();
            expect(cliEvaluateAccess(undefined, { permissions: 'rw-------' }, 'read')).toBeTrue();
        });
    });
});
