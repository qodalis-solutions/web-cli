<h1 align="center">Qodalis Web CLI</h1>

<p align="center">A web-based terminal for Angular, React, and Vue — extensible, themeable, and packed with built-in developer tools.</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@qodalis/cli.svg?label=cli)](https://www.npmjs.com/package/@qodalis/cli)
[![npm version](https://img.shields.io/npm/v/@qodalis/angular-cli.svg?label=angular)](https://www.npmjs.com/package/@qodalis/angular-cli)
[![npm version](https://img.shields.io/npm/v/@qodalis/react-cli.svg?label=react)](https://www.npmjs.com/package/@qodalis/react-cli)
[![npm version](https://img.shields.io/npm/v/@qodalis/vue-cli.svg?label=vue)](https://www.npmjs.com/package/@qodalis/vue-cli)
[![Build Status](https://github.com/qodalis-solutions/web-cli/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/qodalis-solutions/web-cli/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

<p align="center">
  <a href="https://cli.qodalis.com/">Live Demo</a> &middot;
  <a href="https://cli.qodalis.com/docs/">Documentation</a> &middot;
  <a href="https://www.npmjs.com/package/@qodalis/cli">npm</a>
</p>

---

![Help command](assets/help_command.gif)

## Packages

| Package | Description |
|---------|-------------|
| [`@qodalis/cli-core`](https://www.npmjs.com/package/@qodalis/cli-core) | Shared interfaces, models, and types |
| [`@qodalis/cli`](https://www.npmjs.com/package/@qodalis/cli) | Framework-agnostic terminal engine (50+ built-in commands) |
| [`@qodalis/angular-cli`](https://www.npmjs.com/package/@qodalis/angular-cli) | Angular wrapper |
| [`@qodalis/react-cli`](https://www.npmjs.com/package/@qodalis/react-cli) | React wrapper |
| [`@qodalis/vue-cli`](https://www.npmjs.com/package/@qodalis/vue-cli) | Vue 3 wrapper |

## Quick Start

### Angular

```bash
npm install @qodalis/angular-cli
```

```typescript
import { CliModule } from '@qodalis/angular-cli';

@NgModule({
  imports: [CliModule],
})
export class AppModule {}
```

Add styles to `angular.json`:

```json
{
  "styles": [
    "node_modules/@qodalis/angular-cli/src/assets/styles.sass"
  ]
}
```

```html
<!-- Full terminal -->
<cli [options]="cliOptions" />

<!-- Collapsible panel -->
<cli-panel />
```

### React

```bash
npm install @qodalis/react-cli
```

```tsx
import { Cli } from '@qodalis/react-cli';

function App() {
  return <Cli style={{ width: '100vw', height: '100vh' }} />;
}
```

### Vue

```bash
npm install @qodalis/vue-cli
```

```vue
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';
</script>

<template>
  <Cli :style="{ width: '100vw', height: '100vh' }" />
</template>
```

### Configuration (all frameworks)

Pass options to customize the terminal:

```typescript
const options = {
  welcomeMessage: {
    message: '-- your custom welcome message --',
    show: 'daily', // 'never', 'once', 'daily', 'always'
  },
  usersModule: {
    enabled: true,
  },
};
```

## Built-in Commands

### System

| Command | Aliases | Description |
|---------|---------|-------------|
| `help` | `man` | Show all commands or help for a specific command |
| `version` | `ver` | Display CLI version and documentation link |
| `hotkeys` | `shortcuts`, `keys` | Show keyboard shortcuts |
| `history` | `hist` | Browse and clear command history |
| `theme` | `themes` | Apply, customize, and save terminal themes (interactive selection with live preview) |
| `feedback` | `support` | Report bugs or request features on GitHub |
| `pkg` | `packages` | Install, update, remove, and browse packages |

### Utilities

| Command | Aliases | Description |
|---------|---------|-------------|
| `clear` | `cls` | Clear the terminal (or `Ctrl+L`) |
| `echo` | `print` | Print text to the terminal |
| `eval` | `calc`, `js` | Evaluate JavaScript expressions |
| `sleep` | `wait` | Pause execution for N milliseconds |
| `time` | `date` | Show current local and UTC time |
| `uptime` | — | Show session uptime |
| `uname` | `sysinfo` | System and browser information |
| `screen` | `display` | Screen, viewport, and terminal dimensions |
| `open` | — | Open a URL in a new browser tab |
| `alias` / `unalias` | — | Create and remove command aliases |
| `yes` | — | Output a string repeatedly |
| `seq` | `sequence` | Print number sequences |
| `cal` | `calendar` | Display a monthly calendar |

### Developer Tools

| Command | Aliases | Description |
|---------|---------|-------------|
| `base64` | `b64` | Encode / decode Base64 |
| `json` | — | Format, minify, and validate JSON |
| `url` | — | Encode, decode, and parse URLs |
| `jwt` | — | Decode and inspect JWT tokens |
| `hash` | — | SHA-256, SHA-1, SHA-384, SHA-512 hashes |
| `hex` | — | Hex encode/decode and base conversion (2-36) |
| `color` | `colour` | Convert between hex, rgb, hsl with preview |
| `random` | `rand` | Random numbers, strings, UUIDs, coin flip, dice |
| `lorem` | `lipsum` | Generate placeholder text |
| `timestamp` | `ts`, `epoch` | Convert between Unix timestamps and dates |
| `convert` | `conv` | Unit conversion (length, weight, temperature, data) |
| `clipboard` | `cb`, `pbcopy` | Copy to / paste from clipboard |

### Users

| Command | Aliases | Description |
|---------|---------|-------------|
| `whoami` | `me` | Display current user |
| `su` | `switch-user` | Switch user session |
| `adduser` | `useradd` | Add a new user |
| `listusers` | `users` | List all users |

## Package Manager

Install additional commands at runtime from npm — no rebuild needed.

![Install packages](assets/install_packages.gif)

```bash
pkg browse                     # Browse available packages
pkg add guid                   # Install a package
pkg remove guid                # Remove a package
pkg update                     # Update all packages
pkg update guid@1.0.2          # Pin a specific version
pkg check                      # Check for updates
pkg versions guid              # Show all published versions
pkg source set                 # Interactively select a package source (CDN)
pkg source set unpkg           # Set package source directly
```

### Available Packages

| Package | Command | Description |
|---------|---------|-------------|
| [@qodalis/cli-guid](https://www.npmjs.com/package/@qodalis/cli-guid) | `guid` | Generate and validate UUIDs |
| [@qodalis/cli-string](https://www.npmjs.com/package/@qodalis/cli-string) | `string` | String manipulation (case, trim, reverse, slug, wc, etc.) |
| [@qodalis/cli-curl](https://www.npmjs.com/package/@qodalis/cli-curl) | `curl` | HTTP requests (GET, POST, PUT, DELETE) |
| [@qodalis/cli-todo](https://www.npmjs.com/package/@qodalis/cli-todo) | `todo` | Task management |
| [@qodalis/cli-regex](https://www.npmjs.com/package/@qodalis/cli-regex) | `regex` | Regular expression testing |
| [@qodalis/cli-qr](https://www.npmjs.com/package/@qodalis/cli-qr) | `qr` | QR code generation |
| [@qodalis/cli-speed-test](https://www.npmjs.com/package/@qodalis/cli-speed-test) | `speed-test` | Internet speed test |
| [@qodalis/cli-server-logs](https://www.npmjs.com/package/@qodalis/cli-server-logs) | `server-logs` | Live server log streaming |
| [@qodalis/cli-browser-storage](https://www.npmjs.com/package/@qodalis/cli-browser-storage) | `local-storage`, `cookies` | Browser storage operations |
| [@qodalis/cli-text-to-image](https://www.npmjs.com/package/@qodalis/cli-text-to-image) | `text-to-image` | Generate images from text |
| [@qodalis/cli-password-generator](https://www.npmjs.com/package/@qodalis/cli-password-generator) | `generate-password` | Password generation |

Any npm package with UMD support can also be loaded:

```bash
pkg add lodash
eval _.map([1, 2, 3], n => n * 2)
```

## Creating Custom Plugins

Scaffold a new plugin package with the CLI tool:

```bash
npx @qodalis/create-cli-plugin
```

Or install globally:

```bash
npm install -g @qodalis/create-cli-plugin
create-cli-plugin
```

The tool generates a complete plugin project with build config, command processor, tests, and an IIFE bundle for runtime loading. It supports both **standalone** projects and **monorepo** mode (auto-detected when run inside the web-cli workspace).

You can also pass arguments directly for non-interactive usage:

```bash
npx @qodalis/create-cli-plugin --name weather --description "Weather forecasts"
```

Once scaffolded, implement your command logic in `src/lib/processors/`, build with `tsup`, and publish to npm. Users install your plugin at runtime:

```bash
pkg add @qodalis/cli-weather
weather forecast --city "New York"
```

## Extending with Custom Commands

Create a class implementing `ICliCommandProcessor`:

```typescript
import {
  ICliCommandProcessor,
  CliProcessCommand,
  ICliExecutionContext,
} from '@qodalis/cli-core';

export class GreetCommandProcessor implements ICliCommandProcessor {
  command = 'greet';
  description = 'Greet someone by name';
  acceptsRawInput = true;
  valueRequired = true;

  async processCommand(
    command: CliProcessCommand,
    context: ICliExecutionContext,
  ): Promise<void> {
    context.writer.writeln(`Hello, ${command.value}!`);
  }
}
```

### Register in Angular

```typescript
import { CliModule, resolveCommandProcessorProvider } from '@qodalis/angular-cli';

@NgModule({
  imports: [CliModule],
  providers: [resolveCommandProcessorProvider(GreetCommandProcessor)],
})
export class AppModule {}
```

### Register in React

```tsx
import { Cli } from '@qodalis/react-cli';

function App() {
  return <Cli processors={[new GreetCommandProcessor()]} />;
}
```

### Register in Vue

```vue
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';

const processors = [new GreetCommandProcessor()];
</script>

<template>
  <Cli :processors="processors" />
</template>
```

```bash
~$ greet World
Hello, World!
```

## Using the Engine Directly

For advanced use cases or non-framework environments, use `CliEngine` directly:

```typescript
import { CliEngine } from '@qodalis/cli';

const engine = new CliEngine(document.getElementById('terminal')!, {
  welcomeMessage: { message: 'Welcome!', show: 'always' },
});

engine.registerProcessors([new GreetCommandProcessor()]);
await engine.start();
```

## Features

- **Multi-framework** — Angular, React, Vue, or vanilla JS
- **Command chaining** with `&&`, `||`, `|`, and `>>` operators
- **Command history** with arrow key navigation
- **Tab-like completions** and keyboard shortcuts (`Ctrl+C`, `Ctrl+L`, `Escape`)
- **Theming** with built-in themes and custom color support
- **User sessions** with multi-user support
- **State persistence** across sessions
- **Interactive prompts** with live preview (select menus with real-time feedback)
- **Full-screen mode API** for rich TUI commands
- **Progress bars, spinners, and text animations**
- **Runtime package installation** from npm

## Contributing

1. Fork this repository
2. Create a branch for your feature or bugfix
3. Submit a pull request

## License

MIT
