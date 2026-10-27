# @qodalis/cli-snake

Play the classic Snake game in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-snake.svg)](https://www.npmjs.com/package/@qodalis/cli-snake)
[![license](https://img.shields.io/npm/l/@qodalis/cli-snake.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-snake
```

Or install it at runtime in a running terminal:

```bash
pkg add snake
```

## Usage

Register `snakeModule` with your terminal.

```typescript
import { snakeModule } from '@qodalis/cli-snake';

// Angular (template)
// <cli [modules]="[snakeModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(snakeModule)];

// React
<Cli modules={[snakeModule]} />

// Vue
<Cli :modules="[snakeModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(snakeModule);
```

## Commands

`snake` (alias `snek`). Running `snake` alone starts the game in full-screen mode.

| Command | Description |
|---|---|
| `snake` | Start the game |
| `snake scores` | Show the top 10 high scores |
| `snake reset` | Reset all high scores |

```bash
snake
snake scores
snake reset
```

Each food is worth 10 points and makes the snake faster. Hitting a wall or the snake's own body ends the game. The board size follows the terminal size.

## Controls

| Key | Action |
|---|---|
| Arrow keys / `W` `A` `S` `D` | Change direction |
| `Space` | Pause or resume |
| `Esc` | Quit |
| `R` | Restart (after game over) |
| `Q` | Quit (after game over) |

High scores (top 20, with the date) are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/snake

## License

MIT
