# @qodalis/cli-regex

Test, match, replace, split and extract with regular expressions in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-regex.svg)](https://www.npmjs.com/package/@qodalis/cli-regex)
[![license](https://img.shields.io/npm/l/@qodalis/cli-regex.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-regex
```

Or install it at runtime in a running terminal:

```bash
pkg add regex
```

## Usage

Register `regexModule` with your terminal.

```typescript
import { regexModule } from '@qodalis/cli-regex';

// Angular (template)
// <cli [modules]="[regexModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(regexModule)];

// React
<Cli modules={[regexModule]} />

// Vue
<Cli :modules="[regexModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(regexModule);
```

## Commands

`regex` (alias `re`). Running `regex` alone prints the help. Every sub-command takes the text as its value and the pattern as `--pattern`.

| Command | Aliases | Description |
|---|---|---|
| `regex test <text>` | `check`, `is-match` | Test whether the pattern matches the text |
| `regex match <text>` | `find` | Show the first match with its index and capture groups |
| `regex match-all <text>` | `matches`, `find-all` | Show every match (always global) |
| `regex replace <text>` | `sub`, `substitute` | Replace matches (`$1`, `$2`, `$<name>` in the replacement) |
| `regex split <text>` | | Split the text on the pattern |
| `regex extract <text>` | `groups`, `capture` | Print the capture groups of every match (always global) |

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--pattern`, `-p` | all | (required) | Regular expression, without slashes |
| `--with`, `-w` | `replace` | (required) | Replacement string |
| `--limit`, `-n` | `split` | none | Maximum number of parts |
| `--flags`, `-f` | all | none (`g` for `replace`) | Regex flags; only `g`, `i`, `m`, `s`, `u` are kept |
| `--case-insensitive`, `-i` | all | `false` | Add the `i` flag |
| `--copy`, `-c` | all except `test` | `false` | Copy the result to the clipboard |

Passing `--flags` to `replace` replaces its default `g`, so include `g` to keep replacing every match.

```bash
regex test "abc123" --pattern="\d+"
regex match "hello world" --pattern="(\w+)\s(\w+)"
regex match-all "a1 b2 c3" --pattern="[a-z]\d" --copy
regex replace "2024-01-15" --pattern="(\d{4})-(\d{2})-(\d{2})" --with="$2/$3/$1"
regex replace "Hello hello" --pattern=hello --with=bye --flags=gi
regex split "a1b2c3" --pattern="\d" --limit=2
regex extract "key=value; a=b" --pattern="(\w+)=(\w+)"
```

## Documentation

https://cli.qodalis.com/docs/plugins/regex

## License

MIT
