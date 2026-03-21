import { DataExplorerResult } from '../models/data-explorer-types';

/**
 * Format a DataExplorerResult as CSV with proper escaping.
 */
export function formatCsv(result: DataExplorerResult): string {
    const columns = result.columns ?? [];
    const rows = normalizeRows(result.rows, columns);

    const lines: string[] = [];

    // Header
    lines.push(columns.map(escapeCsvValue).join(','));

    // Data rows
    for (const row of rows) {
        lines.push(row.map((v) => escapeCsvValue(String(v ?? ''))).join(','));
    }

    return lines.join('\n');
}

function escapeCsvValue(value: string): string {
    if (
        value.includes(',') ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r')
    ) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

function normalizeRows(
    rows: unknown[][] | Record<string, unknown>[],
    columns: string[],
): unknown[][] {
    if (rows.length === 0) return [];
    if (Array.isArray(rows[0])) return rows as unknown[][];

    return (rows as Record<string, unknown>[]).map((row) =>
        columns.map((col) => row[col]),
    );
}
