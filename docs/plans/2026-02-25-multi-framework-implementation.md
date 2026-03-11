# Multi-Framework Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract a framework-agnostic CLI engine from `@qodalis/angular-cli` into `@qodalis/cli`, then create thin React and Vue wrappers.

**Architecture:** Move all non-Angular code (terminal writer, spinner, progress bar, state store, boot logic, history, clipboard, etc.) from `angular-cli` into `cli`. Create a `CliEngine` class as the public API. Replace Angular DI (`Injector`, `InjectionToken`, `@Injectable`) with a simple service container. Angular-cli becomes a thin wrapper. React-cli and Vue-cli are new thin wrappers.

**Tech Stack:** TypeScript, xterm.js, RxJS, Angular 16 (wrapper only), React 18 (wrapper), Vue 3 (wrapper), tsup (React/Vue builds), ng-packagr (Angular/cli builds)

---

## Phase 1: Extract Engine into @qodalis/cli

### Task 1: Create framework-agnostic CliServiceContainer

The current `CliServiceProvider` wraps Angular's `Injector`. Replace with a simple Map-based container that implements `ICliServiceProvider`.

**Files:**
- Create: `projects/cli/src/lib/services/cli-service-container.ts`
- Modify: `projects/cli/src/lib/index.ts` (add export)

**Step 1: Create the service container**

```typescript
// projects/cli/src/lib/services/cli-service-container.ts
import { CliProvider, ICliServiceProvider } from '@qodalis/cli-core';

export class CliServiceContainer implements ICliServiceProvider {
    private services = new Map<any, any>();
    private multiServices = new Map<any, any[]>();

    get<T>(token: any): T {
        if (this.services.has(token)) {
            return this.services.get(token) as T;
        }
        throw new Error(`Service not found: ${String(token)}`);
    }

    set(definition: CliProvider | CliProvider[]): void {
        const definitions = Array.isArray(definition) ? definition : [definition];

        for (const def of definitions) {
            let value: any;

            if (def.hasOwnProperty('useValue')) {
                value = def.useValue;
            } else if (def.hasOwnProperty('useFactory')) {
                value = (def as any).useFactory();
            } else if (def.hasOwnProperty('useClass')) {
                value = new (def as any).useClass();
            }

            if (def.multi) {
                if (!this.multiServices.has(def.provide)) {
                    this.multiServices.set(def.provide, []);
                }
                this.multiServices.get(def.provide)!.push(value);
                this.services.set(def.provide, this.multiServices.get(def.provide));
            } else {
                this.services.set(def.provide, value);
            }
        }
    }
}
```

**Step 2: Export from index**

Add to `projects/cli/src/lib/index.ts`:
```typescript
export * from './services';
```

Create barrel: `projects/cli/src/lib/services/index.ts`:
```typescript
export * from './cli-service-container';
```

**Step 3: Commit**

```bash
git add projects/cli/src/lib/services/
git commit -m "feat(cli): add framework-agnostic CliServiceContainer"
```

---

### Task 2: Move pure TypeScript services from angular-cli to cli

These files have ZERO Angular dependencies. Copy them as-is, adjusting imports.

**Files to create in `projects/cli/src/lib/`:**
- `services/cli-terminal-writer.ts` — from `angular-cli/.../cli-terminal-writer.ts` (no changes needed)
- `services/progress-bars/cli-terminal-spinner.ts` — from `angular-cli/...` (no changes)
- `services/progress-bars/cli-terminal-progress-bar.ts` — from `angular-cli/...` (no changes)
- `services/progress-bars/cli-terminal-text-animator.ts` — from `angular-cli/...` (no changes)
- `services/cli-clipboard.ts` — from `angular-cli/.../cli-clipboard.ts` (no changes)
- `services/cli-logger.ts` — from `angular-cli/.../cli-logger.service.ts` (no changes)
- `addons/overlay.ts` — from `angular-cli/.../addons/overlay.ts` (no changes)
- `constants/index.ts` — from `angular-cli/.../constants/index.ts` (no changes)

**Step 1: Create directory structure**

