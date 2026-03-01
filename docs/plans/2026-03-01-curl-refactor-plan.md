# Curl Module Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `@qodalis/cli-curl` from a draft sub-command pattern to a real curl-style interface with a reusable utilities layer and comprehensive HTTP support.

**Architecture:** Single `curl <url>` command using `valueRequired: true` with flags (`-X`, `-H`, `-d`, `-v`, `--pretty`, `--timeout`, `--proxy`, `-L`, `-s`, `--data-raw`, `-o`). Utilities extracted to a separate module for reuse. No sub-processors — all logic in one `processCommand`.

**Tech Stack:** TypeScript, browser `fetch` API, `AbortController` for timeouts. Build: tsup (CJS + ESM + IIFE). Tests: Jasmine/Karma.

**Design doc:** `docs/plans/2026-03-01-curl-refactor-design.md`

---

### Task 1: Create utilities module

**Files:**
- Create: `packages/plugins/curl/src/lib/utilities/index.ts`

**Step 1: Create the utilities file with types and pure functions**

```typescript
export interface CurlRequestOptions {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    rawBody?: string;
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

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function inferMethod(explicitMethod?: string, hasBody?: boolean): string {
    if (explicitMethod) {
        const upper = explicitMethod.toUpperCase();
        if (!VALID_METHODS.includes(upper)) {
            throw new Error(`Invalid HTTP method: ${explicitMethod}. Valid methods: ${VALID_METHODS.join(', ')}`);
        }
        return upper;
    }
    return hasBody ? 'POST' : 'GET';
}

export function parseHeaders(headerArgs: string | string[] | undefined): Record<string, string> {
    if (!headerArgs) return {};
    const arr = Array.isArray(headerArgs) ? headerArgs : [headerArgs];
    const result: Record<string, string> = {};
    for (const header of arr) {
        const colonIndex = header.indexOf(':');
        if (colonIndex === -1) continue;
        const key = header.substring(0, colonIndex).trim();
        const value = header.substring(colonIndex + 1).trim();
        if (key) result[key] = value;
    }
    return result;
}

export function resolveBody(data?: string, dataRaw?: string): string | undefined {
    if (dataRaw != null) return dataRaw;
    if (data == null) return undefined;
    try {
        return JSON.stringify(JSON.parse(data));
    } catch {
        return data;
    }
}

export function isJsonBody(body?: string): boolean {
    if (!body) return false;
    try {
        JSON.parse(body);
        return true;
    } catch {
        return false;
    }
}

export function buildFetchOptions(options: CurlRequestOptions): RequestInit {
    const body = resolveBody(options.body, options.rawBody);
    const headers = { ...options.headers };

    if (body && !headers['Content-Type'] && isJsonBody(body)) {
        headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
        method: options.method,
        headers,
    };

    if (body && options.method !== 'GET' && options.method !== 'HEAD') {
        init.body = body;
    }

    if (!options.followRedirects) {
        init.redirect = 'manual';
    }

    return init;
}

export function formatResponseBody(body: string, pretty: boolean): string {
    if (!pretty) return body;
    try {
        return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
        return body;
    }
}

export function rewriteUrlToProxy(originalUrl: string): string {
    const match = originalUrl.match(/^(https?):\/\/([^\/]+)(\/.*)?$/i);
    if (!match) {
        throw new Error(`Invalid URL: ${originalUrl}`);
    }
    const scheme = match[1];
    const domain = match[2];
    const path = match[3] || '/';
    return `https://proxy.qodalis.com/proxy/${scheme}/${domain}${path}`;
}

export function buildCurlEquivalent(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
): string {
    const parts = ['curl'];
    if (method !== 'GET') {
        parts.push(`-X ${method}`);
    }
    for (const [key, value] of Object.entries(headers)) {
        parts.push(`-H '${key}: ${value}'`);
    }
    if (body) {
        parts.push(`-d '${body}'`);
    }
    parts.push(`'${url}'`);
    return parts.join(' ');
}

