export interface ChartDataPoint {
    label: string;
    value: number;
}

/**
 * Parse newline-separated numbers or "key:value" pairs.
 */
export function parseChartInput(input: string): ChartDataPoint[] {
    if (!input.trim()) return [];
    return input
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line, i) => {
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1) {
                const label = line.slice(0, colonIdx).trim();
                const value = parseFloat(line.slice(colonIdx + 1).trim());
                return { label, value: isNaN(value) ? 0 : value };
            }
            const value = parseFloat(line);
            return { label: String(i + 1), value: isNaN(value) ? 0 : value };
        });
}

const BLOCK_CHARS = ' \u2581\u2582\u2583\u2584\u2585\u2586\u2587\u2588';

export function renderBarChart(data: ChartDataPoint[], width = 40): string[] {
    if (data.length === 0) return ['No data'];
    const max = Math.max(...data.map((d) => d.value));
    const labelWidth = Math.max(...data.map((d) => d.label.length)) + 1;

    // When all values are zero, show minimal bars
    if (max === 0) {
        return data.map(({ label }) => `${label.padStart(labelWidth)} | \u2581 0`);
    }

    return data.map(({ label, value }) => {
        const ratio = value / max;
        const barLen = Math.round(ratio * width);
        const bar = '\u2588'.repeat(barLen);
        return `${label.padStart(labelWidth)} | ${bar} ${value}`;
    });
}

export function renderSparkline(data: ChartDataPoint[]): string {
    if (data.length === 0) return '';
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // All same values → use half-block (visual middle)
    if (range === 0) {
        const midChar = BLOCK_CHARS[Math.floor(BLOCK_CHARS.length / 2)];
        return values.map(() => midChar).join('');
    }

    return values
        .map((v) => {
            const idx = Math.round(((v - min) / range) * (BLOCK_CHARS.length - 1));
            return BLOCK_CHARS[idx];
        })
        .join('');
}

export function renderLineChart(data: ChartDataPoint[], width = 60, height = 12): string[] {
    if (data.length === 0) return ['No data'];
    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const grid: string[][] = Array.from({ length: height }, () =>
        Array(width).fill(' '),
    );

    data.forEach(({ value }, i) => {
        const col = Math.round((i / (data.length - 1 || 1)) * (width - 1));
        const row = height - 1 - Math.round(((value - min) / range) * (height - 1));
        if (grid[row]) grid[row][col] = '\u25cf';
    });

    return grid.map((row, i) => {
        const yLabel =
            i === 0
                ? String(max.toFixed(1)).padStart(6)
                : i === height - 1
                  ? String(min.toFixed(1)).padStart(6)
                  : ''.padStart(6);
        return `${yLabel} |${row.join('')}`;
    });
}
