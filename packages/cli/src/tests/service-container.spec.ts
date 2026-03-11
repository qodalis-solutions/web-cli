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
            expect(container.get<string>('greeting')).toBe('hello');
        });

        it('should handle numeric values', () => {
            container.set({ provide: 'port', useValue: 8080 });
            expect(container.get<number>('port')).toBe(8080);
        });

        it('should handle boolean values', () => {
            container.set({ provide: 'debug', useValue: false });
            expect(container.get<boolean>('debug')).toBe(false);
        });

        it('should handle object values', () => {
            const config = { host: 'localhost', port: 3000 };
            container.set({ provide: 'config', useValue: config });
            expect(container.get('config')).toBe(config);
        });

        it('should overwrite existing value', () => {
            container.set({ provide: 'val', useValue: 'first' });
            container.set({ provide: 'val', useValue: 'second' });
            expect(container.get('val')).toBe('second');
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
            const result = container.get<{ id: number }>('service');
            expect(result.id).toBe(42);
            expect(callCount).toBe(1);
        });

        it('should return the same instance on subsequent gets', () => {
            container.set({
                provide: 'singleton',
                useFactory: () => ({ created: Date.now() }),
            });
            const a = container.get('singleton');
            const b = container.get('singleton');
            expect(a).toBe(b);
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
            expect(container.get<MyService>('myService').value).toBe(
                'constructed',
            );
        });

        it('should return the same instance on subsequent gets', () => {
            class Counter {
                count = 0;
            }
            container.set({ provide: 'counter', useClass: Counter });
            const a = container.get<Counter>('counter');
            a.count = 5;
            const b = container.get<Counter>('counter');
            expect(b.count).toBe(5);
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
            const result = container.get<string[]>('plugins');
            expect(result).toEqual(['pluginA', 'pluginB']);
        });

        it('should keep multi separate from single providers', () => {
            container.set({ provide: 'tok', useValue: 'single' });
            container.set({ provide: 'tok-multi', useValue: 'a', multi: true });
            container.set({ provide: 'tok-multi', useValue: 'b', multi: true });

            expect(container.get('tok')).toBe('single');
            expect(container.get<string[]>('tok-multi')).toEqual(['a', 'b']);
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
            expect(container.get('a')).toBe(1);
            expect(container.get('b')).toBe(2);
        });
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------
    describe('error handling', () => {
        it('should throw for unknown token', () => {
            expect(() => container.get('unknown')).toThrowError(
                /No provider found for token "unknown"/,
            );
        });

        it('should include class name for function tokens', () => {
            class MyToken {}
            expect(() => container.get(MyToken)).toThrowError(/MyToken/);
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
