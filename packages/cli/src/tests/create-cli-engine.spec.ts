import { ICliModule } from '@qodalis/cli-core';
import { CLI_FRAMEWORK_SERVICE, createCliEngine, mergeCliOptions, resolveCliHostConfig } from '../lib/engine';

describe('createCliEngine', () => {
    const module = { apiVersion: 2, name: 'm' } as ICliModule;

    it('registers framework, services and modules in order', () => {
        const engine = createCliEngine(document.createElement('div'), {
            framework: 'React',
            services: { a: 1 },
            modules: [module],
        }) as any;
        expect(engine.pendingServices).toEqual([
            { provide: CLI_FRAMEWORK_SERVICE, useValue: 'React' },
            { provide: 'a', useValue: 1 },
        ]);
        expect(engine.userModules).toEqual([module]);
    });

    it('adds the snapshot to the options without mutating them', () => {
        const options = { welcomeMessage: { show: 'never' } } as any;
        const snapshot = { version: 1 } as any;
        const engine = createCliEngine(document.createElement('div'), { options, snapshot }) as any;
        expect(engine.options).toEqual({ ...options, snapshot });
        expect(options.snapshot).toBeUndefined();
    });

    it('skips empty lists', () => {
        const engine = createCliEngine(document.createElement('div'), { modules: [] }) as any;
        expect(engine.userModules).toEqual([]);
        expect(engine.pendingServices).toEqual([]);
    });
});

describe('resolveCliHostConfig', () => {
    it('prefers local values and falls back to the inherited ones', () => {
        const inherited = { modules: [{} as ICliModule], options: { a: 1 } as any, services: { s: 1 } };
        const resolved = resolveCliHostConfig({ options: { b: 2 } as any }, inherited);
        expect(resolved.modules).toBe(inherited.modules);
        expect(resolved.options).toEqual({ b: 2 } as any);
        expect(resolved.services).toBe(inherited.services);
        expect(resolveCliHostConfig({}, null)).toEqual({ modules: undefined, options: undefined, services: undefined });
    });
});

describe('mergeCliOptions', () => {
    it('merges key by key with local winning', () => {
        expect(mergeCliOptions({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual({ a: 1, b: 2, c: 4 } as any);
        expect(mergeCliOptions(undefined, { c: 4 })).toEqual({ c: 4 } as any);
        expect(mergeCliOptions({ a: 1 }, undefined)).toEqual({ a: 1 });
    });
});
