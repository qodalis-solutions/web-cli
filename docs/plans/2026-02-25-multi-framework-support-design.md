# Multi-Framework Support Design

**Date:** 2026-02-25
**Status:** Approved

## Goal

Support React and Vue in addition to Angular by extracting a framework-agnostic engine from the current Angular-coupled code. End state: `@qodalis/react-cli` and `@qodalis/vue-cli` packages alongside the existing `@qodalis/angular-cli`, all sharing a common engine. Plugins become universal (pure TypeScript, no framework dependencies).

## Package Architecture

```
@qodalis/cli-core          <- zero dependencies (interfaces, types, unchanged)
       |
@qodalis/cli               <- framework-agnostic engine (xterm.js, executor, registry, context)
       |
+------+----------+
|      |          |
angular-cli  react-cli  vue-cli    <- thin wrappers, each depends on cli + its framework

@qodalis/cli-guid ----> cli-core only
@qodalis/cli-todo ----> cli-core only
... (all 11 plugins reference cli-core only)
```

## @qodalis/cli — Framework-Agnostic Engine

### What moves from angular-cli into cli

- CliExecutionContext implementation (replace Angular Injector lookups with direct references)
- xterm.js terminal setup (Terminal init, FitAddon, WebLinksAddon, resize handling)
- Boot sequence (processor registration, initialization)
- Terminal writer, spinner, progress bar, text animator
- State store manager
- Command history

### Public API

```typescript
export class CliEngine {
  constructor(container: HTMLElement, options?: CliOptions);

  // Plugin registration (replaces Angular DI multi-providers)
  registerProcessor(processor: ICliCommandProcessor): void;
  registerProcessors(processors: ICliCommandProcessor[]): void;

  // Lifecycle
  boot(): Promise<void>;
  destroy(): void;

  // Terminal access
  readonly terminal: Terminal;
  readonly context: ICliExecutionContext;
}
```

## @qodalis/angular-cli — Thin Angular Wrapper

Slimmed down to ~200-300 lines wrapping CliEngine:

```typescript
@Component({
  selector: 'cli',
  template: '<div #terminal></div>',
})
export class CliComponent implements OnInit, OnDestroy {
  @Input() options?: CliOptions;
  @Input() processors?: ICliCommandProcessor[];
  @ViewChild('terminal') terminalDiv!: ElementRef;

  private engine!: CliEngine;

  ngOnInit() {
    this.engine = new CliEngine(this.terminalDiv.nativeElement, this.options);
    if (this.processors) {
      this.engine.registerProcessors(this.processors);
    }
    this.engine.boot();
  }

  ngOnDestroy() {
    this.engine.destroy();
  }
}
```

Backwards compatibility via Angular DI is possible but not prioritized. Clean break — major version bump.

## @qodalis/react-cli — React Wrapper

Three levels of usage: component, hook, and context provider.

### 1. Simple Component

Drop-in usage, no context needed:

```tsx
<Cli processors={processors} options={options} />
```

### 2. Hook — useCliEngine

For manual control over the engine lifecycle:

```tsx
function MyTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engine = useCliEngine(containerRef, {
    processors: [new CliGuidCommandProcessor()],
    options: { /* ... */ },
  });

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
```

### 3. Context Provider — CliProvider + useCli

For sharing engine access across a component tree:

```tsx
<CliProvider processors={processors} options={options}>
  <Cli />
  <MyToolbar />
</CliProvider>

function MyToolbar() {
  const { engine } = useCli();
  return <button onClick={() => engine?.execute('help')}>Help</button>;
}
```

### Implementation

```tsx
// --- Context ---
const CliContext = createContext<{ engine: CliEngine | null }>({ engine: null });

export const useCli = () => useContext(CliContext);

// --- Hook ---
export function useCliEngine(
  containerRef: RefObject<HTMLElement>,
  config?: { processors?: ICliCommandProcessor[]; options?: CliOptions },
): CliEngine | null {
  const [engine, setEngine] = useState<CliEngine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const e = new CliEngine(containerRef.current, config?.options);
    if (config?.processors) e.registerProcessors(config.processors);
    e.boot().then(() => setEngine(e));
    return () => e.destroy();
  }, []);

  return engine;
}

// --- Provider ---
export const CliProvider: React.FC<{
  processors?: ICliCommandProcessor[];
  options?: CliOptions;
  children: React.ReactNode;
}> = ({ processors, options, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engine = useCliEngine(containerRef, { processors, options });

  return (
    <CliContext.Provider value={{ engine }}>
      {children}
    </CliContext.Provider>
  );
};

// --- Component ---
export const Cli: React.FC<{
  processors?: ICliCommandProcessor[];
  options?: CliOptions;
  onReady?: (engine: CliEngine) => void;
}> = ({ processors, options, onReady }) => {
  // If inside a CliProvider, use its engine. Otherwise standalone.
  const ctx = useCli();
  const containerRef = useRef<HTMLDivElement>(null);
  const standaloneEngine = ctx.engine ? null : useCliEngine(containerRef, { processors, options });

  useEffect(() => {
    const engine = ctx.engine ?? standaloneEngine;
    if (engine) onReady?.(engine);
  }, [ctx.engine, standaloneEngine]);

  return <div ref={containerRef} style={{ height: '100%' }} />;
};
```

