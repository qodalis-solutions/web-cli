# @qodalis/angular-cli

Angular wrapper for the [Qodalis Web CLI](https://github.com/qodalis-solutions/web-cli) — a web-based terminal with 50+ built-in commands, theming, and runtime package installation.

## Installation

```bash
npm install @qodalis/angular-cli
```

## Quick Start

Import the module:

```typescript
import { CliModule } from '@qodalis/angular-cli';

@NgModule({
  imports: [CliModule],
})
export class AppModule {}
```

Add styles to `angular.json`:

```json
{
  "styles": [
    "node_modules/@qodalis/angular-cli/src/assets/styles.sass"
  ]
}
```

Use the component:

```html
<!-- Full terminal -->
<cli [options]="cliOptions" />

<!-- Collapsible panel -->
<cli-panel />
```

## Configuration

```typescript
const cliOptions = {
  welcomeMessage: {
    message: '-- Welcome to My App --',
    show: 'daily', // 'never' | 'once' | 'daily' | 'always'
  },
  usersModule: {
    enabled: true,
  },
};
```

## Registering Custom Commands

```typescript
import { CliModule, resolveCommandProcessorProvider } from '@qodalis/angular-cli';
import { MyCommandProcessor } from './my-command-processor';

@NgModule({
  imports: [CliModule],
  providers: [resolveCommandProcessorProvider(MyCommandProcessor)],
})
export class AppModule {}
```

## Exports

| Export | Description |
|--------|-------------|
| `CliModule` | Angular module that registers the terminal components |
| `CliComponent` | Full-screen terminal component (`<cli>`) |
| `CliPanelComponent` | Collapsible panel variant (`<cli-panel>`) |
| `resolveCliProviders` | Helper to register custom command processors via DI |
| `CliEngine` | Re-exported framework-agnostic engine for advanced use |

## Documentation

See the [main README](https://github.com/qodalis-solutions/web-cli#readme) for the full command reference, extension guide, and framework comparison.

## License

MIT