export function extractResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });
    return headers;
}
```

**Step 2: Commit**

```bash
git add packages/plugins/curl/src/lib/utilities/index.ts
git commit -m "feat(curl): add utilities module with types and pure functions"
```

---

### Task 2: Rewrite the command processor

**Files:**
- Rewrite: `packages/plugins/curl/src/lib/processors/cli-curl-command-processor.ts`

**Step 1: Replace the entire processor file**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { LIBRARY_VERSION } from '../version';
import {
    CurlResponse,
    buildCurlEquivalent,
    buildFetchOptions,
    extractResponseHeaders,
    formatResponseBody,
    inferMethod,
    parseHeaders,
    resolveBody,
    rewriteUrlToProxy,
} from '../utilities';

export class CliCurlCommandProcessor implements ICliCommandProcessor {
    command = 'curl';

    description = 'Make HTTP requests from the terminal. Supports all HTTP methods, custom headers, request bodies, timeouts, and more.';

    author = DefaultLibraryAuthor;

    version = LIBRARY_VERSION;

    valueRequired = true;

    metadata?: CliProcessorMetadata = {
        icon: '🌐',
        requiredCoreVersion: '>=2.0.0 <3.0.0',
        requiredCliVersion: '>=2.0.0 <3.0.0',
    };

    parameters = [
        {
            name: 'request',
            aliases: ['X'],
            type: 'string' as const,
            description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)',
            required: false,
        },
        {
            name: 'header',
            aliases: ['H'],
            type: 'array' as const,
            description: 'Add header, e.g. -H \'Content-Type: application/json\' (repeatable)',
            required: false,
        },
        {
            name: 'data',
            aliases: ['d'],
            type: 'string' as const,
            description: 'Request body (auto-detects JSON, sets method to POST if -X not given)',
            required: false,
        },
        {
            name: 'data-raw',
            type: 'string' as const,
            description: 'Request body sent as-is without JSON parsing',
            required: false,
        },
        {
            name: 'verbose',
            aliases: ['v'],
            type: 'boolean' as const,
            description: 'Show request/response headers and timing',
            required: false,
        },
        {
            name: 'pretty',
            type: 'boolean' as const,
            description: 'Pretty-print JSON response body',
            required: false,
        },
        {
            name: 'timeout',
            type: 'number' as const,
            description: 'Request timeout in milliseconds (default: 30000)',
            required: false,
            defaultValue: '30000',
        },
        {
            name: 'location',
            aliases: ['L'],
            type: 'boolean' as const,
            description: 'Follow redirects (default: true)',
            required: false,
        },
        {
            name: 'proxy',
            type: 'boolean' as const,
            description: 'Route request through proxy.qodalis.com (bypasses CORS)',
            required: false,
        },
        {
            name: 'silent',
            aliases: ['s'],
            type: 'boolean' as const,
            description: 'Only output response body (no status line)',
            required: false,
        },
        {
            name: 'output',
            aliases: ['o'],
            type: 'string' as const,
            description: 'Store response in a named variable',
            required: false,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const url = command.value;

        if (!url) {
            context.writer.writeError('URL is required. Usage: curl <url> [options]');
            context.process.exit(1);
            return;
        }

        const args = command.args;
        const explicitMethod = args['request'] || args['X'];
        const data = args['data'] || args['d'];
        const dataRaw = args['data-raw'];
        const hasBody = data != null || dataRaw != null;
        const verbose = !!args['verbose'] || !!args['v'];
        const pretty = !!args['pretty'];
        const silent = !!args['silent'] || !!args['s'];
        const useProxy = !!args['proxy'];
        const timeout = parseInt(args['timeout'] || '30000', 10);
        const followRedirects = args['location'] !== false && args['L'] !== false;

        let method: string;
        try {
            method = inferMethod(explicitMethod, hasBody);
        } catch (e: any) {
            context.writer.writeError(e.message);
            context.process.exit(1);
            return;
        }

        const headers = parseHeaders(args['header'] || args['H']);
        const body = resolveBody(data, dataRaw);
        const requestUrl = useProxy ? rewriteUrlToProxy(url) : url;

        const fetchOptions = buildFetchOptions({
            url: requestUrl,
            method,
            headers,
            body: data,
            rawBody: dataRaw,
            followRedirects,
            timeout,
            proxy: useProxy,
        });

        if (verbose) {
            context.writer.writeln(
                `> ${context.writer.wrapInColor(`${method} ${url}`, CliForegroundColor.Cyan)}`,
            );
            for (const [key, value] of Object.entries(headers)) {
                context.writer.writeln(
                    `> ${context.writer.wrapInColor(`${key}: ${value}`, CliForegroundColor.Yellow)}`,
                );
            }
            if (body) {
                context.writer.writeln(`> Body: ${body}`);
            }
            context.writer.writeln();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        fetchOptions.signal = controller.signal;

        const startTime = performance.now();

        try {
            const response = await fetch(requestUrl, fetchOptions);
            const elapsed = Math.round(performance.now() - startTime);
            const responseText = await response.text();
            const responseHeaders = extractResponseHeaders(response);

            const curlResponse: CurlResponse = {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
                body: responseText,
                timing: elapsed,
                url: response.url,
                redirected: response.redirected,
            };

            if (!silent) {
                const statusColor = response.ok ? CliForegroundColor.Green : CliForegroundColor.Red;
                context.writer.writeln(
                    context.writer.wrapInColor(
                        `HTTP ${response.status} ${response.statusText}`,
                        statusColor,
                    ),
                );
            }

            if (verbose) {
                context.writer.writeln();
                for (const [key, value] of Object.entries(responseHeaders)) {
                    context.writer.writeln(
                        `< ${context.writer.wrapInColor(`${key}: ${value}`, CliForegroundColor.Yellow)}`,
                    );
                }
                context.writer.writeln(
                    `< ${context.writer.wrapInColor(`Time: ${elapsed}ms`, CliForegroundColor.Magenta)}`,
                );
                if (response.redirected) {
                    context.writer.writeln(
                        `< ${context.writer.wrapInColor(`Redirected to: ${response.url}`, CliForegroundColor.Cyan)}`,
                    );
                }
                context.writer.writeln();
            }

            const formattedBody = formatResponseBody(responseText, pretty);
            if (formattedBody) {
                context.writer.writeln(formattedBody);
            }

            context.process.output(curlResponse);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                context.writer.writeError(`Request timed out after ${timeout}ms`);
            } else {
                context.writer.writeError(`Request failed: ${error.message}`);
            }
            context.process.exit(1);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;

        writer.writeln(this.description!);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Usage:', CliForegroundColor.Yellow));
        writer.writeln(`  curl <url> [options]`);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Options:', CliForegroundColor.Yellow));
        writer.writeln(`  ${writer.wrapInColor('-X, --request <METHOD>', CliForegroundColor.Cyan)}   HTTP method (default: GET, or POST if -d given)`);
        writer.writeln(`  ${writer.wrapInColor('-H, --header <header>', CliForegroundColor.Cyan)}    Add header (repeatable)`);
        writer.writeln(`  ${writer.wrapInColor('-d, --data <body>', CliForegroundColor.Cyan)}        Request body (auto-detects JSON)`);
        writer.writeln(`  ${writer.wrapInColor('--data-raw <body>', CliForegroundColor.Cyan)}        Request body as-is`);
        writer.writeln(`  ${writer.wrapInColor('-v, --verbose', CliForegroundColor.Cyan)}            Show headers and timing`);
        writer.writeln(`  ${writer.wrapInColor('--pretty', CliForegroundColor.Cyan)}                 Pretty-print JSON response`);
        writer.writeln(`  ${writer.wrapInColor('--timeout <ms>', CliForegroundColor.Cyan)}           Timeout in ms (default: 30000)`);
        writer.writeln(`  ${writer.wrapInColor('-L, --location', CliForegroundColor.Cyan)}           Follow redirects (default: true)`);
        writer.writeln(`  ${writer.wrapInColor('--proxy', CliForegroundColor.Cyan)}                  Route through CORS proxy`);
        writer.writeln(`  ${writer.wrapInColor('-s, --silent', CliForegroundColor.Cyan)}             Only output body`);
        writer.writeln(`  ${writer.wrapInColor('-o, --output <name>', CliForegroundColor.Cyan)}      Store response in variable`);
        writer.writeln();

        writer.writeln(writer.wrapInColor('Examples:', CliForegroundColor.Yellow));
        writer.writeln(`  curl https://api.example.com/users`);
        writer.writeln(`  curl https://api.example.com/users -X POST -d '{"name":"John"}' -H 'Content-Type: application/json'`);
        writer.writeln(`  curl https://api.example.com/users -v --pretty`);
        writer.writeln(`  curl https://api.example.com/status -X HEAD`);
        writer.writeln(`  curl https://api.example.com/data --proxy --timeout 5000`);
        writer.writeln();

        writer.writeWarning('The server must allow CORS for this tool to work. Use --proxy to bypass CORS restrictions.');
    }

    async initialize(_context: ICliExecutionContext): Promise<void> {}
}
```

**Step 2: Commit**

```bash
git add packages/plugins/curl/src/lib/processors/cli-curl-command-processor.ts
git commit -m "feat(curl): rewrite processor to real curl-style interface

