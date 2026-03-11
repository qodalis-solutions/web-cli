import { parseCsv, csvToJson, filterCsvRows, sortCsvRows, toCsvString } from '../lib/csv-utils';

const SAMPLE = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCarol,35,NYC';

describe('csv-utils', () => {
    describe('parseCsv', () => {
        it('parses headers and rows', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            expect(headers).toEqual(['name', 'age', 'city']);
            expect(rows).toHaveSize(3);
        });

        it('handles quoted fields with commas', () => {
            const input = 'a,b\n"hello, world",2';
            const { rows } = parseCsv(input);
            expect(rows[0][0]).toBe('hello, world');
        });

        it('handles escaped quotes inside quoted fields', () => {
            const input = 'a\n"say ""hello"""';
            const { rows } = parseCsv(input);
            expect(rows[0][0]).toBe('say "hello"');
        });

        it('returns empty for empty input', () => {
            const { headers, rows } = parseCsv('');
            expect(headers).toEqual([]);
            expect(rows).toEqual([]);
        });

        it('returns only headers for header-only CSV', () => {
            const { headers, rows } = parseCsv('a,b,c');
            expect(headers).toEqual(['a', 'b', 'c']);
            expect(rows).toHaveSize(0);
        });
    });

    describe('csvToJson', () => {
        it('converts rows to array of objects', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const json = csvToJson(headers, rows);
            expect(json[0]).toEqual({ name: 'Alice', age: '30', city: 'NYC' });
        });
    });

    describe('filterCsvRows', () => {
        it('eq filter returns matching rows', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'city', 'eq', 'NYC');
            expect(filtered).toHaveSize(2);
        });

        it('ne filter excludes matching rows', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'city', 'ne', 'NYC');
            expect(filtered).toHaveSize(1);
        });

        it('contains filter matches partial strings', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'name', 'contains', 'li');
            expect(filtered).toHaveSize(1);
            expect(filtered[0][0]).toBe('Alice');
        });

        it('gt filter compares numbers', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'age', 'gt', '29');
            expect(filtered).toHaveSize(2);
        });

        it('lt filter compares numbers', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'age', 'lt', '30');
            expect(filtered).toHaveSize(1);
            expect(filtered[0][0]).toBe('Bob');
        });

        it('returns all rows for unknown column', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'nonexistent', 'eq', 'x');
            expect(filtered).toHaveSize(3);
        });
    });

    describe('sortCsvRows', () => {
        it('sorts ascending by numeric column', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'age', 'asc');
            expect(sorted[0][1]).toBe('25');
        });

        it('sorts descending by numeric column', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'age', 'desc');
            expect(sorted[0][1]).toBe('35');
        });

        it('sorts alphabetically by string column', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'name', 'asc');
            expect(sorted[0][0]).toBe('Alice');
        });

        it('returns original order for unknown column', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'unknown', 'asc');
            expect(sorted).toEqual(rows);
        });
    });

    describe('toCsvString', () => {
        it('round-trips through parseCsv', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const csv = toCsvString(headers, rows);
            expect(csv).toBe(SAMPLE);
        });

        it('escapes commas in values', () => {
            const csv = toCsvString(['a'], [['hello, world']]);
            expect(csv).toBe('a\n"hello, world"');
        });
    });
});
