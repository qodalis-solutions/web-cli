# @qodalis/react-cli

React components for [Qodalis CLI](https://github.com/qodalis-solutions/web-cli): a web terminal extended through command modules.

[![npm](https://img.shields.io/npm/v/@qodalis/react-cli.svg)](https://www.npmjs.com/package/@qodalis/react-cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/react-cli
```

Works with React 18 and 19.

## Usage

```tsx
import '@qodalis/react-cli/styles.css';
import { Cli } from '@qodalis/react-cli';
import { guidModule } from '@qodalis/cli-guid';

export function App() {
    return (
        <Cli
            modules={[guidModule]}
            options={{ welcome: { message: 'Welcome to My App', show: 'daily' } }}
            style={{ height: '100vh' }}
        />
    );
}
```

`CliConfigProvider` shares `modules`, `options` and `services` with every terminal below it; props on a component override it:

```tsx
import { CliConfigProvider, CliPanel } from '@qodalis/react-cli';

<CliConfigProvider modules={[guidModule]}>
    <CliPanel options={{ position: 'bottom' }} />
</CliConfigProvider>;
```

## Exports

| Export | Purpose |
| --- | --- |
| `Cli` | Terminal. Props: `modules`, `options`, `services`, `snapshot`, `onReady(engine)`, `style`, `className` |
| `CliPanel` | Panel docked to an edge of the page, with tabs and split panes. Props: `options` (`CliPanelOptions`), `modules`, `services`, `onClose`, plus controlled `collapsed`, `hidden`, `maximized`, `activeTabId`, `position`, `height`, `width` |
| `CliConfigProvider`, `useCliConfig` | Shared configuration for the terminals below it |
| `CliProvider`, `useCli` | Shares one engine instance between components |
| `useCliEngine` | Creates and manages a `CliEngine` on your own container element |
| `CliEngine`, `CliEngineOptions` | Re-exported from `@qodalis/cli` |

## Documentation

- [Getting started](https://cli.qodalis.com/docs/getting-started), [Configuration](https://cli.qodalis.com/docs/configuration), [Panel API](https://cli.qodalis.com/docs/panel-api)
- [Plugins](https://cli.qodalis.com/docs/plugins) and [creating a plugin](https://cli.qodalis.com/docs/create-plugin)
- [Migrating to 2.0](https://cli.qodalis.com/docs/migration)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
