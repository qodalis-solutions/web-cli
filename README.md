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

## Try It Online

| Framework | StackBlitz | CodeSandbox | Gitpod |
|-----------|------------|-------------|--------|
| **Angular** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-angular-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-angular-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-angular-example) |
| **React** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-react-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-react-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-react-example) |
| **Vue** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-vue-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-vue-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-vue-example) |
| **Vanilla** | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/qodalis-solutions/qodalis-cli-vanilla-example) | [![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/qodalis-solutions/qodalis-cli-vanilla-example) | [![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/qodalis-solutions/qodalis-cli-vanilla-example) |

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
    "node_modules/@qodalis/angular-cli/src/assets/styles.css"
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
import '@qodalis/react-cli/styles.css';
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
import '@qodalis/vue-cli/styles.css';
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

#### Utility Plugins

| Package | Command | Description |
|---------|---------|-------------|
| [@qodalis/cli-data-explorer](https://www.npmjs.com/package/@qodalis/cli-data-explorer) | `data-explorer` | Interactive query console for SQL, MongoDB, Redis, Elasticsearch |
| [@qodalis/cli-guid](https://www.npmjs.com/package/@qodalis/cli-guid) | `guid` | Generate and validate UUIDs |
| [@qodalis/cli-regex](https://www.npmjs.com/package/@qodalis/cli-regex) | `regex` | Regular expression testing |
| [@qodalis/cli-qr](https://www.npmjs.com/package/@qodalis/cli-qr) | `qr` | QR code generation |
| [@qodalis/cli-speed-test](https://www.npmjs.com/package/@qodalis/cli-speed-test) | `speed-test` | Internet speed test |
| [@qodalis/cli-curl](https://www.npmjs.com/package/@qodalis/cli-curl) | `curl` | HTTP requests (GET, POST, PUT, DELETE) |
| [@qodalis/cli-password-generator](https://www.npmjs.com/package/@qodalis/cli-password-generator) | `generate-password` | Password generation |
| [@qodalis/cli-string](https://www.npmjs.com/package/@qodalis/cli-string) | `string` | String manipulation (case, trim, reverse, slug, wc, etc.) |
| [@qodalis/cli-todo](https://www.npmjs.com/package/@qodalis/cli-todo) | `todo` | Task management |
| [@qodalis/cli-browser-storage](https://www.npmjs.com/package/@qodalis/cli-browser-storage) | `local-storage`, `cookies` | Browser storage operations |
| [@qodalis/cli-text-to-image](https://www.npmjs.com/package/@qodalis/cli-text-to-image) | `text-to-image` | Generate images from text |
| [@qodalis/cli-files](https://www.npmjs.com/package/@qodalis/cli-files) | `ls`, `cat`, `nano`, `mkdir`, `touch`, `rm` | Virtual filesystem |
| [@qodalis/cli-yesno](https://www.npmjs.com/package/@qodalis/cli-yesno) | `yesno` | Interactive yes/no confirmation prompts |
| [@qodalis/cli-server-logs](https://www.npmjs.com/package/@qodalis/cli-server-logs) | `server logs` | Live server log streaming with level filtering |
| [@qodalis/cli-server-jobs](https://www.npmjs.com/package/@qodalis/cli-server-jobs) | `server jobs` | Manage server-side background jobs |
| [@qodalis/cli-users](https://www.npmjs.com/package/@qodalis/cli-users) | `whoami`, `adduser`, `login` | User management and authentication |
| [@qodalis/cli-chart](https://www.npmjs.com/package/@qodalis/cli-chart) | `chart` | Render bar, line, and sparkline charts |
| [@qodalis/cli-cron](https://www.npmjs.com/package/@qodalis/cli-cron) | `cron` | Schedule and manage recurring commands |
| [@qodalis/cli-csv](https://www.npmjs.com/package/@qodalis/cli-csv) | `csv` | Parse, filter, sort, and convert CSV data |
| [@qodalis/cli-markdown](https://www.npmjs.com/package/@qodalis/cli-markdown) | `md` | Render Markdown content in the terminal |
| [@qodalis/cli-encode](https://www.npmjs.com/package/@qodalis/cli-encode) | `base64`, `url`, `hex`, `html` | Encode/decode Base64, URL, hex, HTML entities |
| [@qodalis/cli-scp](https://www.npmjs.com/package/@qodalis/cli-scp) | `scp` | Secure copy — transfer files between local and remote |
| [@qodalis/cli-wget](https://www.npmjs.com/package/@qodalis/cli-wget) | `wget` | Download files from URLs |
| [@qodalis/cli-stopwatch](https://www.npmjs.com/package/@qodalis/cli-stopwatch) | `stopwatch` | Interactive stopwatch and countdown timer |

#### Game Plugins

| Package | Command | Description |
|---------|---------|-------------|
| [@qodalis/cli-snake](https://www.npmjs.com/package/@qodalis/cli-snake) | `snake` | Classic Snake game |
| [@qodalis/cli-tetris](https://www.npmjs.com/package/@qodalis/cli-tetris) | `tetris` | Tetris |
| [@qodalis/cli-2048](https://www.npmjs.com/package/@qodalis/cli-2048) | `2048` | 2048 sliding puzzle |
| [@qodalis/cli-minesweeper](https://www.npmjs.com/package/@qodalis/cli-minesweeper) | `minesweeper` | Minesweeper |
| [@qodalis/cli-wordle](https://www.npmjs.com/package/@qodalis/cli-wordle) | `wordle` | Wordle word game |
| [@qodalis/cli-sudoku](https://www.npmjs.com/package/@qodalis/cli-sudoku) | `sudoku` | Sudoku puzzle |

#### Language Packs

| Package | Language |
|---------|----------|
| [@qodalis/cli-lang-es](https://www.npmjs.com/package/@qodalis/cli-lang-es) | Spanish |
| [@qodalis/cli-lang-fr](https://www.npmjs.com/package/@qodalis/cli-lang-fr) | French |
| [@qodalis/cli-lang-de](https://www.npmjs.com/package/@qodalis/cli-lang-de) | German |
| [@qodalis/cli-lang-it](https://www.npmjs.com/package/@qodalis/cli-lang-it) | Italian |
| [@qodalis/cli-lang-pt](https://www.npmjs.com/package/@qodalis/cli-lang-pt) | Portuguese |
| [@qodalis/cli-lang-ro](https://www.npmjs.com/package/@qodalis/cli-lang-ro) | Romanian |
| [@qodalis/cli-lang-ru](https://www.npmjs.com/package/@qodalis/cli-lang-ru) | Russian |
| [@qodalis/cli-lang-zh](https://www.npmjs.com/package/@qodalis/cli-lang-zh) | Chinese |
| [@qodalis/cli-lang-ja](https://www.npmjs.com/package/@qodalis/cli-lang-ja) | Japanese |
| [@qodalis/cli-lang-ko](https://www.npmjs.com/package/@qodalis/cli-lang-ko) | Korean |

Any npm package with UMD support can also be loaded:

```bash
pkg add lodash
eval _.map([1, 2, 3], n => n * 2)
```

## Server Integration

Connect the frontend terminal to a backend server for server-side command execution, interactive shell sessions, filesystem access, and event streaming. Three official backend implementations are available:

| Server | Package | Port | Tech Stack |
|--------|---------|------|------------|
| **.NET** | [Qodalis.Cli](https://www.nuget.org/packages/Qodalis.Cli) | 8046 | ASP.NET Core, .NET 8 |
| **Node.js** | [@qodalis/cli-server](https://www.npmjs.com/package/@qodalis/cli-server) | 8047 | Express, TypeScript, node-pty |
| **Python** | [qodalis-cli-server](https://pypi.org/project/qodalis-cli-server/) | 8048 | FastAPI, uvicorn |

All three implement the same API surface:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cli/versions` | GET | Version discovery |
| `/api/v1/cli/commands` | GET | List registered command processors |
| `/api/v1/cli/execute` | POST | Execute a CLI command |
| `/api/v1/cli/execute/stream` | POST | Execute with SSE streaming output |
| `/ws/v1/cli/events` | WS | Server-push event streaming |
| `/ws/v1/cli/shell` | WS | Interactive PTY shell session |
| `/api/cli/fs/*` | Various | Filesystem operations (ls, cat, upload, download, mkdir, rm) |

### Connecting to a Server

```typescript
import { CliOptions } from '@qodalis/cli-core';

const options: CliOptions = {
  servers: [
    { name: 'node', url: 'http://localhost:8047' },
    { name: 'dotnet', url: 'http://localhost:8046' },
    { name: 'python', url: 'http://localhost:8048' },
  ],
};

// Angular: <cli [options]="options" />
// React:   <Cli options={options} />
// Vue:     <Cli :options="options" />
```

### SSE Streaming Execution

The frontend automatically uses SSE streaming when the server supports it, with transparent fallback to the legacy POST endpoint. Streaming processors emit output chunks as they execute rather than buffering the full response.

### Resilience

The frontend includes built-in resilience features:

- **WebSocket auto-reconnect** with exponential backoff (up to 5 attempts, max 30s delay)
- **Periodic health checks** for disconnected servers (30s interval)
- **HTTP retry** on transient fetch failures (1 retry with 1s delay)
- **Configurable request timeout** per server (default 30s)

### Server Plugins

| Plugin | Servers | Description |
|--------|---------|-------------|
| **Background Jobs** | .NET, Node.js, Python | Scheduled and recurring job execution with cron/interval support |
| **Admin Dashboard** | .NET, Node.js | React-based web UI for server management — commands, jobs, plugins, logs, filesystem, events, and an embedded terminal |
| **AWS Cloud** | .NET, Python | S3, EC2, Lambda, DynamoDB, IAM, ECS, SQS, SNS, CloudWatch with multi-profile credential management |
| **Data Explorer** | .NET, Node.js, Python | SQL, MongoDB, Redis, Elasticsearch, and custom data source providers |

### Docker

Run all three servers with Docker Compose from the [workspace root](https://github.com/qodalis-solutions/cli-workspace):

```bash
docker compose up --build
```

## Creating a CLI Plugin

### Quick Start

Scaffold a complete plugin project with a single command:

```bash
npx @qodalis/create-cli-plugin
```

The interactive prompts will ask for:

| Prompt | Description | Example |
|--------|-------------|---------|
| **Plugin name** | Lowercase, no spaces, no `cli-` prefix (added automatically) | `weather` |
| **Description** | Short description of the plugin | `Weather forecasts` |
| **Processor class name** | PascalCase name for the command processor class | `Weather` |

You can also skip the prompts by passing arguments directly:

```bash
npx @qodalis/create-cli-plugin --name weather --description "Weather forecasts" --processor-name Weather
```

Or install globally:

```bash
npm install -g @qodalis/create-cli-plugin
create-cli-plugin
```

### Standalone vs Monorepo Mode

The tool auto-detects whether you're inside the `web-cli` monorepo:

| Mode | Detection | Output directory | Package manager |
|------|-----------|-----------------|-----------------|
| **Standalone** | Any directory outside web-cli | `./qodalis-cli-<name>/` | npm or pnpm (auto-detected) |
| **Monorepo** | Inside web-cli workspace | `packages/plugins/<name>/` | pnpm (workspace) |

In monorepo mode, the tool also:
- Creates `project.json` (Nx build + test targets)
- Creates `tsconfig.spec.json` (Karma/Jasmine test config)
- Updates `tsconfig.base.json` with the path alias `@qodalis/cli-<name>` -> `dist/<name>`

### Generated Project Structure

```
qodalis-cli-weather/                    # or packages/plugins/weather/ in monorepo
  package.json                          # npm package with CJS/ESM/UMD exports
  tsup.config.ts                        # Build config (library + IIFE bundles)
  tsconfig.json                         # TypeScript config
  README.md                             # Auto-generated README
  src/
    public-api.ts                       # Public exports + ICliModule declaration
    cli-entrypoint.ts                   # IIFE entrypoint for browser runtime loading
    lib/
      version.ts                        # LIBRARY_VERSION + API_VERSION constants
      index.ts                          # Barrel re-exports
      processors/
        cli-weather-command-processor.ts # Command processor (your main logic goes here)
    tests/
      index.spec.ts                     # Jasmine test scaffold
```

### Step-by-Step Workflow

#### 1. Scaffold the plugin

```bash
npx @qodalis/create-cli-plugin --name weather
```

#### 2. Implement your command processor

Edit `src/lib/processors/cli-weather-command-processor.ts`:

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';

export class CliWeatherCommandProcessor implements ICliCommandProcessor {
    command = 'weather';
    description = 'Weather forecasts';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;

    // Sub-commands
    processors?: ICliCommandProcessor[] = [
        {
            command: 'forecast',
            description: 'Get weather forecast for a city',
            parameters: [
                {
                    name: 'city',
                    aliases: ['c'],
                    description: 'City name',
                    required: true,
                    type: 'string',
                },
                {
                    name: 'days',
                    aliases: ['d'],
                    description: 'Number of days',
                    required: false,
                    type: 'number',
                    defaultValue: '3',
                },
            ],
            processCommand: async (command, context) => {
                const city = command.args['city'];
                const days = parseInt(command.args['days'] ?? '3');
                context.writer.writeln(`Forecast for ${city} (${days} days):`);
                context.writer.writeSuccess('Sunny, 25°C');
            },
        },
        {
            command: 'current',
            description: 'Get current weather',
            acceptsRawInput: true,    // command.value = text after 'current'
            valueRequired: true,       // error if no value provided
            processCommand: async (command, context) => {
                context.writer.writeln(`Current weather in ${command.value}: Sunny, 25°C`);
            },
        },
    ];

    // Default handler (runs when user types just 'weather')
    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.executor.showHelp(command, context);
    }
}
```

#### 3. Build the plugin

**Standalone:**

```bash
cd qodalis-cli-weather
npm run build          # or: npx tsup
```

**Monorepo:**

```bash
pnpm nx build weather
```

Build output goes to `dist/weather/` with three bundles:
- `public-api.js` (CJS) + `public-api.mjs` (ESM) + `public-api.d.ts` (types)
- `umd/index.js` (IIFE — self-contained browser bundle for runtime `pkg add`)

#### 4. Test the plugin

**Standalone:** Add your preferred test runner.

**Monorepo:**

```bash
pnpm nx test weather
```

#### 5. Publish to npm

```bash
cd dist/weather         # or: cd qodalis-cli-weather/dist
npm publish --access public
```

Users can then install your plugin at runtime in any Qodalis CLI terminal:

```bash
pkg add @qodalis/cli-weather
weather forecast --city "New York"
```

### The ICliModule Export

Every plugin exports an `ICliModule` object in `public-api.ts`. This is how frameworks register your plugin:

```typescript
import { ICliModule } from '@qodalis/cli-core';
import { CliWeatherCommandProcessor } from './lib/processors/cli-weather-command-processor';
import { API_VERSION } from './lib/version';

export const weatherModule: ICliModule = {
    apiVersion: API_VERSION,         // must be >= 2
    name: '@qodalis/cli-weather',
    processors: [new CliWeatherCommandProcessor()],
};
```

`ICliModule` also supports optional lifecycle hooks and configuration:

```typescript
export const weatherModule: ICliModule = {
    apiVersion: 2,
    name: '@qodalis/cli-weather',
    processors: [new CliWeatherCommandProcessor()],
    dependencies: ['@qodalis/cli-curl'],     // boot other modules first
    priority: 0,                              // boot order (lower = first)
    configure(config) { /* ... */ return this; },
    onInit(context) { /* before processors initialize */ },
    onAfterBoot(context) { /* after all modules boot */ },
    onDestroy(context) { /* teardown */ },
};
```

### The IIFE Entrypoint

`src/cli-entrypoint.ts` enables runtime loading via `pkg add`. It calls `bootCliModule()` which registers the module with the global `window.__cliModuleRegistry`:

```typescript
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { CliWeatherCommandProcessor } from './lib/processors/cli-weather-command-processor';
import { API_VERSION } from './lib/version';

const module: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-weather',
    processors: [new CliWeatherCommandProcessor()],
};

bootCliModule(module);
```

### Execution Context API

The `ICliExecutionContext` passed to `processCommand` provides:

| Property | Description |
|----------|-------------|
| `context.writer` | Terminal output — `writeln()`, `writeInfo()`, `writeSuccess()`, `writeError()`, `wrapInColor()` |
| `context.reader` | User input — `readLine()`, `readPassword()`, `readConfirm()`, `readSelect()`, `readMultiSelect()`, `readNumber()` |
| `context.executor` | Command execution — `showHelp(command, context)` |
| `context.clipboard` | Clipboard — `write()`, `read()` |
| `context.state` | Persistent key-value store |
| `context.progressBar` | Progress bar widget |
| `context.spinner` | Spinner widget |
| `context.terminal` | Raw xterm.js `Terminal` instance |
| `context.onAbort` | `Subject<void>` for Ctrl+C cancellation |
| `context.enterFullScreenMode()` | Switch to full-screen TUI mode |
| `context.createInterval()` / `context.createTimeout()` | Managed timers (auto-cleaned on abort) |

### Registering Plugins in Your App

#### Angular (via providers)

```typescript
import { CliModule, resolveCliModuleProvider } from '@qodalis/angular-cli';
import { weatherModule } from '@qodalis/cli-weather';

@NgModule({
  imports: [CliModule],
  providers: [resolveCliModuleProvider(weatherModule)],
})
export class AppModule {}
```

#### Angular (via template input)

```typescript
import { weatherModule } from '@qodalis/cli-weather';

export class AppComponent {
  modules = [weatherModule];
}
```

```html
<cli [modules]="modules" />
```

#### React

```tsx
import { CliConfigProvider, Cli } from '@qodalis/react-cli';
import { weatherModule } from '@qodalis/cli-weather';

function App() {
  return (
    <CliConfigProvider modules={[weatherModule]}>
      <Cli />
    </CliConfigProvider>
  );
}
```

#### Vue

```vue
<script setup lang="ts">
import { CliConfigProvider, Cli } from '@qodalis/vue-cli';
import { weatherModule } from '@qodalis/cli-weather';
</script>

<template>
  <CliConfigProvider :modules="[weatherModule]">
    <Cli />
  </CliConfigProvider>
</template>
```

## Data Explorer

The `@qodalis/cli-data-explorer` plugin adds an interactive, full-screen REPL for querying data sources (SQL, MongoDB, Redis, Elasticsearch, and custom providers) directly from the terminal.

### Setup

Install and register the plugin, then configure backend servers:

```typescript
import { dataExplorerModule } from '@qodalis/cli-data-explorer';

// Add to your modules array
const modules = [dataExplorerModule, /* ... other modules */];

// Configure at least one server with data explorer providers
const options: CliOptions = {
  servers: [
    { name: 'node', url: 'http://localhost:8047' },
    { name: 'dotnet', url: 'http://localhost:8046' },
    { name: 'python', url: 'http://localhost:8048' },
  ],
};
```

Or install at runtime without a rebuild:

```bash
pkg add data-explorer
```

### Usage

```bash
data-explorer
```

Select a server and data source, then enter the full-screen REPL:

```
data-explorer> SELECT * FROM users WHERE active = true;

3 rows (12ms)
┌────┬───────┬──────────────┐
│ id │ name  │ email        │
├────┼───────┼──────────────┤
│  1 │ Alice │ alice@ex.com │
│  2 │ Bob   │ bob@ex.com   │
│  3 │ Carol │ carol@ex.com │
└────┴───────┴──────────────┘

data-explorer> \format json
Output format set to: json

data-explorer> db.users.find({"age": {"$gt": 25}})
[
  { "_id": "abc", "name": "Alice", "age": 30 },
  { "_id": "def", "name": "Bob", "age": 28 }
]
```

### REPL Commands

| Command | Description |
|---------|-------------|
| `\format <table\|json\|csv\|raw>` | Switch output format |
| `\schema` | Show database schema (tables, columns, types) |
| `\templates` | List available query templates |
| `\use <name>` | Load a template query |
| `\history` | Show query history |
| `\clear` | Clear screen |
| `\help` | Show all commands |
| `\quit` / `\q` | Exit |

Use **Up/Down arrows** for history navigation, **Escape** or **Ctrl+C** to exit.

## Extending with Inline Commands

For quick one-off commands without creating a full plugin, implement `ICliCommandProcessor` directly in your app:

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

Register it with your framework (Angular: `resolveCommandProcessorProvider(GreetCommandProcessor)`, React/Vue: pass via `processors` prop), or wrap it in an inline `ICliModule`:

```typescript
const myModule: ICliModule = {
  apiVersion: 2,
  name: 'my-app-commands',
  processors: [new GreetCommandProcessor()],
};
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
- **38 official plugins** — 24 utility, 6 games, 10 language packs
- **Command chaining** with `&&`, `||`, `|`, and `>>` operators
- **Command history** with arrow key navigation
- **Tab-like completions** and keyboard shortcuts (`Ctrl+C`, `Ctrl+L`, `Escape`)
- **29 built-in themes** with custom color support
- **Tabs & split panes** — multiple terminals in tabs with horizontal splitting
- **User sessions** with multi-user support
- **State persistence** across sessions
- **Interactive prompts** with live preview (select menus with real-time feedback)
- **Full-screen mode API** for rich TUI commands (games, editors, pagers)
- **Progress bars, spinners, and text animations**
- **Runtime package installation** from npm
- **Server integration** with SSE streaming, auto-reconnect, and health checks
- **Admin dashboard** for server management (React SPA)
- **Data explorer** for SQL, MongoDB, Redis, and Elasticsearch

## Contributing

1. Fork this repository
2. Create a branch for your feature or bugfix
3. Submit a pull request

## License

MIT
