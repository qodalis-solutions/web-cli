# @qodalis/vue-cli

Vue 3 wrapper for the [Qodalis Web CLI](https://github.com/qodalis-solutions/web-cli) — a web-based terminal with 50+ built-in commands, theming, and runtime package installation.

## Installation

```bash
npm install @qodalis/vue-cli
```

## Quick Start

```vue
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';
</script>

<template>
  <Cli :style="{ width: '100vw', height: '100vh' }" />
</template>
```

## Components

| Export | Description |
|--------|-------------|
| `Cli` | Full-screen terminal component |
| `CliPanel` | Collapsible panel variant |
| `CliProvider` | Provider component for sharing a CLI engine instance |
| `useCli` | Composable to access the CLI engine from the provider |
| `useCliEngine` | Composable to create and manage a CLI engine instance |
| `CliInjectionKey` | Injection key for provide/inject pattern |
| `CliEngine` | Re-exported framework-agnostic engine for advanced use |

## Configuration

```vue
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';

const options = {
  welcomeMessage: { message: 'Welcome!', show: 'daily' },
  usersModule: { enabled: true },
};
</script>

<template>
  <Cli :options="options" :style="{ width: '100vw', height: '100vh' }" />
</template>
```

## Registering Custom Commands

```vue
<script setup lang="ts">
import { Cli } from '@qodalis/vue-cli';
import { GreetCommandProcessor } from './greet-command-processor';

const processors = [new GreetCommandProcessor()];
</script>

<template>
  <Cli :processors="processors" />
</template>
```

## Documentation

See the [main README](https://github.com/qodalis-solutions/web-cli#readme) for the full command reference, extension guide, and framework comparison.

## License

MIT
