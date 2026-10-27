<h1 align="center">Qodalis CLI</h1>

<p align="center">A web terminal for Angular, React, Vue and plain TypeScript, extended through command modules.</p>

<div align="center">

[![npm](https://img.shields.io/npm/v/@qodalis/cli.svg?label=%40qodalis%2Fcli)](https://www.npmjs.com/package/@qodalis/cli)
[![npm](https://img.shields.io/npm/v/@qodalis/angular-cli.svg?label=angular)](https://www.npmjs.com/package/@qodalis/angular-cli)
[![npm](https://img.shields.io/npm/v/@qodalis/react-cli.svg?label=react)](https://www.npmjs.com/package/@qodalis/react-cli)
[![npm](https://img.shields.io/npm/v/@qodalis/vue-cli.svg?label=vue)](https://www.npmjs.com/package/@qodalis/vue-cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

[Documentation](https://cli.qodalis.com/docs) &middot;
[Live demo](https://cli.qodalis.com/) &middot;
[Playground](https://cli.qodalis.com/docs/playground) &middot;
[Migrating to 2.0](https://cli.qodalis.com/docs/migration)

</div>

![Help command](https://raw.githubusercontent.com/qodalis-solutions/web-cli/main/assets/help_command.gif)

Qodalis CLI renders an [xterm.js](https://xtermjs.org/) terminal in your app with a shell-like command line, built-in commands, themes and a runtime package manager. You add commands as **modules** (`ICliModule`): the 40 official plugins, your own commands, or packages installed at runtime with `pkg add`. It can also connect to a Node.js, .NET or Python backend to run server-side commands.

## Try it online

Starter projects for each framework, using the published npm packages:

| Framework | StackBlitz | CodeSandbox | Gitpod | Repository |
|---|---|---|---|---|
| **Angular** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-angular-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-angular-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-angular-example) | [source](https://github.com/qodalis-solutions/qodalis-cli-angular-example) |
| **React** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-react-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-react-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-react-example) | [source](https://github.com/qodalis-solutions/qodalis-cli-react-example) |
| **Vue** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-vue-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-vue-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-vue-example) | [source](https://github.com/qodalis-solutions/qodalis-cli-vue-example) |
| **Vanilla TypeScript** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-vanilla-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-vanilla-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-vanilla-example) | [source](https://github.com/qodalis-solutions/qodalis-cli-vanilla-example) |

Or try the terminal and write your own commands in the [docs playground](https://cli.qodalis.com/docs/playground).

## Install

| Framework  | Package                                                                    | Install                               |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------- |
| Angular    | [`@qodalis/angular-cli`](https://www.npmjs.com/package/@qodalis/angular-cli) | `npm install @qodalis/angular-cli`    |
| React      | [`@qodalis/react-cli`](https://www.npmjs.com/package/@qodalis/react-cli)     | `npm install @qodalis/react-cli`      |
| Vue 3      | [`@qodalis/vue-cli`](https://www.npmjs.com/package/@qodalis/vue-cli)         | `npm install @qodalis/vue-cli`        |
| Vanilla TS | [`@qodalis/cli`](https://www.npmjs.com/package/@qodalis/cli)                 | `npm install @qodalis/cli @qodalis/cli-core` |
| Electron   | [`@qodalis/electron-cli`](https://www.npmjs.com/package/@qodalis/electron-cli) | `npm install @qodalis/electron-cli` (with a wrapper above) |

Plugins are separate packages, for example `npm install @qodalis/cli-guid`.

## Quick start

Each example shows a terminal with the `guid` plugin. Pass any number of modules.

### Angular

Angular 22 or later. Add the stylesheet to `angular.json`:

```json
"styles": ["node_modules/@qodalis/angular-cli/src/assets/styles.css"]
```

```typescript
import { Component } from '@angular/core';
import { CliModule } from '@qodalis/angular-cli';
import { ICliModule } from '@qodalis/cli-core';
import { guidModule } from '@qodalis/cli-guid';

@Component({
    selector: 'app-root',
    imports: [CliModule],
    template: `<cli [modules]="modules" height="100vh" />`,
})
export class AppComponent {
    modules: ICliModule[] = [guidModule];
}
```

`<cli-panel>` is a collapsible panel docked to the page. To register modules app-wide through DI instead of the `modules` input, add `resolveCliModuleProvider(guidModule)` to your providers.

### React

React 18 or 19.

```tsx
import '@qodalis/react-cli/styles.css';
import { Cli } from '@qodalis/react-cli';
import { guidModule } from '@qodalis/cli-guid';

export function App() {
    return <Cli modules={[guidModule]} style={{ height: '100vh' }} />;
}
```

### Vue

```vue
<script setup lang="ts">
import '@qodalis/vue-cli/styles.css';
import { Cli } from '@qodalis/vue-cli';
import { guidModule } from '@qodalis/cli-guid';
</script>

<template>
    <Cli :modules="[guidModule]" :style="{ height: '100vh' }" />
</template>
```

React and Vue also export `CliPanel`, and `CliConfigProvider` to share `modules` and `options` with every terminal below it.

### Vanilla TypeScript

```typescript
import '@qodalis/cli/assets/styles.css';
import { CliEngine } from '@qodalis/cli';
import { guidModule } from '@qodalis/cli-guid';

const engine = new CliEngine(document.getElementById('terminal')!);
engine.registerModule(guidModule);
await engine.start();
```

## Your own commands

A command is an `ICliCommandProcessor`; a module groups processors (and optional services, translations and lifecycle hooks):

```typescript
import {
    API_VERSION,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

class GreetCommandProcessor implements ICliCommandProcessor {
    command = 'greet';
    description = 'Greet someone by name';
    valueRequired = true;

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeSuccess(`Hello, ${command.value}!`);
    }
}

export const greetModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-app-commands',
    processors: [new GreetCommandProcessor()],
};
```

Register it like any plugin: the `modules` input/prop, `resolveCliModuleProvider(greetModule)` in Angular, or `engine.registerModule(greetModule)`. To publish a reusable plugin, scaffold it with [`npx @qodalis/create-cli-plugin`](https://www.npmjs.com/package/@qodalis/create-cli-plugin). See [Core concepts](https://cli.qodalis.com/docs/core-concepts) and [Create a plugin](https://cli.qodalis.com/docs/create-plugin).

## Configuration

Options go to the `options` input/prop or the `CliEngine` constructor:

```typescript
import { CliEngineOptions } from '@qodalis/cli';

const options: CliEngineOptions = {
    welcome: { message: 'Welcome to My App', show: 'daily' }, // or false
    servers: [{ name: 'node', url: 'http://localhost:8047' }],
    terminalOptions: { fontSize: 14 },
};
```

All options are listed in [Configuration](https://cli.qodalis.com/docs/configuration).

## Features

- **Shell-like command line**: `&&`, `||`, `;`, pipes, `>`/`>>` redirects, aliases, history search, tab completion and readline shortcuts (`hotkeys` lists them).
- **Built-in commands**: `help`, `theme`, `pkg`, `history`, `alias`, `json`, `diff`, `random`, `timestamp`, `convert`, `color`, `clipboard`, `ps`/`kill`, `htop` and more. See [Built-in commands](https://cli.qodalis.com/docs/built-in-commands).
- **Runtime packages**: `pkg add guid` installs a plugin from npm (unpkg or jsdelivr) without rebuilding the app.
- **Interactive input**: line, password, confirm, select, multi-select and number prompts, progress bars, spinners and a full-screen mode for editors and games.
- **Themes**: 29 built-in themes, custom colors and fonts.
- **Panel**: a dockable panel with tabs, split panes, resizing and maximize.
- **Users and permissions** (users plugin): login, `su`, groups, permissions and per-user history.
- **Server integration**: run commands on a backend, stream output, open a remote shell, browse the server filesystem, query databases with the data explorer.
- **i18n**: 10 language packs.

## Plugins

Install from npm and pass the module, or run `pkg add <name>` in the terminal.

| Package | Module | Commands |
| --- | --- | --- |
| [`@qodalis/cli-browser-storage`](https://www.npmjs.com/package/@qodalis/cli-browser-storage) | `browserStorageModule` | `local-storage`, `cookies` |
| [`@qodalis/cli-chart`](https://www.npmjs.com/package/@qodalis/cli-chart) | `chartModule` | `chart` |
| [`@qodalis/cli-cron`](https://www.npmjs.com/package/@qodalis/cli-cron) | `cronModule` | `cron` |
| [`@qodalis/cli-csv`](https://www.npmjs.com/package/@qodalis/cli-csv) | `csvModule` | `csv` |
| [`@qodalis/cli-curl`](https://www.npmjs.com/package/@qodalis/cli-curl) | `curlModule` | `curl` |
| [`@qodalis/cli-data-explorer`](https://www.npmjs.com/package/@qodalis/cli-data-explorer) | `dataExplorerModule` | `data-explorer` (SQL, MongoDB, Redis, Elasticsearch via a server) |
| [`@qodalis/cli-encode`](https://www.npmjs.com/package/@qodalis/cli-encode) | `encodeModule` | `base64`, `hex`, `url`, `jwt`, `hash`, `rot`, `morse`, `binary` |
| [`@qodalis/cli-files`](https://www.npmjs.com/package/@qodalis/cli-files) | `filesModule` | `ls`, `cd`, `cat`, `nano`, `mkdir`, `touch`, `rm`, `cp`, `grep`, `tree` |
| [`@qodalis/cli-guid`](https://www.npmjs.com/package/@qodalis/cli-guid) | `guidModule` | `guid` |
| [`@qodalis/cli-markdown`](https://www.npmjs.com/package/@qodalis/cli-markdown) | `markdownModule` | `md` |
| [`@qodalis/cli-password-generator`](https://www.npmjs.com/package/@qodalis/cli-password-generator) | `passwordGeneratorModule` | `generate-password` |
| [`@qodalis/cli-qr`](https://www.npmjs.com/package/@qodalis/cli-qr) | `qrModule` | `qr` |
| [`@qodalis/cli-regex`](https://www.npmjs.com/package/@qodalis/cli-regex) | `regexModule` | `regex` |
| [`@qodalis/cli-scp`](https://www.npmjs.com/package/@qodalis/cli-scp) | `scpModule` | `scp` |
| [`@qodalis/cli-server-jobs`](https://www.npmjs.com/package/@qodalis/cli-server-jobs) | `jobsModule` | `server jobs` |
| [`@qodalis/cli-server-logs`](https://www.npmjs.com/package/@qodalis/cli-server-logs) | `serverLogsModule` | `server logs` |
| [`@qodalis/cli-speed-test`](https://www.npmjs.com/package/@qodalis/cli-speed-test) | `speedTestModule` | `speed-test` |
| [`@qodalis/cli-stopwatch`](https://www.npmjs.com/package/@qodalis/cli-stopwatch) | `stopwatchModule` | `stopwatch` |
| [`@qodalis/cli-string`](https://www.npmjs.com/package/@qodalis/cli-string) | `stringModule` | `string` |
| [`@qodalis/cli-text-to-image`](https://www.npmjs.com/package/@qodalis/cli-text-to-image) | `textToImageModule` | `text-to-image` |
| [`@qodalis/cli-todo`](https://www.npmjs.com/package/@qodalis/cli-todo) | `todoModule` | `todo` |
| [`@qodalis/cli-users`](https://www.npmjs.com/package/@qodalis/cli-users) | `usersModule` | `login`, `su`, `whoami`, `adduser`, `perms`, `sessions`, ... |
| [`@qodalis/cli-wget`](https://www.npmjs.com/package/@qodalis/cli-wget) | `wgetModule` | `wget` |
| [`@qodalis/cli-yesno`](https://www.npmjs.com/package/@qodalis/cli-yesno) | `yesnoModule` | `yesno` |

**Games**: [`@qodalis/cli-2048`](https://www.npmjs.com/package/@qodalis/cli-2048) (`game2048Module`), [`@qodalis/cli-minesweeper`](https://www.npmjs.com/package/@qodalis/cli-minesweeper), [`@qodalis/cli-snake`](https://www.npmjs.com/package/@qodalis/cli-snake), [`@qodalis/cli-sudoku`](https://www.npmjs.com/package/@qodalis/cli-sudoku), [`@qodalis/cli-tetris`](https://www.npmjs.com/package/@qodalis/cli-tetris), [`@qodalis/cli-wordle`](https://www.npmjs.com/package/@qodalis/cli-wordle).

**Language packs**: `@qodalis/cli-lang-<code>` for `de`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `ro`, `ru`, `zh` (`langDeModule`, ...).

Details and examples for each plugin: [Plugins](https://cli.qodalis.com/docs/plugins).

## Ecosystem

| Repository | What it is |
| --- | --- |
| [cli-server-node](https://github.com/qodalis-solutions/cli-server-node) | Node.js server (`@qodalis/cli-server-node`): server commands, shell, filesystem, data explorer, jobs, MCP |
| [cli-server-dotnet](https://github.com/qodalis-solutions/cli-server-dotnet) | The same server for ASP.NET Core (NuGet `Qodalis.Cli`) |
| [cli-server-python](https://github.com/qodalis-solutions/cli-server-python) | The same server for FastAPI (PyPI `qodalis-cli-server`) |
| [cli-server-dashboard](https://github.com/qodalis-solutions/cli-server-dashboard) | Admin dashboard the servers serve at `/qcli/admin` |
| [mcp-cli](https://github.com/qodalis-solutions/mcp-cli) | `@qodalis/mcp-cli`: MCP server for Claude Code and other AI clients |
| [pwa-cli](https://github.com/qodalis-solutions/pwa-cli) | The terminal as an installable PWA and an [Android app](https://play.google.com/store/apps/details?id=com.qodalis.cli) |
| [Angular](https://github.com/qodalis-solutions/qodalis-cli-angular-example), [React](https://github.com/qodalis-solutions/qodalis-cli-react-example), [Vue](https://github.com/qodalis-solutions/qodalis-cli-vue-example) and [vanilla](https://github.com/qodalis-solutions/qodalis-cli-vanilla-example) examples | Starter apps using the npm packages ([try them online](#try-it-online)) |

Connecting a server: [Server integration](https://cli.qodalis.com/docs/server-integration).

## AI-assisted development

- **[`@qodalis/mcp-cli`](https://www.npmjs.com/package/@qodalis/mcp-cli)** gives Claude Code (or any MCP client) the docs, the published API declarations and the plugin scaffolder, with no server needed:

  ```bash
  claude mcp add qcli -- npx -y @qodalis/mcp-cli
  ```

  Set `QCLI_URL` (and `QCLI_TOKEN`) to also expose a running server's commands, filesystem and data sources as MCP tools.
- **[llms.txt](https://cli.qodalis.com/llms.txt)** and **[llms-full.txt](https://cli.qodalis.com/llms-full.txt)**: the plugin API guide for language models.

See [AI plugin development](https://cli.qodalis.com/docs/ai-plugin-development).

## Development

This repository is a pnpm 12 + Nx 24 monorepo (Node 22):

```bash
pnpm install
pnpm run build                # all packages, in dependency order
pnpm exec nx test <project>   # Jasmine + Karma (ChromeHeadless), e.g. nx test guid
pnpm run lint
pnpm run serve:docs           # docs site on http://localhost:4300
pnpm run serve:angular-demo   # also serve:react-demo, serve:vue-demo, serve:vanilla-demo
pnpm run create-plugin -- --name <name> --description "<desc>" --processor-name <Name>
```

| Path | Contents |
| --- | --- |
| `packages/core` | `@qodalis/cli-core`: interfaces, models, themes, utilities |
| `packages/cli` | `@qodalis/cli`: the engine and built-in commands |
| `packages/angular-cli`, `react-cli`, `vue-cli`, `electron-cli` | Framework wrappers |
| `packages/create-cli-plugin` | Plugin scaffolder |
| `packages/plugins/*` | The 40 plugins |
| `apps/` | Docs site and demo apps |

[CONTRIBUTING.md](https://github.com/qodalis-solutions/web-cli/blob/main/CONTRIBUTING.md) covers branches and pull requests, [DEVELOPER.md](https://github.com/qodalis-solutions/web-cli/blob/main/DEVELOPER.md) the architecture and build details.

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
