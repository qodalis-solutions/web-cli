# @qodalis/cli-lang-ko

Korean language pack (한국어) for the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-lang-ko.svg)](https://www.npmjs.com/package/@qodalis/cli-lang-ko)
[![license](https://img.shields.io/npm/l/@qodalis/cli-lang-ko.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

Adds the `ko` translations for the built-in commands (help, configure, pkg, server and others). Plugins that support the language bring their own `ko` strings.

## Install

```bash
npm install @qodalis/cli-lang-ko
```

Or install it at runtime in a running terminal:

```bash
pkg add lang-ko
```

## Usage

Register `langKoModule` with your terminal.

```typescript
import { langKoModule } from '@qodalis/cli-lang-ko';

// Angular: <cli [modules]="[langKoModule]"></cli>, or providers: [resolveCliModuleProvider(langKoModule)]
// React:   <Cli modules={[langKoModule]} />
// Vue:     <Cli :modules="[langKoModule]" />
// Vanilla: engine.registerModule(langKoModule);
```

Then switch the language in the terminal:

```bash
configure set system.language ko
```

The interactive `configure` menu lists every registered language. Use `configure set system.language en` to switch back to English.

## Documentation

https://cli.qodalis.com/docs/plugins/lang-ko

## License

MIT
