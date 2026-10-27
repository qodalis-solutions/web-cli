# @qodalis/cli-sudoku

Play Sudoku in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-sudoku.svg)](https://www.npmjs.com/package/@qodalis/cli-sudoku)
[![license](https://img.shields.io/npm/l/@qodalis/cli-sudoku.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-sudoku
```

Or install it at runtime in a running terminal:

```bash
pkg add sudoku
```

## Usage

Register `sudokuModule` with your terminal.

```typescript
import { sudokuModule } from '@qodalis/cli-sudoku';

// Angular (template)
// <cli [modules]="[sudokuModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(sudokuModule)];

// React
<Cli modules={[sudokuModule]} />

// Vue
<Cli :modules="[sudokuModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(sudokuModule);
```

## Commands

`sudoku`. Running `sudoku` alone starts an easy game in full-screen mode.

| Command | Description |
|---|---|
| `sudoku` | Start an easy game |
| `sudoku easy` | Easy: 38 clues |
| `sudoku medium` | Medium: 30 clues |
| `sudoku hard` | Hard: 24 clues |
| `sudoku scores` | Show the best time for each difficulty |
| `sudoku reset` | Reset all best times |

```bash
sudoku
sudoku medium
sudoku hard
sudoku scores
```

Every puzzle has a unique solution. The clue count is a target: a cell stays filled when removing it would allow more than one solution, so a puzzle can have a few more clues. The game is won when every cell holds the correct number.

## Controls

| Key | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Move the cursor |
| `1`-`9` | Enter a number (or toggle a note in notes mode) |
| `0` / `Backspace` / `Delete` | Clear the cell |
| `N` | Toggle notes mode |
| `H` | Hint: fill the current cell with the correct number |
| `C` | Check: count the wrong numbers |
| `Esc` | Quit |
| `R` | New game at the same difficulty (after a win) |
| `Q` | Quit (after a win) |

The best time for each difficulty, with the date, is kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/sudoku

## License

MIT
