# @qodalis/cli-encode

Encoding, decoding, and hashing utilities for the Qodalis CLI. Provides 8 commands for working with various encoding formats, cryptographic hashes, and ciphers.

## Commands

| Command | Description | Subcommands |
|---------|-------------|-------------|
| `base64` | Encode/decode Base64 strings | `encode`, `decode` |
| `hex` | Hex encode/decode and base conversions | `encode`, `decode`, `convert` |
| `url` | URL encode/decode and parsing | `encode`, `decode`, `parse` |
| `hash` | Cryptographic hash digests | `sha256`, `sha1`, `sha384`, `sha512` |
| `jwt` | Decode and inspect JWT tokens | `decode` |
| `binary` | Text to/from binary representation | `encode`, `decode` |
| `rot` | ROT cipher (letter rotation) | direct (supports `--shift=N`) |
| `morse` | Morse code encode/decode | `encode`, `decode` |

## Installation

### Runtime (from the CLI terminal)

```bash
pkg add @qodalis/cli-encode
```

### npm (for framework integration)

```bash
npm install @qodalis/cli-encode
```

## Usage

### Angular

```typescript
import { encodeModule } from '@qodalis/cli-encode';

// In your module providers:
resolveCliModuleProvider(encodeModule)
```

### React

```typescript
import { encodeModule } from '@qodalis/cli-encode';

const modules = [encodeModule, ...otherModules];
```

### Vue

```typescript
import { encodeModule } from '@qodalis/cli-encode';

const modules = [encodeModule, ...otherModules];
```

## Examples

```bash
# Base64
base64 encode Hello World        # SGVsbG8gV29ybGQ=
base64 decode SGVsbG8gV29ybGQ=   # Hello World

# Hex
hex encode Hi                    # 4869
hex decode 4869                  # Hi
hex convert 255                  # ff
hex convert ff --from=16 --to=2  # 11111111

# URL
url encode hello world           # hello%20world
url decode hello%20world         # hello world
url parse https://example.com    # protocol, hostname, port, ...

# Hash
hash sha256 hello                # 2cf24dba5fb0a30e...
hash sha512 hello                # 9b71d224bd62f378...

# JWT
jwt decode eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig

# Binary
binary encode Hi                 # 01001000 01101001
binary decode 01001000 01101001  # Hi

# ROT cipher
rot Hello World                  # Uryyb Jbeyq (ROT13)
rot Uryyb Jbeyq                  # Hello World (self-inverse)
rot abc --shift=1                # bcd

# Morse
morse encode SOS                 # ... --- ...
morse decode ... --- ...         # SOS
morse encode Hello World         # .... . .-.. .-.. --- / .-- --- .-. .-.. -..
```

## Build

Builds two outputs:
- **Module** (CJS + ESM): `public-api.js` and `public-api.mjs`
- **IIFE bundle**: `umd/index.global.js` (for browser runtime loading via `pkg add`)
