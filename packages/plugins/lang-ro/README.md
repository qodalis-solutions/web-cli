# @qodalis/cli-lang-ro

Romanian language pack (Română) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-ro.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-ro)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-ro.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `ro` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `ro` strings.

## Install

```bash
npm install @qodalis/cli-lang-ro
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-ro
```

## Usage

Register `langRoModule` with your terminal.

```typescript
import { langRoModule } from '@qodalis/cli-lang-ro';

// Angular: <cli [modules]="[langRoModule]"></cli>, or providers: [resolveCliModuleProvider(langRoModule)]
// React:   <Cli modules={[langRoModule]} />
// Vue:     <Cli :modules="[langRoModule]" />
// Vanilla: engine.registerModule(langRoModule);
```

Then switch the language in the terminal:

```bash
configure set system.language ro
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-ro

## License

MIT
