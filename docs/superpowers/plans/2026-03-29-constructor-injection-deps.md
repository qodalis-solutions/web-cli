# Constructor Injection via `deps` Array — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `deps` array support to `useClass` and `useFactory` providers so the DI container resolves constructor/factory dependencies automatically.

**Architecture:** Extend `CliTypeProvider` and `CliFactoryProvider` types with an optional `deps` array of DI tokens. The container's `resolveProvider` method resolves each token via `this.get()` and passes the results as positional arguments.

**Tech Stack:** TypeScript, Jasmine (Karma)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/core/src/lib/models/services.ts` | Modify | Add `deps?: any[]` to provider types |
| `packages/cli/src/lib/services/cli-service-container.ts` | Modify | Resolve `deps` in `resolveProvider` |
| `packages/cli/src/tests/service-container.spec.ts` | Modify | Add test cases for `deps` |

---

### Task 1: Add `deps` tests for `useClass`

**Files:**
- Modify: `packages/cli/src/tests/service-container.spec.ts:74-95`

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block after the existing `useClass provider` block (after line 95) in `packages/cli/src/tests/service-container.spec.ts`:

```typescript
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

            const app = container.get<AppService>('app');
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

            const instance = container.get<MultiDep>('multi');
            expect(instance.a).toBe('hello');
            expect(instance.b).toBe(42);
        });

        it('should work without deps (backward compatible)', () => {
            class Simple {
                value = 'ok';
            }
            container.set({ provide: 'simple', useClass: Simple });
            expect(container.get<Simple>('simple').value).toBe('ok');
        });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test cli --no-watch 2>&1 | tail -20`

Expected: Two failures — `AppService` and `MultiDep` constructors receive `undefined` args because `resolveProvider` ignores `deps`. The backward-compatible test should pass.

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/cli/src/tests/service-container.spec.ts
git commit -m "test: add failing tests for useClass deps resolution"
```

---

### Task 2: Add `deps` tests for `useFactory`

**Files:**
- Modify: `packages/cli/src/tests/service-container.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add after the `useFactory provider` block (after line 69) in `packages/cli/src/tests/service-container.spec.ts`:

```typescript
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

            const client = container.get<{ endpoint: string }>('client');
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

            expect(container.get('url')).toBe('localhost:3000');
        });

        it('should throw when a dep token is not registered', () => {
            container.set({
                provide: 'broken',
                useFactory: (x: any) => x,
                deps: ['nonexistent'],
            });

            expect(() => container.get('broken')).toThrowError(
                /No provider found for token "nonexistent"/,
            );
        });
    });
```

Note: the "throw" test works because `useFactory` is lazily resolved — the factory is invoked on first `get()`, at which point `deps` resolution triggers `this.get('nonexistent')` which throws.

Wait — actually, looking at the current code, `resolveProvider` is called eagerly inside `registerProvider` (line 156). So the throw happens at `set()` time, not `get()` time. Update the test:

```typescript
        it('should throw when a dep token is not registered', () => {
            expect(() =>
                container.set({
                    provide: 'broken',
                    useFactory: (x: any) => x,
                    deps: ['nonexistent'],
                }),
            ).toThrowError(/No provider found for token "nonexistent"/);
        });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx test cli --no-watch 2>&1 | tail -20`

Expected: Factory tests fail — factories currently receive zero arguments.

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/cli/src/tests/service-container.spec.ts
git commit -m "test: add failing tests for useFactory deps resolution"
```

---

### Task 3: Add `deps` to provider types

**Files:**
- Modify: `packages/core/src/lib/models/services.ts`

- [ ] **Step 1: Add `deps` field to `CliTypeProvider`**

In `packages/core/src/lib/models/services.ts`, change:

```typescript
export type CliTypeProvider = MultiServices & {
    useClass: any;
};
```

To:

```typescript
export type CliTypeProvider = MultiServices & {
    useClass: any;
    /** DI tokens resolved from the container and passed as constructor arguments. */
    deps?: any[];
};
```

- [ ] **Step 2: Add `deps` field to `CliFactoryProvider`**

In the same file, change:

```typescript
export type CliFactoryProvider = MultiServices & {
    useFactory: Function;
};
```

To:

```typescript
export type CliFactoryProvider = MultiServices & {
    useFactory: Function;
    /** DI tokens resolved from the container and passed as factory arguments. */
    deps?: any[];
};
```

- [ ] **Step 3: Commit type changes**

```bash
git add packages/core/src/lib/models/services.ts
git commit -m "feat: add deps field to CliTypeProvider and CliFactoryProvider"
```

---

### Task 4: Implement `deps` resolution in the container

**Files:**
- Modify: `packages/cli/src/lib/services/cli-service-container.ts:170-186`

- [ ] **Step 1: Update `resolveProvider` to resolve deps**

In `packages/cli/src/lib/services/cli-service-container.ts`, change the `resolveProvider` method from:

```typescript
    private resolveProvider(provider: CliProvider): any {
        if ('useValue' in provider) {
            return provider.useValue;
        }

        if ('useFactory' in provider) {
            return provider.useFactory();
        }

        if ('useClass' in provider) {
            return new provider.useClass();
        }

        throw new Error(
            'CliServiceContainer: Provider must specify useValue, useFactory, or useClass.',
        );
    }
```

To:

```typescript
    private resolveProvider(provider: CliProvider): any {
        if ('useValue' in provider) {
            return provider.useValue;
        }

        const deps = (provider.deps ?? []).map((dep: any) => this.get(dep));

        if ('useFactory' in provider) {
            return provider.useFactory(...deps);
        }

        if ('useClass' in provider) {
            return new provider.useClass(...deps);
        }

        throw new Error(
            'CliServiceContainer: Provider must specify useValue, useFactory, or useClass.',
        );
    }
```

- [ ] **Step 2: Run all tests**

Run: `npx nx test cli --no-watch 2>&1 | tail -20`

Expected: All tests pass — both existing (no `deps`) and new (`deps`) tests.

- [ ] **Step 3: Build to verify no type errors**

Run: `pnpm run build 2>&1 | tail -10`

Expected: All 54 projects build successfully.

- [ ] **Step 4: Commit implementation**

```bash
git add packages/cli/src/lib/services/cli-service-container.ts
git commit -m "feat: resolve deps array in useClass and useFactory providers"
```

---

### Task 5: Kill lingering test processes

- [ ] **Step 1: Clean up any leftover Karma/Chrome processes**

```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null; echo "cleanup done"
```
