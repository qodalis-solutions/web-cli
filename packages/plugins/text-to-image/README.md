# @qodalis/cli-text-to-image

Render text into a PNG image and download it from the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-text-to-image.svg)](https://www.npmjs.com/package/@qodalis/cli-text-to-image)
[![license](https://img.shields.io/npm/l/@qodalis/cli-text-to-image.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-text-to-image
```

Or install it at runtime in a running terminal:

```bash
pkg add text-to-image
```

## Usage

Register `textToImageModule` with your terminal.

```typescript
import { textToImageModule } from '@qodalis/cli-text-to-image';

// Angular (template)
// <cli [modules]="[textToImageModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(textToImageModule)];

// React
<Cli modules={[textToImageModule]} />

// Vue
<Cli :modules="[textToImageModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(textToImageModule);
```

## Commands

`text-to-image <text>` draws the text on an HTML canvas, wraps it to the image width, and downloads the result as a PNG. It then prints the options it used. Text is required.

| Flag | Default | Description |
|---|---|---|
| `--width` | `800` | Image width in pixels |
| `--height` | `400` | Image height in pixels |
| `--bgColor` | `#ffffff` | Background color (any CSS color) |
| `--textColor` | `#000000` | Text color (any CSS color) |
| `--font` | `30px Arial` | CSS font string, e.g. `bold 48px Georgia` |
| `--padding` | `40` | Space between the text and the image edges, in pixels |
| `--textAlign` | `center` | `left`, `center` or `right` |
| `--fileName` | `text-image.png` | Name of the downloaded file |

The `width`, `height`, `bgColor`, `textColor` and `font` defaults can be changed through configuration (below).

```bash
text-to-image "Hello World"
text-to-image "Welcome Banner" --bgColor=#1a1a2e --textColor=#e0e0e0 --font="bold 48px Georgia"
text-to-image "This is a longer paragraph that wraps to fit the image" --width=600 --height=300
text-to-image "Meeting notes for today" --textAlign=left --padding=60
text-to-image "Project Logo" --fileName=logo.png --font="bold 64px Helvetica"
```

## Configuration

Set with `configure set text-to-image.<key> <value>` or the interactive `configure` menu.

| Key | Default | Description |
|---|---|---|
| `defaultWidth` | `800` | Image width when `--width` is not given (50-4096) |
| `defaultHeight` | `400` | Image height when `--height` is not given (50-4096) |
| `defaultBgColor` | `#ffffff` | Background color when `--bgColor` is not given |
| `defaultTextColor` | `#000000` | Text color when `--textColor` is not given |
| `defaultFont` | `30px Arial` | Font when `--font` is not given |

## Documentation

https://cli.qodalis.com/docs/plugins/text-to-image

## License

MIT
