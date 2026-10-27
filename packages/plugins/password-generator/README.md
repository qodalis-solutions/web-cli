# @qodalis/cli-password-generator

Generate random passwords in the Qodalis CLI.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-password-generator.svg)](https://www.npmjs.com/package/@qodalis/cli-password-generator)
[![license](https://img.shields.io/npm/l/@qodalis/cli-password-generator.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-password-generator
```

Or install it at runtime in a running terminal:

```bash
pkg add password-generator
```

## Usage

Register `passwordGeneratorModule` with your terminal.

```typescript
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';

// Angular (template)
// <cli [modules]="[passwordGeneratorModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(passwordGeneratorModule)];

// React
<Cli modules={[passwordGeneratorModule]} />

// Vue
<Cli :modules="[passwordGeneratorModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(passwordGeneratorModule);
```

## Commands

`generate-password [options]`. Lowercase letters are always included. The password is also the command output, so it can be piped.

| Flag | Default | Description |
|---|---|---|
| `--length` | `16` | Password length |
| `--symbols` | `false` | Include symbols (`!@#$%^&*()_+[]{}\|;:,.<>?`) |
| `--uppercase` | `true` | Include uppercase letters |
| `--numbers` | `true` | Include digits |

```bash
generate-password
generate-password --length=32 --symbols
generate-password --uppercase=false --numbers=false
```

## Configuration

Set with `configure set generate-password.<key> <value>` or the interactive `configure` menu. Command-line flags override these.

| Key | Default | Description |
|---|---|---|
| `defaultLength` | `16` | Length when `--length` is not given (4-128) |
| `includeSymbols` | `false` | Include symbols by default |
| `includeUppercase` | `true` | Include uppercase letters by default |
| `includeNumbers` | `true` | Include digits by default |

## Documentation

https://cli.qodalis.com/docs/plugins/password-generator

## License

MIT