```bash
mkdir -p projects/cli/src/lib/services/progress-bars
mkdir -p projects/cli/src/lib/addons
mkdir -p projects/cli/src/lib/constants
```

**Step 2: Copy files**

Copy each file listed above. These are pure TypeScript — only imports from `@xterm/xterm` and `@qodalis/cli-core`. No modifications needed.

**Step 3: Create barrel exports**

Update `projects/cli/src/lib/services/index.ts`:
```typescript
export * from './cli-service-container';
export * from './cli-terminal-writer';
export * from './cli-clipboard';
export * from './cli-logger';
export * from './progress-bars/cli-terminal-spinner';
export * from './progress-bars/cli-terminal-progress-bar';
export * from './progress-bars/cli-terminal-text-animator';
```

Update `projects/cli/src/lib/index.ts` to add:
```typescript
export * from './addons/overlay';
export * from './constants';
```

**Step 4: Commit**

```bash
git add projects/cli/src/lib/services/ projects/cli/src/lib/addons/ projects/cli/src/lib/constants/
git commit -m "feat(cli): move pure TypeScript services from angular-cli to cli"
```

---

### Task 3: Move storage and state management to cli

These need minor refactoring to remove Angular decorators.

**Files:**
- Create: `projects/cli/src/lib/storage/cli-key-value-store.ts`
- Create: `projects/cli/src/lib/state/cli-state-store.ts`
- Create: `projects/cli/src/lib/state/cli-state-store-manager.ts`

**Step 1: CliKeyValueStore — remove @Injectable**

```typescript
// projects/cli/src/lib/storage/cli-key-value-store.ts
import { ICliKeyValueStore } from '@qodalis/cli-core';

export class CliKeyValueStore implements ICliKeyValueStore {
    // Exact same code as angular-cli version, just remove:
    // - import { Injectable } from '@angular/core';
    // - @Injectable({ providedIn: 'root' })
    // Keep all methods identical.
}
```

**Step 2: CliStateStore — no changes needed (already pure TS)**

Copy from `angular-cli/.../cli-state-store.ts` as-is. Uses RxJS + ICliServiceProvider — both framework-agnostic.

**Step 3: CliStateStoreManager — replace Angular DI with constructor params**

```typescript
// projects/cli/src/lib/state/cli-state-store-manager.ts
import {
    ICliCommandProcessor,
    ICliCommandProcessorRegistry,
    ICliServiceProvider,
    ICliStateStore,
} from '@qodalis/cli-core';
import { CliStateStore } from './cli-state-store';

export class CliStateStoreManager {
    private stores = new Map<string, ICliStateStore>();

    constructor(
        private readonly services: ICliServiceProvider,
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    public getStateStore(
        name: string,
        defaultState?: Record<string, any>,
    ): ICliStateStore {
        if (!this.stores.has(name)) {
            this.stores.set(
                name,
                new CliStateStore(this.services, name, defaultState ?? {}),
            );
        }
        return this.stores.get(name)!;
    }

    public getProcessorStateStore(
        processor: ICliCommandProcessor,
    ): ICliStateStore {
        const rootProcessor = this.registry.getRootProcessor(processor);
        return this.getStateStore(
            rootProcessor.stateConfiguration?.storeName || rootProcessor.command,
            rootProcessor.stateConfiguration?.initialState,
        );
    }
}
```

**Step 4: Create barrel exports**

`projects/cli/src/lib/storage/index.ts`:
```typescript
export * from './cli-key-value-store';
```

`projects/cli/src/lib/state/index.ts`:
```typescript
export * from './cli-state-store';
export * from './cli-state-store-manager';
```

Update `projects/cli/src/lib/index.ts` to add:
```typescript
export * from './storage';
export * from './state';
```

**Step 5: Commit**

```bash
git add projects/cli/src/lib/storage/ projects/cli/src/lib/state/
git commit -m "feat(cli): move storage and state management, remove Angular deps"
```

---

### Task 4: Move CliCommandHistoryService to cli

Remove `@Injectable` decorator and Angular DI.

