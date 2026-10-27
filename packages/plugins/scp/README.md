# @qodalis/cli-scp

Copy files between the browser and Qodalis CLI servers, and browse their file systems, from the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-scp.svg)](https://www.npmjs.com/package/@qodalis/cli-scp)
[![license](https://img.shields.io/npm/l/@qodalis/cli-scp.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-scp
```

Or install it at runtime in a running terminal:

```bash
pkg add scp
```

## Usage

Register `scpModule` with your terminal.

```typescript
import { scpModule } from '@qodalis/cli-scp';

// Angular (template)
// <cli [modules]="[scpModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(scpModule)];

// React
<Cli modules={[scpModule]} />

// Vue
<Cli :modules="[scpModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(scpModule);
```

Requirements:

- Servers listed in the CLI `servers` option. A server is picked by its name (any case).
- The filesystem API (`/api/qcli/fs/*`) enabled on the server, with the paths you need allowed.
- `@qodalis/cli-files` registered for `download` and `upload`: local paths are paths in its virtual file system.

## Commands

`scp`. Running `scp` alone prints the help. Paths with spaces can be quoted: `scp ls node "/my dir"`.

| Command | Aliases | Description |
|---|---|---|
| `scp ls <server> <path>` | | List a remote directory |
| `scp cat <server> <path>` | | Print a remote file |
| `scp stat <server> <path>` | | Show file or directory information |
| `scp download <server> <remote-path> [local-path]` | `get` | Download a file; the local name defaults to the remote file name |
| `scp upload <server> <local-path> <remote-path>` | `put` | Upload a file from the virtual file system |
| `scp upload --local <server> <remote-path>` | `put` | Upload a file picked from your machine |
| `scp mkdir <server> <path>` | | Create a remote directory |
| `scp rm <server> <path>` | | Delete a remote file (no confirmation) |
| `scp <server>:<remote-path> [local-path]` | | Shorthand download |
| `scp <local-path> <server>:<remote-path>` | | Shorthand upload |

Server and paths can also be passed as flags instead of positionals.

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--server` | all sub-commands | | Server name |
| `--path` | `ls`, `cat`, `stat`, `mkdir`, `rm`, `download` | | Remote path |
| `--remote-path` | `download`, `upload` | | Remote path |
| `--local-path` | `download`, `upload` | | Local path in the virtual file system |
| `--save` | `download`, shorthand download | `false` | Download through the browser instead of the virtual file system |
| `--local` | `upload` | `false` | Pick the file with the browser file picker |

```bash
scp ls node /app
scp cat node /app/config.json
scp stat node /app/logs
scp download node /app/data.csv
scp get node /app/data.csv backup.csv --save
scp upload node notes.txt /app/notes.txt
scp put node /app/uploads --local
scp mkdir node /app/backups
scp rm node /app/tmp/old.log
scp ls --server=node --path=/app
scp node:/app/data.csv
scp report.txt node:/app/report.txt
```

## Documentation

https://cli.qodalis.com/docs/plugins/scp

## License

MIT
