# Curl Module Refactor Design

**Date:** 2026-03-01
**Status:** Approved

## Overview

Refactor the `@qodalis/cli-curl` plugin from a draft sub-command pattern (`curl get`, `curl post`) to a proper real-curl-style interface (`curl <url> [options]`), with a reusable utilities layer, comprehensive HTTP method support, and structured programmatic output.

## Command Interface

```
curl <url> [options]

Options:
  -X, --request <METHOD>    HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
  -H, --header <header>     Add header (repeatable), e.g. -H 'Content-Type: application/json'
  -d, --data <data>         Request body (sets POST if -X not specified)
  --data-raw <data>         Request body sent as-is (no JSON parsing)
  -v, --verbose             Show response headers, timing, request details
  --pretty                  Pretty-print JSON response body
  -o, --output <name>       Store response in named variable for programmatic use
  --timeout <ms>            Request timeout in milliseconds (default: 30000)
  -L, --location            Follow redirects (default: true, use --no-location to disable)
  --proxy                   Route through proxy.qodalis.com
  -s, --silent              Only output response body (no status line)
```

## Behavior

1. **Method inference** — If `-d` is provided without `-X`, defaults to POST. Otherwise defaults to GET.
2. **Response display** — Always shows `HTTP <status> <statusText>` line, then body. With `--pretty`, JSON is formatted with 2-space indent. With `-v`, shows request method/url, all request headers, response headers, and timing.
3. **Body handling** — `-d` tries JSON.parse first; if it fails, sends as string. `--data-raw` always sends as string. If body is JSON and no Content-Type header set, auto-adds `Content-Type: application/json`.
4. **Timeout** — Uses `AbortController` with configurable timeout.
5. **Redirects** — `fetch` follows by default; `--no-location` sets `redirect: 'manual'`.
6. **Proxy** — Same rewrite to `proxy.qodalis.com` but cleaner implementation.
7. **Programmatic output** — `context.process.output()` always called with structured `{ status, statusText, headers, body, timing }`.

## File Structure

```
packages/plugins/curl/src/
  public-api.ts
  cli-entrypoint.ts
  lib/
    version.ts
    utilities/
      index.ts              # parseHeaders, buildFetchOptions, formatResponse, rewriteProxy
    processors/
      cli-curl-command-processor.ts   # main processor (rewritten)
  tests/
    index.spec.ts            # updated tests
```

## Utilities Layer (exported independently)

```typescript
export function parseHeaders(headerArgs: string | string[]): Record<string, string>
export function buildFetchOptions(options: CurlRequestOptions): RequestInit
export function formatResponseBody(body: string, pretty: boolean): string
export function rewriteUrlToProxy(url: string): string
export function inferMethod(explicitMethod?: string, hasBody?: boolean): string

export interface CurlRequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  followRedirects: boolean;
  timeout: number;
  proxy: boolean;
}

export interface CurlResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timing: number;
  url: string;
  redirected: boolean;
}
```

## Breaking Changes

- Removes `curl get`, `curl post`, `curl put`, `curl delete` sub-commands
- New interface: `curl <url> -X METHOD` with method flags
- This is intentional — the old interface was a draft
