import { DataExplorerResult } from '../models/data-explorer-types';

const MAX_COL_WIDTH = 50;

const CSI = '\x1b[';
const CYAN = `${CSI}36m`;
const RESET = `${CSI}0m`;

/**
 * Format a DataExplorerResult as an ASCII table with box-drawing characters.
 */
export function formatTable(result: DataExplorerResult): string {
    const columns = result.columns ?? [];
    const rows = normalizeRows(result.rows, columns);

    if (columns.length === 0 && rows.length === 0) {
        return `(empty result set) (${result.executionTime}ms)`;
    }

    // Calculate column widths
    const widths = columns.map((col) => col.length);
    for (const row of rows) {
        for (let i = 0; i < columns.length; i++) {
            const val = truncate(String(row[i] ?? ''));
            widths[i] = Math.max(widths[i], val.length);
        }
    }

    // Detect numeric columns (right-align)
    const isNumeric = columns.map((_, i) =>
        rows.length > 0 && rows.every((row) => {
            const v = row[i];
            return v === null || v === undefined || !isNaN(Number(v));
        }),
    );

    const lines: string[] = [];

    // Top border
    lines.push(
        '\u250C' +
            widths.map((w) => '\u2500'.repeat(w + 2)).join('\u252C') +
            '\u2510',
    );

    // Header row (colored cyan)
    lines.push(
        '\u2502' +
            columns
                .map((col, i) => {
                    const padded = col.padEnd(widths[i]);
                    return ` ${CYAN}${padded}${RESET} `;
                })
                .join('\u2502') +
            '\u2502',
    );

    // Header separator
    lines.push(
        '\u251C' +
            widths.map((w) => '\u2500'.repeat(w + 2)).join('\u253C') +
            '\u2524',
    );

    // Data rows
    for (const row of rows) {
        lines.push(
            '\u2502' +
                columns
                    .map((_, i) => {
                        const raw = truncate(String(row[i] ?? ''));
                        const padded = isNumeric[i]
                            ? raw.padStart(widths[i])
                            : raw.padEnd(widths[i]);
                        return ` ${padded} `;
                    })
                    .join('\u2502') +
                '\u2502',
        );
    }

    // Bottom border
    lines.push(
        '\u2514' +
            widths.map((w) => '\u2500'.repeat(w + 2)).join('\u2534') +
            '\u2518',
    );

    // Summary
    const rowLabel = result.rowCount === 1 ? 'row' : 'rows';
    lines.push(`${result.rowCount} ${rowLabel} (${result.executionTime}ms)`);
    if (result.truncated) {
        lines.push('(results truncated)');
    }

    return lines.join('\n');
}

function normalizeRows(
    rows: unknown[][] | Record<string, unknown>[],
    columns: string[],
): unknown[][] {
    if (rows.length === 0) return [];
    if (Array.isArray(rows[0])) return rows as unknown[][];

    // Convert object rows to array rows using column order
    return (rows as Record<string, unknown>[]).map((row) =>
        columns.map((col) => row[col]),
    );
}

function truncate(value: string): string {
    if (value.length <= MAX_COL_WIDTH) return value;
    return value.slice(0, MAX_COL_WIDTH - 3) + '...';
}