**Files:**
- Create: `projects/cli/src/lib/services/cli-command-history.ts`

**Step 1: Create framework-agnostic version**

```typescript
// projects/cli/src/lib/services/cli-command-history.ts
import { ICliKeyValueStore } from '@qodalis/cli-core';

export class CliCommandHistory {
    private readonly storageKey = 'cli-command-history';
    private commandHistory: string[] = [];

    constructor(private readonly store: ICliKeyValueStore) {}

    // Keep all methods identical to angular-cli version.
    // Remove: import { Injectable } from '@angular/core';
    // Remove: @Injectable({ providedIn: 'root' })
    // Change constructor: takes ICliKeyValueStore directly instead of CliKeyValueStore via DI
}
```

**Step 2: Export**

Add to `projects/cli/src/lib/services/index.ts`:
```typescript
export * from './cli-command-history';
```

**Step 3: Commit**

```bash
git add projects/cli/src/lib/services/cli-command-history.ts
git commit -m "feat(cli): move CliCommandHistory, remove Angular DI"
```

---

### Task 5: Move CliExecutionContext to cli

This is the biggest file. Replace `Injector` usage with direct constructor params.

**Files:**
- Create: `projects/cli/src/lib/context/cli-execution-context.ts`
- Modify: `projects/cli/src/lib/context/index.ts`

**Step 1: Create framework-agnostic version**

The key change: instead of taking Angular `Injector` and looking up services, take all dependencies directly.

```typescript
// projects/cli/src/lib/context/cli-execution-context.ts
import { Terminal } from '@xterm/xterm';
import { Subject } from 'rxjs';
import {
    ICliExecutionContext, ICliTerminalWriter, ICliUserSession,
    CliOptions, ICliSpinner, ICliPercentageProgressBar,
    ICliClipboard, ICliExecutionProcess, ICliCommandProcessor,
    ICliLogger, CliLogLevel, ICliServiceProvider, ICliStateStore,
    ICliTextAnimator, clearTerminalLine, CliForegroundColor, colorFirstWord,
    ICliCommandExecutorService,
} from '@qodalis/cli-core';
import { CliTerminalWriter } from '../services/cli-terminal-writer';
import { CliTerminalSpinner } from '../services/progress-bars/cli-terminal-spinner';
import { CliTerminalProgressBar } from '../services/progress-bars/cli-terminal-progress-bar';
import { CliTerminalTextAnimator } from '../services/progress-bars/cli-terminal-text-animator';
import { CliClipboard } from '../services/cli-clipboard';
import { CliExecutionProcess } from './cli-execution-process';
import { CliCommandHistory } from '../services/cli-command-history';
import { CliStateStoreManager } from '../state/cli-state-store-manager';

export interface CliExecutionContextDeps {
    services: ICliServiceProvider;
    logger: ICliLogger;
    commandHistory: CliCommandHistory;
    stateStoreManager: CliStateStoreManager;
}

export class CliExecutionContext implements ICliExecutionContext {
    // Same fields as angular-cli version

    constructor(
        deps: CliExecutionContextDeps,
        public terminal: Terminal,
        public executor: ICliCommandExecutorService,
        cliOptions?: CliOptions,
    ) {
        this.services = deps.services;
        this.logger = deps.logger;
        this.commandHistoryService = deps.commandHistory;

        const stateStoreManager = deps.stateStoreManager;
        this.state = stateStoreManager.getStateStore('shared');

        this.options = cliOptions;
        this.writer = new CliTerminalWriter(terminal);

        const spinner = new CliTerminalSpinner(terminal);
        const progressBar = new CliTerminalProgressBar(terminal);
        const textAnimator = new CliTerminalTextAnimator(terminal);

        spinner.context = this;
        progressBar.context = this;
        textAnimator.context = this;

        this.spinner = spinner;
        this.progressBar = progressBar;
        this.textAnimator = textAnimator;

        this.clipboard = new CliClipboard(this);
        this.process = new CliExecutionProcess(this);

        this.logger.setCliLogLevel(cliOptions?.logLevel || CliLogLevel.ERROR);
    }

    // All remaining methods identical to angular-cli version
    // (initializeTerminalListeners, handleInput, showPrompt, etc.)
}
```

