# Qodalis CLI Examples

Focused, copy-pasteable code examples organized by framework. Each file demonstrates a specific feature with inline comments explaining the API.

> These are **code snippets**, not runnable projects. Copy the relevant parts into your application. For fully runnable starter projects, see the [StackBlitz examples](https://github.com/qodalis-solutions/qodalis-cli-angular-example).

## Prerequisites

```bash
npm install @qodalis/cli @qodalis/cli-core
```

Framework-specific:
- **Angular:** `npm install @qodalis/angular-cli`
- **React:** `npm install @qodalis/react-cli`
- **Vue:** `npm install @qodalis/vue-cli`

## Vanilla JS Examples

The most comprehensive set — covers the full `CliEngine` API without any framework wrapper.

| # | File | Feature | Docs |
|---|------|---------|------|
| 01 | [basic-setup.ts](vanilla/01-basic-setup.ts) | Minimal setup with `CliEngine` and `CliOptions` | [Engine API](https://qodalis-solutions.github.io/web-cli/docs/engine-api) |
| 02 | [custom-commands.ts](vanilla/02-custom-commands.ts) | Command processors, sub-commands, validation, extending, modules | [Command Processors](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors) |
| 03 | [writer-api.ts](vanilla/03-writer-api.ts) | All 16 writer methods (tables, boxes, lists, colors, etc.) | [Writer API](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/writer-api) |
| 04 | [input-reader.ts](vanilla/04-input-reader.ts) | All 9 input methods (text, password, select, multi-select, date, file) | [Input Reader](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/input-reader) |
| 05 | [theming.ts](vanilla/05-theming.ts) | Built-in themes and custom theme objects | [Theming](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/theming) |
| 06 | [background-services.ts](vanilla/06-background-services.ts) | Daemons, jobs, Web Workers, events, logging | [Background Services](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/background-services) |
| 07 | [http-client.ts](vanilla/07-http-client.ts) | HTTP client with auto-abort, timeout, streaming | [HTTP Client](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/http-client) |
| 08 | [state-management.ts](vanilla/08-state-management.ts) | Persistent state, reactive subscriptions, configuration options | [State Management](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/state-management) |
| 09 | [full-screen-mode.ts](vanilla/09-full-screen-mode.ts) | Alternate screen buffer, `onData`/`onResize`/`onDispose`, managed timers | [Command Processors](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors) |
| 10 | [server-integration.ts](vanilla/10-server-integration.ts) | Multi-server config, auth headers, WebSocket shell | [Server Integration](https://qodalis-solutions.github.io/web-cli/docs/server-integration) |
| 11 | [progress-and-animations.ts](vanilla/11-progress-and-animations.ts) | Spinners, progress bars, text animations | [Core Concepts](https://qodalis-solutions.github.io/web-cli/docs/core-concepts) |
| 12 | [tabs-and-panes.ts](vanilla/12-tabs-and-panes.ts) | Panel tabs, split panes, panel state via `ICliPanelRef` | [Core Concepts](https://qodalis-solutions.github.io/web-cli/docs/core-concepts) |
| 13 | [clipboard-and-drag-drop.ts](vanilla/13-clipboard-and-drag-drop.ts) | Clipboard read/write, file drag-and-drop handling | [Core Concepts](https://qodalis-solutions.github.io/web-cli/docs/core-concepts) |
| 14 | [engine-snapshots.ts](vanilla/14-engine-snapshots.ts) | Save/restore terminal state with `CliEngineSnapshot` | [Core Concepts](https://qodalis-solutions.github.io/web-cli/docs/core-concepts) |
| 15 | [command-hooks.ts](vanilla/15-command-hooks.ts) | Before/after hooks, timing, validation, hook factories | [Command Processors](https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors) |
| 16 | [users-and-permissions.ts](vanilla/16-users-and-permissions.ts) | Users module, sessions, groups, rwx permission checks | [Plugins: Users](https://qodalis-solutions.github.io/web-cli/docs/plugins/users) |
| 17 | [runtime-plugins.ts](vanilla/17-runtime-plugins.ts) | Dynamic plugin loading via `pkg` commands, custom sources | [Configuration](https://qodalis-solutions.github.io/web-cli/docs/configuration) |
| 18 | [custom-completion.ts](vanilla/18-custom-completion.ts) | Tab completion providers (static, dynamic, async) | [Core Concepts](https://qodalis-solutions.github.io/web-cli/docs/core-concepts) |
| 19 | [custom-users-permissions.ts](vanilla/19-custom-users-permissions.ts) | Custom auth, RBAC permissions, service overrides | [Plugins: Users](https://qodalis-solutions.github.io/web-cli/docs/plugins/users) |
| 20 | [user-group-management.ts](vanilla/20-user-group-management.ts) | Programmatic user/group CRUD, session lifecycle, custom session data | [Plugins: Users](https://qodalis-solutions.github.io/web-cli/docs/plugins/users) |

## Angular Examples

| # | File | Feature |
|---|------|---------|
| 01 | [basic-setup.ts](angular/01-basic-setup.ts) | Standalone component with `CliComponent` |
| 02 | [custom-commands.ts](angular/02-custom-commands.ts) | DI-based and template-based processor registration |
| 03 | [panel-configuration.ts](angular/03-panel-configuration.ts) | `CliPanel` with all config options and controlled state |
| 04 | [engine-api.ts](angular/04-engine-api.ts) | `@ViewChild` engine access and programmatic execution |
| 05 | [plugin-usage.ts](angular/05-plugin-usage.ts) | Plugin imports, configuration, and language packs |

## React Examples

| # | File | Feature |
|---|------|---------|
| 01 | [basic-setup.tsx](react/01-basic-setup.tsx) | `CliConfigProvider` + `Cli` component |
| 02 | [custom-commands.tsx](react/02-custom-commands.tsx) | Custom processors with modules |
| 03 | [panel-configuration.tsx](react/03-panel-configuration.tsx) | `CliPanel` with controlled state and ref methods |
| 04 | [engine-api.tsx](react/04-engine-api.tsx) | `useCliEngine` hook and `useCli` context |
| 05 | [plugin-usage.tsx](react/05-plugin-usage.tsx) | Plugins, language packs, background services |

## Vue Examples

| # | File | Feature |
|---|------|---------|
| 01 | [basic-setup.vue](vue/01-basic-setup.vue) | `CliConfigProvider` + `Cli` with setup script |
| 02 | [custom-commands.vue](vue/02-custom-commands.vue) | Custom processors with modules |
| 03 | [panel-configuration.vue](vue/03-panel-configuration.vue) | `CliPanel` with v-model bindings and ref |
| 04 | [engine-api.vue](vue/04-engine-api.vue) | `useCliEngine` composable |
| 05 | [plugin-usage.vue](vue/05-plugin-usage.vue) | Plugins, language packs, background services |
