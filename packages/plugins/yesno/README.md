# @qodalis/cli-yesno

Answer a question with a random yes or no, shown as a short slot-machine animation.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-yesno.svg)](https://www.npmjs.com/package/@qodalis/cli-yesno)
[![license](https://img.shields.io/npm/l/@qodalis/cli-yesno.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-yesno
```

Or install it at runtime in a running terminal:

```bash
pkg add yesno
```

## Usage

Register `yesnoModule` with your terminal.

```typescript
import { yesnoModule } from '@qodalis/cli-yesno';

// Angular (template)
// <cli [modules]="[yesnoModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(yesnoModule)];

// React
<Cli modules={[yesnoModule]} />

// Vue
<Cli :modules="[yesnoModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(yesnoModule);
```

## Commands

`yesno [question]`. The optional question is echoed above the result. Press Ctrl+C to cancel a running round.

| Flag | Default | Description |
|---|---|---|
| `--count`, `-n` | `1` | Number of rounds to run |

```bash
yesno
yesno Should I deploy to production?
yesno --count=3
```

## Documentation

https://cli.qodalis.com/docs/plugins/yesno

## License

MIT
