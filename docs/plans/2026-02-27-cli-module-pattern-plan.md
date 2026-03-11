# CLI Module Pattern Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the thin `ICliUmdModule` with a richer `ICliModule` interface supporting services, lifecycle hooks, and dependencies — and clean up UMD registration across Angular, React, and Vue.

**Architecture:** The `ICliModule` interface is defined in `cli-core` and used everywhere. `CliModuleRegistry` replaces the `window.cliCore.bootUmdModule` global. `CliBoot` gains module-aware boot with topological dependency sorting. Framework wrappers (Angular, React, Vue) pass modules to `CliEngine`.

**Tech Stack:** TypeScript, Angular 16, React, Vue 3, xterm.js, Jasmine/Karma

---

### Task 1: Add `ICliModule` interface to `cli-core`

**Files:**
- Modify: `projects/core/src/lib/interfaces/index.ts:352-362`

**Step 1: Add `ICliModule` interface and deprecate `ICliUmdModule`**

Replace the existing `ICliUmdModule` interface at lines 352-362 with:

```typescript
/**
 * Represents a module for the CLI
 */
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

/**
 * @deprecated Use ICliModule instead
 */
export type ICliUmdModule = ICliModule;
```

Note: This requires importing `CliProvider` from `'../models'` at the top of the file (add to the existing import block at line 1-11).

**Step 2: Verify the build compiles**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && npm run "build core"`
Expected: Build succeeds — `ICliUmdModule` is now an alias so all existing references still compile.

**Step 3: Commit**

```bash
git add projects/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add ICliModule interface, deprecate ICliUmdModule"
```

---

### Task 2: Add `CliModuleRegistry` to `cli-core`

**Files:**
- Create: `projects/core/src/lib/modules/cli-module-registry.ts`
- Modify: `projects/core/src/lib/modules/index.ts`

**Step 1: Create `CliModuleRegistry` class**

Create `projects/core/src/lib/modules/cli-module-registry.ts`:

```typescript
import { ICliModule } from '../interfaces';

/**
 * Registry that tracks loaded CLI modules and dispatches boot handlers
 * when new modules are registered (including dynamically via UMD).
 */
export class CliModuleRegistry {
    private readonly modules = new Map<string, ICliModule>();
    private readonly bootHandlers: ((module: ICliModule) => Promise<void>)[] = [];

    /**
     * Register a handler that is called whenever a new module is registered.
     */
    onModuleBoot(handler: (module: ICliModule) => Promise<void>): void {
        this.bootHandlers.push(handler);
    }

    /**
     * Register a module and notify all boot handlers.
     */
    async register(module: ICliModule): Promise<void> {
        this.modules.set(module.name, module);
        for (const handler of this.bootHandlers) {
            await handler(module);
        }
    }

    /**
     * Get a module by name.
     */
    getModule(name: string): ICliModule | undefined {
        return this.modules.get(name);
    }

    /**
     * Get all registered modules.
     */
    getAll(): ICliModule[] {
        return Array.from(this.modules.values());
    }

    /**
     * Check if a module is registered.
     */
    has(name: string): boolean {
        return this.modules.has(name);
    }
}
```

**Step 2: Update `projects/core/src/lib/modules/index.ts` to export the registry and add `bootCliModule`**

Replace the entire file contents with:

```typescript
import { enums } from '../models';
import { constants } from '../constants';
import { ICliExecutionContext, ICliModule } from '../interfaces';
import { utils } from '../utils';
import { CliModuleRegistry } from './cli-module-registry';

export { CliModuleRegistry } from './cli-module-registry';

export const initializeBrowserEnvironment = ({
    context,
    registry,
}: {
    context: ICliExecutionContext;
    registry: CliModuleRegistry;
}): void => {
    // Expose the registry as the single clean global for UMD module loading
    (window as any).__cliModuleRegistry = registry;

    // Expose core utilities (no boot logic)
    (window as any).cliCore = {
        ...constants,
        ...utils,
        ...enums,
    };

    // Safety warning for any UMD module trying to use Angular decorators
    Object.defineProperty(window, 'ngCore', {
        configurable: true,
        get() {
            console.warn(
                'CLI: Angular decorators are not supported in UMD modules. '
                + 'Use plain classes instead.'
            );
            return { Injectable: () => () => {} };
        },
    });
};

/**
 * Boot a CLI module by registering it with the global module registry.
 * Used by UMD entrypoints to register themselves when loaded dynamically.
 */
