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
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (ch === ',' && !inQuotes) {
                result.push(current); current = '';
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