Replaces sub-command pattern (curl get/post/put/delete) with
curl <url> [options] using -X flag for method selection.
Adds timeout, pretty-print, silent mode, redirect control."
```

---

### Task 3: Update public-api.ts to export utilities

**Files:**
- Modify: `packages/plugins/curl/src/public-api.ts`

**Step 1: Update exports to include utilities**

```typescript
/*
 * Public API Surface of curl
 */

export * from './lib/utilities';
export * from './lib/processors/cli-curl-command-processor';

import { ICliModule } from '@qodalis/cli-core';
import { CliCurlCommandProcessor } from './lib/processors/cli-curl-command-processor';
import { API_VERSION } from './lib/version';

export const curlModule: ICliModule = {
    apiVersion: API_VERSION,
    name: '@qodalis/cli-curl',
    processors: [new CliCurlCommandProcessor()],
};
```

**Step 2: Commit**

```bash
git add packages/plugins/curl/src/public-api.ts
git commit -m "feat(curl): export utilities from public API"
```

---

### Task 4: Rewrite tests

**Files:**
- Rewrite: `packages/plugins/curl/src/tests/index.spec.ts`

**Step 1: Replace the entire test file**

```typescript
import { CliCurlCommandProcessor } from '../lib/processors/cli-curl-command-processor';
import {
    inferMethod,
    parseHeaders,
    resolveBody,
    isJsonBody,
    formatResponseBody,
    rewriteUrlToProxy,
    buildCurlEquivalent,
} from '../lib/utilities';

