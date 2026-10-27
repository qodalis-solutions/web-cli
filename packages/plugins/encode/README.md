# @qodalis/cli-encode

Encode, decode and hash text in the Qodalis CLI: Base64, hex, URL, binary, Morse, ROT, JWT and SHA digests.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-encode.svg)](https://www.npmjs.com/package/@qodalis/cli-encode)
[![license](https://img.shields.io/npm/l/@qodalis/cli-encode.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-encode
```

Or install it at runtime in a running terminal:

```bash
pkg add encode
```

## Usage

Register `encodeModule` with your terminal.

```typescript
import { encodeModule } from '@qodalis/cli-encode';

// Angular (template)
// <cli [modules]="[encodeModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(encodeModule)];

// React
<Cli modules={[encodeModule]} />

// Vue
<Cli :modules="[encodeModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(encodeModule);
```

## Commands

Root commands: `base64` (alias `b64`), `hex`, `url`, `hash`, `jwt`, `binary` (alias `bin`), `morse` and `rot`. Running a root command without a sub-command prints its help (except `rot`, which takes the text directly). Every command except `hex convert` also reads piped input.

| Command | Aliases | Description |
|---|---|---|
| `base64 encode <text>` | `enc`, `e` | Encode UTF-8 text to Base64 |
| `base64 decode <base64>` | `dec`, `d` | Decode Base64 to UTF-8 text |
| `hex encode <text>` | `enc` | Encode UTF-8 text to hexadecimal |
| `hex decode <hex>` | `dec` | Decode hexadecimal to text |
| `hex convert <number>` | `conv` | Convert a number between bases (2-36) |
| `url encode <text>` | `enc` | URL-encode a string (`encodeURIComponent`) |
| `url decode <text>` | `dec` | URL-decode a string |
| `url parse <url>` | | Show protocol, hostname, port, pathname, search, hash and origin |
| `hash sha256 <text>` | `sha-256` | SHA-256 digest (hex) |
| `hash sha1 <text>` | `sha-1` | SHA-1 digest (hex) |
| `hash sha384 <text>` | `sha-384` | SHA-384 digest (hex) |
| `hash sha512 <text>` | `sha-512` | SHA-512 digest (hex) |
| `jwt decode <token>` | `d` | Show a JWT's header, payload, expiry (`exp`) and issue time (`iat`); the signature is not verified |
| `binary encode <text>` | `enc`, `e` | Encode text to 8-bit binary groups |
| `binary decode <bits>` | `dec`, `d` | Decode binary digits to text (multiple of 8 bits; other characters are ignored) |
| `morse encode <text>` | `enc`, `e` | Encode text to Morse code (`/` between words) |
| `morse decode <code>` | `dec`, `d` | Decode Morse code (spaces between letters, `/` between words) |
| `rot <text>` | | Rotate letters (ROT13 by default, self-inverse) |

| Flag | Applies to | Default | Description |
|---|---|---|---|
| `--from` | `hex convert` | `10` | Source base (2-36) |
| `--to` | `hex convert` | `16` | Target base (2-36) |
| `--shift` | `rot` | `13` | Rotation amount; negative values rotate backwards |

```bash
base64 encode Hello World           # SGVsbG8gV29ybGQ=
b64 d SGVsbG8gV29ybGQ=              # Hello World
hex encode Hi                       # 4869
hex convert 255                     # ff
hex convert ff --from=16 --to=2     # 11111111
url encode hello world              # hello%20world
url parse https://example.com:8080/path?q=1#top
hash sha256 hello                   # 2cf24dba5fb0a30e...
jwt decode eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig
binary encode Hi                    # 01001000 01101001
binary decode 01001000 01101001     # Hi
morse encode SOS                    # ... --- ...
morse decode ... --- ...            # SOS
rot Hello World                     # Uryyb Jbeyq
rot abc --shift=1                   # bcd
```

## Documentation

https://cli.qodalis.com/docs/plugins/encode

## License

MIT
