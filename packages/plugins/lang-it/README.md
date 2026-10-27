# @qodalis/cli-lang-it

Italian language pack (Italiano) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-it.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-it)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-it.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `it` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `it` strings.

## Install

```bash
npm install @qodalis/cli-lang-it
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-it
```

## Usage

Register `langItModule` with your terminal.

```typescript
import { langItModule } from '@qodalis/cli-lang-it';

// Angular: <cli [modules]="[langItModule]"></cli>, or providers: [resolveCliModuleProvider(langItModule)]
// React:   <Cli modules={[langItModule]} />
// Vue:     <Cli :modules="[langItModule]" />
// Vanilla: engine.registerModule(langItModule);
```

Then switch the language in the terminal:

```bash
configure set system.language it
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-it

## License

MIT
