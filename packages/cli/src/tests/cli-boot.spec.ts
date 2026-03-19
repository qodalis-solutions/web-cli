import { ICliModule, ICliCommandProcessor } from '@qodalis/cli-core';
import { CliBoot } from '../lib/services/cli-boot';

// ---------------------------------------------------------------------------
// Minimal mocks — only the parts topologicalSort and bootModule need
// ---------------------------------------------------------------------------

function createMockWriter(): { written: string[] } & Record<string, any> {
    const written: string[] = [];
    return {
        written,
        write: (t: string) => written.push(t),
        writeln: (t?: string) => written.push(t ?? ''),
        writeWarning: (t: string) => written.push(`[warn] ${t}`),
        writeError: (t: string) => written.push(`[error] ${t}`),
        writeSuccess: () => {},
        writeInfo: () => {},
        wrapInColor: (t: string) => t,
    };
}

function createMockStateStore(): any {
    const state: Record<string, any> = {};
    return {
        getState: () => state,
        updateState: (partial: any) => Object.assign(state, partial),
        select: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
        reset: () => {},
        persist: async () => {},
        initialize: async () => {},
    };
}

function createMockContext(writer: ReturnType<typeof createMockWriter>): any {
    const kvStore = {
        get: async () => undefined,
        set: async () => {},
        remove: async () => {},
        clear: async () => {},
    };
    const stateStoreManager = {
        getProcessorStateStore: () => createMockStateStore(),
        getStateStore: () => createMockStateStore(),
        getStoreEntries: () => [],
    };

    const serviceMap: Record<string, any> = {
        'cli-key-value-store': kvStore,
        'cli-state-store-manager': stateStoreManager,
    };

    return {
        writer,
        logger: {
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {},
        },
        spinner: { show: () => {}, hide: () => {} },
        translator: {
            addTranslations: () => {},
        },
        services: {
            get: (token: string) => serviceMap[token] ?? kvStore,
            set: () => {},
        },
        process: { exit: () => {} },
        onAbort: { subscribe: () => ({ unsubscribe: () => {} }) },
        terminal: {},
        reader: {},
        executor: {},
        clipboard: {},
        options: undefined,
        promptLength: 0,
        currentLine: '',
        cursorPosition: 0,
        setContextProcessor: () => {},
        showPrompt: () => {},
        setCurrentLine: () => {},
        clearLine: () => {},
        clearCurrentLine: () => {},
        refreshCurrentLine: () => {},
        enterFullScreenMode: () => {},
        exitFullScreenMode: () => {},
        createInterval: () => ({ clear: () => {} }),
        createTimeout: () => ({ clear: () => {} }),
        backgroundServices: {},
    };
}

function createModule(
    name: string,
    dependencies?: string[],
    apiVersion = 2,
): ICliModule {
    return {
        name,
        apiVersion,
        version: '1.0.0',
        description: `Module ${name}`,
        dependencies,
        processors: [],
    };
}

