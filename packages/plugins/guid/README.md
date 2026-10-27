# @qodalis/cli-guid

Generate, validate, format and inspect UUIDs in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-guid.svg)](https://www.npmjs.com/package/@qodalis/cli-guid)
[![license](https://img.shields.io/npm/l/@qodalis/cli-guid.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-guid
```

Or install it at runtime in a running terminal:

```bash
pkg add guid
```

## Usage

Register `guidModule` with your terminal.

```typescript
import { guidModule } from '@qodalis/cli-guid';

// Angular (template)
// <cli [modules]="[guidModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(guidModule)];

// React
<Cli modules={[guidModule]} />

// Vue
<Cli :modules="[guidModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(guidModule);
```

## Commands

`guid` (alias `uuid`). Running `guid` alone prints the help.

| Command | Aliases | Description |
|---|---|---|
| `guid new` | `gen`, `generate` | Generate one or more UUIDs (v4) |
| `guid validate <uuid>` | `check` | Validate a UUID and detect its version |
| `guid format <uuid>` | `fmt` | Convert a UUID to another format |
| `guid inspect <uuid>` | `info`, `parse` | Show version, variant and all formats |
| `guid compare <a> <b>` | `eq`, `equals` | Check whether two UUIDs are equal, ignoring case and format |
| `guid nil` | `empty`, `zero` | Print the nil UUID (all zeros) |

Formats: `default`, `uppercase`, `braces`, `parentheses`, `digits`, `urn`.

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--count`, `-n` | `new` | `1` | Number of UUIDs to generate (1-1000) |
| `--format`, `-f` | `new` | `default` | Output format |
| `--to`, `-t` | `format` | `default` | Target format |
| `--copy`, `-c` | `new`, `format`, `nil` | `false` | Copy the result to the clipboard |
| `--strict` | `validate` | `false` | Only accept v4 UUIDs |

```bash
guid new --count=5 --copy
guid new --format=braces
guid validate 550e8400-e29b-41d4-a716-446655440000 --strict
guid format 550e8400-e29b-41d4-a716-446655440000 --to=urn
guid inspect 550e8400-e29b-41d4-a716-446655440000
guid compare 550e8400-e29b-41d4-a716-446655440000 550E8400-E29B-41D4-A716-446655440000
```

## Configuration

Set with `configure set guid.<key> <value>` or the interactive `configure` menu.

| Key | Default | Description |
|---|---|---|
| `defaultFormat` | `default` | Format used by `guid new` when `--format` is not given |
| `autoCopy` | `false` | Copy generated UUIDs to the clipboard automatically |

## Documentation

https://cli.qodalis.com/docs/plugins/guid

## License

MIT
