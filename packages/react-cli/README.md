# @qodalis/react-cli

React wrapper for the [Qodalis Web CLI](https://github.com/qodalis-solutions/web-cli) — a web-based terminal with 50+ built-in commands, theming, and runtime package installation.

## Installation

```bash
npm install @qodalis/react-cli
```

## Quick Start

```tsx
import { Cli } from '@qodalis/react-cli';

function App() {
  return <Cli style={{ width: '100vw', height: '100vh' }} />;
}
```

## Components

| Export | Description |
|--------|-------------|
| `Cli` | Full-screen terminal component |
| `CliPanel` | Collapsible panel variant |
| `CliProvider` | Context provider for sharing a CLI engine instance across components |
| `CliConfigProvider` | Configuration context provider |
| `useCli` | Hook to access the CLI engine from context |
| `useCliEngine` | Hook to create and manage a CLI engine instance |
| `useCliConfig` | Hook to access CLI configuration from context |
| `CliEngine` | Re-exported framework-agnostic engine for advanced use |

## Configuration

```tsx
import { Cli } from '@qodalis/react-cli';

function App() {
  return (
    <Cli
      options={{
        welcomeMessage: { message: 'Welcome!', show: 'daily' },
        usersModule: { enabled: true },
      }}
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
```

## Registering Custom Commands

```tsx
import { Cli } from '@qodalis/react-cli';
import { GreetCommandProcessor } from './greet-command-processor';

function App() {
  return <Cli processors={[new GreetCommandProcessor()]} />;
}
```

## Documentation

See the [main README](https://github.com/qodalis-solutions/web-cli#readme) for the full command reference, extension guide, and framework comparison.

## License

MIT
