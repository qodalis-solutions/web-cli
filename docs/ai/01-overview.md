## Overview

### Web plugins vs server plugins

A Qodalis CLI command is either a web plugin running in the browser or a server plugin running in a CLI server; the user types both in the same terminal.

- **Web plugin**: a TypeScript package exporting an `ICliModule` (from `@qodalis/cli-core`) whose `processors` implement `ICliCommandProcessor`. It runs in the page, writes to the xterm.js terminal through `context.writer`, can prompt (`context.reader`), keep state, call HTTP APIs, go full screen, run background services. Use it for anything that can run in the browser: tools, formatters, games, UIs over a REST API, interactive prompts.
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
