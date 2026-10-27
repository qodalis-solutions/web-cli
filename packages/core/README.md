# @qodalis/cli-core

Interfaces, models, themes and utilities shared by every [Qodalis CLI](https://github.com/qodalis-solutions/web-cli) package. Plugins depend only on this package, never on a framework.

[![npm](https://img.shields.io/npm/v/@qodalis/cli-core.svg)](https://www.npmjs.com/package/@qodalis/cli-core)
[![Build](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml/badge.svg?branch=develop)](https://github.com/qodalis-solutions/web-cli/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-core
```

## A command and its module

```typescript
import {
    API_VERSION,
    CliProcessCommand,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

class GreetCommandProcessor implements ICliCommandProcessor {
    command = 'greet';
    description = 'Greet someone by name';
    valueRequired = true;

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeSuccess(`Hello, ${command.value}!`);
    }
}

export const greetModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-app-commands',
    processors: [new GreetCommandProcessor()],
};
```

Hosts register the module through the `modules` input/prop, `resolveCliModuleProvider()` (Angular) or `engine.registerModule()`.

## Main types

| Type | Purpose |
| --- | --- |
| `ICliModule` | What a plugin exports: `processors`, `services`, `translations`, `permissions`, `guards`, `dependencies`, `priority`, `configure()` and lifecycle hooks (`onInit`, ...) |
| `ICliCommandProcessor` | A command: `command`, `description`, `parameters`, sub-command `processors`, `processCommand()` |
| `ICliExecutionContext` | Passed to every command: `writer`, `reader`, `state`, `http`, `clipboard`, `spinner`, `progressBar`, `services`, full-screen mode, abort signal |
| `ICliTerminalWriter` | Output: `writeln`, `writeSuccess`, `writeError`, `writeTable`, `writeJson`, `writeBox`, `wrapInColor`, ... |
| `ICliInputReader` | Prompts: `readLine`, `readPassword`, `readConfirm`, `readSelect`, `readMultiSelect`, `readNumber`, `readDate`, `readFile` |
| `CliProcessCommand` | The parsed command: `command`, `value`, `args`, `rawCommand` |
| `CliOptions` | Options shared by the engine and wrappers (`servers`, `logLevel`, `packageSources`, ...) |
| `API_VERSION` | The module API version a plugin is built against |

The package also holds the built-in themes, the panel and server models, and helpers used by plugins.

## Documentation

- [Core concepts](https://cli.qodalis.com/docs/core-concepts) and [creating a plugin](https://cli.qodalis.com/docs/create-plugin)
- [AI plugin development](https://cli.qodalis.com/docs/ai-plugin-development) and the API guide at [llms-full.txt](https://cli.qodalis.com/llms-full.txt)
- [Migrating to 2.0](https://cli.qodalis.com/docs/migration)

## License

[MIT](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)
