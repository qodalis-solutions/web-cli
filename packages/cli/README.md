# @qodalis/cli

The framework-agnostic engine of [Qodalis CLI](https://github.com/qodalis-solutions/web-cli): terminal, command line, executor, built-in commands and package manager. The Angular, React, Vue and Electron packages are thin wrappers around it.

[![npm](https://img.shields.io/npm/v/@qodalis/cli.svg)](https://www.npmjs.com/package/@qodalis/cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli @qodalis/cli-core
```

Use it directly in plain TypeScript, or in a framework without a wrapper. For Angular, React or Vue, install [`@qodalis/angular-cli`](https://www.npmjs.com/package/@qodalis/angular-cli), [`@qodalis/react-cli`](https://www.npmjs.com/package/@qodalis/react-cli) or [`@qodalis/vue-cli`](https://www.npmjs.com/package/@qodalis/vue-cli) instead.

## Usage

```typescript
import '@qodalis/cli/assets/styles.css';
import { CliEngine } from '@qodalis/cli';
import { guidModule } from '@qodalis/cli-guid';

const engine = new CliEngine(document.getElementById('terminal')!, {
    welcome: { message: 'Welcome to My App', show: 'daily' },
    terminalOptions: { fontSize: 14 },
});

engine.registerModule(guidModule);
await engine.start();
```

| `CliEngine` member | Purpose |
| --- | --- |
| `new CliEngine(container, options?)` | Creates the engine on a container element (`CliEngineOptions`) |
| `registerModule(module)`, `registerModules(modules)` | Adds commands, services and translations from an `ICliModule` (before `start()`) |
| `registerService(token, value)` | Provides a service to commands (before `start()`) |
| `start()` | Boots the modules and opens the terminal |
| `execute(command)` | Runs a command line as if typed |
| `focus()`, `getTerminal()`, `getContext()` | Focus, the xterm.js `Terminal`, the execution context |
| `snapshot()` | Captures the terminal state (restore it with the `snapshot` option) |
| `destroy()` | Disposes the terminal, background services and listeners |

Tests can run commands without a browser terminal through `CliTestHarness`.

## What is in it

- Command line with history, completion, readline shortcuts, `&&`, `||`, `;`, pipes and `>`/`>>` redirects.
- Built-in commands: `help`, `theme`, `pkg`, `history`, `alias`, `json`, `diff`, `random`, `timestamp`, `convert`, `color`, `clipboard`, `ps`, `kill`, `htop`, `nano` and more ([full list](https://cli.qodalis.com/docs/built-in-commands)).
- `pkg`: installs plugins from npm at runtime.
- Server connections (`servers` option): remote commands, streamed output, `ssh` shell sessions.
- The dockable panel with tabs and split panes used by the wrappers.

## Documentation

- [Engine API](https://cli.qodalis.com/docs/engine-api) and [Configuration](https://cli.qodalis.com/docs/configuration)
- [Core concepts](https://cli.qodalis.com/docs/core-concepts) and [creating a plugin](https://cli.qodalis.com/docs/create-plugin)
- [Migrating to 2.0](https://cli.qodalis.com/docs/migration)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
