# @qodalis/cli-cron

Run a command again and again at a fixed interval in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-cron.svg)](https://www.npmjs.com/package/@qodalis/cli-cron)
[![license](https://img.shields.io/npm/l/@qodalis/cli-cron.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-cron
```

Or install it at runtime in a running terminal:

```bash
pkg add cron
```

## Usage

Register `cronModule` with your terminal.

```typescript
import { cronModule } from '@qodalis/cli-cron';

// Angular (template)
// <cli [modules]="[cronModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(cronModule)];

// React
<Cli modules={[cronModule]} />

// Vue
<Cli :modules="[cronModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(cronModule);
```

Jobs run only while the terminal is open. They are saved in the CLI state store, so enabled jobs start again when the terminal starts.

## Commands

`cron`. Running `cron` alone prints the number of jobs and the sub-commands; `help cron` shows the full help.

| Command | Aliases | Description |
|---|---|---|
| `cron add <name> <interval> <command>` | | Add a job and start it; names must be unique |
| `cron list` | `ls` | List jobs with interval, status, command and run count |
| `cron disable <name>` | | Pause a job without removing it |
| `cron enable <name>` | | Resume a paused job |
| `cron remove <name>` | `rm`, `delete` | Stop and remove a job |

The command of `cron add` is everything after the interval, as typed, or a single quoted argument. The interval is a number of seconds (`30`) or a combination of hours, minutes and seconds (`1h`, `5m`, `90s`, `1h30m`), at least 10 seconds.

There are no flags.

```bash
cron add ping 5m echo heartbeat
cron add backup 1h30m server jobs trigger backup
cron add greet 30 "echo hello"
cron list
cron disable ping
cron enable ping
cron remove ping
```

## Documentation

https://cli.qodalis.com/docs/plugins/cron

## License

MIT
