# Core & CLI Package File Splitting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split large barrel files and god objects into smaller, focused files for better developer readability.

**Architecture:** Extract inline definitions from barrel files into dedicated files, split large classes by extracting helpers. All public exports remain identical via barrel re-exports.

**Tech Stack:** TypeScript, Nx monorepo, tsup

---

### Task 1: Core — Split interfaces/index.ts

**Files:**
- Create: `packages/core/src/lib/interfaces/terminal-writer.ts`
- Create: `packages/core/src/lib/interfaces/clipboard.ts`
- Create: `packages/core/src/lib/interfaces/command-executor-service.ts`
- Create: `packages/core/src/lib/interfaces/process-registry.ts`
- Create: `packages/core/src/lib/interfaces/execution-process.ts`
- Create: `packages/core/src/lib/interfaces/state-store.ts`
- Create: `packages/core/src/lib/interfaces/services.ts`
- Create: `packages/core/src/lib/interfaces/permissions.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

- [ ] **Step 1:** Extract `CliTableOptions` + `ICliTerminalWriter` (lines 20-180) → `terminal-writer.ts`
- [ ] **Step 2:** Extract `ICliClipboard` (lines 185-198) → `clipboard.ts`
- [ ] **Step 3:** Extract `ICliCommandExecutorService` (lines 203-238) → `command-executor-service.ts`
- [ ] **Step 4:** Extract `ICliCommandProcessorRegistry`, `ICliProcessEntry`, `ICliProcessRegisterOptions`, `ICliProcessRegistry` (lines 243-382) → `process-registry.ts`
- [ ] **Step 5:** Extract `ICliExecutionProcess` (lines 291-339) → `execution-process.ts`
- [ ] **Step 6:** Extract `ICliKeyValueStore`, `ICliStateStore` (lines 387-468) → `state-store.ts`
- [ ] **Step 7:** Extract `ICliPingServerService`, `ICliModule`, `ICliConfigurableModule`, `ICliUmdModule`, `ICliLogger`, `ICliTranslationService`, `ICliServiceProvider` (lines 473-684) → `services.ts`
- [ ] **Step 8:** Extract `ICliPermissionService` (lines 730-751) → `permissions.ts`
- [ ] **Step 9:** Replace `interfaces/index.ts` with pure re-exports from all sub-files
- [ ] **Step 10:** Build core: `npx nx build core`

### Task 2: Core — Split models/index.ts

**Files:**
- Create: `packages/core/src/lib/models/icons.ts`
- Create: `packages/core/src/lib/models/colors.ts`
- Create: `packages/core/src/lib/models/command.ts`
- Create: `packages/core/src/lib/models/server.ts`
- Create: `packages/core/src/lib/models/options.ts`
- Modify: `packages/core/src/lib/models/index.ts`

- [ ] **Step 1:** Extract `CliIcon` enum (lines 61-203) → `icons.ts`
- [ ] **Step 2:** Extract `CliForegroundColor`, `CliBackgroundColor` enums (lines 38-59) → `colors.ts`
- [ ] **Step 3:** Extract `CliProcessCommand` type (lines 3-36) → `command.ts`
- [ ] **Step 4:** Extract server types: `CliServerConfig`, `CliServerOutput`, `CliServerResponse`, `CliServerCommandDescriptor`, `CliServerCapabilities` (lines 277-346) → `server.ts`
- [ ] **Step 5:** Extract remaining types: `CliPackageSource`, `CliOptions`, `Package`, `CliProcessorMetadata`, `CliStateConfiguration`, `CliLogLevel`, `CliState`, `CliPanelPosition`, `CliPanelHideAlignment`, `CliPanelConfig` → `options.ts`
- [ ] **Step 6:** Replace `models/index.ts` with re-exports + `enums` aggregator object
- [ ] **Step 7:** Build core: `npx nx build core`

### Task 3: Core — Split themes/index.ts

**Files:**
- Create: `packages/core/src/lib/themes/cli-theme.ts`
- Create: `packages/core/src/lib/themes/default-themes.ts`
- Create: `packages/core/src/lib/themes/default-theme-infos.ts`
- Modify: `packages/core/src/lib/themes/index.ts`

- [ ] **Step 1:** Extract `CliTheme` type + `DefaultThemesType` type (lines 1-37) → `cli-theme.ts`
- [ ] **Step 2:** Extract `DefaultThemes` const (lines 39-674) → `default-themes.ts`
- [ ] **Step 3:** Extract `DefaultThemeInfos` const (lines 680-855) → `default-theme-infos.ts`
- [ ] **Step 4:** Replace `themes/index.ts` with pure re-exports
- [ ] **Step 5:** Build core: `npx nx build core`

### Task 4: CLI — Split engine/cli-engine.ts

**Files:**
- Create: `packages/cli/src/lib/engine/cli-terminal-setup.ts`
- Create: `packages/cli/src/lib/engine/cli-service-initializer.ts`
- Modify: `packages/cli/src/lib/engine/cli-engine.ts`
- Modify: `packages/cli/src/lib/engine/index.ts`

- [ ] **Step 1:** Extract `initializeTerminal()`, `handleResize()`, `safeFit()`, `deferResizeFix()`, `waitForLayout()`, `getTerminalOptions()` (lines 471-595) into `cli-terminal-setup.ts` as `CliTerminalSetup` class
- [ ] **Step 2:** Extract the service container setup from `start()` (lines 155-231) into `cli-service-initializer.ts` as a `initializeServices()` function
- [ ] **Step 3:** Update `cli-engine.ts` to import and use the extracted classes/functions
- [ ] **Step 4:** Update `engine/index.ts` barrel
- [ ] **Step 5:** Build cli: `npx nx build cli`

### Task 5: CLI — Split executor/cli-command-executor.ts

**Files:**
- Create: `packages/cli/src/lib/executor/cli-io-redirect-handler.ts`
- Create: `packages/cli/src/lib/executor/cli-script-executor.ts`
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts`
- Modify: `packages/cli/src/lib/executor/index.ts`