describe('Curl Utilities', () => {
    describe('inferMethod', () => {
        it('should default to GET when no method and no body', () => {
            expect(inferMethod()).toBe('GET');
            expect(inferMethod(undefined, false)).toBe('GET');
        });

        it('should default to POST when no method but has body', () => {
            expect(inferMethod(undefined, true)).toBe('POST');
        });

        it('should use explicit method regardless of body', () => {
            expect(inferMethod('PUT', true)).toBe('PUT');
            expect(inferMethod('delete', false)).toBe('DELETE');
        });

        it('should be case-insensitive', () => {
            expect(inferMethod('patch')).toBe('PATCH');
            expect(inferMethod('Options')).toBe('OPTIONS');
        });

        it('should throw for invalid methods', () => {
            expect(() => inferMethod('INVALID')).toThrowError(/Invalid HTTP method/);
        });
    });

    describe('parseHeaders', () => {
        it('should return empty object for undefined', () => {
            expect(parseHeaders(undefined)).toEqual({});
        });

        it('should parse a single header string', () => {
            expect(parseHeaders('Content-Type: application/json')).toEqual({
                'Content-Type': 'application/json',
            });
        });

        it('should parse an array of headers', () => {
            const result = parseHeaders([
                'Content-Type: application/json',
                'Authorization: Bearer token123',
            ]);
            expect(result).toEqual({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer token123',
            });
        });

        it('should handle headers with colons in values', () => {
            expect(parseHeaders('Authorization: Basic dXNlcjpwYXNz')).toEqual({
                'Authorization': 'Basic dXNlcjpwYXNz',
            });
        });

        it('should skip malformed headers without colons', () => {
            expect(parseHeaders('InvalidHeader')).toEqual({});
        });

        it('should trim whitespace', () => {
            expect(parseHeaders('  Key  :  Value  ')).toEqual({
                'Key': 'Value',
            });
        });
    });

    describe('resolveBody', () => {
        it('should return undefined when no data', () => {
            expect(resolveBody()).toBeUndefined();
            expect(resolveBody(undefined, undefined)).toBeUndefined();
        });

        it('should prefer dataRaw over data', () => {
            expect(resolveBody('{"a":1}', 'raw text')).toBe('raw text');
        });

        it('should parse and re-serialize valid JSON data', () => {
            expect(resolveBody('{"a":1}')).toBe('{"a":1}');
        });

        it('should pass through non-JSON data as-is', () => {
            expect(resolveBody('plain text')).toBe('plain text');
        });

        it('should return dataRaw as-is without parsing', () => {
            expect(resolveBody(undefined, '{"not":"parsed"}')).toBe('{"not":"parsed"}');
        });
    });

    describe('isJsonBody', () => {
        it('should return true for valid JSON', () => {
            expect(isJsonBody('{"a":1}')).toBe(true);
            expect(isJsonBody('[1,2,3]')).toBe(true);
            expect(isJsonBody('"string"')).toBe(true);
        });

        it('should return false for non-JSON', () => {
            expect(isJsonBody('plain text')).toBe(false);
            expect(isJsonBody(undefined)).toBe(false);
            expect(isJsonBody('')).toBe(false);
        });
    });

    describe('formatResponseBody', () => {
        it('should return body as-is when pretty is false', () => {
            expect(formatResponseBody('{"a":1}', false)).toBe('{"a":1}');
        });

        it('should pretty-print valid JSON when pretty is true', () => {
            expect(formatResponseBody('{"a":1}', true)).toBe('{\n  "a": 1\n}');
        });

        it('should return non-JSON as-is even when pretty is true', () => {
            expect(formatResponseBody('not json', true)).toBe('not json');
        });
    });

    describe('rewriteUrlToProxy', () => {
        it('should rewrite HTTPS URLs', () => {
            expect(rewriteUrlToProxy('https://api.example.com/users')).toBe(
                'https://proxy.qodalis.com/proxy/https/api.example.com/users',
            );
        });

        it('should rewrite HTTP URLs', () => {
            expect(rewriteUrlToProxy('http://example.com/path')).toBe(
                'https://proxy.qodalis.com/proxy/http/example.com/path',
            );
        });

        it('should default path to / when no path', () => {
            expect(rewriteUrlToProxy('https://example.com')).toBe(
                'https://proxy.qodalis.com/proxy/https/example.com/',
            );
        });

        it('should throw for invalid URLs', () => {
            expect(() => rewriteUrlToProxy('not-a-url')).toThrowError(/Invalid URL/);
        });
    });

    describe('buildCurlEquivalent', () => {
        it('should build a simple GET', () => {
            expect(buildCurlEquivalent('https://api.com', 'GET', {})).toBe(
                "curl 'https://api.com'",
            );
        });

        it('should include method for non-GET', () => {
            expect(buildCurlEquivalent('https://api.com', 'POST', {})).toBe(
                "curl -X POST 'https://api.com'",
            );
        });

        it('should include headers', () => {
            const result = buildCurlEquivalent('https://api.com', 'GET', {
                'Content-Type': 'application/json',
            });
            expect(result).toContain("-H 'Content-Type: application/json'");
        });

        it('should include body', () => {
            const result = buildCurlEquivalent('https://api.com', 'POST', {}, '{"a":1}');
            expect(result).toContain("-d '{\"a\":1}'");
        });
    });
});

