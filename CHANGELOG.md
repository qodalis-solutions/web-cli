# Change Log

This document records all notable changes to the [Qodalis CLI](https://cli.qodalis.com/docs/) ecosystem.
This project adheres to [Semantic Versioning](https://semver.org/).

## v2.0.0-beta.18

### Repository

- ESLint works again: migrated to the ESLint 9 flat config (`eslint.config.mjs`), every project gets a `lint` target through `@nx/eslint`, and CI lints affected projects. Fixed the handful of real findings (`prefer-const`, useless regex escapes, `Function` types) and added `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, a PR template, Dependabot and `CODEOWNERS`.

### CLI engine (`@qodalis/cli`)

- **Typing ahead works.** Keys typed while a command is still running are held and replayed at the next prompt, in order, including Enter. They used to be echoed into the command's output and appended to the line just submitted (`/$ echo hi` then `help` showed `/$ echo hihelp`). Ctrl+C and Esc discard them, and they are dropped when the command takes over the terminal (games, `nano`).
- **Up arrow recalls the command you just ran.** After running a command, Up skipped it and showed the one before (and did nothing after the very first command).
- **Boot report.** While the CLI starts, the terminal lists each step (terminal and services, each server, each installed package, each module with its command count and setup time) with a thin progress bar and percentage below it. When boot completes the report is cleared and the regular terminal takes over; warnings and errors stay on screen, first-run setup prompts are cleared with the report. Keys typed while booting are kept and replayed at the first prompt. Configure it with `boot: { showLogs, keepLogs, slowStepMs }` in the options, or per user with `configure set system.bootLogs false` (shows the previous spinner). Plugins can add steps through the `CliBootLog_TOKEN` service.
- **Event bus.** Each terminal has a publish/subscribe bus (`context.events`, or the `ICliEventBus_TOKEN` service) that the system, plugins and commands use to talk to each other without importing each other. `on` / `once` / `events$` take an exact type, a namespace (`package:*`) or `*`, and are typed from `CliEventMap` (plugins add their events with declaration merging), with an explicit type (`on<T>()`), or untyped. Built-in events: `boot:completed`, `command:executed`, `module:loaded` / `module:unloaded`, `package:installed` / `package:updated` / `package:removed`, `server:connected` / `server:unavailable` / `server:disconnected` / `server:event`, `service:*` (background services), `config:changed` / `config:reset` and `session:changed`. Events are kept in memory only: the last 200 are available with `history()`, nothing is persisted. A failing handler is logged and never affects the emitter. The new `events` command watches (`events watch [pattern]`), lists (`events log`) and emits (`events emit <type> [json]`, permission `system:events`) events. The panel's status indicators now refresh on server and command events instead of waiting for the next poll.
- **`server` commands are easier to use.**
  - `server` alone shows the servers instead of a usage line; every sub-command has a help page with examples (`help server status`), and `ssh` too.
  - `server list` shows status with ● / ○, server version, API version, number of commands and shell access. `server status` without a name pings every server at once with the round-trip time; with a name it shows versions, OS, shell and streaming, and for an unreachable server what to check (running, URL, CORS origin, VPN or firewall).
  - New `server commands [name]`: the commands each server provides, with the name to type (`node:echo` when a local command has the same name) and which ones several servers share.
  - `server reconnect` without a name retries every unreachable server (`--all`: every server). `server default` is remembered across reloads and explains what it is for.
  - Aliases: `servers` / `srv`, `server ls`, `server ping` / `server info`, `server cmds`, `server rc` / `server connect`, `server use`, and `shell` for `ssh`. Server names are case-insensitive, and a mistyped name gets a suggestion (`Did you mean 'node'?`); tab completion covers the aliases.
  - `ssh` says why it cannot connect: unknown server, server unreachable, or shell not enabled on it (instead of "No servers with shell access are available"). Errors no longer end with "Process exited with code 1".
- **Saved state is no longer lost.**
  - `snippet save` after a reload replaced every saved snippet: the store was saved without being loaded first. Every command's store is now loaded before the command first runs (and at boot for commands with a `stateConfiguration`), and saving loads it first if needed.
  - Saved state is merged over `initialState`, so keys added in a later version are present for existing users. A store first read without defaults (the `configure` store, read by the boot report) gets its command's defaults when the command registers.
  - `getState()` returns a copy, as documented; `persist()` does nothing without storage instead of throwing.
- **State across terminals and tabs.** A store is still one saved state per browser, now safe to share: a save writes the keys this terminal changed (or changed in place), merged into what is saved under a cross-tab lock, so terminals changing different keys never overwrite each other; other terminals and tabs apply saved changes right away (`syncAcrossTabs`, on by default). New `scope: 'session'` for state that belongs to one terminal and is never saved.
- **State options:** `autoPersist` (save after every change), `version` + `migrate` (convert older saved state), `reload()`.
- **Atomic state changes.** `state.update(state => changes)` reads the latest saved state, applies the change and saves it under the cross-tab lock, so two tabs adding to the same list both keep their item. `todo`, `snippet`, `cron` and `alias` / `unalias` use it (adding a todo in two tabs at once used to lose one).
- **Per-user state.** New `scope: 'user'`: the store is saved separately for each user signed in to the terminal (users plugin) and switches when the user changes (`session:changed`). Signed out, it is shared like a global store.
- **Theme and font size follow other tabs.** `theme apply` and `font-size set` in one tab or terminal now change the others right away.
- **Unloading a plugin that adds sub-commands to another command** (`extendsProcessor`) removes only the sub-commands it added; the command itself stays. It used to remove the whole command, or nothing.
- **No more "Process exited with code 1" after an error message.** The line is shown only when a command fails without printing an error.
- **Help pages.** Over 40 more commands have a help page with usage and examples (`help grep`, `help cron`, `help server jobs stop`, …). On narrow terminals (phones) descriptions in `help` wrap at word boundaries instead of mid-word, and boxes (`writeBox`) wrap their content. The help helpers (`writeUsage`, `writeExamples`, `writeWrapped`, `writeHint`) are exported from `@qodalis/cli-core` for plugins.
- **Quotes and combined flags on the command line.** A quoted argument stays one argument (`grep "hello world" notes.txt`), keeps its spacing, and flags inside quotes are text (`echo "a --b"`). Values given after a flag lose their quotes (`find --name "my file.txt"`, `sort -t ','`). Short flags can be combined (`rm -rf dir`, `ls -la`) when each letter is a flag of the command.
- **Pipes and redirects show only the final output.** In `cat f | grep x` only grep's output appears, and `echo hi > f` prints nothing, as in a shell (every stage used to print). Errors and warnings of every stage are still shown. Tables, lists and key-value output are passed down a pipe as text, so `server list | grep node` works. A lone `-` is kept as an operand (`paste - b.txt`), `-n5` / `-f2` work like `-n 5`, and redirect targets can be quoted (`> "my dir/f.txt"`).
- **Redirects write whole lines.** `echo one > f.txt; echo two >> f.txt` gives two lines (it gave `onetwo`).
- **A server that stops is shown as disconnected at once** (`server:disconnected`, panel status, `server list`), instead of after about 30 seconds of event-socket retries.
- `diff` compares piped input: `echo "a" | diff --b "b"`.
- Translations for the `server`, `ssh` and `events` commands in all 10 language packs.
- **Services (DI):**
  - Unloading a module (`pkg remove`, `pkg update`) now removes everything it registered: its guards and permissions at once (a removed plugin's guards used to keep running, and ran twice after `pkg update`), then calls its `onDestroy` (it was only called when the whole terminal was destroyed), then removes its services. An overridden service becomes the previous one again. The users plugin also removes the services it registers at runtime.
  - `useClass` / `useFactory` providers are created on first use, so their `deps` can be registered after them; dependency cycles are reported.
  - Typed tokens: `createCliToken<T>(name)` makes `services.get(TOKEN)` typed without a type argument; the built-in tokens are typed. Plain string tokens still work.
  - `services.remove(token, provider?)`; created services with a `dispose()` method are disposed when the terminal is destroyed.
- **Boot completion is observable.** `CliEngine.isBooted` and `CliEngine.booted` (a promise), and `context.isBooted` for commands and plugins. Plugins loaded from scripts (`pkg`) are part of boot: the engine waits for them, setup prompts included (`CliModuleRegistry.whenIdle()`).
- **The greeting comes last.** The animated greeting is its own module and runs after every other `onAfterBoot` hook, so it no longer writes over setup or sign-in prompts, and stops by itself if other output appears.
- **Duplicated terminals look like the original.** Restoring a snapshot clears the terminal first; warnings printed by the new terminal's own boot no longer pile up above the restored screen.
- If boot fails, the error stays on screen and the terminal remains usable. `CliEngine.start()` is split into named phases and module boot into steps.
- **Typing right after the page loads works.** Keys typed while the welcome greeting animated (about 3 seconds) were silently dropped; typing now stops the greeting and is handled normally (`ICliTextAnimator.cancel()`).
- **Installing a plugin with a setup step no longer freezes the terminal.** After `pkg add users` finished its account setup, a spinner kept running and blocked all input; the boot spinner is now restored only when it was showing.
- **Sub-command aliases receive their value.** `pkg rm guid` (and any aliased sub-command that takes a value) failed with "Value required" because only the full command name was stripped from the input.
- **`pkg` command:**
  - `pkg remove` really unloads the plugin's commands, and `pkg update` loads the new version without a page reload. Both used to keep the old commands until the page was reloaded. Modules can now be unregistered through `CliModuleRegistry.unregister()` / `onModuleUnregister()`.
  - New aliases: `pkg rm` / `pkg uninstall`, `pkg install`, `pkg list`. `pkg add guid@<version>` installs a specific version.
  - `pkg check`, `pkg update` and `pkg browse` compare versions with semver including prerelease tags, so `2.0.0-beta.9` is older than `2.0.0-beta.18` and a newer installed version is never offered as an "update". `pkg update` with no name prints an updated / up-to-date / failed summary instead of always "All packages updated".
  - `pkg browse` probes all 40 official plugins (was 12) in parallel; `pkg check` checks packages in parallel; `pkg versions` uses the configured registry sources (e.g. Verdaccio) instead of always npmjs.org.
  - `pkg browse` no longer lists server packages (`@qodalis/cli-server-*`, the dashboard, the core library), which cannot be installed in the browser. Removing a plugin with protected commands (the users plugin) says that they disappear after a reload. Clearer errors for removing an uninstalled package and for unknown packages in `pkg versions`.
  - Extra spaces between names no longer produce an empty package name; help text columns are aligned. The processor is split into an installer, a search module and help helpers.

### Users (`@qodalis/cli-users`)

- User events (sign-in, sign-out, user and group changes) are also published on the event bus as `user:<type>` (`user:login`, `user:logout`, …), so other plugins can react without depending on the users plugin.

### Plugins

- **Typed tokens:** `IFileSystemService_TOKEN` (files), `IScpTransferService_TOKEN` (scp), `CliUsersModuleConfig_TOKEN` and `CliApiTokensService_TOKEN` (users) are created with `createCliToken`, so `services.get()` returns the right type.
- **Files** (`@qodalis/cli-files`), closer to Unix:
  - `cut -f 2` works (a plain number used to fail); `mv dir dir/sub` is refused instead of losing the directory; `echo "a > b"` prints the text instead of writing a file named `b`; `rmdir` removes directories (it always failed).
  - Quoted paths and patterns work everywhere (`cat "my file.txt"`, `grep "two words"`); combined flags (`rm -rf`, `ls -lah`, `cp -rf`, `grep -in`).
  - `cat`, `rm`, `mkdir` (`-p`), `touch` and `rmdir` take several paths; `cat` and `paste` read piped input; `sort` sorts several files together; `du` defaults to the current directory; `cp` and `mv` take several sources into a directory.
  - `wc -l` counts lines like Unix (a final newline is not an extra line); `head` / `tail` no longer print a blank last line, `tail -n 0` prints nothing.
  - `find`: `--maxdepth` counts from the start path (0 = the path itself), `--name` is case-sensitive, new `--iname`.
  - `sed`: `-n` and `p`, `&` and `\1`…`\9` in replacements, `-E`, several `-e`, `;`-separated commands, address ranges, `!`, `q`; `$` is the real last line.
  - `awk` accepts an unquoted program (`awk {print $1} file`) and several files. `xargs` passes the inner command's flags (`xargs rm -r`). `tee` writes whole lines and passes its input through. `tr` never reads a set as a file name with piped input, and supports `\n`, `\t`, `-d` and `-s` together.
  - Every file command has a help page.
- **Markdown** (`@qodalis/cli-markdown`): `md "# Title"` renders (it was "Command not found"); `\n` makes new lines; piped input is rendered.
- **Todo:** `todo add "buy milk"` stores the text without the quotes.
- **Server jobs** (`@qodalis/cli-server-jobs`):
  - With several servers, actions (`trigger`, `pause`, `resume`, `stop`, `cancel`) and `info` / `history` / `logs` apply to every server that has the job (they stopped at the first), with a note naming the servers; `edit` asks for `--server` when the job is on several. A job found on none of them is reported instead of printing nothing.
  - `watch` stops on Ctrl+C and when the servers close the connection, and cleans up its subscriptions (it never ended). `edit` can be cancelled at every prompt, and nothing is sent.
  - `server jobs stop` says "stopped" (was "stoped"); usage messages say `server jobs …`. Help pages for every sub-command.
- Tests for server jobs, 2048, minesweeper, snake, tetris and wordle.

### Docs site

- State Management: `update()` and `scope: 'user'`. Services: the typed plugin tokens.

- New "Using servers from the terminal" section on the Server Integration page (configuration, running remote commands, all `server` commands and aliases, troubleshooting); the Built-in Commands page lists the server commands.
- New "Event Bus" and "Services (DI)" pages under Core Concepts. The State Management page described storage that did not exist (`localStorage`, saving on every `updateState`); it now covers the options, several terminals and migrations.

### Angular (`@qodalis/angular-cli`)

- **Requires Angular 22 or later** (was 16.2). The package is built with Angular 22.2; Angular 19 is out of support and its security fixes (XSS sanitization bypasses, `HttpTransferCache` leaks, i18n XSS, router DoS) only ship for 20.3+, 21.2+ and 22.x.
- The panel works in zoneless apps, Angular's default since v21, as well as with zone.js. Its templates use the built-in `@if`/`@for` control flow.

### Security and tooling

- Patched every open Dependabot alert: the lockfile was regenerated, Electron moved from 35 to 44 (`@qodalis/electron-cli` and the desktop demo), Vite to 7.3.7, and `undici` under Nx and `uuid` under sockjs are overridden to their patched releases. Two stale npm lockfiles were removed.
- TypeScript 6.0, tsup 9 and TypeDoc 0.28 across the monorepo. tsconfig no longer uses the options TypeScript 6 deprecates (`baseUrl`, `downlevelIteration`, `node10` resolution): path mappings are relative and modules resolve with `bundler`.
- The Angular demo and the docs site run zoneless and no longer load zone.js.
- `nx serve demo-angular` and `nx serve docs` work again: an open-ended `path-to-regexp` override pulled version 8 into Express 4 (`pathRegexp is not a function`).
- Plugins created with `create-cli-plugin` point `umd`/`unpkg` at `umd/index.global.js`, the file the build actually writes (was `umd/index.js`).
- `@qodalis/cli-encode` and `@qodalis/cli-data-explorer` can be installed with `pkg add` again: their `unpkg` entry pointed at a file their build did not produce.
- The Electron demo starts again: tsup 9 writes `.cjs` files in an ESM package, and the demo now points at them. It also uses the mobile app's icon.

### Panel (`@qodalis/cli`, `@qodalis/react-cli`, `@qodalis/vue-cli`, `@qodalis/angular-cli`)

- **One panel implementation for all three frameworks.** Tabs, split panes, collapse/hide/maximize, position, drag resizing, menus, theme sync and the status bar now live in a framework-agnostic `CliPanelController` in `@qodalis/cli`, with shared icons, class names, labels and status/dropdown models. The React, Vue and Angular `CliPanel` components only render it, with unchanged props, events and `ICliPanelRef` methods.
- **Same features everywhere.** Angular gains the server-connections dropdown; React and Vue gain Escape to close menus or cancel a rename, and select the tab title when renaming. Double-clicking a tab to rename it no longer loses focus to the terminal. Tab dots show each tab's own activity in every framework (React and Vue only tracked the active tab).
- **Angular uses the shared `cli-panel.css`.** The private `collapsable-content` component and its stylesheets are gone; the panel uses the same `cli-panel-*` classes as React and Vue. Apps already load the stylesheet through `@qodalis/angular-cli/src/assets/styles.css`.
- `createCliEngine()`, `resolveCliHostConfig()` and `mergeCliOptions()` in `@qodalis/cli` replace the engine set-up each wrapper repeated (framework service, services, modules, processors, snapshot). Angular now registers its modules before its processors, like React and Vue.

## v2.0.0-beta.17

### CLI engine (`@qodalis/cli`, `@qodalis/cli-core`)

- **Readable on phones.** The default terminal font is 14px on viewports up to 640px wide (20px elsewhere), so a 390px screen gets about 37 columns instead of 26. A host's own `terminalOptions.fontSize` is no longer overridden at startup by the `font-size` and `configure` defaults: both apply a size only after the user picks one, and `font-size reset` returns to the host's size.
- **Tables fall back to one block per row** (`KEY : value`) when the columns would be cut to a few letters or wrap (`listusers`, `audit`, `sessions`, `ps`, …); unlabelled columns such as `(current)` print as notes.
- `help`, `help <command>` and `theme list` put descriptions on their own line in narrow terminals instead of wrapping mid-word; `theme list` uses compact swatches there.
- **Environment variables work across the system**: `USER`, `HOME` and `PWD` follow the signed-in user and the current directory (they were fixed to `user`, `/home/user` and `/`); variables set with `export` or `NAME=value` and removals with `unset` are saved per user and restored on the next visit, and `su`/`login` switch to that user's variables; `export A=1 B="two words"` sets several at once and `unset A B` removes several; `~` and `~/…` expand to `$HOME` and `$?` to the last exit status.
- A yes/no prompt answered with Enter shows the default it took (`(Y/n): y`).
- Picker summaries read `✔ Groups: admin, users` (the colon was missing), and prompts that already end with `:` no longer show `::`.
- The collapsed panel tab is icon-only on phones so it covers less of the page.

### Users (`@qodalis/cli-users`)

- `adduser`: when no group is picked, it says the user joins the default group `users` (the summary used to say `none`).

### Docs site

- No page scrolls sideways on phones: wide tables and code blocks scroll inside themselves.
- The header fits on one line on phones, the sidebar button no longer covers the page title, and the live terminals have inner padding.
- The command lists and examples used commands that do not exist (`config set/get/list/delete`, `pkg list`, `theme set/get`); they now show `configure …`, `pkg ls`, `theme apply` and `theme current`.
- New "Environment variables" section on the Built-in Commands page.

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
