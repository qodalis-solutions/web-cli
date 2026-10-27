# @qodalis/cli-curl

Make HTTP requests from the Qodalis CLI with a curl-like interface.

[![npm version](https://img.shields.io/npm/v/@qodalis/cli-curl.svg)](https://www.npmjs.com/package/@qodalis/cli-curl)
[![license](https://img.shields.io/npm/l/@qodalis/cli-curl.svg)](https://github.com/qodalis-solutions/web-cli/blob/main/LICENSE)

## Install

```bash
npm install @qodalis/cli-curl
```

Or install it at runtime in a running terminal:

```bash
pkg add curl
```

## Usage

Register `curlModule` with your terminal.

```typescript
import { curlModule } from '@qodalis/cli-curl';

// Angular (template)
// <cli [modules]="[curlModule]"></cli>

// Angular (DI, NgModule or application providers)
providers: [resolveCliModuleProvider(curlModule)];

// React
<Cli modules={[curlModule]} />

// Vue
<Cli :modules="[curlModule]" />

// Vanilla TypeScript (CliEngine from @qodalis/cli)
engine.registerModule(curlModule);
```

## Commands

`curl <url> [options]`. The method defaults to `GET`, or `POST` when a body is given. A `--data` body that parses as JSON is minified and sent with `Content-Type: application/json` unless you set that header yourself. With `--verbose` the output ends with the equivalent curl command.

| Flag | Alias | Default | Description |
|---|---|---|---|
| `--request` | `-X` | `GET` / `POST` | Method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| `--header` | `-H` | | Add a header, `'Name: value'` (repeatable) |
| `--data` | `-d` | | Request body; JSON is detected |
| `--data-raw` | | | Request body sent as-is |
| `--verbose` | `-v` | `false` | Show request and response headers, timing and redirects |
| `--pretty` | | `false` | Pretty-print a JSON response |
| `--timeout` | | `30000` | Timeout in milliseconds |
| `--location` | `-L` | `true` | Follow redirects; `--location=false` stops at the redirect |
| `--proxy` | | `false` | Send the request through `proxy.qodalis.com` to get around CORS |
| `--silent` | `-s` | `false` | Print only the body, without the status line |

```bash
curl https://api.example.com/users
curl https://api.example.com/users -X POST -d '{"name":"John"}' -H 'Content-Type: application/json'
curl https://api.example.com/users/1 -X DELETE
curl https://api.example.com/status -X HEAD -v
curl https://api.example.com/users --pretty -s
curl https://api.example.com/data --proxy --timeout=5000
```

### CORS

The request runs in the browser, so the target server must allow cross-origin requests. Otherwise use `--proxy`, which rewrites `https://host/path` to `https://proxy.qodalis.com/proxy/https/host/path`.

## Configuration

Set with `configure set curl.<key> <value>` or the interactive `configure` menu. Command-line flags override these.

| Key | Default | Description |
|---|---|---|
| `defaultTimeout` | `30000` | Request timeout in milliseconds (1000-300000) |
| `prettyPrint` | `false` | Pretty-print JSON responses by default |
| `verbose` | `false` | Show request and response headers by default |

## Documentation

https://cli.qodalis.com/docs/plugins/curl

## License

MIT
