# @qodalis/cli-minesweeper

Play Minesweeper in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-minesweeper.svg)](https://www.npmjs.com/package/@qodalis/cli-minesweeper)
[![license](https://img.shields.io/npm/l/@qodalis/cli-minesweeper.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-minesweeper
```

Or install it at runtime in a running terminal:

```bash
pkg add minesweeper
```

## Usage

Register `minesweeperModule` with your terminal.

```typescript
import { minesweeperModule } from '@qodalis/cli-minesweeper';

// Angular (template)
// <cli [modules]="[minesweeperModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(minesweeperModule)];

// React
<Cli modules={[minesweeperModule]} />

// Vue
<Cli :modules="[minesweeperModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(minesweeperModule);
```

## Commands

`minesweeper` (aliases `mines`, `sweep`). Running `minesweeper` alone starts an easy game in full-screen mode.

| Command | Description |
|---|---|
| `minesweeper` | Start an easy game |
| `minesweeper easy` | Easy: 9x9, 10 mines |
| `minesweeper medium` | Medium: 16x16, 40 mines |
| `minesweeper hard` | Hard: 16 rows x 30 columns, 99 mines |
| `minesweeper scores` | Show the best time for each difficulty |
| `minesweeper reset` | Reset all best times |

```bash
minesweeper
mines medium
minesweeper hard
minesweeper scores
```

Mines are placed after the first reveal, so the first cell and its neighbours are always safe. The timer starts with the first reveal. Revealing an empty cell opens the area around it.

## Controls

| Key | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Move the cursor |
| `Enter` / `Space` | Reveal the cell |
| `F` | Flag or unflag the cell |
| `Esc` | Quit |
| `R` | Restart at the same difficulty (after a win or loss) |
| `Q` | Quit (after a win or loss) |

The best time for each difficulty is kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/minesweeper

## License

MIT
