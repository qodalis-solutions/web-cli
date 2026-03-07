import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    DefaultLibraryAuthor,
    CliIcon,
    ICliCommandChildProcessor,
} from '@qodalis/cli-core';
import { parseCsv, csvToJson, filterCsvRows, sortCsvRows, toCsvString } from '../csv-utils';
import { LIBRARY_VERSION } from '../version';

export class CliCsvCommandProcessor implements ICliCommandProcessor {
    command = 'csv';
    description = 'Parse, filter, sort, and convert CSV data';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    metadata = { icon: CliIcon.Database };

    processors: ICliCommandChildProcessor[] = [
        {
            command: 'parse',
            description: 'Parse CSV and display as a table. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                const separator = headers.join(' | ');
                context.writer.writeln(separator);
                context.writer.writeln('-'.repeat(separator.length));
                rows.forEach((row) => context.writer.writeln(row.join(' | ')));
            },
        },
        {
            command: 'to-json',
            description: 'Convert CSV to JSON array. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                const json = csvToJson(headers, rows);
                context.writer.writeJson(json);
            },
        },
        {
            command: 'columns',
            description: 'List column names from CSV. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { headers } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                headers.forEach((h, i) => context.writer.writeln(`  ${i}: ${h}`));
            },
        },
        {
            command: 'count',
            description: 'Count rows in CSV. Input via pipe.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { rows } = parseCsv(cmd.value ?? '');
                context.writer.writeln(String(rows.length));
            },
        },
        {
            command: 'filter',
            description: 'Filter rows: csv filter --col=name --op=eq --val=Alice',
            valueRequired: true,
            parameters: [
                { name: 'col', description: 'Column name', required: true, type: 'string' },
                { name: 'op', description: 'Operator: eq, ne, contains, gt, lt', required: true, type: 'string' },
                { name: 'val', description: 'Value to compare', required: true, type: 'string' },
            ],
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                const col = cmd.args?.['col'] as string;
                const op = cmd.args?.['op'] as 'eq' | 'ne' | 'contains' | 'gt' | 'lt';
                const val = cmd.args?.['val'] as string;
                if (!col || !op || val === undefined) {
                    context.writer.writeError('Usage: csv filter --col=<name> --op=<op> --val=<value>');
                    return;
                }
                const filtered = filterCsvRows(headers, rows, col, op, val);
                context.writer.writeln(toCsvString(headers, filtered));
            },
        },
        {
            command: 'sort',
            description: 'Sort rows: csv sort --col=age --dir=asc',
            valueRequired: true,
            parameters: [
                { name: 'col', description: 'Column name', required: true, type: 'string' },
                { name: 'dir', description: 'Direction: asc or desc (default: asc)', required: false, type: 'string' },
            ],
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const { headers, rows } = parseCsv(cmd.value ?? '');
                if (!headers.length) { context.writer.writeError('No CSV data'); return; }
                const col = cmd.args?.['col'] as string;
                const dir = (cmd.args?.['dir'] as 'asc' | 'desc') ?? 'asc';
                if (!col) {
                    context.writer.writeError('Usage: csv sort --col=<name> [--dir=asc|desc]');
                    return;
                }
                const sorted = sortCsvRows(headers, rows, col, dir);
                context.writer.writeln(toCsvString(headers, sorted));
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeln('Usage: <command> | csv <subcommand>');
        context.writer.writeln('Subcommands: parse, to-json, columns, count, filter, sort');
    }

    writeDescription(context: ICliExecutionContext): void {
        context.writer.writeln(this.description!);
    }
}