## @qodalis/vue-cli — Vue Wrapper

```typescript
export const Cli = defineComponent({
  name: 'Cli',
  props: {
    options: { type: Object as PropType<CliOptions>, required: false },
    processors: { type: Array as PropType<ICliCommandProcessor[]>, required: false },
  },
  emits: ['ready'],
  setup(props, { emit }) {
    const containerRef = ref<HTMLElement | null>(null);
    let engine: CliEngine | null = null;

    onMounted(async () => {
      engine = new CliEngine(containerRef.value!, props.options);
      if (props.processors) engine.registerProcessors(props.processors);
      await engine.boot();
      emit('ready', engine);
    });

    onBeforeUnmount(() => engine?.destroy());

    return () => <div ref={containerRef} style={{ height: '100%' }} />;
  },
});

export function useCliEngine(engine: Ref<CliEngine | null>) {
  return {
    registerProcessor: (p: ICliCommandProcessor) => engine.value?.registerProcessor(p),
    execute: (command: string) => engine.value?.execute(command),
  };
}
```

## Universal Plugins

All 11 plugins lose their Angular dependencies. Each exports only the processor class.

**Before:**
```typescript
@NgModule({
  providers: [resolveCommandProcessorProvider(CliGuidCommandProcessor)],
})
export class CliGuidModule {}
```

**After:**
```typescript
// Just export the processor class — no module, no Angular
export class CliGuidCommandProcessor implements ICliCommandProcessor { ... }
```

**package.json after:**
```json
{
  "dependencies": {
    "@qodalis/cli-core": "^0.0.16"
  }
}
```

No backwards compatibility shim. Clean break, documented migration.

## Migration Guide (Angular Users)

```typescript
// Before
@NgModule({
  imports: [CliModule, CliGuidModule, CliTodoModule],
})
export class AppModule {}

// After
import { CliModule } from '@qodalis/angular-cli';
import { CliGuidCommandProcessor } from '@qodalis/cli-guid';
import { CliTodoCommandProcessor } from '@qodalis/cli-todo';

@Component({
  template: '<cli [processors]="processors"></cli>',
})
export class AppComponent {
  processors = [
    new CliGuidCommandProcessor(),
    new CliTodoCommandProcessor(),
  ];
}
```

## Monorepo Structure

```
angular-web-cli/
  projects/
    core/                  <- @qodalis/cli-core (unchanged)
    cli/                   <- @qodalis/cli (absorbs engine from angular-cli)
    angular-cli/           <- @qodalis/angular-cli (slimmed to thin wrapper)
    react-cli/             <- NEW: @qodalis/react-cli
    vue-cli/               <- NEW: @qodalis/vue-cli
    demo/                  <- Angular demo (updated to new API)
    demo-react/            <- NEW: React demo app (Vite)
    demo-vue/              <- NEW: Vue demo app (Vite)
    guid/                  <- plugins (Angular deps removed)
    ...
```

## Build Tooling

- `core`, `cli`, `angular-cli`: ng-packagr (works for pure TS libraries)
- `react-cli`: tsup with React JSX transform, outputs ESM + CJS
- `vue-cli`: tsup with Vue plugin, outputs ESM + CJS
- `demo`: Angular CLI
- `demo-react`, `demo-vue`: Vite

**Build order:**
```
core -> cli -> angular-cli -> demo
               react-cli  -> demo-react
               vue-cli    -> demo-vue
         cli -> plugins (parallel)
```

## Implementation Phases

### Phase 1: Extract engine into @qodalis/cli
- Move xterm.js setup, execution context, boot sequence, terminal writer, spinner, progress bar, state store, command history from angular-cli to cli
- Create CliEngine class as public API
- Remove Angular dependencies from cli package
- Strip angular-cli down to thin wrapper
- Update demo app to new API

### Phase 2: Decouple plugins
- Remove NgModule and Angular deps from all 11 plugins
- Each plugin exports only the processor class
- Update all plugin package.json

### Phase 3: React wrapper
- Create projects/react-cli/ with Cli component and useCliEngine hook
- Build setup with tsup
- Create projects/demo-react/ with Vite

### Phase 4: Vue wrapper
- Create projects/vue-cli/ with Cli component and useCliEngine composable
- Build setup with tsup + Vue plugin
- Create projects/demo-vue/ with Vite

### Phase 5: CI & publishing
- Update scripts/build-all.js for new build order and tools
- Update GitHub Actions to build/test/publish new packages
- Major version bump for angular-cli and all plugins

## What Stays Unchanged

- `@qodalis/cli-core` — interfaces and types
- `cli-server-dotnet` — completely independent
- `stackblitz-qodalis-cli-example` — update after publishing new versions
