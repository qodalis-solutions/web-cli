# @qodalis/cli-lang-zh

Chinese language pack (中文) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-zh.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-zh)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-zh.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `zh` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `zh` strings.

## Install

```bash
npm install @qodalis/cli-lang-zh
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-zh
```

## Usage

Register `langZhModule` with your terminal.

```typescript
import { langZhModule } from '@qodalis/cli-lang-zh';

// Angular: <cli [modules]="[langZhModule]"></cli>, or providers: [resolveCliModuleProvider(langZhModule)]
// React:   <Cli modules={[langZhModule]} />
// Vue:     <Cli :modules="[langZhModule]" />
// Vanilla: engine.registerModule(langZhModule);
```

Then switch the language in the terminal:

```bash
configure set system.language zh
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-zh

## License

MIT
