# CLI Framework Split Design

**Date:** 2026-02-23
**Status:** Approved
**Goal:** Extract framework-agnostic CLI core from Angular-specific code to enable future React/Vue support

## Package Architecture

Three-layer structure:

```
@qodalis/cli-core  →  @qodalis/cli  →  @qodalis/angular-cli  →  plugins
(interfaces)          (engine)          (Angular binding)         (unchanged)
```

### @qodalis/cli-core (existing, minor enhancements)

Stays as the contract layer. Contains:

- Interfaces: `ICliCommandProcessor`, `ICliCommandParameterDescriptor`, `ICliCommandAuthor`
- Interfaces: `ICliExecutionContext` (base, callback-based, no RxJS)
- Interfaces: `ICliTerminalWriter`, `ICliProgressBar`, `ICliStateStore` (callback-based)
- Models: `ICliUser`, `ICliUserSession`, `CliProvider` pattern
- Types: enums, `CliProcessCommand`, `CliOptions`, `Package`, metadata
- Constants: `DefaultLibraryAuthor`
- Utils: delay, version-utils, terminal-utils, string helpers, object-describer
- Themes: xterm.js theme definitions
- Dependencies: `tslib`, `@xterm/xterm` (types only)

### @qodalis/cli (NEW — v0.1.0)

Framework-agnostic execution engine. Contains:

- **DI Container:** Lightweight `CliContainer` class (register/resolve/multi)
- **CommandExecutor:** Parsing, matching, routing (extracted from `CliCommandExecutorService`)
- **ProcessorRegistry:** Discovery and chaining (extracted from `CliCommandProcessorRegistry`)
- **Parsers:** `CommandParser`, `ArgsParser`
- **Built-in processors:** All 45+ commands (echo, hash, json, jwt, base64, ping, etc.)
- **Execution context:** `CliExecutionContext` implementation (callback/promise, wraps xterm Terminal)
- **Terminal:** Writer, progress bar, spinner, text animator (uses xterm.js)
- **State:** `CliStateStore` (Map-based with `onChange` callbacks)
- **Storage:** `CliKeyValueStore` (localStorage abstraction)
- **Errors:** Custom error types, process abstractions
- Dependencies: `tslib`, `@qodalis/cli-core`, `@xterm/xterm` + addons

### @qodalis/angular-cli (refactored, minor version bump)

Angular-specific binding layer. Contains:

- Components: `CliComponent`, `CliPanelComponent`, `CliTerminalComponent`
- Modules: `CliModule`, `CliPanelModule`
- Angular DI bridge: Maps `CliContainer` ↔ Angular `Injector`
- RxJS adapters: Wraps callback-based state store → Observable
- `resolveCommandProcessorProvider()` (registers processors via both DI systems)
- Angular services: user session, users store (RxJS wrappers)
- Dependencies: `@qodalis/cli-core`, `@qodalis/cli`, `@angular/*`, `rxjs`, `@xterm/*`

## Folder Structure

```
angular-web-cli/projects/
├── core/                  # @qodalis/cli-core (unchanged)
├── cli/                   # @qodalis/cli (NEW)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── di/              # DI container
│   │   │   ├── executor/        # Command executor
│   │   │   ├── registry/        # Processor registry
│   │   │   ├── parsers/         # Command & args parsers
│   │   │   ├── processors/      # Built-in command processors
│   │   │   ├── context/         # Execution context impl
│   │   │   ├── terminal/        # Writer, progress bar, spinner
│   │   │   ├── state/           # State store
│   │   │   └── storage/         # Key-value store
│   │   └── public-api.ts
│   ├── package.json
│   └── tsconfig.lib.json
├── angular-cli/           # @qodalis/angular-cli (RENAMED from cli/)
├── demo/
└── [11 plugins]
```

Build order: `core` → `cli` → `angular-cli` → plugins → `demo`

## DI Container Design

Improves existing `CliProvider` pattern from `cli-core/models/services.ts`:

```typescript
class CliContainer {
  register(token: any, provider: CliProvider): void;
  resolve<T>(token: any): T;
  resolveAll<T>(token: any): T[];
  has(token: any): boolean;
}

function registerCommandProcessor(
  container: CliContainer,
  processor: ICliCommandProcessor | Type<ICliCommandProcessor>
): void;
```

Angular-cli bridges this to Angular DI at bootstrap time.

## Execution Context (No RxJS)

Base interface uses native APIs:

```typescript
interface ICliExecutionContext {
  terminal: Terminal;                    // xterm.js
  writer: ICliTerminalWriter;
  spinner: ICliTerminalSpinner;
  progressBar: ICliTerminalProgressBar;
  abortSignal: AbortSignal;             // replaces Subject<void>
  stateStore: ICliStateStore;           // callback-based
  userSession?: ICliUserSession;
  logger: ICliLogger;
  executor: ICliCommandExecutor;
  data: Record<string, any>;
}

interface ICliStateStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  onChange<T>(key: string, callback: (value: T) => void): () => void;
}
```

Angular-cli extends with RxJS:

```typescript
interface IAngularCliExecutionContext extends ICliExecutionContext {
  stateStore$: ICliObservableStateStore;
  onAbort$: Observable<void>;
}
```

## Migration Strategy

- **angular-cli:** Minor version bump. Adds `@qodalis/cli` as dependency. Internal code migrates to delegate to `@qodalis/cli`. Public API unchanged. No breaking changes.
- **Plugins:** No changes needed. They depend on `@qodalis/angular-cli` which continues to work.
- **Future major version:** Clean break — remove duplicated code from angular-cli, require consumers to import from `@qodalis/cli` directly for non-Angular APIs.

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Primary driver | Clean architecture first | React/Vue support is future, not immediate |
| Package naming | Three layers: cli-core, cli, angular-cli | Clear separation of concerns |
| Repo structure | Inside angular-web-cli monorepo | Shared build tooling, easier cross-package dev |
| Plugin strategy | Keep Angular-only for now | Minimize scope, revisit when React/Vue arrives |
| Terminal abstraction | Keep xterm.js in @qodalis/cli | xterm.js is framework-agnostic, works everywhere |
| RxJS | Remove from core, Angular-only | Not portable to React/Vue ecosystems |
| DI container | Simple register/resolve | Minimal, evolves from existing CliProvider pattern |
| Backward compat | Minor version, no breaking changes | Non-disruptive migration path |
| Folder naming | Rename cli/ → angular-cli/, new cli/ | Clean naming, cli = framework-agnostic |
