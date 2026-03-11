# @qodalis/cli

Framework-agnostic terminal engine for the [Qodalis Web CLI](https://github.com/qodalis-solutions/web-cli) — 50+ built-in commands, theming, runtime package installation, and extensible command processing.

## Installation

```bash
npm install @qodalis/cli
```

## Quick Start

```typescript
import { CliEngine } from '@qodalis/cli';

const engine = new CliEngine(document.getElementById('terminal')!, {
  welcomeMessage: { message: 'Welcome!', show: 'always' },
});

engine.registerProcessors([new MyCommandProcessor()]);
await engine.start();
```

## What's Inside

This is the core engine that powers all framework wrappers (`@qodalis/angular-cli`, `@qodalis/react-cli`, `@qodalis/vue-cli`). It provides:

- **`CliEngine`** — Main entry point. Manages the xterm.js terminal, command execution, input handling, theming, and state persistence.
- **Command processor registry** — Register, discover, and execute command processors.
- **Built-in commands** — 50+ commands: help, theme, pkg, echo, eval, json, base64, hash, random, and more.
- **Command parsing** — Supports flags, quoted strings, chaining (`&&`, `||`, `|`, `>>`), and argument coercion.
- **Input reader** — Interactive prompts: `readLine`, `readPassword`, `readConfirm`, `readSelect` (with live preview via `onChange`).
- **Theming** — Built-in themes with interactive selection and custom color support.
- **Runtime package manager** — Install npm packages at runtime without rebuilding.
- **State persistence** — Per-processor state storage across sessions.

## When to Use This Package

Use `@qodalis/cli` directly when:
- Building a vanilla JS/TS application without a framework
- Integrating into a framework not covered by the existing wrappers
- Needing low-level control over the terminal engine

For framework-specific wrappers, use [`@qodalis/angular-cli`](https://www.npmjs.com/package/@qodalis/angular-cli), [`@qodalis/react-cli`](https://www.npmjs.com/package/@qodalis/react-cli), or [`@qodalis/vue-cli`](https://www.npmjs.com/package/@qodalis/vue-cli).

## Documentation

See the [main README](https://github.com/qodalis-solutions/web-cli#readme) for the full command reference, extension guide, and configuration options.

## License

MIT
