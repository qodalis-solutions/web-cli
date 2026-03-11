# @qodalis/cli-core

Shared interfaces, models, types, themes, and utilities for the [Qodalis Web CLI](https://github.com/qodalis-solutions/web-cli) framework.

## Installation

```bash
npm install @qodalis/cli-core
```

## What's Inside

This package provides the foundational types that all Qodalis CLI libraries and plugins depend on:

### Interfaces

- **`ICliCommandProcessor`** — The core interface for implementing CLI commands. Defines `command`, `description`, `processCommand()`, optional sub-processors, parameters, and hooks.
- **`ICliExecutionContext`** — Passed to every command at runtime. Provides access to the terminal writer, input reader, progress bars, spinners, state store, user session, clipboard, and abort signals.
- **`ICliInputReader`** — Terminal input API: `readLine()`, `readPassword()`, `readConfirm()`, `readSelect()` (with optional `onChange` callback for live preview).
- **`ICliTerminalWriter`** — Terminal output API: `writeln()`, `writeError()`, `writeSuccess()`, `writeWarning()`, `writeInfo()`, `wrapInColor()`.

### Models

- **`CliProcessCommand`** — Parsed command with `command`, `value`, `args`, `chainCommands`, and `rawCommand`.
- **`CliProcessorMetadata`** — Processor metadata: `sealed`, `hidden`, `module`, `icon`, `requiredCoreVersion`.
- **`CliSelectOption`** — Options for `readSelect()` interactive menus.
- **`CliStateConfiguration`** — State persistence configuration for processors.

### Themes

Built-in terminal themes (Dark, Dracula, Solarized, etc.) and the `ICliTheme` interface for custom themes.

### Utilities

Helper functions for command parsing, string manipulation, and common CLI operations.

## Usage

```typescript
import {
  ICliCommandProcessor,
  ICliExecutionContext,
  CliProcessCommand,
} from '@qodalis/cli-core';

export class MyCommandProcessor implements ICliCommandProcessor {
  command = 'my-command';
  description = 'Does something useful';

  async processCommand(
    command: CliProcessCommand,
    context: ICliExecutionContext,
  ): Promise<void> {
    context.writer.writeln('Hello from my command!');
  }
}
```

## Documentation

See the [main README](https://github.com/qodalis-solutions/web-cli#readme) for full documentation, framework integration guides, and the complete command reference.

## License

MIT
