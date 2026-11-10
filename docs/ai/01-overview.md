## Overview

### Web plugins vs server plugins

A Qodalis CLI command is either a web plugin running in the browser or a server plugin running in a CLI server; the user types both in the same terminal.

- **Web plugin**: a TypeScript package exporting an `ICliModule` (from `@qodalis/cli-core`) whose `processors` implement `ICliCommandProcessor`. It runs in the page, writes to the xterm.js terminal through `context.writer`, can prompt (`context.reader`), keep state, call HTTP APIs, go full screen, run background services. Use it for anything that can run in the browser: tools, formatters, games, UIs over a REST API, interactive prompts. A plugin does not have to live in web-cli: the six game plugins (`@qodalis/cli-2048`, `-minesweeper`, `-snake`, `-tetris`, `-wordle`, `-sudoku`) are built and published from their own repository, [qodalis-solutions/cli-games](https://github.com/qodalis-solutions/cli-games), with `@qodalis/cli-core` as a peer dependency; it is a complete example of an external plugin repository (tsup build, Jasmine/Karma tests, npm publish on push to `main`).
- **Server plugin**: a processor/module for a Qodalis CLI server (`@qodalis/cli-server-abstractions` for Node, `Qodalis.Cli.Abstractions` for .NET, `qodalis-cli-server-abstractions` for Python). It runs on the server, receives the parsed command over HTTP and returns text or structured output (`text`, `table`, `list`, `json`, `key-value`). Use it when the command needs server resources: the filesystem, databases, secrets, OS processes, private networks. Server commands are also exposed as MCP tools when the server enables MCP.
- The browser terminal discovers server commands at startup (`GET /api/v1/qcli/commands`) and registers a proxy for each one as `<server>:<command>` (e.g. `node:weather`) plus the bare name (`weather`) when no local command owns it.
- Rule of thumb: no secrets and no server-only resources -> web plugin; otherwise server plugin. Both can coexist (a web command can call a server through `context.http`).

### Packages

The npm, NuGet and PyPI packages a plugin author uses, by role.

| Package | Role |
|---|---|
| `@qodalis/cli-core` | Web plugin API: `ICliModule`, `ICliCommandProcessor`, `ICliExecutionContext`, `CliProcessCommand`, `API_VERSION`, `DefaultLibraryAuthor`, `bootCliModule`, colors, tokens. The only runtime dependency of a web plugin. |
| `@qodalis/cli` | Framework-agnostic engine: `CliEngine`, `CliTestHarness` (for tests). |
| `@qodalis/angular-cli` | Angular wrapper: `CliModule`, `<cli>`, `<cli-panel>`, `resolveCliModuleProvider`. |
| `@qodalis/react-cli` | React wrapper: `Cli`, `CliPanel`, `CliProvider`, `CliConfigProvider`. |
| `@qodalis/vue-cli` | Vue 3 wrapper: `Cli`, `CliPanel`, `CliConfigProvider`. |
| `@qodalis/create-cli-plugin` | Scaffolder (`npx @qodalis/create-cli-plugin`). |
| `@qodalis/cli-<name>` | Published web plugins (`@qodalis/cli-guid`, `@qodalis/cli-todo`, ...). Each exports `<name>Module`. |
| `@qodalis/cli-server-abstractions` (npm) | Node server plugin API. Server: `@qodalis/cli-server-node`. |
| `Qodalis.Cli.Abstractions` (NuGet) | .NET server plugin API. Server: `Qodalis.Cli`. |
| `qodalis-cli-server-abstractions` (PyPI, import `qodalis_cli_server_abstractions`) | Python server plugin API. Server: `qodalis-cli-server` (import `qodalis_cli`). |
| `@qodalis/mcp-cli` | MCP server for AI assistants: docs search, API lookup, plugin scaffolding, and (with `QCLI_URL`) driving a CLI server. |

### Shipping the CLI under your own name

`CliOptions.branding` sets the name and icon an application ships the CLI under. Anything left out keeps Qodalis CLI's.

```tsx
<CliPanel options={{ branding: { name: 'RateBell CLI', icon: '/favicon.svg' }, servers: [...] }} />
```

- `name` replaces "Web CLI" and the Qodalis CLI art in the welcome banner and the startup log, and "CLI" in the panel's header and hide tab (React, Vue, Angular).
- `icon` (an image URL: http(s), a path, or a `data:image` URL) replaces the panel's terminal glyph.
- The copyright line, the documentation link and `version` stay Qodalis CLI's; `version` adds the name as an `App` row.

### Panel and terminal themes

`theme` (on `CliPanelOptions`, and on `CliOptions` for a plain `<Cli>`) sets the look of the panel and of every terminal in it:

| Value | Result |
|---|---|
| `'dark'` (default) | Built-in dark palette, terminal theme `default` |
| `'light'` | Built-in light palette, terminal theme `light` |
| `'auto'` | Light or dark, following the system's `prefers-color-scheme`, live |
| a terminal theme name (`'dracula'`, `'nord'`, `'solarizedLight'`, ... see `theme list`) | That terminal theme; the panel's colors are derived from it |
| a `CliPanelTheme` object | `base` (`'light'`/`'dark'`/`'auto'`), `terminal` (name or xterm colors), `colors` (any of `background`, `headerBackground`, `border`, `text`, `textSecondary`, `accent`, `hoverBackground`, `activeBackground`, `danger`, `shadow`), `fontFamily`, `radius` |

Pass the host's own setting through, and the panel follows when it changes (React re-render, Vue reactivity, a new `options` object in Angular, or `panelRef.setTheme(theme)`):

```tsx
const { dark } = useAppSettings();
<CliPanel options={{
    theme: {
        base: dark ? 'dark' : 'light',
        colors: { accent: dark ? '#4f9be0' : '#2a6bba', headerBackground: dark ? '#13212f' : '#ffffff' },
        fontFamily: 'Onest Variable, sans-serif',
    },
}} />
```

- The host's `theme` is the default. A theme the user applies with the `theme` command (`theme apply dracula`, `theme set`, `theme import`) wins over it, is saved, and restyles the panel too; `theme reset` returns to the host's theme, which follows the host again from then on. Without a host `theme`, the terminals keep the user's saved theme and the panel uses the dark palette (or, with `syncTheme: true`, colors derived from the terminal).
- The dropdowns and the context menu use the theme too. Stylesheets can override the CSS variables (`--cli-panel-bg`, `--cli-panel-accent`, `--cli-panel-font`, `--cli-panel-radius`, ... listed at the top of `@qodalis/cli/assets/cli-panel.css`).
- `resolvePanelTheme(theme, prefersDark)` and `CliPanelPalettes` (from `@qodalis/cli-core`) give the resolved CSS variables and terminal theme, for hosts that style other parts of the page to match.

### Phones

The panel resizes with touch (pointer events on the grip, a bigger grip on touch screens), stays above the on-screen keyboard (it follows `visualViewport`, so the prompt stays visible while typing), is never taller than the visible area and stays below the status bar of apps that draw under it (`safe-area-inset-top`). On screens up to 600px wide the header keeps the title, the run state and the buttons on one line.

An app with its own bottom bar docks the panel above it with a CSS variable, never by overriding `bottom` (that would stop the panel from moving above the keyboard):

```css
:root { --cli-panel-bottom-offset: var(--tab-bar-height, 0px); }
```
