# @qodalis/cli-text-to-image

A CLI extension that converts text into downloadable PNG images. Renders text on an HTML canvas with configurable dimensions, colors, fonts, and alignment, then triggers a browser download.

## Installation

```bash
pkg add @qodalis/cli-text-to-image
```

## Usage

```bash
text-to-image <text> [options]
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `--width` | integer | `800` | Image width in pixels |
| `--height` | integer | `400` | Image height in pixels |
| `--bgColor` | string | `#ffffff` | Background color (hex) |
| `--textColor` | string | `#000000` | Text color (hex) |
| `--font` | string | `30px Arial` | CSS font string |
| `--fileName` | string | `text-image.png` | Output filename |
| `--padding` | integer | `40` | Padding around text in pixels |
| `--textAlign` | string | `center` | Horizontal alignment: `left`, `center`, or `right` |

### Examples

**Basic usage** - creates an 800x400 white image with centered black text:

```bash
text-to-image "Hello World"
```

**Custom colors and font** - dark background with light text:

```bash
text-to-image "Welcome Banner" --bgColor=#1a1a2e --textColor=#e0e0e0 --font="bold 48px Georgia"
```

**Custom dimensions** - long text wraps automatically:

```bash
text-to-image "This is a longer paragraph that will wrap to fit the image" --width=600 --height=300
```

**Left-aligned with padding**:

```bash
text-to-image "Meeting notes for today" --textAlign=left --padding=60
```

**Custom filename**:

```bash
text-to-image "Project Logo" --fileName=logo.png --font="bold 64px Helvetica" --bgColor=#2d3436 --textColor=#dfe6e9
```

## Features

- Automatic word wrapping based on canvas width and padding
- Configurable text alignment (left, center, right)
- CSS font strings for full control over typeface, weight, and size
- Hex color support for background and text
- Direct browser download as PNG

## Programmatic Usage

```typescript
import { textToImageModule } from '@qodalis/cli-text-to-image';

// Register as a module
cliBuilder.addModule(textToImageModule);
```

Or use the processor directly:

```typescript
import { CliTextToImageCommandProcessor } from '@qodalis/cli-text-to-image';

const processor = new CliTextToImageCommandProcessor();
```

## Browser (UMD)

```html
<script src="https://unpkg.com/@qodalis/cli-text-to-image/umd/index.js"></script>
```

The UMD bundle self-registers via `bootCliModule` when loaded.