describe('CliCurlCommandProcessor', () => {
    let processor: CliCurlCommandProcessor;

    beforeEach(() => {
        processor = new CliCurlCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "curl"', () => {
            expect(processor.command).toBe('curl');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have metadata with an icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBeDefined();
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });

        it('should require a value (URL)', () => {
            expect(processor.valueRequired).toBe(true);
        });
    });

    describe('parameters', () => {
        it('should have parameters defined', () => {
            expect(processor.parameters).toBeDefined();
            expect(processor.parameters!.length).toBeGreaterThan(0);
        });

        it('should have a "request" parameter with alias "X"', () => {
            const param = processor.parameters!.find((p) => p.name === 'request');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('X');
            expect(param!.type).toBe('string');
        });

        it('should have a "header" parameter with alias "H"', () => {
            const param = processor.parameters!.find((p) => p.name === 'header');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('H');
            expect(param!.type).toBe('array');
        });

        it('should have a "data" parameter with alias "d"', () => {
            const param = processor.parameters!.find((p) => p.name === 'data');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('d');
            expect(param!.type).toBe('string');
        });

        it('should have a "data-raw" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'data-raw');
            expect(param).toBeDefined();
            expect(param!.type).toBe('string');
        });

        it('should have a "verbose" parameter with alias "v"', () => {
            const param = processor.parameters!.find((p) => p.name === 'verbose');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('v');
            expect(param!.type).toBe('boolean');
        });

        it('should have a "pretty" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'pretty');
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
        });

        it('should have a "timeout" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'timeout');
            expect(param).toBeDefined();
            expect(param!.type).toBe('number');
        });

        it('should have a "location" parameter with alias "L"', () => {
            const param = processor.parameters!.find((p) => p.name === 'location');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('L');
            expect(param!.type).toBe('boolean');
        });

        it('should have a "proxy" parameter', () => {
            const param = processor.parameters!.find((p) => p.name === 'proxy');
            expect(param).toBeDefined();
            expect(param!.type).toBe('boolean');
        });

        it('should have a "silent" parameter with alias "s"', () => {
            const param = processor.parameters!.find((p) => p.name === 'silent');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('s');
            expect(param!.type).toBe('boolean');
        });

        it('should have an "output" parameter with alias "o"', () => {
            const param = processor.parameters!.find((p) => p.name === 'output');
            expect(param).toBeDefined();
            expect(param!.aliases).toContain('o');
            expect(param!.type).toBe('string');
        });
    });

    describe('methods', () => {
        it('should have processCommand defined as a function', () => {
            expect(typeof processor.processCommand).toBe('function');
        });

        it('should have writeDescription defined as a function', () => {
            expect(typeof processor.writeDescription).toBe('function');
        });

        it('should have initialize defined as a function', () => {
            expect(typeof processor.initialize).toBe('function');
        });
    });
});
```

**Step 2: Commit**

```bash
git add packages/plugins/curl/src/tests/index.spec.ts
git commit -m "test(curl): rewrite tests for new curl-style interface

