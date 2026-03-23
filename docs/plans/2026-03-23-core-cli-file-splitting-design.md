# Core & CLI Package File Splitting Design

**Date:** 2026-03-23
**Goal:** Split large files into smaller, focused files for better developer readability. Light refactoring to extract helper classes where it makes sense. No public API changes.

## Approach

- Subdirectory per domain when a file splits into 3+ files
- Each directory gets a barrel `index.ts` that re-exports everything
- All existing public exports remain identical — no breaking changes
- No behavioral changes, just code organization

## Core Package Splits

### interfaces/index.ts (751 lines) → 8 files

| New File | Content |
|----------|---------|
| `interfaces/terminal-writer.ts` | `ICliTerminalWriter` (~160 lines) |
| `interfaces/clipboard.ts` | `ICliClipboard` (~20 lines) |
| `interfaces/command-executor-service.ts` | `ICliCommandExecutorService` (~30 lines) |
| `interfaces/process-registry.ts` | `ICliCommandProcessorRegistry`, `ICliProcessEntry`, `ICliProcessRegisterOptions`, `ICliProcessRegistry` (~80 lines) |
| `interfaces/execution-process.ts` | `ICliExecutionProcess` (~40 lines) |
| `interfaces/state-store.ts` | `ICliKeyValueStore`, `ICliStateStore` (~40 lines) |
| `interfaces/services.ts` | `ICliPingServerService`, `ICliModule`, `ICliConfigurableModule`, `ICliLogger`, `ICliTranslationService`, `ICliServiceProvider` (~120 lines) |
| `interfaces/permissions.ts` | `ICliPermissionService` (~30 lines) |
| `interfaces/index.ts` | Pure re-exports (~25 lines) |

### models/index.ts (536 lines) → 6 files

| New File | Content |
|----------|---------|
| `models/icons.ts` | `CliIcon` enum (~170 lines) |
| `models/colors.ts` | `CliForegroundColor`, `CliBackgroundColor` enums (~35 lines) |
| `models/command.ts` | `CliProcessCommand` (~20 lines) |
| `models/server.ts` | `CliServerConfig`, `CliServerOutput`, `CliServerResponse`, `CliServerCommandDescriptor`, `CliServerCapabilities` (~100 lines) |
| `models/options.ts` | `CliOptions`, `CliPanelConfig`, `CliPanelPosition`, `CliPanelHideAlignment`, `CliProcessorMetadata`, `CliStateConfiguration`, `CliState`, `CliLogLevel` (~100 lines) |
| `models/index.ts` | Pure re-exports + `enums` object (~25 lines) |

### themes/index.ts (855 lines) → 4 files

| New File | Content |
|----------|---------|
| `themes/cli-theme.ts` | `CliTheme` type alias, `DefaultThemesType` (~40 lines) |
| `themes/default-themes.ts` | `DefaultThemes` object (31 palettes) (~640 lines) |
| `themes/default-theme-infos.ts` | `DefaultThemeInfos` metadata (~180 lines) |
| `themes/index.ts` | Pure re-exports (~10 lines) |

## CLI Package Splits

### engine/ (595 lines → 3 files)

| File | Content |
|------|---------|
| `engine/cli-engine.ts` | Core orchestration — bootstrap, module loading, public API (~250) |
| `engine/cli-terminal-setup.ts` | Terminal creation, xterm.js, addons, resize/wheel (~200) |
| `engine/cli-service-initializer.ts` | DI wiring — create and register all services (~150) |
| `engine/index.ts` | Re-exports |

### context/ (579 lines → 3 files)

| File | Content |
|------|---------|
| `context/cli-execution-context.ts` | Core context class, delegates to managers (~440) |
| `context/cli-fullscreen-manager.ts` | Enter/exit fullscreen, overlay, state tracking (~80) |
| `context/cli-timer-manager.ts` | Managed timers/intervals with auto-cleanup (~60) |
| `context/index.ts` | Re-exports |

