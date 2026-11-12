# Change Log

This document records all notable changes to the [Qodalis CLI](https://cli.qodalis.com/docs/) ecosystem.
This project adheres to [Semantic Versioning](https://semver.org/).

## Unreleased

### `server add` knows servers it already has

- Adding a server the app already configures (the same URL, whatever the name) stops with `… is already configured by the app as '<name>'`.
- Adding a server that is already linked says `… is already linked as '<name>'` and links it again only when you confirm, replacing the old entry and its token (keeping its name when you give none). URLs are compared normalized (scheme and host case, a trailing slash).

## v2.5.1

### Panel scrolling on phones and over the panel chrome

- A finger drag over a terminal scrolls its scrollback and glides on after a swipe; the page behind no longer scrolls instead (xterm.js has no touch scrolling, so in the panel on a phone the page moved and the terminal never did). A tap still focuses the terminal and opens the keyboard; a scroll never opens it. Paused while a full-screen command runs. `CliEngineOptions.touchScroll: false` turns it off for hosts that scroll the terminal themselves.
- The mouse wheel over the panel header, icon strip and tab bar no longer scrolls the page; the tab bar and menus still scroll themselves.

## v2.5.0

### Job tags in `server jobs`

- `server jobs list --tag <tag>` (repeatable or comma-separated) lists only the jobs that have every tag, ignoring case. The tags go to the server as `?tag=`; the list is filtered in the CLI too, so a server without job tags lists nothing for a tag instead of every job.
- `list` shows a Tags column when a job has tags, `info` a Tags row, and `edit` asks for the tags (comma-separated, `-` clears them). Needs servers with job tags (the next server release).

### Server commands get the same help as web commands

- Server commands show their own documentation and examples in `help <command>`, keep their aliases, and are listed under their own module and icon. They need servers with command metadata (the next server release). Help names the server a command runs on. Commands from older servers look as before.
- `ICliCommandParameterDescriptor.allowedValues` (core) works for every command: help lists the values and Tab completes them after `--name ` and `--name=`. Server commands also refuse other values before sending, ignoring case.
- `ICliCommandParameterDescriptor.examples` (core): example values of a parameter, listed in help after its description (`e.g. Paris, New York`). Server commands get them from the servers' parameter `examples`.
- A server alias is added as a bare name only when no local command owns it. `node:<alias>` always works.

### Data explorer: read-only sources and export permission

- The `data-explorer` source list and header show `read-only` for sources the server marks read-only (servers from 1.0.0-beta.25 make every source read-only unless it sets `readOnly: false`).
- `\format json` and `\format csv` print `Export is not allowed on this source` when the server reports `canExport: false` for the user, and such a source starts in table output.
- Refused queries show the server's message (missing source permission, too many queries) instead of the HTTP status.
- A query that uses a masked column other than by its own name (`masked_column`) shows the server's message and the hint `Select masked columns by their own name, or use SELECT *`.

### Connect your own server: `server add`

- `server add [name] [url]` links a Node, .NET or Python server to the terminal in any app, kept across reloads. It checks the server (version, OS, shell), then links it by **browser approval** (the terminal prints and opens the server's `/qcli/admin/link?code=…` page; the user signs in, compares the code and approves; servers from 1.0.0-beta.25), a pasted **API token** (`--token` for scripts) or a **user and password** (an API token is created for the device and the session ends). `server edit <name> --url|--token`, `server remove <name>` and `server forget-all` change and unlink linked servers; `server list` has a Source column (`app` or `linked ••••abcd`).
- Tokens are kept apart from the server list, encrypted with AES-GCM by a non-extractable Web Crypto key in IndexedDB, never shown again, redacted from the command history (`--token ***`) and never put in WebSocket URLs. Hosts provide their own store (`ICliSecretStore_TOKEN`) for platform storage.
- Only https servers can be linked; http for localhost and private addresses after a confirmation, with a mixed-content warning. `CliOptions.userServers` turns linking off (`false`) or limits it to origins (`{ allowedOrigins }`); app servers cannot be removed, edited or replaced from the terminal.
- `CliServerManager.addServer` / `removeServer` connect and drop a server while the terminal runs.

## v2.4.2

### Stop the running command from the panel

- While a command runs, the panel's status shows a **Stop** button next to "running" (the compact side-position indicator stops it on a tap). It interrupts the command exactly as Ctrl+C does: a watch such as `events watch` ends, `Ctrl+C` is written and the prompt returns. Hosts on a phone browser had no way to send Ctrl+C; the Android app's `^C` key already did. Rendered by the Angular, React and Vue panels.
- `ICliExecutionContext.interrupt()` runs the same Ctrl+C path from code.

### The game plugins moved to their own repository

- `@qodalis/cli-2048`, `-minesweeper`, `-snake`, `-tetris`, `-wordle` and `-sudoku` are now built, tested and published from [qodalis-solutions/cli-games](https://github.com/qodalis-solutions/cli-games), with their history. The npm names, module exports and commands are unchanged; from 2.4.2 the games take `@qodalis/cli-core` as a peer dependency. The demos and the docs site install them from npm (`^2.4.2`). web-cli builds 34 plugins, so its builds and CI runs are shorter.

## v2.4.1

### Stop background services from the panel

- The panel's Background Services dropdown shows a **Stop** button on every running service. It stops the service the way `kill <pid>` does, the list updates in place and the dropdown stays open. On a phone, where there is no Ctrl+C, the services indicator opens the dropdown on a tap and the button is sized for touch. The button comes from the shared panel rows, so the Angular, React and Vue panels all have it.

### Fixes

- A skipped welcome banner (`once` or `daily` after the first time, `never`, or `welcome: false`) left two empty rows above the first prompt, and a shown banner started two rows down. The boot hid a spinner it had never shown, and the boot log replayed the clear-line control codes as output written during boot.

## v2.4.0

### Server events in the `events` command

- `events watch` and `events log` show the events of the connected servers next to the terminal's own: job runs, changes to users, groups, tokens and files, sign-ins and more. They match by the server's own type (`events watch job:*` follows the jobs of every server), and each line names the server and the time the server sent it, with the fields as `key=value`.
- `--server <name>` keeps one server's events, `--local` only the terminal's own. `server:*` still matches every server event.
- Server events stay wrapped in `server:event` on the bus, so a server's `user:*` or `session:*` events never reach plugins that listen for the terminal's own. Each server sends only the events the signed-in user may see (servers 1.0.0-beta.23).

### `server jobs`: max concurrent runs

- `server jobs info` shows a job's max concurrent runs and the runs going now (`2/3 running, 1 queued: <ids>`); `server jobs edit` asks for it (a whole number of at least 1). Servers 1.0.0-beta.23 run up to that many runs of a job at once; the overlap policy decides when they are all busy.
- Intervals and timeouts show as `30s`, `5m`, `1h` whatever form the server sends: Python sends spans such as `30s`, which `info`, `list` and `edit` showed as `30sms`.

## v2.3.0

### The `theme` command works with a host theme

- `theme apply`, `theme random`, `theme set` and `theme import` now work in a panel or terminal whose host sets a `theme`. In React the panel re-applied the host theme on every re-render, so the chosen theme was undone at the next status update.
- The host's theme is the default, and a theme the user applies wins over it: it is saved and restored on the next start, and the panel's header, tabs and menus take its colors. `theme reset` returns to the host's theme, which follows the host's light/dark setting again. Before, a host theme kept the saved theme from being restored.
- The panel picks up the user's saved theme as soon as the terminal opens; before, it waited until the terminal had connected to its servers.
- `theme` and `font-size` keep each terminal's own default. Both commands are shared by every terminal on a page, so `theme reset` and `font-size reset` could return to another terminal's theme or size. The `theme` command also repainted the background of every terminal on the page instead of only its own.

### A new look for the panel

- The header is one compact 48px bar: the terminal glyph sits on an accent tile, the status (run state, services, last command, servers, uptime) reads as one capsule, and the buttons are rounded squares; the close button turns red under the pointer.
- Tabs are chips: the active tab takes the terminal's background, and a tab's close button shows on the active tab and under the pointer. The `+` button is a plain icon button.
- The terminal has room to breathe: padding around the text, and xterm's black viewport no longer shows through it. The active pane is marked only when a tab is split.
- The panel has rounded corners on the side facing the page and a softer, deeper shadow; buttons and tabs show a focus ring for keyboard users.
- `--cli-panel-header-size` sets the header's height (its width when docked left or right); `--cli-panel-radius` defaults to 8px.

### A light theme that is easier on the eyes

- The `light` terminal theme and the light panel palette use a soft grey background (`#f7f8fa`) instead of pure white, slate text instead of near-black, and calmer colors; every color reads at 4.5:1 or more on the background, so yellow warnings and dim hints stay legible.

### Fixes

- The terminal no longer starts wider than its panel when a saved font size (`font-size set`) is restored: the terminal refits whenever its cells change size, also when a web font arrives late.
- React: the panel's `color-scheme` (light or dark scrollbars and form controls) is applied; React dropped the kebab-case style key with a warning.

## v2.2.0

### Panel themes: light, dark, auto and your own colors

- `theme` option on the panel (`CliPanelConfig.theme`) and on any terminal (`CliOptions.theme`): `'dark'` (default), `'light'`, `'auto'` (follows `prefers-color-scheme`, live), the name of a terminal theme (`'dracula'`, `'nord'`, ...; the panel's colors are derived from it) or a `CliPanelTheme`: a `base` palette with your own `colors` (background, header, border, text, secondary text, accent, hover, active, danger, shadow), `terminal` colors, `fontFamily` and corner `radius`. It styles the header, tabs, hide tab, dropdowns, context menu and every terminal in the panel.
- The host can change it at any time: a re-render (React), reactivity (Vue), a new `options` object (Angular) or `setTheme(theme)` on the panel ref (`ICliPanelRef.setTheme`) restyles the panel and its open terminals, so the panel follows an app's own light/dark setting. With a host theme, the theme saved with the `theme` command is not restored on start (the command still works for the session).
- New built-in terminal theme `light`, the counterpart of `default`; `CliEngine.setTheme(theme)` restyles one terminal.
- `resolvePanelTheme`, `derivePanelColors`, `CliPanelPalettes` and `colorSchemeOf` in `@qodalis/cli-core` for hosts that style other parts of the page to match.
- The default (dark) look is refreshed: the panel's background matches the terminal, quieter borders and secondary text. Every color, the chrome font (`--cli-panel-font`) and the corners (`--cli-panel-radius`) are CSS variables now, including the danger color and shadows; without a `theme` option, stylesheet overrides of the variables keep working.
- The context menu and the services/servers dropdowns, which render outside the panel, now take the panel's colors and font instead of staying dark.

### The panel on phones and tablets

- The panel resizes with touch: dragging the grip uses pointer events (it only listened to the mouse before), the grip is larger on touch screens and shows while the panel is open. Pane dividers work with touch too.
- With the on-screen keyboard open, the panel moves above it and fits the visible area (it follows `visualViewport`), so the prompt stays in view while typing. Before, browsers that open the keyboard over the page hid the bottom of the panel. In app WebViews that resize instead, the panel shrinks with the page.
- The panel is never taller than the space it has, and stays below the status bar of apps that draw under it (`safe-area-inset-top`).
- `--cli-panel-bottom-offset`: a host that docks the panel above its own bottom bar sets this variable (e.g. to the bar's height) instead of overriding `bottom`; the panel and its hide tab sit on the bar, move above the keyboard when it opens, and size to the space between. **Upgrading**: replace a `bottom` override of `.cli-panel-wrapper` / `.cli-panel-hide-tab` with the variable, or the panel can no longer avoid the keyboard.
- Up to 600px wide, the header shows only the run state next to the title, so the title is no longer squeezed by the other status items.
- A panel remounted with the same controller (React StrictMode) follows the viewport and the system color scheme again.

## v2.1.1

### The panel on phones and in apps that sign in

- A panel that starts hidden (`isHidden: true`) opens with its terminal on the first click of its tab; it used to open collapsed and needed a second click. A panel hidden after use still comes back the way it was.
- On screens up to 600px wide the panel header stays on one line: a long title ends in an ellipsis, the buttons are smaller and the position button is left out.
- The welcome banner wraps at words on a narrow terminal instead of breaking words at the edge, and the greeting typed after the prompt is cut to the line, so its backspaces no longer leave text behind on the next row.
- `welcome: { show: 'once' }` (and `'daily'`, `'never'`) works again: the default that `configure` stores, `'always'`, no longer overrides the host's option. A value chosen with `configure set system.welcomeMessage` still wins.
- A server that answers `/commands` with 401 or 403 before the app's sign-in has given the CLI a token is reported as "needs a sign-in" in the log, not as an unavailable server with a warning; its commands load once the users plugin reconnects with the token (`CliServerConnection.needsSignIn`).

## v2.1.0

### Your own name and icon on the CLI

- `branding` option (`CliBranding` in `@qodalis/cli-core`): the `name` and `icon` an application ships the CLI under (`{ name: 'RateBell CLI', icon: '/favicon.svg' }`). The name replaces "Web CLI" and the Qodalis CLI art in the welcome banner and the startup log, and "CLI" in the panel's header and hide tab (React, Vue, Angular); the icon (an image URL) replaces the panel's terminal glyph. The copyright line, the documentation link and `version` stay Qodalis CLI's; `version` adds the name as an `App` row. Without it nothing changes.

## v2.0.1

### Server WebSockets keep tokens out of URLs

- Server `headers` are no longer copied into WebSocket URLs as `_header_<name>` query parameters, where tokens ended up in access, proxy and CDN logs and in browser history. When no auth module handles the server, the client fetches a single-use ticket from `POST /api/v1/qcli/sessions/ws-ticket` with the headers and connects with `?ticket=`; a server without that endpoint gets an unauthenticated socket and a one-time console warning. Applies to server events, `ssh`, `server logs` and `server jobs` (`buildServerWebSocketUrl` in `@qodalis/cli-core`).
- **Upgrading**: a server that authorizes sockets from `_header_Authorization` (a shell token without the users plugin) needs `unsafeHeadersInWebSocketUrl: true` on its server entry. The option is deprecated; use the users plugin's tickets instead.

### Server commands hidden by local commands

- A server command whose name a local command or alias already has (the users module's `listusers`, alias `users`, hides a server `users`) is reported once: `Server command "users" from "ops" is hidden by local "listusers"; use "ops:users".` `server info <name>` lists the hidden commands, `help <command>` of the local command names them, and `CliServerManager.hiddenCommands` returns them.

### Paged server output

- Server tables can carry `page: { skip, take, total?, hasMore, truncated? }` (`CliServerTablePage` in `@qodalis/cli-core`). The terminal prints `Rows 51–100 of 1987 · next: <command> --skip 100` under a paged table, and a warning when the server cut a table from a command that does not page. Servers (Node, .NET, Python) add the `--skip` / `--take` convention, a paged table writer and a `maxTableRows` cap (default 200); see [Paging long results](https://cli.qodalis.com/docs/server-integration#paging).

## v2.0.0

The first stable release of the 2.0 line: the same packages as 2.0.0-rc.4. Upgrading from 1.x: see [Upgrading to 2.0](https://cli.qodalis.com/docs/migration). The sections below list every change since 1.0.39.

- **Framework-agnostic engine**: `@qodalis/cli` runs the terminal in any page (`CliEngine`); `@qodalis/angular-cli`, `@qodalis/react-cli` and `@qodalis/vue-cli` wrap it with a terminal and a collapsible panel, and `@qodalis/electron-cli` adds native dialogs, clipboard and file transfer.
- **Modules**: commands are registered through `ICliModule` (the `modules` input/prop, `resolveCliModuleProvider()` or `engine.registerModule()`), with lifecycle hooks, dependencies, configuration and translations; the deprecated processor-only APIs are gone.
- **Plugins**: 40 plugins as framework-free packages, among them a virtual file system with `nano`, users with groups, permissions and audit, a data explorer, server logs and jobs, games and 10 languages.
- **Servers**: Node, .NET and Python servers run commands remotely, stream output and shells, and expose an MCP endpoint and API tokens; `@qodalis/mcp-cli` connects Claude Code to a server and helps build plugins.
- **Touch screens**: full-screen commands declare their keys (`controls`) so phone apps show them as buttons.
- **Tooling and docs**: `@qodalis/create-cli-plugin`, a docs site with a playground, `llms.txt` for AI assistants and runnable starters for Angular, React, Vue and vanilla TypeScript.

## v2.0.0-rc.4

Keys for touch screens, tab completion after flag values, and a session lifetime option for local users.

### Command controls for touch screens

- `ICliCommandProcessor.controls` (`ICliCommandControls` in `@qodalis/cli-core`): the keys a full-screen command reads, each with a label, the data it sends to `onData`, its usual key and a description, plus whether the command reads typed text (`textInput`), what a tap sends (`tap`) and whether swipes send arrows (`swipe`). Hosts on touch screens show them as buttons; `CliKeyData` has the common key sequences and `ctrl(letter)`.
- Declared by every full-screen command: `nano` (Save, Exit, Find, Cut, Paste, Help, navigation), `htop`, `ssh`, `data-explorer`, `stopwatch` and its `timer`, and the games (tetris, snake, 2048, minesweeper, sudoku, wordle).

### Users (`@qodalis/cli-users`)

- `maxSessionLifetime` (local mode): how long a session lasts before signing in again, in ms; `0` keeps it until sign-out (default 12 hours, as before). Apps on a personal device, such as the phone app, can keep their owner signed in.

### Docs

- The privacy policy covers the phone app's local user account (stored on the device, password as a salted hash) and how to delete it (`#delete-account`), and lists its install-time permissions.
- The AI guide documents `controls` for full-screen commands.

### CLI engine (`@qodalis/cli`)

- Tab completion reads a line the way the executor does: the value of a flag (`--sides 6`, `-s 6`) is not taken for a sub-command, so `dice roll --sides 6 --` completes the flags of `dice roll` (the parent command's flags included) and `dice --seed 42 r` completes its sub-commands; both found nothing before. A flag's value is not completed with sub-command names.

## v2.0.0-rc.3

Dependency cleanup and build fixes; no changes to the packages' APIs.

- Unused dependencies removed: `@microsoft/signalr`, `@xterm/addon-webgl` and `@nx/js` from the workspace, and the Vite template ESLint packages from the React demos. `eslint-plugin-react-hooks` is declared where the ESLint config imports it.
- Electron 45 for `@qodalis/electron-cli` development and the Electron demo (the package still accepts `electron` >= 28); sass 1.106, concurrently 10.
- Builds: specs wait for the builds of the packages they import, and every app declares the `@qodalis` packages it imports, so building only affected projects (as CI does) no longer misses them. A files spec that depended on the order of the other specs is deterministic.

## v2.0.0-rc.2

Second release candidate: fixes found while testing rc.1, plugin-development help for AI assistants, and rewritten READMEs. No API removals.

### CLI engine (`@qodalis/cli`)

- `--flag value` works on sub-commands and on commands that take no value: `dice roll --sides 6` ran as "Command not found: dice roll 6", since the value was read as a sub-command (only `--sides=6` worked). Flags of the parent command are read on its sub-commands too (`dice --seed 5 roll`). A word after a flag that takes a value is now always that flag's value.

### Plugins

- `@qodalis/cli-password-generator`: passwords are drawn with `crypto.getRandomValues` (was `Math.random()`), without modulo bias.
- `@qodalis/cli-string`: `includes`, `startsWith` and `endsWith` fail with "--find is required" instead of matching the empty string; piped data that is not text (e.g. the array from `csv to-json`) is used as JSON instead of failing with "toUpperCase is not a function".
- `@qodalis/cli-encode`: `rot --shift=0` leaves the text unchanged (it fell back to 13).
- `@qodalis/cli-scp` and `upload` (`@qodalis/cli-files`): without a file transfer service they say so instead of throwing.

### Plugin scaffolding (`@qodalis/create-cli-plugin`)

- Standalone plugins depend on `@qodalis/cli-core` of the same version (was `^0.0.16`), install with pnpm 12 (a `pnpm-workspace.yaml` allows esbuild's build script), and publish their build: `main`/`module`/`types`/`umd` point into `dist/`, which is published (`files`). The UMD bundle is `umd/index.global.js`, as `package.json` says.
- Monorepo plugins are registered in `angular.json`, so `nx test <plugin>` runs, with the path alias `./dist/<name>`.
- Standalone plugins get an `AGENTS.md` for AI coding assistants; `--version` prints the package version.
- `@inquirer/prompts` 8.

### Build plugins with AI

- **llms.txt** and **llms-full.txt** at https://cli.qodalis.com: a plugin development reference for AI assistants (web plugins; Node, .NET and Python server plugins; recipes), generated from `docs/ai/*.md` at docs build time.
- Docs page **Build plugins with AI** (`/docs/ai-plugin-development`): the developer tools of `@qodalis/mcp-cli` 0.2 (docs search, API declarations, plugin scaffolding, prompts; no server needed), `llms.txt` and `AGENTS.md`.
- `AGENTS.md` in the repository for AI coding agents.

### Docs and READMEs

- The README links the runnable starters for Angular, React, Vue and vanilla TypeScript (StackBlitz, CodeSandbox, Gitpod).
- Every README rewritten against the current API: the root README (also the npm page of core, cli and the framework wrappers), the core packages, `create-cli-plugin`, all 40 plugins (16 had none, including the language packs) and a new one for `@qodalis/electron-cli`. Wrong commands fixed on the way (`server jobs`, `server logs`, `md`). `DEVELOPER.md` brought up to date.
- Docs: Encode plugin page; the Create a Plugin page lists the right build output (`dist/public-api.*`); `nano` is shown as the core command it is.

### Packaging and dependencies

- `@qodalis/electron-cli` is published to npm (its build was never copied into `dist/` for publishing).
- Security advisories closed: `electron` 44.9.1; overrides for `fast-uri` (>= 3.1.9), `serialize-javascript` (>= 7.1.3) and `body-parser` (1.20.9 / 2.4.0). `pnpm audit`: no known vulnerabilities.
- Nx 24.0.1, ng-packagr 22.2.5, jasmine-core 5.13; Dependabot skips `@types/node` majors (types follow the Node 22 runtime).

## v2.0.0-rc.1

Release candidate for 2.0.0: the API is frozen, only fixes go in until 2.0.0. Upgrading from 1.x or an earlier beta: see [Upgrading to 2.0](https://cli.qodalis.com/docs/migration).

### Breaking: deprecated APIs removed

- `@qodalis/cli-core`: `ICliUmdModule` (use `ICliModule`) and `bootUmdModule()` (use `bootCliModule()`; `window.cliCore.bootUmdModule` is gone too).
- `@qodalis/cli`: `CliEngine.registerProcessor()` / `registerProcessors()` (wrap the processors in a module and use `registerModule()`), `NumberInputOptions` (use `CliNumberOptions` from core), `CLi_Name_Art` (use `getCliNameArt(cols)`), and `processors` in `CliHostConfig` / `createCliEngine()`.
- `@qodalis/angular-cli`: `resolveCommandProcessorProvider()` (use `resolveCliModuleProvider()`), `CliCommandProcessor_TOKEN` (use `CliModule_TOKEN`), and the `processors` input of `<cli>` and `<cli-panel>`. `resolveCliModuleProvider()` now only provides the module; its processors are no longer also provided one by one.
- `@qodalis/react-cli` and `@qodalis/vue-cli`: the `processors` prop of `Cli`, `CliPanel`, `CliProvider` and `CliConfigProvider` (use `modules`).
- `CliEngine.registerService()` stays (no longer deprecated): it registers a service before any module boots, as the framework wrappers do.

### Docs site

- New page **Upgrading to 2.0** (`/docs/migration`): packages, registering commands through modules in each framework, every removed or renamed API with its replacement, and the server versions to use.
- READMEs register commands through modules and use the `welcome` option (they still showed `registerProcessors()`, the `processors` prop and the removed `welcomeMessage` option).

### Dependencies

- ESLint 10, ngx-translate 18 (the docs app uses `provideTranslateService` and the standalone pipe), xterm.js updates, Nx and Angular updates, commander 15.
- Overrides for open advisories: `dompurify` >= 3.4.17, and the `vite` of `@angular/build` ^8.3.3.
- `@qodalis/cli-core` specs run with the esbuild Karma builder.

## v2.0.0-beta.21

### Docs site

- **Playground** (`/docs/playground`): write a command processor or module in TypeScript in a Monaco editor (autocomplete and type errors from the real `@qodalis/cli-core` types) and the terminal next to it is rebuilt with your code after every change, then runs the commands you list. The page uses the full window width, and the editor keeps the keyboard while the terminal is rebuilt. Five starting points (a command, sub-commands, prompts, progress and cancelling, a module); code is kept in the browser and **Copy link** shares it in the URL. Runnable TypeScript examples in the docs get a **Playground** button that opens them there, with their missing `@qodalis/cli-core` imports added. The editor is loaded only on that page: other pages are unchanged.
- Code examples keep their own indentation (the beta.18 template migration had re-indented 97 of them); CI checks it (`tools/check-docs-code-blocks.js`).
- The `GreetProcessor` example on Command Processors works as written: it sets `acceptsRawInput` (without it `greet Ada` is "Command not found") and gives its parameter a `type`.

### CLI engine (`@qodalis/cli`)

- `CliEngine` option `welcome`: `false` starts with just the prompt, without the banner and the animated greeting (`start()` no longer waits about 4 seconds for the greeting to type out); an object configures the banner like `welcomeModule.configure()`.
- `CliEngine` option `autoFocus`: `false` leaves the keyboard where it is when the terminal starts (it always focused itself).

## v2.0.0-beta.20

### Users (`@qodalis/cli-users`)

- **`su` works like Unix: sessions nest.** `su bob` keeps your session open and switches to bob; `exit` (new, the same command as `logout`) ends bob's session and returns to you, with any number of levels. `login` still replaces every session (like `exec login`). The stack survives a reload, sessions under the current one are kept alive while you work, and ones that ended meanwhile (expired, kicked) are skipped on `exit`. Works in local mode and against the .NET, Node and Python servers, with no server changes.
- `su -c "<command>" <user>` runs one command as the user, switches back and exits with that command's status. `su - <user>` is accepted.
- `exit` and `logout` while signed out say `not logged in` instead of `login required`.

### CLI engine (`@qodalis/cli`)

- **Command history is per user**, like `~/.bash_history`: each signed-in user has their own, and `su`/`exit` switch to it. While nobody is signed in, and always without the users module, the shared history is used as before. The first user to sign in after upgrading takes over the existing history.
- **Line editing keys:** Home/End and Ctrl+A/E move to the start/end of the line, Ctrl+U and Ctrl+K cut to the start/end, Ctrl+W and Alt+Backspace cut the previous word, Ctrl+Y pastes the last cut, Delete and Ctrl+D delete the character under the cursor. They work at the prompt and in `readLine` prompts. Home, End, PageUp and other function keys no longer insert their escape sequences as text.
- `CliTestHarness`: `context.userSession` is live, so commands run by a command (`su -c`) see session changes, as in the engine.

### Files (`@qodalis/cli-files`)

- The saved current directory and home are only the signed-out ones: a signed-in user's directory is no longer left behind for whoever uses the browser next (or for an app without the users module).

## v2.0.0-beta.19

### CLI engine (`@qodalis/cli`)

- **Switching to a language pack installed at runtime works.** After `pkg add @qodalis/cli-lang-de`, `configure set system.language de` was refused ("Valid options: en"): the language choices were only refreshed by the interactive `configure` menu. They now come from the loaded language packs on every `configure` command; the choice applies at once and is kept after a reload.
- The descriptions of `--help`, `--version` and `--context` in help pages are translated (all 10 language packs).

### Docs site

- **Moving between plugin pages updates the page.** Going from one plugin to another (users → todo) changed the heading but kept the previous plugin's code blocks and try-it terminal. The browser tab title also follows in-app navigation (it kept the first page's title).
- Language packs: how to install one in a running terminal and switch to it (`pkg add @qodalis/cli-lang-es`, `configure set system.language es`), on the Language Packs page and on each language pack's page.

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
- **Cross-tab sync no longer loses a change.** A sync message from another tab that arrived late, or while this tab was saving, replaced the newer value in memory (saved data was right; the tab showed an old value until reloaded). Stores now read the saved state when another tab saves, and only this terminal's own edits count as unsaved.
- **Variables for the terminal, the user and everyone.** `NAME=value` is for this terminal only (as in a shell; it used to be saved), `export NAME=value` is saved for the signed-in user, and the new `export --global NAME=value` is shared by every user (permission `system:env:global` with the users plugin; admins have it). The terminal's value wins over the user's, the user's over the shared one. `export NAME` saves a terminal variable, `unset --global` removes a shared one, and `env` shows where each value comes from. Saving applies each change to the latest saved variables under the cross-tab lock: two tabs, or two users in two tabs, used to overwrite each other's variables. `CliEnvironment.onChange` now receives one change at a time (`applyEnvironmentChange` applies it).
- **Scripts with control flow.** `sh`, `source` and `./script.sh` support `if` / `elif` / `else`, `for … in`, `while`, `until`, `break` / `continue`, `exit`, `;` on one line and `\` line continuation, with syntax errors reported by line (`sh: line 4: syntax error: expected 'fi'`). New `test` / `[ … ]` (strings, numbers, `-e` / `-f` / `-d` paths), `true` (`:`) and `false`. Ctrl+C stops a script; a `while` stops after 10000 rounds. `grep` exits 1 when nothing matches (2 on errors) and has `-q`, so `if grep -q …` works.
- **Loops and conditions at the prompt.** A line starting with `if`, `for`, `while` or `until` runs like a one-line script (`for f in *.md; do wc -l $f; done`); a failing command does not stop the loop, as in an interactive shell.
- **`eval` gets the line as typed** (`literalInput` in a processor's metadata): `>`, `|`, `&&`, `$` and wildcards in its code are no longer treated as shell syntax.
- **Command substitution.** `$(command)` and backticks are replaced by the command's output (`echo "Today is $(date)"`, `COUNT=$(cat log | wc -l)`), nested too; not inside single quotes.
- **Brace expansion and `**`.** `touch app.{ts,html}`, `mkdir day{1..7}`, `{a..e}`, `{01..10}`, `{0..20..5}`; `cat **/*.md` matches at any depth (not inside dot folders).
- **Backslash escapes.** Outside quotes a backslash keeps the next character (`cat my\ notes.txt`, `echo \$HOME`); inside double quotes it escapes `"`, `\`, `$` and `` ` ``; operators after a backslash are text (`a\|b`).
- **Fixes found while moving commands to shell-split arguments:** `alias ll="ls -la"` works (it never reached the command); `history search <text>` searches (the query was always empty); `theme set` / `theme random` read their argument; `localStorage get` / `remove` read the right key and keep its case; `guid compare` / `validate` accept UUIDs containing `d`, `i`, `n`, `r` or `u` (they were stripped); `users adduser "carol"`, `snippet run k="a b"`, `events emit type '{"a":1}'` and `csv` / `chart` with quoted fields work. Unquoted extra spaces are collapsed as in a shell (`string length a   b` counts `a b`); quoted text keeps them. Core exports `unquoteRawArgument` for code and JSON arguments.
- **Commands get their arguments split like a shell:** `command.positionals` (`cat "a b.txt" c` gives `['a b.txt', 'c']`), so commands no longer each strip quotes their own way. Core exports `splitShellWords`, `joinShellWords` and `quoteShellWord`. The servers accept `positionals` too.
- **Wildcards.** With the files plugin, `*`, `?` and `[...]` in unquoted arguments become the matching paths (`rm *.log`, `cat docs/*.md`, `ls */`), as in a shell: dot files only for a pattern starting with `.`, a pattern without matches is kept as typed, quoted patterns are never expanded.
- **Variables and quotes.** `$VAR` is not expanded inside single quotes, and an apostrophe inside double quotes or without a pair (`echo "it's $HOME"`, `echo it's $USER`) no longer stops the expansion of the rest of the line.
- **`echo` prints its arguments like a shell:** `echo "a" "b"` prints `a b` (was `a" "b`), and words that look like flags are printed (`echo hello --world`, or a variable holding `--x`); they used to disappear. The servers' `echo` behaves the same.
- **Tab completion with spaces.** Paths with spaces are completed in quotes (`cat my` + Tab gives `cat "my notes.txt"`), also inside a quote already typed; path completion covers every file command (`sort`, `cut`, `du`, `sed`, …).
- Redirect errors name the target: `> /nope/f.txt: No such file or directory` (was `> failed: touch: /nope: ...`).
- An unreachable server is detected with one request instead of two, and logs one warning instead of two.
- `CliTestHarness` runs the processors' `initialize()` before the first `execute()`, links sub-commands to their command and gives each processor its own state store, as the engine does.
- **Redirects write whole lines.** `echo one > f.txt; echo two >> f.txt` gives two lines (it gave `onetwo`).
- **A server that stops is shown as disconnected at once** (`server:disconnected`, panel status, `server list`), instead of after about 30 seconds of event-socket retries.
- `diff` compares piped input: `echo "a" | diff --b "b"`.
- **`events` respects permissions.** `events log` and `events watch` show `user:*` events only to those with `audit:read`, and those events no longer carry the user's email or extra data. `events emit` refuses the system's own namespaces (`boot`, `command`, `config`, `module`, `package`, `server`, `service`, `session`, `user`), so `session:changed` can no longer be faked from the terminal.
- `isExecuting` no longer stays on when a nested command (a script or `$(…)`) finishes before the outer one.
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
  - `tr` and `tee` read only piped input, as in Unix (`cat f | tr a-z A-Z`); a file operand is an error instead of being read.
  - `cat`, `rm`, `mkdir` (`-p`), `touch` and `rmdir` take several paths; `cat` and `paste` read piped input; `sort` sorts several files together; `du` defaults to the current directory; `cp` and `mv` take several sources into a directory.
  - `wc -l` counts lines like Unix (a final newline is not an extra line); `head` / `tail` no longer print a blank last line, `tail -n 0` prints nothing.
  - `find`: `--maxdepth` counts from the start path (0 = the path itself), `--name` is case-sensitive, new `--iname`.
  - `sed`: `-n` and `p`, `&` and `\1`…`\9` in replacements, `-E`, several `-e`, `;`-separated commands, address ranges, `!`, `q`; `$` is the real last line.
  - `awk` accepts an unquoted program (`awk {print $1} file`) and several files. `xargs` passes the inner command's flags (`xargs rm -r`). `tee` writes whole lines and passes its input through. `tr` never reads a set as a file name with piped input, and supports `\n`, `\t`, `-d` and `-s` together.
  - `xargs` quotes each input item, so items containing spaces, `;` or `*` are passed as one argument instead of becoming new commands or wildcards. `mv a a` is refused as the same file (it could delete a neighbouring entry). `echo a \> f` prints `a > f` instead of writing a file. `ls | wc -l` counts the entries (piped `ls` gives one name per line).
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
- New "Command Line" page under Core Concepts: quotes, flags, pipes and redirects, `&&` / `||` / `;`, variables, wildcards and tab completion.
- The Command Line page covers backslashes, command substitution, brace expansion and `**`, and scripts, and is translated into every language of the docs site.
- The markdown plugin is loaded in the React, Vue, Angular and vanilla demos.

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

### Bundle size

- The docs site and the Angular demo load the language packs and the demo's plugins on demand: the docs' initial bundle went from 3.2 MB to 2.3 MB, the Angular demo's from 2.0 MB to 1.5 MB.

### Breaking changes

- `ICliStateStore.update()` is required: a custom state store must implement it.
- `grep` exits with status 1 when nothing matches (scripts and `&&` chains see it as a failure, as in Unix).
- `tr` and `tee` read only piped input; a file operand is an error.
- `sh` / `source` need the engine's script runner service (`ICliScriptRunner_TOKEN`), registered by `@qodalis/cli` 2.0.0-beta.18 or later.
- `NAME=value` sets a variable for this terminal only; use `export NAME=value` to save it.

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

## v2.0.0-beta.1 to v2.0.0-beta.13 (2026-02-28 onwards)

The changes from 1.0.39 that opened the 2.0 line (this section was first headed v2.0.1, a version that was never published).

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
