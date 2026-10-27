# @qodalis/cli-wordle

Play the Wordle word-guessing game in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-wordle.svg)](https://www.npmjs.com/package/@qodalis/cli-wordle)
[![license](https://img.shields.io/npm/l/@qodalis/cli-wordle.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-wordle
```

Or install it at runtime in a running terminal:

```bash
pkg add wordle
```

## Usage

Register `wordleModule` with your terminal.

```typescript
import { wordleModule } from '@qodalis/cli-wordle';

// Angular (template)
// <cli [modules]="[wordleModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(wordleModule)];

// React
<Cli modules={[wordleModule]} />

// Vue
<Cli :modules="[wordleModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(wordleModule);
```

## Commands

`wordle`. Running `wordle` alone starts a game in full-screen mode.

| Command | Description |
|---|---|
| `wordle` | Start the game |
| `wordle stats` | Show statistics: games played, win rate, streaks and guess distribution |
| `wordle reset` | Reset all statistics |

```bash
wordle
wordle stats
wordle reset
```

Guess a random five-letter word in six tries. Guesses must come from the built-in list of 300 words. Letters turn green when they are in the right spot, yellow when they are in the word elsewhere and gray when they are not in the word. An on-screen keyboard shows the status of each letter.

## Controls

| Key | Action |
|---|---|
| `A`-`Z` | Type a letter |
| `Backspace` | Delete the last letter |
| `Enter` | Submit the guess (5 letters) |
| `Esc` | Quit |
| `R` | Play again (after the game ends) |
| `Q` | Quit (after the game ends) |

During a game only `Esc` quits, since `Q` is a letter.

Statistics are kept in the terminal state and persisted between sessions.

## Documentation

https://cli.qodalis.com/docs/plugins/wordle

## License

MIT
