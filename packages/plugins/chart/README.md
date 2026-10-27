# @qodalis/cli-chart

Render ASCII bar charts, line charts and sparklines from data in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-chart.svg)](https://www.npmjs.com/package/@qodalis/cli-chart)
[![license](https://img.shields.io/npm/l/@qodalis/cli-chart.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-chart
```

Or install it at runtime in a running terminal:

```bash
pkg add chart
```

## Usage

Register `chartModule` with your terminal.

```typescript
import { chartModule } from '@qodalis/cli-chart';

// Angular (template)
// <cli [modules]="[chartModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(chartModule)];

// React
<Cli modules={[chartModule]} />

// Vue
<Cli :modules="[chartModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(chartModule);
```

## Commands

`chart`. Running `chart` alone prints the help.

| Command | Description |
|---|---|
| `chart bar [data]` | Horizontal bar chart, scaled to the largest value (bars up to 60 columns) |
| `chart line [data]` | Scatter/line chart, 12 rows high, with min/max on the y axis and labels below |
| `chart sparkline [data]` | Single-line sparkline built from block characters |

None of the sub-commands have aliases or flags.

Data comes from the argument or from piped input, one value per line. A line is either a number (labelled `1`, `2`, ...) or a `label:value` pair. Values that are not numbers count as `0`.

```bash
echo "10\n20\n30" | chart bar
echo "Jan:100\nFeb:200\nMar:150" | chart bar
echo "Jan:100\nFeb:200\nMar:150" | chart line
echo "1\n4\n9\n16\n25" | chart sparkline
cat sales.txt | chart bar
```

The `cat` example needs the files plugin (`@qodalis/cli-files`).

## Documentation

https://cli.qodalis.com/docs/plugins/chart

## License

MIT
