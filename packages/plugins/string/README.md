# @qodalis/cli-string

Transform, analyze and format strings in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-string.svg)](https://www.npmjs.com/package/@qodalis/cli-string)
[![license](https://img.shields.io/npm/l/@qodalis/cli-string.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-string
```

Or install it at runtime in a running terminal:

```bash
pkg add string
```

## Usage

Register `stringModule` with your terminal.

```typescript
import { stringModule } from '@qodalis/cli-string';

// Angular (template)
// <cli [modules]="[stringModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(stringModule)];

// React
<Cli modules={[stringModule]} />

// Vue
<Cli :modules="[stringModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(stringModule);
```

## Commands

`string` (alias `str`). Running `string` alone prints the help. Every sub-command takes the text as its argument or from piped input, and writes the result to the pipeline.

**Case**

| Command | Aliases | Description |
|---|---|---|
| `string upper <text>` | `uppercase`, `toUpper` | Convert to UPPERCASE |
| `string lower <text>` | `lowercase`, `toLower` | Convert to lowercase |
| `string capitalize <text>` | `cap` | Capitalize the first letter, lowercase the rest |
| `string camelCase <text>` | `camel` | Convert to camelCase |
| `string kebabCase <text>` | `kebab` | Convert to kebab-case |
| `string snakeCase <text>` | `snake` | Convert to snake_case |
| `string startCase <text>` | `title`, `titleCase` | Convert to Start Case |

**Transform**

| Command | Aliases | Description |
|---|---|---|
| `string trim <text>` | | Remove whitespace from both ends |
| `string trimStart <text>` | `ltrim` | Remove leading whitespace |
| `string trimEnd <text>` | `rtrim` | Remove trailing whitespace |
| `string reverse <text>` | `rev` | Reverse the characters |
| `string slug <text>` | `slugify` | Convert to a URL-friendly slug (accents removed) |
| `string escape <text>` | `escapeHtml` | Escape HTML entities |
| `string unescape <text>` | `unescapeHtml` | Unescape HTML entities |
| `string repeat <text>` | | Repeat the text N times |
| `string replace <text>` | | Replace every occurrence of a substring |
| `string truncate <text>` | `trunc` | Cut the text to a maximum length, ending with a suffix |
| `string pad <text>` | | Pad the text to a target length |
| `string split <text>` | | Split by a delimiter and list the parts |
| `string words <text>` | | Split into words |

**Analysis**

| Command | Aliases | Description |
|---|---|---|
| `string length <text>` | `len` | Character count |
| `string wc <text>` | `wordcount`, `count` | Count lines, words, characters and bytes |
| `string includes <text>` | `contains`, `has` | Check whether the text contains a substring |
| `string startsWith <text>` | | Check whether the text starts with a prefix |
| `string endsWith <text>` | | Check whether the text ends with a suffix |

| Flag | Alias | Applies to | Default | Description |
|---|---|---|---|---|
| `--count` | `-n` | `repeat` | `2` | Number of repetitions (at most 1000) |
| `--separator` | `--sep` | `repeat` | none | Text placed between repetitions |
| `--find` | `-f` | `replace`, `includes`, `startsWith`, `endsWith` | | Text to search for (required) |
| `--with` | `-w` | `replace` | empty | Replacement text |
| `--length` | `-l` | `truncate`, `pad` | `30` (`truncate`); required for `pad` | Maximum or target length |
| `--suffix` | | `truncate` | `...` | Text appended to truncated output (counts toward the length) |
| `--char` | `-c` | `pad` | space | Padding character |
| `--side` | | `pad` | `both` | `left` (`start`), `right` (`end`) or `both` |
| `--by` | `-d`, `--delimiter` | `split` | space | Delimiter |

```bash
string upper "hello world"                       # HELLO WORLD
string camelCase "hello world"                   # helloWorld
string slug "Hello World! 2024"                  # hello-world-2024
string repeat ha --count=3 --sep=-               # ha-ha-ha
string replace "hello world" --find=world --with=there
string truncate "A very long text" --length=10   # A very ...
string pad hello --length=10 --char=. --side=right
string split a,b,c --by=,
string wc "hello world"
string includes "hello world" --find=world
```

## Documentation

https://cli.qodalis.com/docs/plugins/string

## License

MIT
