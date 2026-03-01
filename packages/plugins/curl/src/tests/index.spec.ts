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
            expect(processor.parameters!.length).toBe(10);
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
