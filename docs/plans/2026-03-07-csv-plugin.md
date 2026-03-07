# CSV Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@qodalis/cli-csv` plugin for parsing, filtering, sorting, and converting CSV data in the terminal pipeline.

**Architecture:** New plugin scaffolded via `create-plugin`. All CSV parsing done without external dependencies (inline RFC 4180-compliant parser). Subcommands: `parse`, `filter`, `sort`, `to-json`, `from-json`, `columns`, `count`. Input always comes through pipe.

**Tech Stack:** TypeScript, tsup, Jasmine

---

### Task 1: Scaffold the plugin

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name csv --description "CSV data manipulation in the terminal" --processor-name CliCsvCommandProcessor
git add packages/plugins/csv/
git commit -m "chore(csv): scaffold csv plugin"
```

---

### Task 2: Write failing tests

**Files:**
- Create: `packages/plugins/csv/src/tests/csv.spec.ts`

```typescript
import { parseCsv, csvToJson, filterCsvRows, sortCsvRows } from '../lib/csv-utils';

describe('csv-utils', () => {
    const SAMPLE = 'name,age,city\nAlice,30,NYC\nBob,25,LA\nCarol,35,NYC';

    describe('parseCsv', () => {
        it('parses headers and rows', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            expect(headers).toEqual(['name', 'age', 'city']);
            expect(rows).toHaveSize(3);
        });

        it('handles quoted fields', () => {
            const input = 'a,b\n"hello, world",2';
            const { rows } = parseCsv(input);
            expect(rows[0][0]).toBe('hello, world');
        });

        it('returns empty for empty input', () => {
            const { headers, rows } = parseCsv('');
            expect(headers).toEqual([]);
            expect(rows).toEqual([]);
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
        it('filters rows by column equals value', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'city', 'eq', 'NYC');
            expect(filtered).toHaveSize(2);
        });

        it('filters rows by column contains value', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const filtered = filterCsvRows(headers, rows, 'name', 'contains', 'li');
            expect(filtered).toHaveSize(1);
            expect(filtered[0][0]).toBe('Alice');
        });
    });

    describe('sortCsvRows', () => {
        it('sorts by column ascending', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'age', 'asc');
            expect(sorted[0][1]).toBe('25');
        });

        it('sorts by column descending', () => {
            const { headers, rows } = parseCsv(SAMPLE);
            const sorted = sortCsvRows(headers, rows, 'age', 'desc');
            expect(sorted[0][1]).toBe('35');
        });
    });
});
```

Run to verify failure:
```bash
npx nx test csv
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 3: Implement CSV utilities

**Files:**
- Create: `packages/plugins/csv/src/lib/csv-utils.ts`

```typescript
export interface ParsedCsv {
    headers: string[];
    rows: string[][];
}

export function parseCsv(input: string): ParsedCsv {
    if (!input.trim()) return { headers: [], rows: [] };
    const lines = input.split('\n').filter(Boolean);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
}

export function csvToJson(headers: string[], rows: string[][]): Record<string, string>[] {
    return rows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
        return obj;
    });
}

export function filterCsvRows(
    headers: string[],
    rows: string[][],
    column: string,
    op: 'eq' | 'ne' | 'contains' | 'gt' | 'lt',
    value: string,
): string[][] {
    const colIdx = headers.indexOf(column);
    if (colIdx === -1) return rows;
    return rows.filter((row) => {
        const cell = row[colIdx] ?? '';
        switch (op) {
            case 'eq': return cell === value;
            case 'ne': return cell !== value;
            case 'contains': return cell.includes(value);
            case 'gt': return parseFloat(cell) > parseFloat(value);
            case 'lt': return parseFloat(cell) < parseFloat(value);
        }
    });
}

export function sortCsvRows(
    headers: string[],
    rows: string[][],
    column: string,
    direction: 'asc' | 'desc',
): string[][] {
    const colIdx = headers.indexOf(column);
    if (colIdx === -1) return rows;
    return [...rows].sort((a, b) => {
        const av = a[colIdx] ?? '';
        const bv = b[colIdx] ?? '';
        const numA = parseFloat(av);
        const numB = parseFloat(bv);
        const cmp = isNaN(numA) || isNaN(numB) ? av.localeCompare(bv) : numA - numB;
        return direction === 'asc' ? cmp : -cmp;
    });
}

export function toCsvString(headers: string[], rows: string[][]): string {
    const escape = (s: string) => (s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s);
    return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}
```

