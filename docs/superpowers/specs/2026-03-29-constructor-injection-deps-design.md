# Constructor Injection via `deps` Array

**Date:** 2026-03-29
**Status:** Approved

## Problem

`CliServiceContainer` supports `useClass` and `useFactory` providers but cannot resolve constructor/factory dependencies automatically. Classes are instantiated with zero arguments (`new provider.useClass()`), forcing all DI to be done manually:

```typescript
// Manual wiring required today
const authService = new CliServerAuthService(services);
services.set({ provide: ICliServerAuthService_TOKEN, useValue: authService });
```

## Solution

Add a `deps` array to `CliTypeProvider` and `CliFactoryProvider`. The container resolves each token from the array and passes them as positional arguments.

### Type Changes

**File:** `packages/core/src/lib/models/services.ts`

```typescript
export type CliTypeProvider = MultiServices & {
    useClass: any;
    deps?: any[];
};

export type CliFactoryProvider = MultiServices & {
    useFactory: Function;
    deps?: any[];
};
```

### Container Changes

**File:** `packages/cli/src/lib/services/cli-service-container.ts`

In `resolveProvider`, resolve `deps` before instantiation:

```typescript
if ('useClass' in provider) {
    const args = (provider.deps ?? []).map(dep => this.get(dep));
    return new provider.useClass(...args);
}

if ('useFactory' in provider) {
    const args = (provider.deps ?? []).map(dep => this.get(dep));
    return provider.useFactory(...args);
}
```

### Usage

```typescript
// After: container resolves deps automatically
services.set({
    provide: ICliServerAuthService_TOKEN,
    useClass: CliServerAuthService,
    deps: [ICliServiceProvider_TOKEN],
});
```

## Error Handling

No new error handling needed. If a `deps` token is not registered, the existing `get()` method throws `No provider found for token "X"`, which is clear and sufficient.

## Backward Compatibility

Fully backward compatible. `deps` is optional and defaults to `[]`. Existing providers with no `deps` continue to work identically.

## Test Plan

**File:** `packages/cli/src/tests/service-container.spec.ts`

New test cases:

1. `useClass` with `deps` resolves constructor arguments from the container
2. `useFactory` with `deps` passes resolved arguments to the factory function
3. `deps` referencing an unregistered token throws the standard error

## Files Modified

| File | Change |
|------|--------|
| `packages/core/src/lib/models/services.ts` | Add `deps?: any[]` to `CliTypeProvider` and `CliFactoryProvider` |
| `packages/cli/src/lib/services/cli-service-container.ts` | Resolve `deps` in `resolveProvider` for `useClass` and `useFactory` |
| `packages/cli/src/tests/service-container.spec.ts` | Add test cases for `deps` resolution |
