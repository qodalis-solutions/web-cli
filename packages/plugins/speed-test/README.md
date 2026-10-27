# @qodalis/cli-speed-test

Measure download and upload speed from the browser.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-speed-test.svg)](https://www.npmjs.com/package/@qodalis/cli-speed-test)
[![license](https://img.shields.io/npm/l/@qodalis/cli-speed-test.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-speed-test
```

Or install it at runtime in a running terminal:

```bash
pkg add speed-test
```

## Usage

Register `speedTestModule` with your terminal.

```typescript
import { speedTestModule } from '@qodalis/cli-speed-test';

// Angular (template)
// <cli [modules]="[speedTestModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(speedTestModule)];

// React
<Cli modules={[speedTestModule]} />

// Vue
<Cli :modules="[speedTestModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(speedTestModule);
```

## Commands

`speed-test` runs the test directly; `speed-test run` does the same. By default it downloads 25 MB and uploads 10 MB (in 1 MB requests) against Cloudflare's speed test endpoints (`speed.cloudflare.com`), then prints a summary table. Press Ctrl+C to abort.

| Command | Description |
|---|---|
| `speed-test run` | Run the speed test (same as `speed-test`) |

| Flag | Default | Description |
|---|---|---|
| `--download-only` | `false` | Only run the download test |
| `--upload-only` | `false` | Only run the upload test |
| `--download-url` | Cloudflare `__down` (25 MB) | Custom URL for the download test |
| `--upload-url` | Cloudflare `__up` | Custom URL for the upload test (receives POST requests) |

Custom URLs must allow cross-origin requests from the page hosting the terminal.

```bash
speed-test
speed-test --download-only
speed-test run --upload-only
speed-test --download-url=https://example.com/100mb.bin
```

## Documentation

https://cli.qodalis.com/docs/plugins/speed-test

## License

MIT
