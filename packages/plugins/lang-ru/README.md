# @qodalis/cli-lang-ru

Russian language pack (Русский) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-ru.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-ru)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-ru.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `ru` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `ru` strings.

## Install

```bash
npm install @qodalis/cli-lang-ru
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-ru
```

## Usage

Register `langRuModule` with your terminal.

```typescript
import { langRuModule } from '@qodalis/cli-lang-ru';

// Angular: <cli [modules]="[langRuModule]"></cli>, or providers: [resolveCliModuleProvider(langRuModule)]
// React:   <Cli modules={[langRuModule]} />
// Vue:     <Cli :modules="[langRuModule]" />
// Vanilla: engine.registerModule(langRuModule);
```

Then switch the language in the terminal:

```bash
configure set system.language ru
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-ru

## License

MIT
