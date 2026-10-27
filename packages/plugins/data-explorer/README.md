# @qodalis/cli-data-explorer

Full-screen query console for server data sources (SQL, MongoDB, Redis, Elasticsearch and custom providers) in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-data-explorer.svg)](https://www.npmjs.com/package/@qodalis/cli-data-explorer)
[![license](https://img.shields.io/npm/l/@qodalis/cli-data-explorer.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-data-explorer
```

Or install it at runtime in a running terminal:

```bash
pkg add data-explorer
```

## Usage

Register `dataExplorerModule` with your terminal.

```typescript
import { dataExplorerModule } from '@qodalis/cli-data-explorer';

// Angular (template)
// <cli [modules]="[dataExplorerModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(dataExplorerModule)];

// React
<Cli modules={[dataExplorerModule]} />

// Vue
<Cli :modules="[dataExplorerModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(dataExplorerModule);
```

## Server requirement

The plugin runs queries on a Qodalis CLI server (Node `@qodalis/cli-server-node`, .NET or Python) that has at least one data explorer provider registered (SQL, MongoDB, Redis, Elasticsearch, ...). Add the server to the CLI options:

```typescript
const options: CliOptions = {
    servers: [{ name: 'node', url: 'http://localhost:8047' }],
};
```

It calls `GET /api/qcli/data-explorer/sources`, `POST /api/qcli/data-explorer/execute` and `GET /api/qcli/data-explorer/schema`, sending the server's auth headers.

## Commands

`data-explorer` fetches the server's data sources, asks you to pick one (skipped when there is only one) and opens a full-screen query console.

| Flag | Default | Description |
|---|---|---|
| `--server` | default server, else the first configured | Server name from `servers`, or a full `http(s)://` URL |

```bash
data-explorer
data-explorer --server=node
data-explorer --server=http://localhost:8046
```

### Writing queries

Queries can span several lines. Enter runs the query once it is complete:

- SQL sources: when it ends with `;`.
- Redis sources: always (single line).
- Elasticsearch sources: when braces are balanced, or there are none.
- MongoDB and other sources: when brackets, braces and parentheses are balanced.

```
data-explorer> SELECT * FROM users WHERE active = 1;
data-explorer> db.users.find({"age": {"$gt": 25}})
```

The query syntax itself (for example MongoDB's `db.<collection>.<operation>(...)`) is defined by the server's provider.

### Console commands

Type these on an empty line. They also work with `/` instead of `\`.

| Command | Description |
|---|---|
| `\format <table\|json\|csv\|raw>` | Switch the output format (the source sets the initial one) |
| `\templates` | List the source's query templates |
| `\use <name>` | Show a template's query |
| `\schema [table]` | Show the database schema, or one table |
| `\history` | Show query history |
| `\clear` | Clear the screen |
| `\help` | Show all commands |
| `\quit`, `\q` | Exit the console |

### Keys

| Key | Action |
|---|---|
| Enter | Run the query when complete, otherwise start a new line |
| Up / Down | Move between lines; on the first line, browse history |
| Left / Right, Home / End (Ctrl+A / Ctrl+E) | Move the cursor |
| Ctrl+L | Clear the screen |
| Ctrl+C | Discard the current query; on an empty prompt, exit |
| Escape | Exit |

History keeps the last 50 queries per data source in the CLI state.

## Documentation

https://cli.qodalis.com/docs/plugins/data-explorer

## License

MIT
