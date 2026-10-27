# @qodalis/cli-2048

Play the 2048 sliding-tile puzzle in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-2048.svg)](https://www.npmjs.com/package/@qodalis/cli-2048)
[![license](https://img.shields.io/npm/l/@qodalis/cli-2048.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-2048
```

Or install it at runtime in a running terminal:

```bash
pkg add 2048
```

## Usage

Register `game2048Module` with your terminal.

```typescript
import { game2048Module } from '@qodalis/cli-2048';

// Angular (template)
// <cli [modules]="[game2048Module]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(game2048Module)];

// React
<Cli modules={[game2048Module]} />

// Vue
<Cli :modules="[game2048Module]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(game2048Module);
```

## Commands

`2048`. Running `2048` alone starts the game in full-screen mode on a 4x4 grid.

| Command | Description |
|---|---|
| `2048` | Start the game |
| `2048 scores` | Show the top 10 high scores |
| `2048 reset` | Reset all high scores |

```bash
2048
2048 scores
2048 reset
```

Each move adds a new tile (2, or 4 one time in ten). Reaching a 2048 tile shows a win screen where you can keep playing. The game ends when no move is possible.

## Controls

| Key | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Slide the tiles |
| `U` | Undo the last move (one level) |
| `Esc` | Quit |
| `C` | Keep playing (on the win screen) |
| `Q` | Quit (on the win or game over screen) |
| `R` | Restart (after game over) |

High scores (top 20, with the date) are saved when a game ends, kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/2048

## License

MIT
