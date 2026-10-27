# @qodalis/cli-lang-de

German language pack (Deutsch) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-de.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-de)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-de.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `de` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `de` strings.

## Install

```bash
npm install @qodalis/cli-lang-de
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-de
```

## Usage

Register `langDeModule` with your terminal.

```typescript
import { langDeModule } from '@qodalis/cli-lang-de';

// Angular: <cli [modules]="[langDeModule]"></cli>, or providers: [resolveCliModuleProvider(langDeModule)]
// React:   <Cli modules={[langDeModule]} />
// Vue:     <Cli :modules="[langDeModule]" />
// Vanilla: engine.registerModule(langDeModule);
```

Then switch the language in the terminal:

```bash
configure set system.language de
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-de

## License

MIT