export const bootCliModule = async (module: ICliModule): Promise<void> => {
    if (typeof window !== 'undefined' && (window as any).__cliModuleRegistry) {
        await (window as any).__cliModuleRegistry.register(module);
    }
};

/**
 * @deprecated Use bootCliModule instead
 */
export const bootUmdModule = async (module: ICliModule): Promise<void> => {
    await bootCliModule(module);
};
```

**Step 3: Verify core builds**

Run: `npm run "build core"`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add projects/core/src/lib/modules/cli-module-registry.ts projects/core/src/lib/modules/index.ts
git commit -m "feat(core): add CliModuleRegistry, bootCliModule, clean up UMD globals"
```

---

### Task 3: Rewrite `CliBoot` to be module-aware

**Files:**
- Modify: `projects/cli/src/lib/services/cli-boot.ts`

**Step 1: Rewrite `CliBoot`**

Replace the entire file with the module-aware version. Key changes:
- Constructor takes `registry` + `services` (ICliServiceProvider)
- `boot()` accepts `ICliModule[]` instead of `ICliCommandProcessor[]`
- Add `bootModule()` — registers services, calls `onInit`, then registers/inits processors
- Add `buildCoreModule()` — constructs the core module from builtinProcessors
- Add `topologicalSort()` — orders modules by `dependencies`
- Keep `filterByVersion()` and `initializeProcessorsInternal()` logic

