# @qodalis/cli-lang-pt

Portuguese language pack (Português) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-pt.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-pt)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-pt.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `pt` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `pt` strings.

## Install

```bash
npm install @qodalis/cli-lang-pt
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-pt
```

## Usage

Register `langPtModule` with your terminal.

```typescript
import { langPtModule } from '@qodalis/cli-lang-pt';

// Angular: <cli [modules]="[langPtModule]"></cli>, or providers: [resolveCliModuleProvider(langPtModule)]
// React:   <Cli modules={[langPtModule]} />
// Vue:     <Cli :modules="[langPtModule]" />
// Vanilla: engine.registerModule(langPtModule);
```

Then switch the language in the terminal:

```bash
configure set system.language pt
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-pt

## License

MIT
