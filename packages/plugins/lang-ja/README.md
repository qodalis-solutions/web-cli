# @qodalis/cli-lang-ja

Japanese language pack (日本語) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-ja.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-ja)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-ja.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `ja` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `ja` strings.

## Install

```bash
npm install @qodalis/cli-lang-ja
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-ja
```

## Usage

Register `langJaModule` with your terminal.

```typescript
import { langJaModule } from '@qodalis/cli-lang-ja';

// Angular: <cli [modules]="[langJaModule]"></cli>, or providers: [resolveCliModuleProvider(langJaModule)]
// React:   <Cli modules={[langJaModule]} />
// Vue:     <Cli :modules="[langJaModule]" />
// Vanilla: engine.registerModule(langJaModule);
```

Then switch the language in the terminal:

```bash
configure set system.language ja
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-ja

## License

MIT