**Step 2: Update context barrel export**

`projects/cli/src/lib/context/index.ts`:
```typescript
export * from './cli-command-execution-context';
export * from './cli-execution-context';
export * from './cli-execution-process';
```

**Step 3: Commit**

```bash
git add projects/cli/src/lib/context/
git commit -m "feat(cli): move CliExecutionContext, replace Angular Injector with direct deps"
```

---

### Task 6: Move boot logic and welcome message to cli

**Files:**
- Create: `projects/cli/src/lib/services/cli-boot.ts`
- Create: `projects/cli/src/lib/services/cli-welcome-message.ts`

**Step 1: CliWelcomeMessage — remove @Injectable**

```typescript
// projects/cli/src/lib/services/cli-welcome-message.ts
// Same code, remove Angular decorator. Import constants from local path.
import { LIBRARY_VERSION } from '../version';
import { getCliNameArt } from '../constants';
import { CliForegroundColor, ICliExecutionContext } from '@qodalis/cli-core';

export class CliWelcomeMessage {
    // Same methods, no @Injectable
}
```

Note: `getGreetingBasedOnTime` utility needs to also be moved. Check if it exists in utils.

**Step 2: CliBoot — remove Angular DI, take deps directly**

```typescript
// projects/cli/src/lib/services/cli-boot.ts
import {
    ICliCommandProcessor, ICliCommandProcessorRegistry,
    ICliCommandChildProcessor, ICliUmdModule,
    initializeBrowserEnvironment, LIBRARY_VERSION as CORE_VERSION,
    satisfiesMinVersion, CliIcon, delay,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION as CLI_VERSION } from '../version';
import { CliExecutionContext, CliExecutionContextDeps } from '../context/cli-execution-context';
import { CliCommandExecutionContext } from '../context/cli-command-execution-context';
import { CliKeyValueStore } from '../storage/cli-key-value-store';

export class CliBoot {
    private initialized = false;
    private initializing = false;

    constructor(
        private readonly registry: ICliCommandProcessorRegistry,
    ) {}

    public async boot(
        context: CliExecutionContext,
        processors: ICliCommandProcessor[],
    ): Promise<void> {
        // Same logic but processors passed as parameter instead of @Inject
        // Remove Angular @Injectable, @Inject decorators
    }

    // Same private methods
}
```

**Step 3: Export and commit**

---

### Task 7: Create CliEngine class

The main public API that ties everything together.

**Files:**
- Create: `projects/cli/src/lib/engine/cli-engine.ts`
- Create: `projects/cli/src/lib/engine/index.ts`

**Step 1: Create CliEngine**

