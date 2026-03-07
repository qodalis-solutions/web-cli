import { parseChartInput, renderBarChart, renderSparkline, renderLineChart } from '../lib/chart-utils';

describe('chart-utils', () => {
    describe('parseChartInput', () => {
        it('parses newline-separated numbers', () => {
            const result = parseChartInput('10\n20\n30');
            expect(result).toEqual([
                { label: '1', value: 10 },
                { label: '2', value: 20 },
                { label: '3', value: 30 },
            ]);
        });

        it('parses key:value pairs', () => {
            const result = parseChartInput('Jan:100\nFeb:200\nMar:150');
            expect(result).toEqual([
                { label: 'Jan', value: 100 },
                { label: 'Feb', value: 200 },
                { label: 'Mar', value: 150 },
            ]);
        });

        it('skips blank lines', () => {
            const result = parseChartInput('10\n\n20');
            expect(result.length).toBe(2);
        });

        it('returns empty array for empty input', () => {
            expect(parseChartInput('')).toEqual([]);
        });

        it('returns 0 for non-numeric values', () => {
            const result = parseChartInput('abc');
            expect(result[0].value).toBe(0);
        });
    });

    describe('renderBarChart', () => {
        it('renders a bar for each data point', () => {
            const data = [{ label: 'A', value: 10 }, { label: 'B', value: 20 }];
            const lines = renderBarChart(data, 20);
            expect(lines.length).toBe(2);
            expect(lines.some((l) => l.includes('A'))).toBeTrue();
            expect(lines.some((l) => l.includes('B'))).toBeTrue();
        });

        it('renders max value at full width', () => {
            const data = [{ label: 'X', value: 100 }];
            const lines = renderBarChart(data, 20);
            expect(lines[0]).toContain('\u2588'.repeat(20));
        });

        it('returns ["No data"] for empty input', () => {
            expect(renderBarChart([], 20)).toEqual(['No data']);
        });

        it('renders zero value as empty bar', () => {
            const data = [{ label: 'A', value: 0 }, { label: 'B', value: 10 }];
            const lines = renderBarChart(data, 10);
            expect(lines[0]).toContain('| ');
        });
    });

    describe('renderSparkline', () => {
        it('returns empty string for empty input', () => {
            expect(renderSparkline([])).toBe('');
        });

        it('returns string with same length as data', () => {
            const data = [1, 2, 3, 4].map((v, i) => ({ label: String(i), value: v }));
            expect(renderSparkline(data).length).toBe(4);
        });

        it('uses block characters', () => {
            const data = [{ label: '1', value: 1 }, { label: '2', value: 8 }];
            const spark = renderSparkline(data);
            expect(spark.length).toBeGreaterThan(0);
        });

        it('handles all-same values gracefully', () => {
            const data = [5, 5, 5].map((v, i) => ({ label: String(i), value: v }));
            const spark = renderSparkline(data);
            expect(spark.length).toBe(3);
        });
    });

    describe('renderLineChart', () => {
        it('returns ["No data"] for empty input', () => {
            expect(renderLineChart([], 20, 5)).toEqual(['No data']);
        });

        it('returns height number of lines', () => {
            const data = [1, 2, 3].map((v, i) => ({ label: String(i), value: v }));
            const lines = renderLineChart(data, 20, 5);
            expect(lines.length).toBe(5);
        });

        it('includes max value label on first line', () => {
            const data = [0, 50, 100].map((v, i) => ({ label: String(i), value: v }));
            const lines = renderLineChart(data, 20, 5);
            expect(lines[0]).toContain('100');
        });

        it('includes min value label on last line', () => {
            const data = [0, 50, 100].map((v, i) => ({ label: String(i), value: v }));
            const lines = renderLineChart(data, 20, 5);
            expect(lines[lines.length - 1]).toContain('0');
        });

        it('places a dot character in the grid', () => {
            const data = [10, 20, 30].map((v, i) => ({ label: String(i), value: v }));
            const lines = renderLineChart(data, 20, 5);
            const combined = lines.join('');
            expect(combined).toContain('\u25cf');
        });
    });
});
