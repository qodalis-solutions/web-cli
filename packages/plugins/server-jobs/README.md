# @qodalis/cli-server-jobs

List, run, pause and inspect background jobs on connected Qodalis CLI servers.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-server-jobs.svg)](https://www.npmjs.com/package/@qodalis/cli-server-jobs)
[![license](https://img.shields.io/npm/l/@qodalis/cli-server-jobs.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-server-jobs
```

Or install it at runtime in a running terminal:

```bash
pkg add server-jobs
```

## Usage

Register `jobsModule` with your terminal.

```typescript
import { jobsModule } from '@qodalis/cli-server-jobs';

// Angular (template)
// <cli [modules]="[jobsModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(jobsModule)];

// React
<Cli modules={[jobsModule]} />

// Vue
<Cli :modules="[jobsModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(jobsModule);
```

The plugin needs at least one connected Qodalis CLI server (.NET, Node.js or Python) that exposes the jobs API (`/api/v1/qcli/jobs`). Live events come over the server's `/ws/v1/qcli/events` WebSocket. Job names are completed with Tab.

## Commands

`server jobs`: a sub-command of the built-in `server` command. Running `server jobs` alone lists the jobs.

A job is picked by name (any case) or ID and looked up on every connected server; an action applies to each server that has the job. `--server` limits a command to one server.

| Command | Aliases | Description |
|---|---|---|
| `server jobs list` | `ls` | List jobs on all connected servers (one table per server) |
| `server jobs info <name\|id>` | | Show schedule, retries, timeout, overlap policy, current and last run |
| `server jobs trigger <name\|id>` | | Run a job now; its schedule does not change |
| `server jobs pause <name\|id>` | | Stop running the job on its schedule until resumed |
| `server jobs resume <name\|id>` | | Put a paused job back on its schedule |
| `server jobs stop <name\|id>` | | Take the job off its schedule and cancel the run in progress |
| `server jobs cancel <name\|id>` | | Cancel the run in progress; the job stays scheduled |
| `server jobs history <name\|id>` | | List past runs: status, start, duration, attempt, error |
| `server jobs logs <name\|id>` | | Print the log entries of the latest run, or of one run |
| `server jobs edit <name\|id>` | | Interactively edit description, group, cron schedule or interval, max retries, timeout and overlap policy (`skip`, `queue`, `cancel`) |
| `server jobs watch` | | Follow job events live; Ctrl+C stops |

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--server` | all | all connected servers | Target one server by name |
| `--group` | `list` | | Only jobs in this group |
| `--limit` | `history` | `20` | Number of runs to show |
| `--offset` | `history` | `0` | Offset for paging through older runs |
| `--status` | `history` | | Only runs with this status (`running`, `completed`, `failed`, `cancelled`, `timed_out`) |
| `--exec` | `logs` | latest run | Execution ID (from `history`) to show logs for |

`edit` asks for each setting; press Enter to keep a value and Ctrl+C or Escape to cancel. Nothing is sent until you confirm. A job that exists on several servers needs `--server`.

```bash
server jobs
server jobs ls --server=node
server jobs list --group=reports
server jobs info cleanup
server jobs trigger cleanup
server jobs logs cleanup
server jobs history cleanup --status=failed --limit=5
server jobs logs cleanup --exec=3f2a91c0
server jobs pause cleanup
server jobs resume cleanup
server jobs edit cleanup --server=node
server jobs watch
```

## Documentation

https://cli.qodalis.com/docs/plugins/server-jobs

## License

MIT