```typescript
// projects/cli/src/lib/engine/cli-engine.ts
import { Terminal, ITerminalOptions, ITerminalInitOnlyOptions } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import {
    CliOptions, ICliCommandProcessor, ICliCommandProcessorRegistry,
} from '@qodalis/cli-core';
import { CliCommandExecutor } from '../executor/cli-command-executor';
import { CliCommandProcessorRegistry } from '../registry/cli-command-processor-registry';
import { CliExecutionContext } from '../context/cli-execution-context';
import { CliServiceContainer } from '../services/cli-service-container';
import { CliLogger } from '../services/cli-logger';
import { CliCommandHistory } from '../services/cli-command-history';
import { CliStateStoreManager } from '../state/cli-state-store-manager';
import { CliKeyValueStore } from '../storage/cli-key-value-store';
import { CliBoot } from '../services/cli-boot';
import { CliWelcomeMessage } from '../services/cli-welcome-message';
import { OverlayAddon } from '../addons/overlay';
import { themes } from './themes'; // move default themes
import { miscProcessors } from '../processors';
import { CliStateStoreManager_TOKEN, CliProcessorsRegistry_TOKEN } from '../tokens';

export interface CliEngineOptions extends CliOptions {
    terminalOptions?: ITerminalOptions & ITerminalInitOnlyOptions;
    welcomeMessage?: CliOptions['welcomeMessage'];
}

export class CliEngine {
    private terminal!: Terminal;
    private fitAddon!: FitAddon;
    private context!: CliExecutionContext;
    private registry: ICliCommandProcessorRegistry;
    private processors: ICliCommandProcessor[] = [];
    private resizeObserver?: ResizeObserver;
    private resizeListener?: () => void;
    private wheelListener?: (e: WheelEvent) => void;
    private boot: CliBoot;

    constructor(
        private container: HTMLElement,
        private options?: CliEngineOptions,
    ) {
        this.registry = new CliCommandProcessorRegistry([...miscProcessors]);
        this.boot = new CliBoot(this.registry);
    }

    registerProcessor(processor: ICliCommandProcessor): void {
        this.processors.push(processor);
    }

    registerProcessors(processors: ICliCommandProcessor[]): void {
        this.processors.push(...processors);
    }

    async start(): Promise<void> {
        // 1. Init terminal
        this.initializeTerminal();

        // 2. Init storage
        const store = new CliKeyValueStore();
        await store.initialize();

        // 3. Build services
        const services = new CliServiceContainer();
        const logger = new CliLogger();
        const commandHistory = new CliCommandHistory(store);
        await commandHistory.initialize();

        services.set([
            { provide: 'cli-key-value-store', useValue: store },
        ]);

        const stateStoreManager = new CliStateStoreManager(services, this.registry);

        services.set([
            { provide: CliStateStoreManager_TOKEN, useValue: stateStoreManager },
            { provide: CliProcessorsRegistry_TOKEN, useValue: this.registry },
        ]);

        // 4. Create executor and context
        const executor = new CliCommandExecutor(this.registry);

        this.context = new CliExecutionContext(
            { services, logger, commandHistory, stateStoreManager },
            this.terminal,
            executor,
            { ...(this.options ?? {}), terminalOptions: this.getTerminalOptions() },
        );

        this.context.initializeTerminalListeners();

        // 5. Boot (register processors, initialize them)
        await this.boot.boot(this.context, this.processors);

        // 6. Welcome message
        const welcomeMessage = new CliWelcomeMessage();
        welcomeMessage.displayWelcomeMessage(this.context);
    }

    destroy(): void {
        window.removeEventListener('resize', this.resizeListener!);
        this.container.removeEventListener('wheel', this.wheelListener!);
        this.resizeObserver?.disconnect();
        this.terminal?.dispose();
    }

    focus(): void {
        requestAnimationFrame(() => {
            this.fitAddon.fit();
            this.terminal.focus();
        });
    }

    getTerminal(): Terminal {
        return this.terminal;
    }

    getContext(): CliExecutionContext {
        return this.context;
    }

    private getTerminalOptions(): ITerminalOptions & ITerminalInitOnlyOptions {
        return {
            cursorBlink: true,
            allowProposedApi: true,
            fontSize: 20,
            theme: themes.default,
            convertEol: true,
            ...(this.options?.terminalOptions ?? {}),
        };
    }

    private initializeTerminal(): void {
        const opts = this.getTerminalOptions();
        this.terminal = new Terminal(opts);

        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(new WebLinksAddon());
        this.terminal.loadAddon(new OverlayAddon());
        this.terminal.loadAddon(new Unicode11Addon());

        this.terminal.open(this.container);
        this.fitAddon.fit();

        this.wheelListener = (e: WheelEvent) => e.preventDefault();
        this.container.addEventListener('wheel', this.wheelListener, { passive: false });

        this.terminal.focus();
        this.handleResize();
    }

    private handleResize(): void {
        this.resizeListener = () => this.fitAddon.fit();
        window.addEventListener('resize', this.resizeListener);

        this.resizeObserver = new ResizeObserver(() => this.fitAddon.fit());
        this.resizeObserver.observe(this.container);
    }
}
```

**Step 2: Move themes to cli**

The themes are currently in `angular-cli/.../processors/theme/types/index.ts`. They're pure data objects — move to `projects/cli/src/lib/engine/themes.ts` or similar.

