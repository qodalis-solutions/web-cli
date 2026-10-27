# @qodalis/cli-wget

Download files from HTTP and HTTPS URLs in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-wget.svg)](https://www.npmjs.com/package/@qodalis/cli-wget)
[![license](https://img.shields.io/npm/l/@qodalis/cli-wget.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-wget
```

Or install it at runtime in a running terminal:

```bash
pkg add wget
```

## Usage

Register `wgetModule` with your terminal.

```typescript
import { wgetModule } from '@qodalis/cli-wget';

// Angular (template)
// <cli [modules]="[wgetModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(wgetModule)];

// React
<Cli modules={[wgetModule]} />

// Vue
<Cli :modules="[wgetModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(wgetModule);
```

## Commands

`wget <url> [options]`. The file name defaults to the last segment of the URL path (`download` when there is none). A progress bar is shown when the server sends `Content-Length`, otherwise a spinner with the byte count.

Where the file goes:

- With `@qodalis/cli-files` registered, it is written to the virtual file system. Text, JSON and XML responses are stored as text; other content is stored as a base64 `data:` URI.
- Without it, or with `--save`, the browser downloads the file.

| Flag | Alias | Default | Description |
|---|---|---|---|
| `--output` | `-o` | from the URL | Output file name |
| `--header` | `-H` | | Custom header, `'Name: value'` (repeatable) |
| `--no-progress` | | `false` | Hide the progress bar and spinner |
| `--save` | | `false` | Download through the browser instead of the virtual file system |

```bash
wget https://example.com/data.json
wget https://example.com/report.csv -o report.csv
wget https://example.com/api/export -H 'Authorization: Bearer <token>'
wget https://example.com/image.png --save
wget https://example.com/big.zip --no-progress
```

The request runs in the browser, so the target server must allow cross-origin requests.

## Documentation

https://cli.qodalis.com/docs/plugins/wget

## License

MIT
