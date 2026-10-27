# @qodalis/cli-tetris

Play the classic Tetris game in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-tetris.svg)](https://www.npmjs.com/package/@qodalis/cli-tetris)
[![license](https://img.shields.io/npm/l/@qodalis/cli-tetris.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-tetris
```

Or install it at runtime in a running terminal:

```bash
pkg add tetris
```

## Usage

Register `tetrisModule` with your terminal.

```typescript
import { tetrisModule } from '@qodalis/cli-tetris';

// Angular (template)
// <cli [modules]="[tetrisModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(tetrisModule)];

// React
<Cli modules={[tetrisModule]} />

// Vue
<Cli :modules="[tetrisModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(tetrisModule);
```

## Commands

`tetris`. Running `tetris` alone starts the game in full-screen mode on a 10x20 board.

| Command | Description |
|---|---|
| `tetris` | Start the game |
| `tetris scores` | Show the top 10 high scores with level and lines |
| `tetris reset` | Reset all high scores |

```bash
tetris
tetris scores
tetris reset
```

Clearing 1, 2, 3 or 4 lines at once scores 100, 300, 500 or 800 points, multiplied by the level. Soft drop adds 1 point per row and hard drop 2 points per row. The level goes up every 10 lines and pieces fall faster. A ghost piece shows where the current piece will land, and the next piece is shown beside the board.

## Controls

| Key | Action |
|---|---|
| Left / Right, `A` / `D` | Move the piece |
| Up / `W` | Rotate clockwise |
| Down / `S` | Soft drop |
| `Space` | Hard drop |
| `P` | Pause or resume |
| `Esc` | Quit |
| `R` | Restart (after game over) |
| `Q` | Quit (after game over) |

High scores (top 20, with level, lines and date) are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/tetris

## License

MIT
