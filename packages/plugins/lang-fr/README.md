# @qodalis/cli-lang-fr

French language pack (Français) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-fr.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-fr)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-fr.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `fr` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `fr` strings.

## Install

```bash
npm install @qodalis/cli-lang-fr
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-fr
```

## Usage

Register `langFrModule` with your terminal.

```typescript
import { langFrModule } from '@qodalis/cli-lang-fr';

// Angular: <cli [modules]="[langFrModule]"></cli>, or providers: [resolveCliModuleProvider(langFrModule)]
// React:   <Cli modules={[langFrModule]} />
// Vue:     <Cli :modules="[langFrModule]" />
// Vanilla: engine.registerModule(langFrModule);
```

Then switch the language in the terminal:

```bash
configure set system.language fr
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-fr

## License

MIT
