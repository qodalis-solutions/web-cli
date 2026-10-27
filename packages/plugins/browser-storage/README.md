# @qodalis/cli-browser-storage

Read and write browser cookies and local storage from the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-browser-storage.svg)](https://www.npmjs.com/package/@qodalis/cli-browser-storage)
[![license](https://img.shields.io/npm/l/@qodalis/cli-browser-storage.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-browser-storage
```

Or install it at runtime in a running terminal:

```bash
pkg add browser-storage
```

## Usage

Register `browserStorageModule` with your terminal.

```typescript
import { browserStorageModule } from '@qodalis/cli-browser-storage';

// Angular (template)
// <cli [modules]="[browserStorageModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(browserStorageModule)];

// React
<Cli modules={[browserStorageModule]} />

// Vue
<Cli :modules="[browserStorageModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(browserStorageModule);
```

## Commands

The module registers two commands: `cookies` and `local-storage`. Running either alone prints its help. Values may contain spaces; quote them or pass several words.

| Command | Description |
|---|---|
| `cookies list` | List all cookies for the current page |
| `cookies get <key>` | Print a cookie value (`null` if missing) |
| `cookies set <key> <value>` | Set a cookie (path `/`, expires in one year) |
| `cookies remove <key>` | Delete a cookie |
| `local-storage get <key>` | Print a local storage value (`null` if missing) |
| `local-storage set <key> <value>` | Store a value |
| `local-storage remove <key>` | Delete a key |

```bash
cookies set lang en
cookies get lang
cookies list
cookies remove lang

local-storage set theme dark
local-storage set greeting "hello world"
local-storage get theme
local-storage remove theme
```

## Documentation

https://cli.qodalis.com/docs/plugins/browser-storage

## License

MIT
