# CLI Module Pattern Design

## Problem

`ICliUmdModule` is too thin — it only holds `name` and `processors[]`. There is no way to register services, declare dependencies between modules, or hook into module lifecycle. The UMD registration uses a messy `window.cliCore.bootUmdModule()` global bag and mocks `window.ngCore = { Injectable: () => {} }` unnecessarily.

## Solution

Replace `ICliUmdModule` with a richer `ICliModule` interface that serves as the single module abstraction across all contexts (Angular, React, Vue, UMD). Clean up the UMD global registration pattern. Make the core itself a module.

## 1. `ICliModule` Interface (in `cli-core`)

```typescript
export interface ICliModule {
    /** Unique module identifier, e.g. '@qodalis/cli-guid' */
    name: string;

    /** Semver version string */
    version?: string;

    /** Human-readable description */
    description?: string;

    /** Module names this module depends on (resolved before this module boots) */
    dependencies?: string[];

    /** Command processors provided by this module */
    processors?: ICliCommandProcessor[];

    /** Services registered into the shared service container */
    services?: CliProvider[];

    /** Called after services are registered and before processors are initialized */
    onInit?(context: ICliExecutionContext): Promise<void>;

    /** Called when the module is being torn down */
    onDestroy?(context: ICliExecutionContext): Promise<void>;
}
```

`ICliUmdModule` becomes a deprecated alias:

```typescript
/** @deprecated Use ICliModule instead */
export type ICliUmdModule = ICliModule;
```

## 2. UMD Registration Cleanup

### CliModuleRegistry

Replace `window.cliCore.bootUmdModule` with a proper registry class:

```typescript
export class CliModuleRegistry {
    private modules = new Map<string, ICliModule>();
    private bootHandlers: ((module: ICliModule) => Promise<void>)[] = [];

    onModuleBoot(handler: (module: ICliModule) => Promise<void>): void {
        this.bootHandlers.push(handler);
    }

    async register(module: ICliModule): Promise<void> {
        this.modules.set(module.name, module);
        for (const handler of this.bootHandlers) {
            await handler(module);
        }
    }

    getModule(name: string): ICliModule | undefined {
        return this.modules.get(name);
    }

    getAll(): ICliModule[] {
        return Array.from(this.modules.values());
    }
}
```

### Browser Environment

`initializeBrowserEnvironment` changes:

```typescript
export const initializeBrowserEnvironment = ({
    context,
    registry,
}: {
    context: ICliExecutionContext;
    registry: CliModuleRegistry;
}): void => {
    // Single clean global — the registry instance
    (window as any).__cliModuleRegistry = registry;

    // Expose core utilities separately (no boot logic)
    (window as any).cliCore = {
        ...constants,
        ...utils,
        ...enums,
    };

    // Safety warning for any UMD module trying to use Angular decorators
    Object.defineProperty(window, 'ngCore', {
        get() {
            console.warn(
                'CLI: Angular decorators are not supported in UMD modules. '
                + 'Use plain classes instead.'
            );
            return { Injectable: () => () => {} };
        },
    });
};
```

### Boot Functions

```typescript
export const bootCliModule = async (module: ICliModule): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).__cliModuleRegistry) {
        await (window as any).__cliModuleRegistry.register(module);
    }
};

/** @deprecated Use bootCliModule instead */
export const bootUmdModule = async (module: ICliModule): Promise<void> => {
    await bootCliModule(module);
};
```

### Core as Default Module

The core itself is a module, always registered first. Every other module implicitly depends on it:

```typescript
export const CLI_CORE_MODULE: ICliModule = {
    name: '@qodalis/cli-core',
    version: CORE_VERSION,
    description: 'Core CLI services and utilities',
    processors: [...builtinProcessors],
    services: [
        { provide: CliProcessorsRegistry_TOKEN, useValue: /* registry */ },
        { provide: CliStateStoreManager_TOKEN, useValue: /* state store manager */ },
        { provide: CliCommandHistory_TOKEN, useValue: /* command history */ },
        // other core services currently wired in CliEngine.start()
    ],
};
```

## 3. Boot Service Changes

`CliBoot` becomes module-aware with dependency resolution:

