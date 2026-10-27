# @qodalis/angular-cli

Angular components for [Qodalis CLI](https://github.com/qodalis-solutions/web-cli): a web terminal extended through command modules.

[![npm](https://img.shields.io/npm/v/@qodalis/angular-cli.svg)](https://www.npmjs.com/package/@qodalis/angular-cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/angular-cli
```

Requires Angular 22 or later; works with zoneless and zone.js change detection. Add the stylesheet to `angular.json`:

```json
"styles": ["node_modules/@qodalis/angular-cli/src/assets/styles.css"]
```

## Usage

Import `CliModule` and pass the modules (plugins or your own commands) to the component:

```typescript
import { Component } from '@angular/core';
import { CliModule } from '@qodalis/angular-cli';
import { ICliModule } from '@qodalis/cli-core';
import { guidModule } from '@qodalis/cli-guid';

@Component({
    selector: 'app-root',
    imports: [CliModule],
    template: `<cli [modules]="modules" [options]="options" height="100vh" />`,
})
export class AppComponent {
    modules: ICliModule[] = [guidModule];
    options = { welcome: { message: 'Welcome to My App', show: 'daily' as const } };
}
```

To register modules once for every `<cli>` and `<cli-panel>` in the app, provide them through DI instead:

```typescript
import { ApplicationConfig } from '@angular/core';
import { resolveCliModuleProvider } from '@qodalis/angular-cli';
import { guidModule } from '@qodalis/cli-guid';

export const appConfig: ApplicationConfig = {
    providers: [resolveCliModuleProvider(guidModule)],
};
```

## Components

| Selector | Inputs | Outputs |
| --- | --- | --- |
| `<cli>` | `options`, `modules`, `height`, `snapshot` | `engineReady` (the `CliEngine`) |
| `<cli-panel>` | `options` (`CliPanelOptions`: `position`, `isCollapsed`, `isHidden`, `resizable`, ...), `modules`, `collapsed`, `hidden`, `maximized`, `activeTabId`, `position`, `height`, `width` | `onClose`, `collapsedChange`, `hiddenChange`, `maximizedChange`, `activeTabIdChange` |

`<cli-panel>` is a panel docked to an edge of the page (`'bottom' | 'top' | 'left' | 'right'`) with tabs and split panes.

## Exports

| Export | Purpose |
| --- | --- |
| `CliModule` | Declares and exports `<cli>` and `<cli-panel>` |
| `CliComponent`, `CliPanelComponent`, `CliPanelOptions` | The components and panel options type |
| `resolveCliModuleProvider(module)` | Registers an `ICliModule` through DI |
| `CliEngine`, `CliEngineOptions` | Re-exported from `@qodalis/cli` |

## Documentation

- [Getting started](https://cli.qodalis.com/docs/getting-started), [Configuration](https://cli.qodalis.com/docs/configuration), [Panel API](https://cli.qodalis.com/docs/panel-api)
- [Plugins](https://cli.qodalis.com/docs/plugins) and [creating a plugin](https://cli.qodalis.com/docs/create-plugin)
- [Migrating to 2.0](https://cli.qodalis.com/docs/migration)
- Example app: [qodalis-cli-angular-example](https://github.com/qodalis-solutions/qodalis-cli-angular-example)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