```typescript
import {
    CliIcon,
    delay,
    ICliCommandChildProcessor,
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliModule,
    ICliServiceProvider,
    CliModuleRegistry,
    initializeBrowserEnvironment,
    LIBRARY_VERSION as CORE_VERSION,
    satisfiesMinVersion,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION } from '../version';
import { CliExecutionContext } from '../context/cli-execution-context';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { builtinProcessors } from '../processors';

export class CliBoot {
    private initialized = false;
    private initializing = false;
    private readonly moduleRegistry: CliModuleRegistry;
    private readonly bootedModules = new Set<string>();

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
        private readonly services: ICliServiceProvider,
    ) {
        this.moduleRegistry = new CliModuleRegistry();
    }

    /**
     * Get the module registry for external access.
     */
    getModuleRegistry(): CliModuleRegistry {
        return this.moduleRegistry;
    }

    public async boot(
        context: CliExecutionContext,
        modules: ICliModule[],
    ): Promise<void> {
        context.spinner?.show(CliIcon.Rocket + '  Booting...');

        if (this.initialized || this.initializing) {
            await this.bootShared(context);
            context.spinner?.hide();
            return;
        }

        this.initializing = true;

        // 1. Set up browser environment for dynamic UMD loading
        initializeBrowserEnvironment({
            context,
            registry: this.moduleRegistry,
        });

        // 2. Wire handler so dynamically loaded UMD modules go through the same pipeline
        this.moduleRegistry.onModuleBoot(async (module: ICliModule) => {
            await this.bootModule(module, context);
        });

        // 3. Boot core module first (implicit dependency for all others)
        const coreModule = this.buildCoreModule();
        await this.bootModule(coreModule, context);

        // 4. Topologically sort remaining modules by dependencies
        const sorted = this.topologicalSort(modules, context);

        // 5. Boot each module in order
        for (const module of sorted) {
            await this.bootModule(module, context);
        }

        await this.bootShared(context);

        context.spinner?.hide();

        this.initialized = true;
    }

    private async bootModule(
        module: ICliModule,
        context: CliExecutionContext,
    ): Promise<void> {
        // Skip if already booted
        if (this.bootedModules.has(module.name)) {
            return;
        }

        // Check dependencies are satisfied
        for (const dep of module.dependencies ?? []) {
            if (!this.bootedModules.has(dep)) {
                context.writer.writeWarning(
                    `Module "${module.name}" requires "${dep}" which is not loaded. Skipping.`,
                );
                return;
            }
        }

        context.logger.info(`Booting module: ${module.name}`);

        // Register services into the shared container
        if (module.services && module.services.length > 0) {
            this.services.set(module.services);
        }

        // Module lifecycle: onInit (before processors)
        if (module.onInit) {
            try {
                await module.onInit(context);
            } catch (e) {
                console.error(`Error in onInit for module "${module.name}":`, e);
            }
        }

        // Register and initialize processors
        if (module.processors && module.processors.length > 0) {
            const filtered = this.filterByVersion(module.processors, context);
            for (const processor of filtered) {
                this.registry.registerProcessor(processor);
            }
            await this.initializeProcessorsInternal(context, filtered);
        }

        this.bootedModules.add(module.name);
    }

    private buildCoreModule(): ICliModule {
        return {
            name: '@qodalis/cli-core',
            version: CORE_VERSION,
            description: 'Core CLI services and utilities',
            processors: [...builtinProcessors],
        };
    }

    /**
     * Topologically sort modules by their dependencies.
     * Modules with no dependencies (or only @qodalis/cli-core) come first.
     * Circular dependencies are logged as warnings and the involved modules are appended at the end.
     */
    private topologicalSort(
        modules: ICliModule[],
        context: CliExecutionContext,
    ): ICliModule[] {
        const moduleMap = new Map<string, ICliModule>();
        for (const m of modules) {
            moduleMap.set(m.name, m);
        }

        const sorted: ICliModule[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>(); // cycle detection

        const visit = (mod: ICliModule): void => {
            if (visited.has(mod.name)) return;

            if (visiting.has(mod.name)) {
                context.logger.warn(
                    `Circular dependency detected involving module "${mod.name}". Loading order may be incorrect.`,
                );
                return;
            }

            visiting.add(mod.name);

            for (const dep of mod.dependencies ?? []) {
                // Skip core — it's always booted first
                if (dep === '@qodalis/cli-core') continue;

                const depModule = moduleMap.get(dep);
                if (depModule) {
                    visit(depModule);
                }
            }

            visiting.delete(mod.name);
            visited.add(mod.name);
            sorted.push(mod);
        };

        for (const mod of modules) {
            visit(mod);
        }

        return sorted;
    }

    private filterByVersion(
        processors: ICliCommandProcessor[],
        context: CliExecutionContext,
    ): ICliCommandProcessor[] {
        return processors.filter((p) => {
            const meta = p.metadata;
            if (
                meta?.requiredCoreVersion &&
                !satisfiesMinVersion(CORE_VERSION, meta.requiredCoreVersion)
            ) {
                context.writer.writeWarning(
                    `Plugin "${p.command}" requires cli-core >=${meta.requiredCoreVersion} but ${CORE_VERSION} is installed. Skipping.`,
                );
                return false;
            }
            if (
                meta?.requiredCliVersion &&
                !satisfiesMinVersion(CLI_VERSION, meta.requiredCliVersion)
            ) {
                context.writer.writeWarning(
                    `Plugin "${p.command}" requires angular-cli >=${meta.requiredCliVersion} but ${CLI_VERSION} is installed. Skipping.`,
                );
                return false;
            }
            return true;
        });
    }

    private async bootShared(context: CliExecutionContext): Promise<void> {
        await this.initializeProcessorsInternal(
            context,
            this.registry.processors,
        );

        await delay(300);
    }

    private async initializeProcessorsInternal(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
        parent?: ICliCommandProcessor,
    ): Promise<void> {
        for (const p of processors) {
            try {
                (p as ICliCommandChildProcessor).parent = parent;

                if (p.initialize) {
                    const processorContext = new CliCommandExecutionContext(
                        context,
                        p,
                    );

                    await processorContext.state.initialize();

                    await p.initialize(processorContext);
                }

                if (p.processors && p.processors.length > 0) {
                    await this.initializeProcessorsInternal(
                        context,
                        p.processors,
                        p,
                    );
                }
            } catch (e) {
                console.error(`Error initializing processor "${p.command}":`, e);
            }
        }
    }
}
```

**Step 2: Verify the cli lib builds**

