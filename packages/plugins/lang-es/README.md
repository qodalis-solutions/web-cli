# @qodalis/cli-lang-es

Spanish language pack (Español) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-es.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-es)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-es.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `es` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `es` strings.

## Install

```bash
npm install @qodalis/cli-lang-es
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-es
```

## Usage

Register `langEsModule` with your terminal.

```typescript
import { langEsModule } from '@qodalis/cli-lang-es';

// Angular: <cli [modules]="[langEsModule]"></cli>, or providers: [resolveCliModuleProvider(langEsModule)]
// React:   <Cli modules={[langEsModule]} />
// Vue:     <Cli :modules="[langEsModule]" />
// Vanilla: engine.registerModule(langEsModule);
```

Then switch the language in the terminal:

```bash
configure set system.language es
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-es

## License

MIT
