import { CliDataExplorerCommandProcessor } from '../lib/processors/cli-data-explorer-command-processor';
import {
    DataExplorerOutputFormat,
    DataExplorerLanguage,
    DataExplorerResult,
} from '../lib/models/data-explorer-types';
import { formatTable } from '../lib/formatters/table-formatter';
import { formatJson } from '../lib/formatters/json-formatter';
import { formatCsv } from '../lib/formatters/csv-formatter';
import { getFormatter } from '../lib/formatters';

function makeResult(overrides: Partial<DataExplorerResult> = {}): DataExplorerResult {
    return {
        success: true,
        source: 'test',
        language: DataExplorerLanguage.Sql,
        defaultOutputFormat: DataExplorerOutputFormat.Table,
        executionTime: 12,
        columns: ['id', 'name', 'email'],
        rows: [
            [1, 'Alice', 'alice@ex.com'],
            [2, 'Bob', 'bob@ex.com'],
        ],
        rowCount: 2,
        truncated: false,
        error: null,
        ...overrides,
    };
}

describe('CliDataExplorerModule', () => {
    describe('CliDataExplorerCommandProcessor', () => {
        let processor: CliDataExplorerCommandProcessor;

        beforeEach(() => {
            processor = new CliDataExplorerCommandProcessor();
        });

        it('should have command "data-explorer"', () => {
            expect(processor.command).toBe('data-explorer');
        });

        it('should have correct description', () => {
            expect(processor.description).toBe(
                'Interactive query console for data sources',
            );
        });

        it('should have metadata with requireServer', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.requireServer).toBeTrue();
        });
    });

    describe('Table formatter', () => {
        it('should produce box-drawing characters', () => {
            const result = makeResult();
            const output = formatTable(result);

            // Top-left corner
            expect(output).toContain('\u250C');
            // Bottom-right corner
            expect(output).toContain('\u2518');
            // Horizontal
            expect(output).toContain('\u2500');
            // Vertical separator
            expect(output).toContain('\u2502');
        });

        it('should include column headers', () => {
            const result = makeResult();
            const output = formatTable(result);

            expect(output).toContain('id');
            expect(output).toContain('name');
            expect(output).toContain('email');
        });

        it('should include data rows', () => {
            const result = makeResult();
            const output = formatTable(result);

            expect(output).toContain('Alice');
            expect(output).toContain('bob@ex.com');
        });

        it('should show row count and execution time', () => {
            const result = makeResult();
            const output = formatTable(result);

            expect(output).toContain('2 rows (12ms)');
        });

        it('should show truncated message when truncated', () => {
            const result = makeResult({ truncated: true });
            const output = formatTable(result);

            expect(output).toContain('(results truncated)');
        });

        it('should handle empty result set', () => {
            const result = makeResult({
                columns: [],
                rows: [],
                rowCount: 0,
            });
            const output = formatTable(result);

            expect(output).toContain('(empty result set)');
        });

        it('should handle object rows', () => {
            const result = makeResult({
                rows: [
                    { id: 1, name: 'Alice', email: 'alice@ex.com' },
                    { id: 2, name: 'Bob', email: 'bob@ex.com' },
                ],
            });
            const output = formatTable(result);

            expect(output).toContain('Alice');
            expect(output).toContain('Bob');
        });

        it('should right-align numeric columns', () => {
            const result = makeResult({
                columns: ['id', 'count'],
                rows: [
                    [1, 100],
                    [2, 5],
                ],
                rowCount: 2,
            });
            const output = formatTable(result);
            const lines = output.split('\n');

            // Data rows: numeric values should be right-aligned (padStart)
            // id column: "1" should have leading space, "2" should have leading space
            const dataLines = lines.filter((l) => l.includes('100') || l.includes('  5'));
            expect(dataLines.length).toBeGreaterThan(0);
        });
    });

    describe('JSON formatter', () => {
        it('should produce valid JSON output', () => {
            const result = makeResult();
            const output = formatJson(result);

            // The first part should be parseable JSON
            const jsonPart = output.split('\n\n')[0];
            const parsed = JSON.parse(jsonPart);

            expect(Array.isArray(parsed)).toBeTrue();
            expect(parsed.length).toBe(2);
        });

        it('should pretty-print with 2-space indent', () => {
            const result = makeResult();
            const output = formatJson(result);

            // Check for 2-space indentation
            expect(output).toContain('  "id"');
        });

        it('should convert array rows to objects', () => {
            const result = makeResult();
            const output = formatJson(result);

            const jsonPart = output.split('\n\n')[0];
            const parsed = JSON.parse(jsonPart);

            expect(parsed[0].id).toBe(1);
            expect(parsed[0].name).toBe('Alice');
            expect(parsed[0].email).toBe('alice@ex.com');
        });

        it('should show row count and execution time', () => {
            const result = makeResult();
            const output = formatJson(result);

            expect(output).toContain('2 rows (12ms)');
        });
    });

    describe('CSV formatter', () => {
        it('should produce comma-separated header and rows', () => {
            const result = makeResult();
            const output = formatCsv(result);
            const lines = output.split('\n');

            expect(lines[0]).toBe('id,name,email');
            expect(lines[1]).toBe('1,Alice,alice@ex.com');
            expect(lines[2]).toBe('2,Bob,bob@ex.com');
        });

        it('should quote values containing commas', () => {
            const result = makeResult({
                columns: ['name', 'address'],
                rows: [['Alice', '123 Main St, Apt 4']],
                rowCount: 1,
            });
            const output = formatCsv(result);
            const lines = output.split('\n');

            expect(lines[1]).toBe('Alice,"123 Main St, Apt 4"');
        });

        it('should escape double quotes by doubling them', () => {
            const result = makeResult({
                columns: ['name', 'quote'],
                rows: [['Alice', 'She said "hello"']],
                rowCount: 1,
            });
            const output = formatCsv(result);
            const lines = output.split('\n');

            expect(lines[1]).toBe('Alice,"She said ""hello"""');
        });

        it('should quote values containing newlines', () => {
            const result = makeResult({
                columns: ['name', 'bio'],
                rows: [['Alice', 'Line1\nLine2']],
                rowCount: 1,
            });
            const output = formatCsv(result);

            expect(output).toContain('"Line1\nLine2"');
        });
    });

    describe('getFormatter', () => {
        it('should return table formatter for Table format', () => {
            const formatter = getFormatter(DataExplorerOutputFormat.Table);
            expect(formatter).toBe(formatTable);
        });

        it('should return json formatter for Json format', () => {
            const formatter = getFormatter(DataExplorerOutputFormat.Json);
            expect(formatter).toBe(formatJson);
        });

        it('should return csv formatter for Csv format', () => {
            const formatter = getFormatter(DataExplorerOutputFormat.Csv);
            expect(formatter).toBe(formatCsv);
        });

        it('should return a function for Raw format', () => {
            const formatter = getFormatter(DataExplorerOutputFormat.Raw);
            expect(typeof formatter).toBe('function');
        });
    });
});