- [ ] **Step 1:** Extract IO redirect methods (appendOutputToFile, writeOutputToFile, writeStderrToFile, appendStderrToFile — lines 188-635) → `cli-io-redirect-handler.ts` as standalone functions
- [ ] **Step 2:** Extract script execution (tryExecuteScript, substituteVars — lines 653-760) → `cli-script-executor.ts` as standalone functions
- [ ] **Step 3:** Update `cli-command-executor.ts` to import and call the extracted functions
- [ ] **Step 4:** Update `executor/index.ts` barrel
- [ ] **Step 5:** Build cli: `npx nx build cli`

### Task 6: CLI — Split context/cli-execution-context.ts

**Files:**
- Create: `packages/cli/src/lib/context/cli-fullscreen-manager.ts`
- Create: `packages/cli/src/lib/context/cli-timer-manager.ts`
- Modify: `packages/cli/src/lib/context/cli-execution-context.ts`
- Modify: `packages/cli/src/lib/context/index.ts`

- [ ] **Step 1:** Extract fullscreen methods (enterFullScreenMode, exitFullScreenMode — lines 373-415) → `cli-fullscreen-manager.ts` as `CliFullScreenManager` class
- [ ] **Step 2:** Extract timer methods (createInterval, createTimeout, clearAllManagedTimers — lines 417-524) → `cli-timer-manager.ts` as `CliTimerManager` class
- [ ] **Step 3:** Update `cli-execution-context.ts` to delegate to managers
- [ ] **Step 4:** Update `context/index.ts` barrel
- [ ] **Step 5:** Build cli: `npx nx build cli`

### Task 7: Final build verification

- [ ] **Step 1:** Full build: `cd /home/nicolae/work/cli-workspace/web-cli && pnpm run build`
- [ ] **Step 2:** Run tests: `npx nx test core && npx nx test cli`
- [ ] **Step 3:** Commit all changes