```typescript
export class CliBoot {
    private initialized = false;
    private initializing = false;
    private moduleRegistry: CliModuleRegistry;
    private bootedModules = new Set<string>();

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly services: ICliServiceProvider,
    ) {
        this.moduleRegistry = new CliModuleRegistry();
    }

    async boot(context: CliExecutionContext, modules: ICliModule[]): Promise<void> {
        context.spinner?.show(CliIcon.Rocket + '  Booting...');

        if (this.initialized || this.initializing) {
            await this.bootShared(context);
            context.spinner?.hide();
            return;
        }

        this.initializing = true;

        // 1. Set up browser environment for dynamic UMD loading
        initializeBrowserEnvironment({ context, registry: this.moduleRegistry });

        // 2. Wire handler so dynamically loaded UMD modules go through the same pipeline
        this.moduleRegistry.onModuleBoot(async (module) => {
            await this.bootModule(module, context);
        });

        // 3. Boot core module first (implicit dependency)
        await this.bootModule(this.buildCoreModule(context), context);

        // 4. Topologically sort remaining modules by dependencies
        const sorted = this.topologicalSort(modules);

        // 5. Boot each module in order
        for (const module of sorted) {
            await this.bootModule(module, context);
        }

        await this.bootShared(context);
        context.spinner?.hide();
        this.initialized = true;
    }

    private async bootModule(module: ICliModule, context: CliExecutionContext): Promise<void> {
        if (this.bootedModules.has(module.name)) return;

        // Check dependencies
        for (const dep of module.dependencies ?? []) {
            if (!this.bootedModules.has(dep)) {
                context.writer.writeWarning(
                    `Module "${module.name}" requires "${dep}" which is not loaded. Skipping.`
                );
                return;
            }
        }

        // Register services
        if (module.services?.length) {
            this.services.set(module.services);
        }

        // Module lifecycle: onInit
        if (module.onInit) {
            await module.onInit(context);
        }

        // Register and initialize processors
        if (module.processors?.length) {
            const filtered = this.filterByVersion(module.processors, context);
            for (const processor of filtered) {
                this.registry.registerProcessor(processor);
            }
            await this.initializeProcessorsInternal(context, filtered);
        }

        this.bootedModules.add(module.name);
    }

    private topologicalSort(modules: ICliModule[]): ICliModule[] {
        // Standard topological sort using dependencies[]
        // Modules with no/only-core dependencies come first
        // Circular dependencies logged as warnings, modules skipped
    }
}
```

Boot order per module:
1. Check dependencies are satisfied
2. Register services into shared container
3. Call `onInit` lifecycle hook
4. Register and initialize processors

## 4. CliEngine API Changes

```typescript
export class CliEngine {
    private registry: CliCommandProcessorRegistry;
    private userModules: ICliModule[] = [];
    private pendingServices: CliProvider[] = [];
    private bootService: CliBoot;

    constructor(
        private readonly container: HTMLElement,
        private readonly options?: CliEngineOptions,
    ) {
        // builtinProcessors move into the core module
        this.registry = new CliCommandProcessorRegistry();
    }

    /** Register a CLI module to be loaded on start(). */
    registerModule(module: ICliModule): void {
        this.userModules.push(module);
    }

    /** Register multiple CLI modules to be loaded on start(). */
    registerModules(modules: ICliModule[]): void {
        this.userModules.push(...modules);
    }

    /**
     * @deprecated Use registerModule() instead.
     */
    registerProcessor(processor: ICliCommandProcessor): void {
        this.userModules.push({
            name: `__inline_${processor.command}`,
            processors: [processor],
        });
    }

    /**
     * @deprecated Use registerModule() instead.
     */
    registerProcessors(processors: ICliCommandProcessor[]): void {
        this.userModules.push({
            name: '__inline_processors',
            processors,
        });
    }

    /**
     * @deprecated Use registerModule() with services instead.
     */
    registerService(token: string, value: any): void {
        this.pendingServices.push({ provide: token, useValue: value });
    }

    async start(): Promise<void> {
        await this.waitForLayout();
        this.initializeTerminal();

        const store = new CliKeyValueStore();
        await store.initialize();

        const services = new CliServiceContainer();
        const logger = new CliLogger();

        if (this.pendingServices.length > 0) {
            services.set(this.pendingServices);
        }

        this.bootService = new CliBoot(this.registry, services);

        const executor = new CliCommandExecutor(this.registry);
        const terminalOptions = this.getTerminalOptions();

        this.executionContext = new CliExecutionContext(
            { services, logger },
            this.terminal,
            executor,
            { ...(this.options ?? {}), terminalOptions },
        );

        this.executionContext.initializeTerminalListeners();

        await this.bootService.boot(this.executionContext, this.userModules);

        const welcomeMessage = new CliWelcomeMessage();
        welcomeMessage.displayWelcomeMessage(this.executionContext);
    }
}
```

## 5. Angular Integration

New utility and token in `@qodalis/angular-cli`:

```typescript
export const CliModule_TOKEN = new InjectionToken<ICliModule[]>('cli-modules');

export const resolveCliModuleProvider = (module: ICliModule): Provider[] => {
    const providers: Provider[] = [
        {
            provide: CliModule_TOKEN,
            useValue: module,
            multi: true,
        },
    ];

    // Backward compat: also register processors individually
    if (module.processors) {
        for (const processor of module.processors) {
            providers.push({
                provide: CliCommandProcessor_TOKEN,
                useValue: processor,
                multi: true,
            });
        }
    }

    return providers;
};
```

`resolveCommandProcessorProvider` stays but is deprecated.

Plugin NgModules change from:

```typescript
@NgModule({
    providers: [resolveCommandProcessorProvider(CliGuidCommandProcessor)],
})
export class CliGuidModule {}
```

To:

