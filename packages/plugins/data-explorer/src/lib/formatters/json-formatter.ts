import { DataExplorerResult } from '../models/data-explorer-types';

/**
 * Format a DataExplorerResult as pretty-printed JSON.
 */
export function formatJson(result: DataExplorerResult): string {
    const columns = result.columns ?? [];
    const rows = result.rows;

    let output: unknown[];

    if (rows.length === 0) {
        output = [];
    } else if (Array.isArray(rows[0])) {
        // Convert array rows to object rows
        output = (rows as unknown[][]).map((row) => {
            const obj: Record<string, unknown> = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return obj;
        });
    } else {
        output = rows;
    }

    const lines: string[] = [];
    lines.push(JSON.stringify(output, null, 2));
    lines.push('');
    const rowLabel = result.rowCount === 1 ? 'row' : 'rows';
    lines.push(`${result.rowCount} ${rowLabel} (${result.executionTime}ms)`);
    if (result.truncated) {
        lines.push('(results truncated)');
    }

    return lines.join('\n');
}
