# @qodalis/vue-cli

Vue 3 components for [Qodalis CLI](https://github.com/qodalis-solutions/web-cli): a web terminal extended through command modules.

[![npm](https://img.shields.io/npm/v/@qodalis/vue-cli.svg)](https://www.npmjs.com/package/@qodalis/vue-cli)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/vue-cli
```

Requires Vue 3.3 or later.

## Usage

```vue
<script setup lang="ts">
import '@qodalis/vue-cli/styles.css';
import { Cli } from '@qodalis/vue-cli';
import { guidModule } from '@qodalis/cli-guid';

const modules = [guidModule];
const options = { welcome: { message: 'Welcome to My App', show: 'daily' as const } };
</script>

<template>
    <Cli :modules="modules" :options="options" :style="{ height: '100vh' }" />
</template>
```

`CliConfigProvider` shares `modules`, `options` and `services` with every terminal below it; props on a component override it:

```vue
<script setup lang="ts">
import { CliConfigProvider, CliPanel } from '@qodalis/vue-cli';
import { guidModule } from '@qodalis/cli-guid';
</script>

<template>
    <CliConfigProvider :modules="[guidModule]">
        <CliPanel :options="{ position: 'bottom' }" />
    </CliConfigProvider>
</template>
```

## Exports

| Export | Purpose |
| --- | --- |
| `Cli` | Terminal. Props: `modules`, `options`, `services`, `snapshot`, `style`, `class`; emits `ready` with the engine |
| `CliPanel` | Panel docked to an edge of the page, with tabs and split panes. Props: `options` (`CliPanelOptions`), `modules`, `services`, `onClose`, plus controlled `collapsed`, `hidden`, `maximized`, `activeTabId`, `position`, `height`, `width` |
| `CliConfigProvider`, `CliConfigKey` | Shared configuration for the terminals below it |
| `CliProvider`, `useCli`, `CliInjectionKey` | Shares one engine instance between components |
| `useCliEngine` | Creates and manages a `CliEngine` on your own container element |
| `CliEngine`, `CliEngineOptions` | Re-exported from `@qodalis/cli` |

## Documentation

- [Getting started](https://cli.qodalis.com/docs/getting-started), [Configuration](https://cli.qodalis.com/docs/configuration), [Panel API](https://cli.qodalis.com/docs/panel-api)
- [Plugins](https://cli.qodalis.com/docs/plugins) and [creating a plugin](https://cli.qodalis.com/docs/create-plugin)
- [Migrating to 2.0](https://cli.qodalis.com/docs/migration)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