Tests utilities (inferMethod, parseHeaders, resolveBody, isJsonBody,
formatResponseBody, rewriteUrlToProxy, buildCurlEquivalent) and
processor structure (parameters, command identity, methods)."
```

---

### Task 5: Update README

**Files:**
- Rewrite: `packages/plugins/curl/README.md`

**Step 1: Replace README content**

```markdown
# @qodalis/cli-curl

CLI extension for making HTTP requests with a real curl-like interface.

## Installation

```
packages add @qodalis/cli-curl
packages add curl
```

## Usage

```bash
# Simple GET request
curl https://api.example.com/users

# POST with JSON body
curl https://api.example.com/users -X POST -d '{"name":"John"}' -H 'Content-Type: application/json'

# PUT request
curl https://api.example.com/users/1 -X PUT -d '{"name":"Jane"}'

# DELETE request
curl https://api.example.com/users/1 -X DELETE

# HEAD request
curl https://api.example.com/status -X HEAD -v

# Verbose output with pretty-printed JSON
curl https://api.example.com/users -v --pretty

# With timeout and proxy
curl https://api.example.com/data --timeout 5000 --proxy

# Silent mode (body only)
curl https://api.example.com/users -s
```

## Options

| Flag | Alias | Description |
|------|-------|-------------|
| `--request` | `-X` | HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) |
| `--header` | `-H` | Add header (repeatable) |
| `--data` | `-d` | Request body (auto-detects JSON) |
| `--data-raw` | | Request body as-is |
| `--verbose` | `-v` | Show headers and timing |
| `--pretty` | | Pretty-print JSON response |
| `--timeout` | | Timeout in ms (default: 30000) |
| `--location` | `-L` | Follow redirects (default: true) |
| `--proxy` | | Route through CORS proxy |
| `--silent` | `-s` | Only output body |
| `--output` | `-o` | Store response in variable |

## CORS

Browser security prevents cross-origin requests by default. Use `--proxy` to route requests through `proxy.qodalis.com` to bypass CORS restrictions.
```

**Step 2: Commit**

```bash
git add packages/plugins/curl/README.md
git commit -m "docs(curl): update README for new curl-style interface"
```

---

### Task 6: Build and run tests

**Step 1: Build the curl plugin and its dependencies**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx build curl`
Expected: Build succeeds, output in `dist/curl/`

**Step 2: Run tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test curl`
Expected: All tests pass

**Step 3: Kill any lingering test processes**

Run: `pkill -f "karma|ChromeHeadless" 2>/dev/null; true`

**Step 4: Commit if any build-related fixes were needed**

If fixes were made, commit them with an appropriate message.
