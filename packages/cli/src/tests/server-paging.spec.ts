import { nextRowsCommand, renderSingleOutput } from '../lib/server/cli-server-proxy-processor';

describe('Paged server tables', () => {
    function render(output: any, rawCommand?: string) {
        const lines: string[] = [];
        const warnings: string[] = [];
        const tables: string[][][] = [];
        const context: any = {
            writer: {
                writeTable: (_h: string[], rows: string[][]) => tables.push(rows),
                writeln: (text = '') => lines.push(text.replace(/\x1b\[[0-9;]*m/g, '')),
                writeWarning: (text: string) => warnings.push(text),
                wrapInColor: (text: string) => text,
            },
            translator: {
                t: (_key: string, fallback: string, params: Record<string, string> = {}) =>
                    fallback.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? ''),
            },
        };
        renderSingleOutput(output, context, rawCommand);
        return { lines, warnings, tables };
    }

    const rows = (count: number) => Array.from({ length: count }, (_, i) => [String(i + 1)]);
    const table = (page?: any, count = 1) => ({ type: 'table', headers: ['N'], rows: rows(count), page });

    it('builds the next rows command, replacing any --skip', () => {
        expect(nextRowsCommand('accounts list', 50)).toBe('accounts list --skip 50');
        expect(nextRowsCommand('rb:accounts list jo --skip 20 --take 20', 40)).toBe(
            'rb:accounts list jo --take 20 --skip 40',
        );
        expect(nextRowsCommand('jobs runs --skip=30', 60)).toBe('jobs runs --skip 60');
    });

    it('shows the rows, the total and the next command', () => {
        const { lines } = render(table({ skip: 50, take: 50, total: 120, hasMore: true }, 50), 'accounts list --skip 50');
        expect(lines).toEqual(['Rows 51–100 of 120 · next: accounts list --skip 100']);
    });

    it('omits the next command on the last rows and the total when unknown', () => {
        expect(render(table({ skip: 100, take: 50, total: 120, hasMore: false }, 20), 'x').lines).toEqual([
            'Rows 101–120 of 120',
        ]);
        expect(render(table({ skip: 0, take: 50, hasMore: true }, 50), 'x').lines).toEqual([
            'Rows 1–50 · next: x --skip 50',
        ]);
    });

    it('says when there are no rows past the skip', () => {
        expect(render(table({ skip: 200, take: 50, total: 120, hasMore: false }, 0), 'x').lines).toEqual([
            'No rows after 200 of 120',
        ]);
    });

    it('warns when the server cut a table that does not page', () => {
        const { lines, warnings } = render(
            table({ skip: 0, take: 200, total: 5000, hasMore: true, truncated: true }, 200),
            'big',
        );
        expect(lines).toEqual([]);
        expect(warnings[0]).toContain('first 200 of 5000 rows');
    });

    it('writes no footer for a plain table', () => {
        const { lines, tables } = render(table(), 'x');
        expect(tables.length).toBe(1);
        expect(lines).toEqual([]);
    });
});