---

### Task 4: Implement the command processor

**Files:**
- Modify: `packages/plugins/csv/src/lib/cli-csv-command-processor.ts`

```typescript
import {
    ICliCommandProcessor, ICliExecutionContext, CliProcessCommand,
    DefaultLibraryAuthor, CliIcon,
} from '@qodalis/cli-core';
import { parseCsv, csvToJson, filterCsvRows, sortCsvRows, toCsvString } from './csv-utils';

export class CliCsvCommandProcessor implements ICliCommandProcessor {
    command = 'csv';
    description = 'Parse, filter, sort, and convert CSV data';
    author = DefaultLibraryAuthor;
    metadata = { icon: CliIcon.Table };

    processors: ICliCommandProcessor[] = [
        {
            command: 'parse',
            description: 'Parse CSV and display as a table. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd, context) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                context.writer.writeColumns(headers, rows);
            },
        },
        {
            command: 'to-json',
            description: 'Convert CSV to JSON array. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd, context) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                const json = csvToJson(headers, rows);
                context.writer.writeJson(json);
            },
        },
        {
            command: 'columns',
            description: 'List column names from CSV. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd, context) => {
                const { headers } = parseCsv(cmd.value ?? '');
                headers.forEach((h, i) => context.writer.writeln(`  ${i}: ${h}`));
            },
        },
        {
            command: 'count',
            description: 'Count rows in CSV. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd, context) => {
                const { rows } = parseCsv(cmd.value ?? '');
                context.writer.writeln(String(rows.length));
            },
        },
        {
            command: 'filter',
            description: 'Filter rows: csv filter --col name --op eq --val Alice',
            valueRequired: true,
            parameters: [
                { name: 'col', description: 'Column name', required: true, type: 'string' },
                { name: 'op', description: 'Operator: eq, ne, contains, gt, lt', required: true, type: 'string' },
                { name: 'val', description: 'Value to compare', required: true, type: 'string' },
            ],
            processCommand: async (cmd, context) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                const col = cmd.parameters?.['col'] as string;
                const op = cmd.parameters?.['op'] as 'eq' | 'ne' | 'contains' | 'gt' | 'lt';
                const val = cmd.parameters?.['val'] as string;
                const filtered = filterCsvRows(headers, rows, col, op, val);
                context.writer.writeln(toCsvString(headers, filtered));
            },
        },
        {
            command: 'sort',
            description: 'Sort rows: csv sort --col age --dir asc',
            valueRequired: true,
            parameters: [
                { name: 'col', description: 'Column name', required: true, type: 'string' },
                { name: 'dir', description: 'Direction: asc or desc (default: asc)', required: false, type: 'string' },
            ],
            processCommand: async (cmd, context) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                const col = cmd.parameters?.['col'] as string;
                const dir = (cmd.parameters?.['dir'] as 'asc' | 'desc') ?? 'asc';
                const sorted = sortCsvRows(headers, rows, col, dir);
                context.writer.writeln(toCsvString(headers, sorted));
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeln('Usage: <command> | csv <subcommand>');
        context.writer.writeln('Subcommands: parse, to-json, columns, count, filter, sort');
    }
}
```

---

### Task 5: Run tests and commit

```bash
npx nx test csv
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
npx nx build csv
git add packages/plugins/csv/
git commit -m "feat(csv): add CSV manipulation plugin (parse/filter/sort/to-json)"
```