```typescript
@NgModule({
    providers: [
        ...resolveCliModuleProvider({
            name: '@qodalis/cli-guid',
            version: LIBRARY_VERSION,
            processors: [new CliGuidCommandProcessor()],
        }),
    ],
})
export class CliGuidModule {}
```

`CliComponent` injects both `CliCommandProcessor_TOKEN` and `CliModule_TOKEN`, passing modules to the boot service.

## 6. React & Vue Integration

Both use `CliEngine` directly. Thin integration layers provide idiomatic APIs.

### React (`@qodalis/cli-react`)

```typescript
export function useCli(modules?: ICliModule[], options?: CliEngineOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<CliEngine | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const engine = new CliEngine(containerRef.current, options);

        if (modules?.length) {
            engine.registerModules(modules);
        }

        engine.start();
        engineRef.current = engine;

        return () => engine.destroy();
    }, []);

    return { containerRef, engine: engineRef };
}
```

Usage:

```tsx
const { containerRef } = useCli(
    [guidModule, todoModule],
    { welcomeMessage: 'Hello!' },
);
return <div ref={containerRef} style={{ height: '100%' }} />;
```

### Vue (`@qodalis/cli-vue`)

```typescript
export function useCli(
    containerRef: Ref<HTMLElement | null>,
    modules?: ICliModule[],
    options?: CliEngineOptions,
) {
    const engine = ref<CliEngine | null>(null);

    onMounted(() => {
        if (!containerRef.value) return;

        const e = new CliEngine(containerRef.value, options);

        if (modules?.length) {
            e.registerModules(modules);
        }

        e.start();
        engine.value = e;
    });

    onUnmounted(() => {
        engine.value?.destroy();
    });

    return { engine };
}
```

Usage:

```vue
<script setup>
const containerRef = ref(null);
const { engine } = useCli(containerRef, [guidModule], { welcomeMessage: 'Hello!' });
</script>

<template>
    <div ref="containerRef" style="height: 100%" />
</template>
```

Modules and options are separate arguments — modules define what commands are available, options define how the terminal behaves.

## 7. Plugin Exports

Each plugin exports a pre-built module object alongside its classes:

```typescript
// @qodalis/cli-guid public API
export { CliGuidCommandProcessor } from './processors/...';
export { GuidService } from './services/...';

// Pre-built module for framework-agnostic usage
export const guidModule: ICliModule = {
    name: '@qodalis/cli-guid',
    version: LIBRARY_VERSION,
    processors: [new CliGuidCommandProcessor()],
};
```

Angular uses `resolveCliModuleProvider(guidModule)` in NgModule providers. React/Vue pass `guidModule` to `useCli`. UMD entrypoints call `bootCliModule(guidModule)`. Same object everywhere.

## 8. Migration & Backward Compatibility

### What stays working without changes

- `bootUmdModule()` — deprecated shim calls `bootCliModule()`
- `resolveCommandProcessorProvider()` — still works, deprecated
- `CliEngine.registerProcessor()` / `registerProcessors()` — wraps into anonymous modules
- `CliEngine.registerService()` — applied as pending services before boot

### Plugin migration (per plugin)

UMD entrypoint:

```diff
- import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
+ import { bootCliModule, ICliModule } from '@qodalis/cli-core';

- const module: ICliUmdModule = {
+ const module: ICliModule = {
      name: '@qodalis/cli-guid',
+     version: LIBRARY_VERSION,
      processors: [new CliGuidCommandProcessor()],
  };

- bootUmdModule(module);
+ bootCliModule(module);
```

Angular module:

```diff
- providers: [resolveCommandProcessorProvider(CliGuidCommandProcessor)],
+ providers: [
+     ...resolveCliModuleProvider({
+         name: '@qodalis/cli-guid',
+         version: LIBRARY_VERSION,
+         processors: [new CliGuidCommandProcessor()],
+     }),
+ ],
```

### Migration order

1. Ship new interfaces and utilities in `cli-core` and `cli` (fully backward compatible)
2. Update plugins one at a time (each is independent)
3. Remove deprecated shims in a future major version

### `window.ngCore` removal

No current UMD entrypoints use Angular decorators — they all use plain classes. Safe to remove. A `console.warn` via `Object.defineProperty` getter catches any future misuse.

## Package Structure

| Package | Purpose | Depends on |
|---|---|---|
| `@qodalis/cli-core` | Interfaces, `ICliModule`, `CliModuleRegistry`, `bootCliModule` | nothing |
| `@qodalis/cli` | `CliEngine`, `CliBoot`, service container, built-in processors | `cli-core` |
| `@qodalis/angular-cli` | `resolveCliModuleProvider`, `CliModule_TOKEN`, `CliComponent` | `cli-core`, `cli` |
| `@qodalis/cli-react` | `useCli` hook | `cli-core`, `cli` |
| `@qodalis/cli-vue` | `useCli` composable | `cli-core`, `cli` |
| `@qodalis/cli-*` plugins | Export `ICliModule` + classes | `cli-core` |
