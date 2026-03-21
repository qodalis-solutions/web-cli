import { highlightLine } from '../lib/syntax/highlighter';
import { DataExplorerLanguage } from '../lib/models/data-explorer-types';

// ANSI codes for verification
const R = '\x1b[0m';
const BB = '\x1b[1;34m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const C = '\x1b[36m';

describe('Syntax Highlighter', () => {

    describe('highlightLine with Redis', () => {
        it('should highlight Redis commands in bold blue', () => {
            const result = highlightLine('GET mykey', DataExplorerLanguage.Redis);
            expect(result).toContain(BB + 'GET' + R);
        });

        it('should highlight HGETALL command', () => {
            const result = highlightLine('HGETALL user:1', DataExplorerLanguage.Redis);
            expect(result).toContain(BB + 'HGETALL' + R);
        });

        it('should highlight quoted strings in green', () => {
            const result = highlightLine("SET key 'hello world'", DataExplorerLanguage.Redis);
            expect(result).toContain(G);
        });

        it('should highlight numbers in yellow', () => {
            const result = highlightLine('EXPIRE key 3600', DataExplorerLanguage.Redis);
            expect(result).toContain(Y);
        });

        it('should highlight flags in cyan', () => {
            const result = highlightLine('SET key value EX 100', DataExplorerLanguage.Redis);
            expect(result).toContain(C);
        });

        it('should return plain text for key names', () => {
            const result = highlightLine('GET mykey', DataExplorerLanguage.Redis);
            // mykey should NOT be wrapped in any color code
            expect(result).toContain('mykey');
        });

        it('should handle empty input', () => {
            const result = highlightLine('', DataExplorerLanguage.Redis);
            expect(result).toBe('');
        });
    });

    describe('highlightLine with Elasticsearch', () => {
        it('should highlight HTTP verbs in bold blue', () => {
            const result = highlightLine('GET /my-index/_search', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(BB + 'GET' + R);
        });

        it('should highlight paths in cyan', () => {
            const result = highlightLine('GET /my-index/_search', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(C);
        });

        it('should highlight POST verb', () => {
            const result = highlightLine('POST /my-index/_doc', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(BB + 'POST' + R);
        });

        it('should highlight DELETE verb', () => {
            const result = highlightLine('DELETE /my-index/_doc/1', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(BB + 'DELETE' + R);
        });

        it('should highlight query parameters in yellow', () => {
            const result = highlightLine('GET /_cat/indices?v', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(Y);
        });

        it('should handle bare path shortcuts', () => {
            const result = highlightLine('_cat/indices', DataExplorerLanguage.Elasticsearch);
            expect(result).toContain(C);
        });

        it('should delegate JSON body lines to JSON highlighter', () => {
            const result = highlightLine('  "query": { "match_all": {} }', DataExplorerLanguage.Elasticsearch);
            // JSON keys should be colored (cyan for keys)
            expect(result).toContain(C);
        });

        it('should handle empty input', () => {
            const result = highlightLine('', DataExplorerLanguage.Elasticsearch);
            expect(result).toBe('');
        });
    });

    describe('highlightLine with existing languages', () => {
        it('should highlight SQL keywords', () => {
            const result = highlightLine('SELECT * FROM users', DataExplorerLanguage.Sql);
            expect(result).toContain(BB + 'SELECT' + R);
            expect(result).toContain(BB + 'FROM' + R);
        });

        it('should highlight JSON keys', () => {
            const result = highlightLine('{"name": "test"}', DataExplorerLanguage.Json);
            expect(result).toContain(C); // key color
            expect(result).toContain(G); // value color
        });

        it('should return plain text for unknown language', () => {
            const result = highlightLine('some text', 'unknown' as DataExplorerLanguage);
            expect(result).toBe('some text');
        });
    });
});