### executor/ (903 lines → 4 files)

| File | Content |
|------|---------|
| `executor/cli-command-executor.ts` | Core executor — routing, global params, processor lookup (~450) |
| `executor/cli-pipeline-handler.ts` | Operator parsing & execution (&&, \|\|, \|, ;) (~200) |
| `executor/cli-alias-resolver.ts` | Alias expansion, circular detection (~100) |
| `executor/cli-argument-reconciler.ts` | Parameter matching, validation, defaults (~150) |
| `executor/index.ts` | Re-exports |

### processors/configure/ (929 lines → 3 files)

| File | Content |
|------|---------|
| `configure/cli-configure-command-processor.ts` | Core processor — command handling, state persistence (~350) |
| `configure/cli-configure-renderer.ts` | UI rendering — option display, interactive menus (~300) |
| `configure/cli-configure-defaults.ts` | SYSTEM_OPTIONS definitions, default values (~280) |
| `configure/index.ts` | Re-exports |

### processors/theme/ (796 lines → 3 files)

| File | Content |
|------|---------|
| `theme/cli-theme-command-processor.ts` | Core processor — command routing, state management (~250) |
| `theme/cli-theme-renderer.ts` | Theme list rendering, color swatches (~300) |
| `theme/cli-theme-preview.ts` | Preview generation, sample text rendering (~250) |
| `theme/index.ts` | Re-exports |

### processors/system/packages/ (1,384 lines → 4 files)

| File | Content |
|------|---------|
| `packages/cli-packages-command-processor.ts` | Core processor — command routing (~300) |
| `packages/cli-package-search.ts` | Search across npm, PyPI, NuGet, Maven (~350) |
| `packages/cli-package-installer.ts` | Installation logic, CDN loading (~350) |
| `packages/cli-package-registry.ts` | Registry abstraction, source management (~380) |
| `packages/index.ts` | Re-exports |

### processors/system/htop/ (716 lines → 3 files)

| File | Content |
|------|---------|
| `htop/cli-htop-command-processor.ts` | Core processor — key handling, lifecycle (~250) |
| `htop/cli-htop-renderer.ts` | Terminal UI rendering, bar charts (~300) |
| `htop/cli-htop-collector.ts` | Process data collection, sorting (~170) |
| `htop/index.ts` | Re-exports |

### services/background/ (446 lines → 3 files)

| File | Content |
|------|---------|
| `background/cli-background-service-registry.ts` | Service lifecycle — start/stop/restart (~250) |
| `background/cli-background-service-logger.ts` | ServiceLogBuffer, log entry management (~100) |
| `background/cli-background-service-events.ts` | Event emission, handler registration (~100) |
| `background/index.ts` | Re-exports |

### server/ — split connection (283 lines → 3 files)

| File | Content |
|------|---------|
| `server/cli-server-connection.ts` | Core connection — connect/disconnect, config (~150) |
| `server/cli-server-protocol.ts` | Message formatting, request/response protocol (~80) |
| `server/cli-server-response-parser.ts` | Response parsing, type mapping (~60) |
| `server/index.ts` | Re-exports |

## Files Left Unchanged

- `input/command-line-mode.ts` (442 lines) — cohesive UI mode
- `input/modes/select-input-mode.ts` (501 lines) — cohesive UI mode
- `input/modes/multi-select-input-mode.ts` (511 lines) — cohesive UI mode
- `services/cli-terminal-writer.ts` — single responsibility
- `testing/cli-test-harness.ts` — test utilities
- `processors/system/cli-nano-command-processor.ts` — already modularized with editor/
- `processors/system/cli-debug-command-processor.ts` — single concern

## Constraints

- All public exports remain identical
- Tests pass without modification (imports come from barrel files)
- No behavioral changes
- Each barrel index.ts re-exports everything its parent file used to export
