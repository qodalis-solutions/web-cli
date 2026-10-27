# @qodalis/cli-qr

Generate QR codes from text or URLs and download them as PNG images.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-qr.svg)](https://www.npmjs.com/package/@qodalis/cli-qr)
[![license](https://img.shields.io/npm/l/@qodalis/cli-qr.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-qr
```

Or install it at runtime in a running terminal:

```bash
pkg add qr
```

## Usage

Register `qrModule` with your terminal.

```typescript
import { qrModule } from '@qodalis/cli-qr';

// Angular (template)
// <cli [modules]="[qrModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(qrModule)];

// React
<Cli modules={[qrModule]} />

// Vue
<Cli :modules="[qrModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(qrModule);
```

## Commands

`qr`. Running `qr` alone prints the help.

| Command | Description |
|---|---|
| `qr generate` | Generate a QR code and download it as `<fileName>.png` |

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--text` | `generate` | (required) | Text or URL to encode |
| `--fileName` | `generate` | `qr-code` | Name of the downloaded file, without extension |
| `--width` | `generate` | `defaultWidth` (300) | Image width in pixels |
| `--height` | `generate` | `defaultHeight` (300) | Image height in pixels |

```bash
qr generate --text=https://example.com
qr generate --text="Hello world!" --fileName=my-qr
qr generate --text=https://example.com --width=600 --height=600
```

## Configuration

Set with `configure set qr.<key> <value>` or the interactive `configure` menu.

| Key | Default | Description |
|---|---|---|
| `defaultWidth` | `300` | Width in pixels when `--width` is not given (50-2000) |
| `defaultHeight` | `300` | Height in pixels when `--height` is not given (50-2000) |

## Documentation

https://cli.qodalis.com/docs/plugins/qr

## License

MIT