**Step 3: Export and commit**

Add to `projects/cli/src/lib/index.ts`:
```typescript
export * from './engine';
```

```bash
git commit -m "feat(cli): add CliEngine — framework-agnostic terminal engine"
```

---

### Task 8: Remove Angular peer dependencies from @qodalis/cli

**Files:**
- Modify: `projects/cli/package.json`

**Step 1: Update package.json**

Remove Angular peer dependencies. Add xterm addon dependencies that were previously only in angular-cli.

```json
{
  "name": "@qodalis/cli",
  "version": "0.2.0",
  "peerDependencies": {},
  "dependencies": {
    "tslib": "^2.3.0",
    "@qodalis/cli-core": "^0.0.16",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/addon-unicode11": "^0.8.0",
    "rxjs": "^7.0.0"
  }
}
```

**Step 2: Commit**

```bash
git commit -m "feat(cli): remove Angular peer deps, add xterm addons"
```

---

### Task 9: Build and verify @qodalis/cli compiles

**Step 1: Build**

```bash
npm run "build cli"
```

**Step 2: Fix any compilation errors**

Iterate until clean build.

**Step 3: Commit fixes if any**

---

### Task 10: Refactor @qodalis/angular-cli to use CliEngine

Slim down angular-cli to be a thin wrapper.

**Files:**
- Modify: `projects/angular-cli/src/lib/cli/cli.component.ts`
- Modify: `projects/angular-cli/src/lib/cli.module.ts`
- Modify: `projects/angular-cli/src/lib/index.ts`
- Modify: `projects/angular-cli/src/public-api.ts`
- Modify: `projects/angular-cli/package.json`

**Step 1: Rewrite CliComponent to wrap CliEngine**

```typescript
@Component({
    selector: 'cli',
    template: '<div #terminal [style.height]="height || \'100%\'"></div>',
    encapsulation: ViewEncapsulation.None,
})
export class CliComponent implements AfterViewInit, OnDestroy {
    @Input() options?: CliEngineOptions;
    @Input() processors?: ICliCommandProcessor[];
    @Input() height?: string;

    @ViewChild('terminal', { static: true }) terminalDiv!: ElementRef;

    private engine?: CliEngine;

    ngAfterViewInit(): void {
        this.engine = new CliEngine(this.terminalDiv.nativeElement, this.options);
        if (this.processors) {
            this.engine.registerProcessors(this.processors);
        }
        this.engine.start();
    }

    ngOnDestroy(): void {
        this.engine?.destroy();
    }

    public focus(): void {
        this.engine?.focus();
    }
}
```

**Step 2: Simplify CliModule**

```typescript
@NgModule({
    declarations: [CliComponent, CliPanelComponent],
    imports: [CommonModule],
    exports: [CliComponent, CliPanelComponent],
})
export class CliModule {}
```

No more `resolveCliProviders()` — the engine handles everything internally.

**Step 3: Clean up angular-cli**

Remove files that are now in `@qodalis/cli`:
- Delete `services/cli-terminal-writer.ts`, spinner, progress bar, text animator
- Delete `storage/cli-key-value-store.ts`
- Delete `state/` directory
- Delete `services/cli-logger.service.ts`
- Delete `services/system/cli-boot.ts`
- Delete `services/system/cli-welcome-message.service.ts`
- Delete `services/cli-command-history.service.ts`
- Delete `services/system/cli-service-provider.ts`
- Delete `addons/overlay.ts`

Keep:
- `cli.component.ts` (slimmed down)
- `cli-panel/cli-panel.component.ts`
- `cli-terminal/cli-terminal.component.ts` (may keep for backwards compat or delete)
- `tokens/index.ts` (for any remaining Angular DI needs)
- Angular-specific processors (ping, theme, users, system) — these can stay if they need Angular services, or move to cli if they don't

**Step 4: Update public-api.ts**

