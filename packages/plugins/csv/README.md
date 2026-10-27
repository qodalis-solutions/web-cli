# @qodalis/cli-csv

Parse, filter, sort and convert CSV data in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-csv.svg)](https://www.npmjs.com/package/@qodalis/cli-csv)
[![license](https://img.shields.io/npm/l/@qodalis/cli-csv.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-csv
```

Or install it at runtime in a running terminal:

```bash
pkg add csv
```

## Usage

Register `csvModule` with your terminal.

```typescript
import { csvModule } from '@qodalis/cli-csv';

// Angular (template)
// <cli [modules]="[csvModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(csvModule)];

// React
<Cli modules={[csvModule]} />

// Vue
<Cli :modules="[csvModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(csvModule);
```

## Commands

`csv`. Running `csv` alone prints a short usage line.

Every sub-command reads CSV from its argument or from piped input. The first line is the header row; fields are comma-separated and may be double-quoted (`""` escapes a quote).

| Command | Description |
|---|---|
| `csv parse` | Print the data as a `\|`-separated table |
| `csv to-json` | Convert the rows to a JSON array of objects keyed by header |
| `csv columns` | List the column names with their index |
| `csv count` | Print the number of data rows |
| `csv filter` | Keep the rows that match a condition and print them as CSV |
| `csv sort` | Sort the rows by a column and print them as CSV |

None of the sub-commands have aliases.

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--col` | `filter`, `sort` | | Column name (required). An unknown column leaves the rows unchanged |
| `--op` | `filter` | | `eq`, `ne`, `contains`, `gt` or `lt` (required); `gt` and `lt` compare numbers |
| `--val` | `filter` | | Value to compare with (required) |
| `--dir` | `sort` | `asc` | `asc` or `desc`. Numeric columns sort by number, others alphabetically |

```bash
echo "name,age\nAlice,30\nBob,25" | csv parse
echo "name,age\nAlice,30\nBob,25" | csv to-json
echo "name,age\nAlice,30\nBob,25" | csv columns
echo "name,age\nAlice,30\nBob,25" | csv filter --col=age --op=gt --val=28
echo "name,age\nAlice,30\nBob,25" | csv sort --col=age --dir=desc
cat people.csv | csv count
```

The `cat` example needs the files plugin (`@qodalis/cli-files`).

## Documentation

https://cli.qodalis.com/docs/plugins/csv

## License

MIT
