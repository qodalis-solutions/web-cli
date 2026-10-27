# @qodalis/electron-cli

Electron integration for [Qodalis CLI](https://github.com/qodalis-solutions/web-cli): native file dialogs, the system clipboard and the default browser for a terminal running in an Electron app.

[![npm](https://img.shields.io/npm/v/@qodalis/electron-cli.svg)](https://www.npmjs.com/package/@qodalis/electron-cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/electron-cli
```

Requires Electron 28 or later. The renderer shows the terminal with one of the wrappers ([`@qodalis/react-cli`](https://www.npmjs.com/package/@qodalis/react-cli), [`@qodalis/vue-cli`](https://www.npmjs.com/package/@qodalis/vue-cli), [`@qodalis/angular-cli`](https://www.npmjs.com/package/@qodalis/angular-cli)) or [`@qodalis/cli`](https://www.npmjs.com/package/@qodalis/cli).

## Setup

The package has an entry point for each Electron process.

**1. Main process**: register the IPC handlers before creating a window.

```typescript
import { app } from 'electron';
import { registerElectronCliIpcHandlers } from '@qodalis/electron-cli/main';

registerElectronCliIpcHandlers({
    allowedPaths: [app.getPath('documents')], // optional; omitted or empty allows every path
});
```

**2. Preload script**: expose the bridge as `window.electronCliApi`. The window needs `contextIsolation: true` and a preload script that can import modules (`sandbox: false`, or a bundled preload).

```typescript
import { exposeElectronCliApi } from '@qodalis/electron-cli/preload';

exposeElectronCliApi();
```

**3. Renderer**: add `electronModule` to the terminal's modules.

```tsx
import '@qodalis/react-cli/styles.css';
import { Cli } from '@qodalis/react-cli';
import { electronModule } from '@qodalis/electron-cli';

export function App() {
    return <Cli modules={[electronModule]} style={{ height: '100vh' }} />;
}
```

## What `electronModule` changes

| Feature | In the browser | With `electronModule` |
| --- | --- | --- |
| File transfer (uploads and downloads) | Browser file input and downloads | Native open and save dialogs, real filesystem |
| Clipboard | `navigator.clipboard` | Electron `clipboard` |
| `open <url>` | `window.open()` | `shell.openExternal()` in the default browser |

`allowedPaths` restricts the filesystem calls (read, write, list, exists) to those directories. The services (`ElectronFileTransferService`, `ElectronClipboardService`, `ElectronFilePickerProvider`) and the `ElectronCliApi` type are exported for custom setups.

A complete app is in [`apps/demo-electron`](https://github.com/qodalis-solutions/web-cli/tree/main/apps/demo-electron) (`pnpm run serve:electron-demo`).

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
