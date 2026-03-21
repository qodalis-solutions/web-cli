import { DataExplorerOutputFormat, DataExplorerResult } from '../models/data-explorer-types';
import { formatTable } from './table-formatter';
import { formatJson } from './json-formatter';
import { formatCsv } from './csv-formatter';

export { formatTable } from './table-formatter';
export { formatJson } from './json-formatter';
export { formatCsv } from './csv-formatter';

/**
 * Returns the appropriate formatter function for the given output format.
 */
export function getFormatter(
    format: DataExplorerOutputFormat,
): (result: DataExplorerResult) => string {
    switch (format) {
        case DataExplorerOutputFormat.Table:
            return formatTable;
        case DataExplorerOutputFormat.Json:
            return formatJson;
        case DataExplorerOutputFormat.Csv:
            return formatCsv;
        case DataExplorerOutputFormat.Raw:
            return (result) => JSON.stringify(result.rows);
        default:
            return formatTable;
    }
}