function createMockRegistry(): any {
    const processors: ICliCommandProcessor[] = [];
    return {
        processors,
        registerProcessor: (p: ICliCommandProcessor) => processors.push(p),
        unregisterProcessor: () => {},
        findProcessor: () => undefined,
        getRootProcessor: (p: ICliCommandProcessor) => p,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CliBoot', () => {
    let boot: CliBoot;
    let registry: ReturnType<typeof createMockRegistry>;
    let services: any;

    beforeEach(() => {
        registry = createMockRegistry();
        services = {
            get: () => ({
                get: async () => undefined,
                set: async () => {},
            }),
            set: () => {},
        };
        boot = new CliBoot(registry, services);
    });

    describe('topologicalSort (via private access)', () => {
        let writer: ReturnType<typeof createMockWriter>;
        let context: any;

        beforeEach(() => {
            writer = createMockWriter();
            context = createMockContext(writer);
        });

        function sort(modules: ICliModule[]): ICliModule[] {
            return (boot as any).topologicalSort(modules, context);
        }

        it('should return modules with no dependencies in order', () => {
            const a = createModule('a');
            const b = createModule('b');
            const c = createModule('c');

            const result = sort([a, b, c]);
            expect(result.map((m: ICliModule) => m.name)).toEqual([
                'a',
                'b',
                'c',
            ]);
        });

        it('should sort a simple dependency chain', () => {
            const a = createModule('a');
            const b = createModule('b', ['a']);
            const c = createModule('c', ['b']);

            // Even if provided out of order, deps should come first
            const result = sort([c, b, a]);
            const names = result.map((m: ICliModule) => m.name);

            expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
            expect(names.indexOf('b')).toBeLessThan(names.indexOf('c'));
        });

        it('should handle diamond dependencies', () => {
            const a = createModule('a');
            const b = createModule('b', ['a']);
            const c = createModule('c', ['a']);
            const d = createModule('d', ['b', 'c']);

            const result = sort([d, c, b, a]);
            const names = result.map((m: ICliModule) => m.name);

            expect(names.indexOf('a')).toBeLessThan(names.indexOf('b'));
            expect(names.indexOf('a')).toBeLessThan(names.indexOf('c'));
            expect(names.indexOf('b')).toBeLessThan(names.indexOf('d'));
            expect(names.indexOf('c')).toBeLessThan(names.indexOf('d'));
        });

        it('should detect circular dependencies', () => {
            const a = createModule('a', ['b']);
            const b = createModule('b', ['a']);

            sort([a, b]);

            const errorMessages = writer.written.filter((m: string) =>
                m.includes('Circular dependency'),
            );
            expect(errorMessages.length).toBeGreaterThan(0);
        });

        it('should detect circular dependency in a longer cycle', () => {
            const a = createModule('a', ['c']);
            const b = createModule('b', ['a']);
            const c = createModule('c', ['b']);

            sort([a, b, c]);

            const errorMessages = writer.written.filter((m: string) =>
                m.includes('Circular dependency'),
            );
            expect(errorMessages.length).toBeGreaterThan(0);
        });

        it('should skip module with missing dependency', () => {
            const a = createModule('a', ['nonexistent']);

            const result = sort([a]);

            expect(result.length).toBe(0);
            const warnMessages = writer.written.filter((m: string) =>
                m.includes('not loaded'),
            );
            expect(warnMessages.length).toBeGreaterThan(0);
        });

        it('should not skip module whose dependency is already booted', () => {
            // Simulate that "core" is already booted
            (boot as any).bootedModules.add('core');

            const a = createModule('a', ['core']);
            const result = sort([a]);

            expect(result.map((m: ICliModule) => m.name)).toEqual(['a']);
        });

        it('should handle empty module list', () => {
            const result = sort([]);
            expect(result).toEqual([]);
        });

        it('should handle single module with no deps', () => {
            const a = createModule('a');
            const result = sort([a]);
            expect(result.map((m: ICliModule) => m.name)).toEqual(['a']);
        });

        it('should handle multiple independent modules', () => {
            const a = createModule('a');
            const b = createModule('b');
            const c = createModule('c');

            const result = sort([a, b, c]);
            expect(result.length).toBe(3);
        });

        it('should skip dependent module when its dep is missing but include independent ones', () => {
            const a = createModule('a');
            const b = createModule('b', ['nonexistent']);
            const c = createModule('c');

            const result = sort([a, b, c]);
            const names = result.map((m: ICliModule) => m.name);

            expect(names).toContain('a');
            expect(names).not.toContain('b');
            expect(names).toContain('c');
        });

        it('should handle self-dependency as circular', () => {
            const a = createModule('a', ['a']);

            sort([a]);

            const errorMessages = writer.written.filter((m: string) =>
                m.includes('Circular dependency'),
            );
            expect(errorMessages.length).toBeGreaterThan(0);
        });
    });

    describe('initializeProcessorsInternal (double-init prevention)', () => {
        let writer: ReturnType<typeof createMockWriter>;
        let context: any;

        beforeEach(() => {
            writer = createMockWriter();
            context = createMockContext(writer);
        });

        it('should not initialize a processor twice', async () => {
            let initCount = 0;
            const processor: any = {
                command: 'test',
                description: 'test processor',
                initialize: async () => {
                    initCount++;
                },
                processors: [],
            };

            await (boot as any).initializeProcessorsInternal(
                context,
                [processor],
            );
            await (boot as any).initializeProcessorsInternal(
                context,
                [processor],
            );

            expect(initCount).toBe(1);
        });

        it('should initialize child processors', async () => {
            const initialized: string[] = [];
            const child: any = {
                command: 'child',
                description: 'child processor',
                initialize: async () => {
                    initialized.push('child');
                },
                processors: [],
            };
            const parent: any = {
                command: 'parent',
                description: 'parent processor',
                initialize: async () => {
                    initialized.push('parent');
                },
                processors: [child],
            };

            await (boot as any).initializeProcessorsInternal(
                context,
                [parent],
            );

            expect(initialized).toEqual(['parent', 'child']);
        });

        it('should set parent reference on child processors', async () => {
            const child: any = {
                command: 'child',
                description: 'child processor',
                processors: [],
            };
            const parent: any = {
                command: 'parent',
                description: 'parent processor',
                processors: [child],
            };

            await (boot as any).initializeProcessorsInternal(
                context,
                [parent],
            );

            expect(child.parent).toBe(parent);
        });

        it('should handle processor initialization errors gracefully', async () => {
            const logged: any[] = [];
            context.logger.error = (...args: any[]) => logged.push(args);

            const badProcessor: any = {
                command: 'bad',
                description: 'bad processor',
                initialize: async () => {
                    throw new Error('init failed');
                },
                processors: [],
            };

            // Should not throw
            await (boot as any).initializeProcessorsInternal(
                context,
                [badProcessor],
            );

            expect(logged.length).toBeGreaterThan(0);
            expect(logged[0][0]).toContain('Error initializing processor');
        });
    });

    describe('bootModule', () => {
        let writer: ReturnType<typeof createMockWriter>;
        let context: any;

        beforeEach(() => {
            writer = createMockWriter();
            context = createMockContext(writer);
        });

        it('should not boot the same module twice', async () => {
            let bootCount = 0;
            const module: ICliModule = {
                name: 'test-module',
                apiVersion: 2,
                version: '1.0.0',
                description: 'test',
                onInit: async () => {
                    bootCount++;
                },
                processors: [],
            };

            await (boot as any).bootModule(module, context);
            await (boot as any).bootModule(module, context);

            expect(bootCount).toBe(1);
        });

        it('should skip module with unsatisfied dependency', async () => {
            const module: ICliModule = {
                name: 'dependent',
                apiVersion: 2,
                version: '1.0.0',
                description: 'test',
                dependencies: ['missing-dep'],
                processors: [],
            };

            await (boot as any).bootModule(module, context);

            // Module should not be booted
            expect((boot as any).bootedModules.has('dependent')).toBe(false);
            const warnings = writer.written.filter((m: string) =>
                m.includes('requires'),
            );
            expect(warnings.length).toBeGreaterThan(0);
        });

        it('should register module translations', async () => {
            const addedTranslations: any[] = [];
            context.translator.addTranslations = (
                locale: string,
                translations: any,
            ) => {
                addedTranslations.push({ locale, translations });
            };

            const module: ICliModule = {
                name: 'i18n-module',
                apiVersion: 2,
                version: '1.0.0',
                description: 'test',
                translations: {
                    en: { greeting: 'Hello' },
                    es: { greeting: 'Hola' },
                },
                processors: [],
            };

            await (boot as any).bootModule(module, context);

            expect(addedTranslations.length).toBe(2);
            expect(addedTranslations[0].locale).toBe('en');
            expect(addedTranslations[1].locale).toBe('es');
        });

        it('should catch and log onInit errors', async () => {
            const logged: any[] = [];
            context.logger.error = (...args: any[]) => logged.push(args);

            const module: ICliModule = {
                name: 'bad-init',
                apiVersion: 2,
                version: '1.0.0',
                description: 'test',
                onInit: async () => {
                    throw new Error('onInit exploded');
                },
                processors: [],
            };

            await (boot as any).bootModule(module, context);

            expect(logged.length).toBeGreaterThan(0);
            expect(logged[0][0]).toContain('Error in onInit');
        });

        it('should register services from module', async () => {
            const registeredServices: any[] = [];
            // bootModule calls this.services.set() where this.services is
            // the constructor-injected service provider, not context.services
            services.set = (defs: any) => {
                registeredServices.push(defs);
            };

            const module: ICliModule = {
                name: 'service-module',
                apiVersion: 2,
                version: '1.0.0',
                description: 'test',
                services: [{ provide: 'my-service', useValue: 42 }],
                processors: [],
            };

            await (boot as any).bootModule(module, context);

            expect(registeredServices.length).toBe(1);
        });
    });

    describe('getModuleRegistry', () => {
        it('should return a CliModuleRegistry instance', () => {
            const moduleReg = boot.getModuleRegistry();
            expect(moduleReg).toBeDefined();
        });
    });
});