Re-export from `@qodalis/cli` for backwards compat where reasonable:
```typescript
export * from './lib/cli.module';
export { CliComponent } from './lib/cli/cli.component';
export { CliPanelComponent } from './lib/cli-panel/cli-panel.component';
// Re-exports for backwards compat
export { CliEngine, CliEngineOptions } from '@qodalis/cli';
```

**Step 5: Commit**

```bash
git commit -m "refactor(angular-cli): slim down to thin wrapper around CliEngine"
```

---

### Task 11: Build and test the full Angular stack

**Step 1: Build all**

```bash
npm run "build all"
```

**Step 2: Run demo app**

```bash
npm run "start demo"
```

**Step 3: Verify terminal works** — boot, commands, history, spinner, progress bar, themes

**Step 4: Fix issues and commit**

---

## Phase 2: Decouple Plugins

### Task 12: Remove Angular deps from all plugins

For each of the 11 plugin directories, apply the same pattern:

**Pattern for each plugin (example: guid):**

1. Remove `NgModule` class and file
2. Keep only the processor class export
3. Update `package.json` — remove Angular peer deps, remove `@qodalis/angular-cli` dep
4. Update `public-api.ts` to export only the processor class

**Files per plugin:**
- Modify: `projects/guid/src/lib/cli-guid.module.ts` → delete
- Modify: `projects/guid/src/public-api.ts` → export only processor
- Modify: `projects/guid/package.json` → remove Angular deps

Apply to: `guid`, `regex`, `text-to-image`, `speed-test`, `browser-storage`, `string`, `todo`, `curl`, `password-generator`, `server-logs`, `qr`

**Commit:**

```bash
git commit -m "feat(plugins): remove Angular deps from all 11 plugins"
```

---

## Phase 3: React Wrapper

### Task 13: Create @qodalis/react-cli project

**Files:**
- Create: `projects/react-cli/package.json`
- Create: `projects/react-cli/tsconfig.json`
- Create: `projects/react-cli/tsup.config.ts`
- Create: `projects/react-cli/src/index.tsx`
- Create: `projects/react-cli/src/Cli.tsx`
- Create: `projects/react-cli/src/CliProvider.tsx`
- Create: `projects/react-cli/src/useCliEngine.ts`

**Step 1: package.json**

```json
{
  "name": "@qodalis/react-cli",
  "version": "0.1.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "dependencies": {
    "@qodalis/cli": "^0.2.0",
    "@qodalis/cli-core": "^0.0.16"
  }
}
```

**Step 2: Implement components**

`src/useCliEngine.ts` — hook that creates CliEngine from a ref
`src/CliProvider.tsx` — context provider
`src/Cli.tsx` — component (standalone or within provider)
`src/index.tsx` — barrel exports

See design doc for full implementation.

**Step 3: Build config**

tsup.config.ts targeting ESM + CJS, external react/react-dom.

**Step 4: Commit**

```bash
git commit -m "feat(react-cli): add @qodalis/react-cli wrapper"
```

---

### Task 14: Create React demo app

**Files:**
- Create: `projects/demo-react/` — Vite React app consuming `@qodalis/react-cli`

**Step 1: Scaffold with Vite**

```bash
cd projects && npm create vite@latest demo-react -- --template react-ts
```

**Step 2: Add dependencies and implement**

Import `<Cli>` component, pass processors, verify it works.

**Step 3: Commit**

---

## Phase 4: Vue Wrapper

### Task 15: Create @qodalis/vue-cli project

Same pattern as React — thin wrapper with Vue component + composable.

### Task 16: Create Vue demo app

Vite Vue app consuming `@qodalis/vue-cli`.

---

## Phase 5: CI & Build

### Task 17: Update build-all.js

Add react-cli and vue-cli to build order. Handle different build tools (ng-packagr vs tsup).

### Task 18: Update GitHub Actions

Add build/test/publish steps for new packages.

---

## Execution Notes

- Phase 1 is the critical path — everything depends on it
- Tasks 1-9 can be done incrementally with builds after each
- Task 10-11 is the integration point — expect iteration here
- Phase 2 is mechanical (11 plugins, same change)
- Phase 3-4 are independent of each other
