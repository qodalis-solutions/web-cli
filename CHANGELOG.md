# Change Log

This document records all notable changes to the [Qodalis CLI](https://cli.qodalis.com/docs/) ecosystem.
This project adheres to [Semantic Versioning](https://semver.org/).

## [v2.0.1](https://github.com/qodalis-solutions/web-cli/compare/v1.0.39...v2.0.1) (2026-02-28)

### Breaking Changes

- **Framework-agnostic CLI engine** — The core terminal engine has been extracted from `@qodalis/angular-cli` into a new `@qodalis/cli` package. All 26 built-in command processors, the command executor, processor registry, parsers, and utilities now live in the framework-agnostic layer.
- **Project rename** — `projects/cli` renamed to `projects/angular-cli`. The Angular wrapper now only contains Angular-specific components (terminal component, CLI panel, DI providers).
- **Module system** — `ICliUmdModule` is deprecated in favor of `ICliModule`. All plugins migrated to `bootCliModule()` and export module objects. `CliEngine` registers modules instead of raw processors.
- **Angular dependencies removed from plugins** — All plugin libraries are now pure TypeScript packages usable with any framework.
- **`allowUnlistedCommands` renamed to `acceptsRawInput`**.
- **`welcomeMessage` and `usersModule` removed from `CliOptions`** — Welcome message is now a module with boot priority. User management moved to `@qodalis/cli-users`.
- **User services extracted** — User processors and services moved from `@qodalis/cli` to `@qodalis/cli-users`.

### New Packages

- **`@qodalis/cli`** — Framework-agnostic CLI engine with all built-in commands, command executor, processor registry, and `CliEngine` class.
- **`@qodalis/react-cli`** — React wrapper with `Cli`, `CliPanel`, `CliProvider`, `CliConfigProvider` components and `useCli`, `useCliEngine`, `useCliConfig` hooks.
- **`@qodalis/vue-cli`** — Vue 3 wrapper with `Cli`, `CliPanel`, `CliProvider` components and `useCli`, `useCliEngine` composables.
- **`@qodalis/cli-users`** — User management plugin with 14 command processors, IndexedDB-backed stores, authentication, permissions, and groups.
- **`@qodalis/cli-files`** — Virtual filesystem plugin with tab completion and prompt path integration.
- **`@qodalis/cli-yesno`** — Yes/no confirmation utility plugin.

### Features

#### Multi-Framework Support
- React and Vue 3 wrappers with full feature parity to the Angular wrapper
- `CliPanel` collapsible panel component available in all three frameworks
- Demo applications for Angular, React (Vite), and Vue (Vite)
- Framework wrappers built with tsup for optimal bundling

#### Module System (`ICliModule`)
- New `ICliModule` interface with lifecycle hooks, dependency resolution, and configuration
- `bootCliModule()` helper for registering modules
- `CliModuleRegistry` for tracking and introspecting registered modules
- Type-safe module configuration via interface narrowing
- `onAfterBoot` lifecycle hook and boot priority ordering

#### Input System (`ICliInputReader`)
- New `ICliInputReader` interface with `readLine`, `readPassword`, `readConfirm`, `readSelect`, `readSelectInline`, `readMultiSelect`, `readNumber`
- Input mode state machine: `CommandLineMode`, `ReaderMode`, `RawMode`
- `CliTerminalLineRenderer` for prompt and line display
- `CliLineBuffer` reusable text buffer

#### Full-Screen Mode
- `enterFullScreenMode` / `exitFullScreenMode` on execution context
- `onData` raw input hook on `ICliCommandProcessor`
- Built-in `nano` text editor command

#### Command Pipeline
- Pipe operator (`|`) for chaining command output
- Quote-aware command parsing
- Auto-capture of terminal output as implicit pipeline data

#### Configure Command
- `CliConfigureCommandProcessor` for managing system and plugin configuration
- `ICliConfigurationOption` interface and `configurationOptions` property on processors
- `getConfigValue` utility with state store integration

#### Command Processor Extensions
- `extendsProcessor` for wrapping/extending existing command processors

#### Server Connection
- Server connection manager and proxy processors
- WebSocket proxy configuration for .NET backend integration

#### Users Plugin (`@qodalis/cli-users`)
- 14 command processors for user/group management
- IndexedDB-backed user and group stores
- Authentication with configurable `requirePassword` and `requirePasswordOnBoot`
- Permission system with group-based access control
- Session persistence with root fallback on logout

#### Debug & Diagnostics
- `debug` command processor for system diagnostics
- Service container and state store introspection
- Hidden processor support (filtered from help listing)

#### Terminal Output
- `writeList`, `writeKeyValue`, `writeColumns` output methods
- `readSelectInline`, `readMultiSelect`, `readNumber` input methods

### Bug Fixes

- Fixed `readSelect` redraw cursor drift causing duplicate options
- Fixed users auto-login as root when no session restored on boot
- Fixed `requirePasswordOnBoot` clearing persisted session
- Fixed `su` always requiring password when `requirePassword` is true
- Fixed welcome module to respect configure command's persisted setting
- Fixed bracket notation for Record index access in debug export
- Fixed statically-booted module tracking in `CliModuleRegistry`
- Fixed React and Vue demo build failures
- Clear current line before showing prompt on Ctrl+L
- Skip prompt/messages after entering full-screen mode

### CI/CD

- Deploy workflow updated to publish `@qodalis/react-cli` and `@qodalis/vue-cli`
- tsup build outputs copied into `dist/` before npm publish

### Documentation

- Rewritten README for multi-framework support
- Documentation site (`docs` project)

---

## [v1.0.26](https://github.com/qodalis-solutions/web-cli/compare/v1.0.22...v1.0.26) (2025-01-07)

- Supports add/remove multiple packages
- Moved processors to registry
- Added logger with min level
- Moved boot to separate service
- Customization for welcome message
- Support silent process exit
- Show icon on command version
- Expose executor execute command
- Support writer.writeln()
- Fix logical operators && and ||
- Supports dependency injection
- etc

## [v1.0.22](https://github.com/qodalis-solutions/web-cli/compare/v1.0.21...v1.0.22) (2025-01-04)

- fix: rename function
- feat: supports icons
- feat: progress supports text, fix progress bar on small screens
- fix: initializing packages
- feat: supports list users and add new user
- feat: group cli proc into folders
- feat: add options for users module
- feat: added processor metadata
- feat: add string library
- fix: improve help command, show welcome msg art, fix change command from history
- feat: update the git url

## [v1.0.21](https://github.com/qodalis-solutions/web-cli/tree/v1.0.21) (2025-01-03)

Initial changelog
