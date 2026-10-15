# Change Log

This document records all notable changes to the [Qodalis CLI](https://cli.qodalis.com/docs/) ecosystem.
This project adheres to [Semantic Versioning](https://semver.org/).

## v2.0.0-beta.16

### CLI engine (`@qodalis/cli`, `@qodalis/cli-core`)

- **Select and multi-select prompts redraw in place in narrow terminals.** A row wider than the terminal (a long label or description, or the help bar) wrapped onto two rows, the redraw moved the cursor up too few rows, and every arrow key printed the prompt again (`? Groups:` repeated). Rows are now cut to the terminal width with `…` (`readSelect`, `readMultiSelect`, and the help/error lines of every prompt). New `truncateToWidth(text, width)` in core (ANSI- and wide-character-aware).

### Users (`@qodalis/cli-users`)

- `adduser` reports a taken user name or email as soon as it is entered (asked again interactively; a name given on the command line or a taken `--email` fails before the password), instead of after the password.
- The groups picker shows each group's description next to its name, and the summary line lists only the names.


### Docs site

- Consecutive code blocks (e.g. the npm and runtime install commands) have a gap between them.
- **Search engines see every docs page.** GitHub Pages answered deep links (`/docs/...`) from `404.html` with HTTP 404, so crawlers treated the pages as missing. The deploy now runs `apps/docs/scripts/generate-static-routes.mjs`, which writes a real page per route (HTTP 200) with its own title, description, canonical URL and Open Graph tags, a `noindex` 404 page for unknown URLs, and a `sitemap.xml` generated from the navigation and plugin list (replacing the hand-maintained one).

## v2.0.0-beta.15

### `@qodalis/cli-users`

- **`adduser` walks through every field**: run without `--email` (or with no arguments at all), it asks for the name, email, full name, groups (a multi-select of the existing groups, `users` preselected), home directory (default `/home/<name>`), whether the account is enabled, and the password. The email is checked before the password is asked for. `adduser <name> --email=..` is unchanged and only asks for the password, so scripts keep working.
- Invalid answers (name, email, passwords that break the policy or don't match) are asked again, up to 3 times like `passwd`, instead of ending the command. `passwd` gets the same password retries.
- **API tokens** (server mode): `token create <name> [--expires=<days>|never] [--permissions=a,b]` creates a long-lived, revocable bearer token for MCP clients, CI and scripts. It is printed once, with a ready-to-paste `claude mcp add --transport http qcli <server>/api/qcli/mcp --header "Authorization: Bearer <token>"` example. `token list [--all]` shows NAME, ID, EXPIRES, LAST USED and SCOPE (plus USER with `--all`); `token revoke <id>` revokes one. In local mode the commands explain that tokens need a server.
- `ICliUsersBackend` gains optional `listApiTokens`, `createApiToken` and `revokeApiToken` (implemented by the HTTP backend against the servers' `/api/v1/qcli/tokens`), and the module declares the `tokens:read` and `tokens:revoke` permissions.
- **Full name**: `adduser --full-name` / `usermod --full-name` store it in the user's `data.fullName`; `listusers` shows a FULL NAME column when any user has one.

### Docs

- Server integration: new **MCP endpoint** section, the main MCP documentation: enabling it on each server, the tools it exposes (`server_info`, command tools, `fs_*`, `data_*`, `jobs_*`, plugin-contributed tools) and their permissions, authentication with or without the users plugin, and a step-by-step guide for Claude Code (direct HTTP with a token, or the `@qodalis/mcp-cli` stdio proxy; curl check; troubleshooting with `claude mcp list` and `/mcp`). The main README links to it; the users plugin README now only covers API tokens.
- Opening another docs page starts at the top; Back/Forward return to the previous scroll position.

## v2.0.0-beta.14

### Users, permissions and security (`@qodalis/cli-users`)

- **Complete users module** in local (IndexedDB), server (`server: '<name>'`), embedded (`hostAuth`) and custom-backend (`backend`) modes, with identical commands and rules: users, groups as roles, `resource:action` permissions with wildcards, sessions, lockout and an audit log. See `packages/plugins/users/README.md`.
- **Command guards** in core: `requireAuth`, `requiredGroups` and `requiredPermissions` on processor metadata, global guards contributable from modules, and `cliAuthorize` / `cliCanAccess` helpers that allow everything when no auth module is loaded.
- Built-in `users` group grants `commands:execute` (matching the servers); core declares `system:*` and `shell:execute`.
- Server mode: WebSocket tickets instead of tokens in URLs, 401 handling, `session-kick`, server-side audit and events; servers reconnect on sign-in / sign-out and when a session is restored at reload.
- Signed-out prompt shows a dimmed `anonymous` label (`anonymousName`, `''` to hide).
- Files: the working directory leaves the user's home on sign-out and is re-checked like `cd` on restore.

### Remote shell (`ssh`)

- Requires `shell:execute` when the users module is loaded; shell tokens and custom authorizers are supported on servers without it.
- Readable messages for every shell close reason (login required, permission denied, disabled, timed out, too many sessions, session ended).
- One-shot commands keep flag-like arguments (`ssh node sh -c 'ls -la'`); no more `ProcessExitedError` from WebSocket callbacks.

### Fixes from the security review

- Permissions: a `*` that is not the last segment matches one segment (`*:read` no longer grants everything).
- Sub-commands merged from an extending module inherit the host command's access rules.
- Server commands accept a value (`node:hello world`); a 4401 `session ended` close stops event-socket retries.
- `ssh`: Ctrl+C/abort ends the command; per-call state; malformed messages ignored.
- Users: a new login is no longer signed out by a 401 for the old token; stale refreshes ignored; concurrent local logins are serialized (lockout cannot be bypassed); built-in audit events cannot be written by extensions; `requirePasswordOnBoot` ends the previous session.
- Files: `cp -r` checks read access on everything copied; ownership follows user renames and deleted users' files go to `root`.
- `server logs --server=<url>` sends no credentials to ad-hoc URLs.

### Servers and engine

- `cliDefaultServer(context)` and `ICliServerManager.preferredServer()`: commands without `--server` target a connected server (`server logs`, `data-explorer`, `scp`).
- `scp` and `data-explorer` send the signed-in user's token.
- Reconnects no longer unregister local commands that declare `requireServer`.
- `wasmUrl` engine option; the WebAssembly accelerator is first looked up next to the page.
- Validation failures (missing values, invalid arguments) end silently instead of printing `ProcessExitedError`.
- `context.notifier` replaces `setStatusText` / `clearStatusText`; panel status bars show notifications by level, with compact indicators for vertical panels.
- HTTP client service and constructor injection (`deps`) in the service container.

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
