import { CliServiceContainer } from '../lib/services/cli-service-container';

describe('CliServiceContainer', () => {
    let container: CliServiceContainer;

    beforeEach(() => {
        container = new CliServiceContainer();
    });

    // -----------------------------------------------------------------------
    // useValue
    // -----------------------------------------------------------------------
    describe('useValue provider', () => {
        it('should register and retrieve a value', () => {
            container.set({ provide: 'greeting', useValue: 'hello' });
            expect(container.getRequired<string>('greeting')).toBe('hello');
        });

        it('should handle numeric values', () => {
            container.set({ provide: 'port', useValue: 8080 });
            expect(container.getRequired<number>('port')).toBe(8080);
        });

        it('should handle boolean values', () => {
            container.set({ provide: 'debug', useValue: false });
            expect(container.getRequired<boolean>('debug')).toBe(false);
        });

        it('should handle object values', () => {
            const config = { host: 'localhost', port: 3000 };
            container.set({ provide: 'config', useValue: config });
            expect(container.getRequired('config')).toBe(config);
        });

        it('should overwrite existing value', () => {
            container.set({ provide: 'val', useValue: 'first' });
            container.set({ provide: 'val', useValue: 'second' });
            expect(container.getRequired('val')).toBe('second');
        });
    });

    // -----------------------------------------------------------------------
    // useFactory
    // -----------------------------------------------------------------------
    describe('useFactory provider', () => {
        it('should invoke factory and store the result', () => {
            let callCount = 0;
            container.set({
                provide: 'service',
                useFactory: () => {
                    callCount++;
                    return { id: 42 };
                },
            });
            const result = container.getRequired<{ id: number }>('service');
            expect(result.id).toBe(42);
            expect(callCount).toBe(1);
        });

        it('should return the same instance on subsequent gets', () => {
            container.set({
                provide: 'singleton',
                useFactory: () => ({ created: Date.now() }),
            });
            const a = container.getRequired('singleton');
            const b = container.getRequired('singleton');
            expect(a).toBe(b);
        });
    });

    // -----------------------------------------------------------------------
    // useFactory with deps
    // -----------------------------------------------------------------------
    describe('useFactory with deps', () => {
        it('should resolve deps and pass as factory arguments', () => {
            container.set({ provide: 'baseUrl', useValue: 'https://api.example.com' });
            container.set({
                provide: 'client',
                useFactory: (url: string) => ({ endpoint: url }),
                deps: ['baseUrl'],
            });

            const client = container.getRequired<{ endpoint: string }>('client');
            expect(client.endpoint).toBe('https://api.example.com');
        });

        it('should resolve multiple deps for factory', () => {
            container.set({ provide: 'host', useValue: 'localhost' });
            container.set({ provide: 'port', useValue: 3000 });
            container.set({
                provide: 'url',
                useFactory: (h: string, p: number) => `${h}:${p}`,
                deps: ['host', 'port'],
            });

            expect(container.getRequired('url')).toBe('localhost:3000');
        });

        it('should throw when a dep token is not registered', () => {
            expect(() =>
                container.set({
                    provide: 'broken',
                    useFactory: (x: any) => x,
                    deps: ['nonexistent'],
                }),
            ).toThrowError(/No provider found for token "nonexistent"/);
        });
    });

    // -----------------------------------------------------------------------
    // useClass
    // -----------------------------------------------------------------------
    describe('useClass provider', () => {
        it('should instantiate the class', () => {
            class MyService {
                value = 'constructed';
            }
            container.set({ provide: 'myService', useClass: MyService });
            expect(container.getRequired<MyService>('myService').value).toBe(
                'constructed',
            );
        });

        it('should return the same instance on subsequent gets', () => {
            class Counter {
                count = 0;
            }
            container.set({ provide: 'counter', useClass: Counter });
            const a = container.getRequired<Counter>('counter');
            a.count = 5;
            const b = container.getRequired<Counter>('counter');
            expect(b.count).toBe(5);
        });
    });

    // -----------------------------------------------------------------------
    // useClass with deps
    // -----------------------------------------------------------------------
    describe('useClass with deps', () => {
        it('should resolve deps and pass as constructor arguments', () => {
            class Logger {
                name = 'logger';
            }
            class AppService {
                constructor(public logger: Logger) {}
            }

            container.set({ provide: 'logger', useClass: Logger });
            container.set({
                provide: 'app',
                useClass: AppService,
                deps: ['logger'],
            });

            const app = container.getRequired<AppService>('app');
            expect(app.logger).toBeDefined();
            expect(app.logger.name).toBe('logger');
        });

        it('should resolve multiple deps in order', () => {
            class MultiDep {
                constructor(
                    public a: string,
                    public b: number,
                ) {}
            }

            container.set({ provide: 'valA', useValue: 'hello' });
            container.set({ provide: 'valB', useValue: 42 });
            container.set({
                provide: 'multi',
                useClass: MultiDep,
                deps: ['valA', 'valB'],
            });

            const instance = container.getRequired<MultiDep>('multi');
            expect(instance.a).toBe('hello');
            expect(instance.b).toBe(42);
        });

        it('should work without deps (backward compatible)', () => {
            class Simple {
                value = 'ok';
            }
            container.set({ provide: 'simple', useClass: Simple });
            expect(container.getRequired<Simple>('simple').value).toBe('ok');
        });
    });

    // -----------------------------------------------------------------------
    // multi providers
    // -----------------------------------------------------------------------
    describe('multi providers', () => {
        it('should accumulate values when multi is true', () => {
            container.set({
                provide: 'plugins',
                useValue: 'pluginA',
                multi: true,
            });
            container.set({
                provide: 'plugins',
                useValue: 'pluginB',
                multi: true,
            });
            const all = container.getAll<string>('plugins');
            expect(all).toEqual(['pluginA', 'pluginB']);
        });

        it('should return last registered value via get() for multi tokens', () => {
            container.set({ provide: 'hooks', useValue: 'first', multi: true });
            container.set({ provide: 'hooks', useValue: 'second', multi: true });
            expect(container.get<string>('hooks')).toBe('second');
            expect(container.getRequired<string>('hooks')).toBe('second');
        });

        it('should keep multi separate from single providers', () => {
            container.set({ provide: 'tok', useValue: 'single' });
            container.set({ provide: 'tok-multi', useValue: 'a', multi: true });
            container.set({ provide: 'tok-multi', useValue: 'b', multi: true });

            expect(container.getRequired('tok')).toBe('single');
            expect(container.getAll<string>('tok-multi')).toEqual(['a', 'b']);
            expect(container.get('tok-multi')).toBe('b');
        });
    });

    // -----------------------------------------------------------------------
    // getAll()
    // -----------------------------------------------------------------------
    describe('getAll()', () => {
        it('should return all values for multi tokens', () => {
            container.set({ provide: 'items', useValue: 1, multi: true });
            container.set({ provide: 'items', useValue: 2, multi: true });
            container.set({ provide: 'items', useValue: 3, multi: true });
            expect(container.getAll<number>('items')).toEqual([1, 2, 3]);
        });

        it('should wrap single-value token in array', () => {
            container.set({ provide: 'single', useValue: 'val' });
            expect(container.getAll<string>('single')).toEqual(['val']);
        });

        it('should return empty array for unknown token', () => {
            expect(container.getAll('nonexistent')).toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // Array registration
    // -----------------------------------------------------------------------
    describe('array registration', () => {
        it('should register multiple providers at once', () => {
            container.set([
                { provide: 'a', useValue: 1 },
                { provide: 'b', useValue: 2 },
            ]);
            expect(container.getRequired('a')).toBe(1);
            expect(container.getRequired('b')).toBe(2);
        });
    });

    // -----------------------------------------------------------------------
    // get() returns undefined
    // -----------------------------------------------------------------------
    describe('get() optional', () => {
        it('should return undefined for unknown token', () => {
            expect(container.get('unknown')).toBeUndefined();
        });

        it('should return the value when token is registered', () => {
            container.set({ provide: 'val', useValue: 42 });
            expect(container.get<number>('val')).toBe(42);
        });
    });

    // -----------------------------------------------------------------------
    // getRequired() throws
    // -----------------------------------------------------------------------
    describe('getRequired()', () => {
        it('should throw for unknown token', () => {
            expect(() => container.getRequired('unknown')).toThrowError(
                /No provider found for token "unknown"/,
            );
        });

        it('should include class name for function tokens', () => {
            class MyToken {}
            expect(() => container.getRequired(MyToken)).toThrowError(/MyToken/);
        });

        it('should return the value when token is registered', () => {
            container.set({ provide: 'x', useValue: 'hello' });
            expect(container.getRequired<string>('x')).toBe('hello');
        });
    });

    // -----------------------------------------------------------------------
    // sealed services
    // -----------------------------------------------------------------------
    describe('sealed services', () => {
        it('should prevent overwriting a sealed token', () => {
            container.set({ provide: 'core', useValue: 'original' });
            container.seal('core');

            expect(() =>
                container.set({ provide: 'core', useValue: 'override' }),
            ).toThrowError(/Cannot override sealed service "core"/);
            expect(container.getRequired('core')).toBe('original');
        });

        it('should allow registering a new token after sealing a different one', () => {
            container.set({ provide: 'sealed', useValue: 1 });
            container.seal('sealed');

            container.set({ provide: 'other', useValue: 2 });
            expect(container.getRequired('other')).toBe(2);
        });

        it('should allow multi providers on a sealed token', () => {
            container.set({ provide: 'hooks', useValue: 'a', multi: true });
            container.seal('hooks');

            // multi providers should still accumulate
            container.set({ provide: 'hooks', useValue: 'b', multi: true });
            expect(container.getAll<string>('hooks')).toEqual(['a', 'b']);
        });

        it('should seal multiple tokens at once with sealAll', () => {
            container.set({ provide: 'a', useValue: 1 });
            container.set({ provide: 'b', useValue: 2 });
            container.sealAll(['a', 'b']);

            expect(() =>
                container.set({ provide: 'a', useValue: 99 }),
            ).toThrowError(/Cannot override sealed service "a"/);
            expect(() =>
                container.set({ provide: 'b', useValue: 99 }),
            ).toThrowError(/Cannot override sealed service "b"/);
        });

        it('should report sealed status via isSealed', () => {
            container.set({ provide: 'x', useValue: 1 });
            expect(container.isSealed('x')).toBeFalse();

            container.seal('x');
            expect(container.isSealed('x')).toBeTrue();
        });

        it('should seal token via sealed flag on provider', () => {
            container.set({ provide: 'auto', useValue: 'first', sealed: true });
            expect(container.isSealed('auto')).toBeTrue();
            expect(container.getRequired('auto')).toBe('first');

            expect(() =>
                container.set({ provide: 'auto', useValue: 'second' }),
            ).toThrowError(/Cannot override sealed service "auto"/);
        });
    });

    // -----------------------------------------------------------------------
    // transient services
    // -----------------------------------------------------------------------
    describe('transient services', () => {
        it('should return a new instance on every get() for useClass', () => {
            class Ephemeral {
                id = Math.random();
            }
            container.set({ provide: 'eph', useClass: Ephemeral, transient: true });
            const a = container.getRequired<Ephemeral>('eph');
            const b = container.getRequired<Ephemeral>('eph');
            expect(a).not.toBe(b);
            expect(a.id).not.toBe(b.id);
        });

        it('should return a new value on every get() for useFactory', () => {
            let counter = 0;
            container.set({
                provide: 'counter',
                useFactory: () => ++counter,
                transient: true,
            });
            expect(container.getRequired('counter')).toBe(1);
            expect(container.getRequired('counter')).toBe(2);
            expect(container.getRequired('counter')).toBe(3);
        });

        it('should resolve deps on every get() call', () => {
            container.set({ provide: 'seed', useValue: 42 });
            class WithDep {
                constructor(public seed: number) {}
            }
            container.set({
                provide: 'svc',
                useClass: WithDep,
                deps: ['seed'],
                transient: true,
            });
            const a = container.getRequired<WithDep>('svc');
            const b = container.getRequired<WithDep>('svc');
            expect(a).not.toBe(b);
            expect(a.seed).toBe(42);
            expect(b.seed).toBe(42);
        });

        it('should report has() as true for transient tokens', () => {
            container.set({ provide: 'tr', useClass: class X {}, transient: true });
            expect(container.has('tr')).toBeTrue();
        });

        it('should show transient in getRegisteredTokens', () => {
            container.set({ provide: 'tr', useClass: class X {}, transient: true });
            const tokens = container.getRegisteredTokens();
            expect(tokens).toContain('tr (transient)');
        });

        it('should allow overwriting a transient provider', () => {
            let v = 0;
            container.set({ provide: 't', useFactory: () => ++v, transient: true });
            expect(container.getRequired('t')).toBe(1);

            container.set({ provide: 't', useValue: 'static' });
            expect(container.getRequired('t')).toBe('static');
        });
    });

    // -----------------------------------------------------------------------
    // Introspection
    // -----------------------------------------------------------------------
    describe('getRegisteredTokens', () => {
        it('should list all registered tokens', () => {
            container.set({ provide: 'a', useValue: 1 });
            container.set({ provide: 'b', useValue: 'x', multi: true });
            const tokens = container.getRegisteredTokens();
            expect(tokens).toContain('a');
            expect(tokens).toContain('b (multi)');
        });
    });

    describe('getRegisteredServiceDetails', () => {
        it('should return detail objects for each registration', () => {
            container.set({ provide: 'str', useValue: 'hello' });
            container.set({ provide: 'num', useValue: 42 });
            container.set({ provide: 'bool', useValue: true });
            container.set({ provide: 'arr', useValue: [1, 2, 3] });
            container.set({ provide: 'nil', useValue: null });

            const details = container.getRegisteredServiceDetails();
            expect(details.length).toBe(5);

            const strDetail = details.find((d) => d.token === 'str')!;
            expect(strDetail.type).toContain('string');
            expect(strDetail.multi).toBeFalse();

            const numDetail = details.find((d) => d.token === 'num')!;
            expect(numDetail.type).toContain('number');

            const boolDetail = details.find((d) => d.token === 'bool')!;
            expect(boolDetail.type).toContain('boolean');

            const arrDetail = details.find((d) => d.token === 'arr')!;
            expect(arrDetail.type).toContain('Array');

            const nilDetail = details.find((d) => d.token === 'nil')!;
            expect(nilDetail.type).toBe('null');
        });

        it('should flag multi providers', () => {
            container.set({ provide: 'multi', useValue: 'a', multi: true });
            const details = container.getRegisteredServiceDetails();
            const multiDetail = details.find((d) => d.token === 'multi')!;
            expect(multiDetail.multi).toBeTrue();
        });
    });
});
