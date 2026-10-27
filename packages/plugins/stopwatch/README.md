# @qodalis/cli-stopwatch

Interactive stopwatch and countdown timer for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-stopwatch.svg)](https://www.npmjs.com/package/@qodalis/cli-stopwatch)
[![license](https://img.shields.io/npm/l/@qodalis/cli-stopwatch.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-stopwatch
```

Or install it at runtime in a running terminal:

```bash
pkg add stopwatch
```

## Usage

Register `stopwatchModule` with your terminal.

```typescript
import { stopwatchModule } from '@qodalis/cli-stopwatch';

// Angular (template)
// <cli [modules]="[stopwatchModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(stopwatchModule)];

// React
<Cli modules={[stopwatchModule]} />

// Vue
<Cli :modules="[stopwatchModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(stopwatchModule);
```

## Commands

`stopwatch` (alias `sw`). Running `stopwatch` alone starts the stopwatch in full-screen mode.

| Command | Description |
|---|---|
| `stopwatch` | Start an interactive stopwatch with laps |
| `stopwatch timer <duration>` | Run a countdown timer with a progress bar |

Durations: `30s`, `5m`, `1h`, `2h30m`, `1h30m45s`, or a plain number of seconds (`90`). Write them without spaces. The minimum is 10 seconds.

```bash
stopwatch
sw
stopwatch timer 5m
stopwatch timer 1h30m
stopwatch timer 90
```

When you quit the stopwatch, the final time and all laps are printed. A timer stopped early prints the elapsed time out of the total.

## Controls

Stopwatch:

| Key | Action |
|---|---|
| `Space` / `P` | Pause or resume |
| `L` | Record a lap (the last 5 are shown) |
| `R` | Reset and start again |
| `Q` / `Ctrl+C` | Quit |

Timer:

| Key | Action |
|---|---|
| `Space` / `P` | Pause or resume |
| `R` | Reset to the full duration (paused) |
| `Q` / `Ctrl+C` | Quit |
| Any key | Exit once the timer has finished |

## Documentation

https://cli.qodalis.com/docs/plugins/stopwatch

## License

MIT