Run: `npm run "build core" && npm run "build cli"`
Expected: Build succeeds (will likely fail until Task 4 updates CliEngine — that's fine, proceed to Task 4).

**Step 3: Commit**

```bash
git add projects/cli/src/lib/services/cli-boot.ts
git commit -m "feat(cli): rewrite CliBoot to be module-aware with dependency resolution"
```

---

### Task 4: Update `CliEngine` to use modules

**Files:**
- Modify: `projects/cli/src/lib/engine/cli-engine.ts`

**Step 1: Update CliEngine**

Key changes to `projects/cli/src/lib/engine/cli-engine.ts`:

1. Add import for `ICliModule` from `@qodalis/cli-core`
2. Replace `userProcessors: ICliCommandProcessor[]` with `userModules: ICliModule[]`
3. Remove `[...builtinProcessors]` from `CliCommandProcessorRegistry` constructor (core module provides them now)
4. Add `registerModule()` and `registerModules()` methods
5. Deprecate `registerProcessor()`, `registerProcessors()`, `registerService()` — keep working via anonymous modules
6. Update `start()` to create `CliBoot` with `(registry, services)` and call `boot(context, userModules)`
7. Remove the manual service wiring that now moves into the boot service

The constructor changes from:
```typescript
this.registry = new CliCommandProcessorRegistry([...builtinProcessors]);
this.bootService = new CliBoot(this.registry);
```
To:
```typescript
this.registry = new CliCommandProcessorRegistry();
```

And `bootService` is created in `start()`:
```typescript
this.bootService = new CliBoot(this.registry, services);
```

The `registerProcessor` / `registerProcessors` methods wrap into anonymous modules:
```typescript
registerProcessor(processor: ICliCommandProcessor): void {
    this.userModules.push({
        name: `__inline_${processor.command}`,
        processors: [processor],
    });
}
```

The `start()` method is simplified — the core service wiring (CliStateStoreManager, CliCommandHistory, default services) should be registered as services on the core module inside `CliBoot.buildCoreModule()`, OR kept in `start()` as pending services. For this task, keep the core infra services (store, stateStoreManager, commandHistory) registered in `start()` via `services.set()` before calling `boot()` — the boot service's core module only provides processors.

**Step 2: Verify full build**

Run: `npm run "build core" && npm run "build cli"`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add projects/cli/src/lib/engine/cli-engine.ts
git commit -m "feat(cli): update CliEngine to register modules instead of raw processors"
```

---

### Task 5: Update Angular integration

**Files:**
- Modify: `projects/angular-cli/src/lib/cli/tokens/index.ts`
- Modify: `projects/angular-cli/src/lib/utils/dependency-injection.ts`
- Modify: `projects/angular-cli/src/lib/cli/cli.component.ts`
- Modify: `projects/angular-cli/src/public-api.ts`

**Step 1: Add `CliModule_TOKEN` to tokens**

In `projects/angular-cli/src/lib/cli/tokens/index.ts`, add:

```typescript
import { ICliModule } from '@qodalis/cli-core';

export const CliModule_TOKEN = new InjectionToken<ICliModule[]>('cli-modules');
```

**Step 2: Add `resolveCliModuleProvider` to dependency-injection.ts**

In `projects/angular-cli/src/lib/utils/dependency-injection.ts`, add:

```typescript
import { ICliModule } from '@qodalis/cli-core';
import { CliModule_TOKEN } from '../cli/tokens';

/**
 * Resolve an ICliModule into Angular providers.
 * Registers the module via CliModule_TOKEN and also registers processors
 * individually via CliCommandProcessor_TOKEN for backward compatibility.
 */
export const resolveCliModuleProvider = (module: ICliModule): Provider[] => {
    const providers: Provider[] = [
        {
            provide: CliModule_TOKEN,
            useValue: module,
            multi: true,
        },
    ];

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

Add `@deprecated` JSDoc to existing `resolveCommandProcessorProvider`.

**Step 3: Update `CliComponent` to inject modules**

In `projects/angular-cli/src/lib/cli/cli.component.ts`:

1. Add import for `ICliModule` and `CliModule_TOKEN`
2. Add `@Input() modules?: ICliModule[];` alongside existing `processors` input
3. Inject `CliModule_TOKEN` in constructor:
   ```typescript
   @Optional()
   @Inject(CliModule_TOKEN)
   private readonly diModules: ICliModule[],
   ```
4. In `ngAfterViewInit()`, register modules:
   ```typescript
   // Register modules provided via Angular DI
   if (this.diModules && this.diModules.length > 0) {
       this.engine.registerModules(this.diModules);
   }

   // Register modules provided via @Input
   if (this.modules && this.modules.length > 0) {
       this.engine.registerModules(this.modules);
   }
   ```
   Keep existing `diProcessors` / `processors` registration for backward compat.

**Step 4: Export new symbols from public-api.ts**

The `resolveCliModuleProvider` and `CliModule_TOKEN` are already covered by the existing wildcard exports (`export * from './lib/utils'` and `export * from './lib/cli/tokens'`). Verify this is the case.

**Step 5: Build angular-cli**

Run: `npm run "build core" && npm run "build cli" && npm run "build angular-cli"` (or equivalent — check the actual build script name for angular-cli)
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add projects/angular-cli/src/lib/cli/tokens/index.ts \
       projects/angular-cli/src/lib/utils/dependency-injection.ts \
       projects/angular-cli/src/lib/cli/cli.component.ts
git commit -m "feat(angular-cli): add resolveCliModuleProvider and CliModule_TOKEN"
```

---

### Task 6: Update React wrapper

**Files:**
- Modify: `projects/react-cli/src/useCliEngine.ts`
- Modify: `projects/react-cli/src/CliProvider.tsx`
- Modify: `projects/react-cli/src/index.tsx`

**Step 1: Update `UseCliEngineConfig` to accept modules**

In `projects/react-cli/src/useCliEngine.ts`:

1. Add `ICliModule` to imports from `@qodalis/cli-core`
2. Add `modules?: ICliModule[]` to `UseCliEngineConfig`
3. In the `useEffect`, register modules before processors:
   ```typescript
   if (config?.modules) {
       e.registerModules(config.modules);
   }
   ```
   Keep existing `config?.processors` registration for backward compat.

**Step 2: Update `CliProvider` to accept modules prop**

In `projects/react-cli/src/CliProvider.tsx`:

1. Add `ICliModule` to imports
2. Add `modules?: ICliModule[]` to `CliProviderProps`
3. Pass modules through to `useCliEngine`:
   ```typescript
   const engine = useCliEngine(containerRef, {
       modules: modules ?? config.modules,
       processors: processors ?? config.processors,
       ...
   });
   ```

**Step 3: Update exports in index.tsx**

Verify `ICliModule` is re-exported from `@qodalis/cli-core` for convenience, or note that consumers import it from `@qodalis/cli-core` directly. No changes needed if the convention is to import types from their source package.

**Step 4: Commit**

```bash
git add projects/react-cli/src/useCliEngine.ts \
       projects/react-cli/src/CliProvider.tsx
git commit -m "feat(react-cli): add modules support to useCliEngine and CliProvider"
```

---

### Task 7: Update Vue wrapper

**Files:**
- Modify: `projects/vue-cli/src/useCliEngine.ts`
- Modify: `projects/vue-cli/src/CliProvider.ts`

**Step 1: Update `UseCliEngineConfig` to accept modules**

In `projects/vue-cli/src/useCliEngine.ts`:

1. Add `ICliModule` to imports from `@qodalis/cli-core`
2. Add `modules?: ICliModule[]` to `UseCliEngineConfig`
3. In `onMounted`, register modules before processors:
   ```typescript
   if (config?.modules) {
       e.registerModules(config.modules);
   }
   ```

**Step 2: Update `CliProvider` to accept modules prop**

In `projects/vue-cli/src/CliProvider.ts`:

1. Add `ICliModule` to imports
2. Add `modules` prop:
   ```typescript
   modules: {
       type: Array as PropType<ICliModule[]>,
       default: undefined,
   },
   ```
3. Pass through to `useCliEngine`:
   ```typescript
   const engine = useCliEngine(containerRef, {
       modules: props.modules,
       processors: props.processors,
       ...
   });
   ```

**Step 3: Commit**

```bash
git add projects/vue-cli/src/useCliEngine.ts \
       projects/vue-cli/src/CliProvider.ts
git commit -m "feat(vue-cli): add modules support to useCliEngine and CliProvider"
```

---

### Task 8: Migrate all plugin UMD entrypoints

**Files (all 12 plugin entrypoints):**
- Modify: `projects/guid/src/cli-entrypoint.ts`
- Modify: `projects/todo/src/cli-entrypoint.ts`
- Modify: `projects/string/src/cli-entrypoint.ts`
- Modify: `projects/regex/src/cli-entrypoint.ts`
- Modify: `projects/speed-test/src/cli-entrypoint.ts`
- Modify: `projects/password-generator/src/cli-entrypoint.ts`
- Modify: `projects/qr/src/cli-entrypoint.ts`
- Modify: `projects/curl/src/cli-entrypoint.ts`
- Modify: `projects/browser-storage/src/cli-entrypoint.ts`
- Modify: `projects/yesno/src/cli-entrypoint.ts`
- Modify: `projects/server-logs/src/cli-entrypoint.ts`
- Modify: `projects/text-to-image/src/cli-entrypoint.ts`

**Step 1: Update each entrypoint**

For each file, apply this pattern change:

```diff
- import { bootUmdModule, ICliUmdModule } from '@qodalis/cli-core';
+ import { bootCliModule, ICliModule } from '@qodalis/cli-core';

- const module: ICliUmdModule = {
+ const module: ICliModule = {
      name: '@qodalis/cli-xxx',
      processors: [new CliXxxCommandProcessor()],
  };

- bootUmdModule(module);
+ bootCliModule(module);
```

Each plugin may have slightly different processor imports — preserve those. Only change the module type and boot function.

**Step 2: Commit**

```bash
git add projects/*/src/cli-entrypoint.ts
git commit -m "refactor(plugins): migrate all UMD entrypoints to bootCliModule/ICliModule"
```

---

### Task 9: Export pre-built module objects from each plugin

**Files (each plugin's public-api.ts or lib/index.ts):**
- Modify: Each plugin's main export file to add a `xxxModule` export

**Step 1: Add module export to each plugin**

For each plugin, add a pre-built module export alongside existing class exports. Example for guid (`projects/guid/src/public-api.ts` or equivalent):

```typescript
import { ICliModule } from '@qodalis/cli-core';
import { CliGuidCommandProcessor } from './lib/processors/cli-guid-command-processor';

export const guidModule: ICliModule = {
    name: '@qodalis/cli-guid',
    processors: [new CliGuidCommandProcessor()],
};
```

Naming convention: `{name}Module` (e.g., `guidModule`, `todoModule`, `stringModule`, `regexModule`, etc.)

This allows consumers to do:
```typescript
import { guidModule } from '@qodalis/cli-guid';
engine.registerModule(guidModule);
```

**Step 2: Commit**

```bash
git add projects/*/src/public-api.ts
git commit -m "feat(plugins): export pre-built ICliModule objects from all plugins"
```

---

### Task 10: Update scaffold templates

**Files:**
- Modify: `scripts/templates/module.txt`
- Modify: `scripts/templates/cli-entrypoint.txt`

**Step 1: Update module.txt template**

Replace contents of `scripts/templates/module.txt`:

```typescript
import { NgModule } from '@angular/core';
import { resolveCliModuleProvider } from '@qodalis/angular-cli';
import { {{name}}Module } from './modules/{{name}}-module';

@NgModule({
    declarations: [],
    imports: [],
    exports: [],
    providers: [...resolveCliModuleProvider({{name}}Module)],
})
export class Cli{{processorName}}Module {}
```

**Step 2: Update cli-entrypoint.txt template**

Replace contents of `scripts/templates/cli-entrypoint.txt`:

```typescript
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { Cli{{processorName}}CommandProcessor } from './lib/processors/cli-{{name}}-command-processor';

const module: ICliModule = {
    name: '@qodalis/cli-{{name}}',
    processors: [new Cli{{processorName}}CommandProcessor()],
};

bootCliModule(module);
```

**Step 3: Commit**

```bash
git add scripts/templates/module.txt scripts/templates/cli-entrypoint.txt
git commit -m "chore: update scaffold templates to use ICliModule and bootCliModule"
```

---

### Task 11: Update demo apps

**Files:**
- Modify: `projects/demo-angular/src/app/app.module.ts`
- Modify: `projects/demo-react/src/App.tsx`
- Modify: `projects/demo-vue/src/App.vue`

**Step 1: Update demo-angular**

If the demo app uses `resolveCommandProcessorProvider`, switch to `resolveCliModuleProvider`. If it just imports plugin NgModules, no change needed.

**Step 2: Update demo-react**

If the demo app passes `processors` to `CliProvider`, switch to passing `modules`:

```tsx
import { guidModule } from '@qodalis/cli-guid';

<CliProvider modules={[guidModule]}>
```

**Step 3: Update demo-vue**

Same pattern as React — switch from `processors` to `modules`.

**Step 4: Verify all three demos build and work**

Run each demo's build/serve command and verify the terminal loads correctly.

**Step 5: Commit**

```bash
git add projects/demo-angular/ projects/demo-react/ projects/demo-vue/
git commit -m "refactor(demos): migrate demo apps to use ICliModule"
```

---

### Task 12: Full build verification

**Step 1: Run full build**

Run: `npm run "build all"`
Expected: All libraries and demo apps build successfully.

**Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass.

**Step 3: Commit any remaining fixes**

If any build or test issues surfaced, fix and commit.
