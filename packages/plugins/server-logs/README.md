# @qodalis/cli-server-logs

Stream live server logs into the Qodalis CLI, filtered by level or regex.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-server-logs.svg)](https://www.npmjs.com/package/@qodalis/cli-server-logs)
[![license](https://img.shields.io/npm/l/@qodalis/cli-server-logs.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-server-logs
```

Or install it at runtime in a running terminal:

```bash
pkg add server-logs
```

## Usage

Register `serverLogsModule` with your terminal.

```typescript
import { serverLogsModule } from '@qodalis/cli-server-logs';

// Angular (template)
// <cli [modules]="[serverLogsModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(serverLogsModule)];

// React
<Cli modules={[serverLogsModule]} />

// Vue
<Cli :modules="[serverLogsModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(serverLogsModule);
```

The plugin needs a Qodalis CLI server (.NET, Node.js or Python). It connects to the server's `/ws/v1/qcli/logs` WebSocket.

## Commands

`server logs` (also `server logs live`): a sub-command of the built-in `server` command. It streams log lines until you press Ctrl+C or the server closes the connection.

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--level` | `logs` | all levels | Level sent to the server as a filter: `verbose`, `debug`, `information`, `warning`, `error`, `fatal` |
| `--pattern` | `logs` | | Regex; only matching lines are shown, with the matches highlighted |
| `--server` | `logs` | default server | Configured server name, or a URL (a URL gets no credentials) |
| `--file` | `logs` | `false` | Download the received lines as `logs-<timestamp>.txt` on disconnect |

```bash
server logs
server logs --level=error
server logs --pattern=Exception
server logs --server=node --level=warning
server logs --server=http://localhost:8047
server logs --file
```

## Documentation

https://cli.qodalis.com/docs/plugins/server-logs

## License

MIT
