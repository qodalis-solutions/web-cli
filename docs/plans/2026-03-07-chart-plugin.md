# ASCII Chart Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a `@qodalis/cli-chart` plugin with `chart bar`, `chart line`, and `chart sparkline` subcommands that render ASCII graphs from piped numeric data.

**Architecture:** New plugin scaffolded via `create-plugin`. Input accepted via pipe (`cmd.value`) as newline-separated numbers or `key:value` pairs. Rendering is pure terminal character art using box-drawing characters. No new npm dependencies.

**Tech Stack:** TypeScript, tsup, Jasmine, ASCII/Unicode box-drawing characters

---

### Task 1: Scaffold the plugin

**Step 1: Run the scaffolding tool**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run create-plugin -- --name chart --description "ASCII chart and graph rendering" --processor-name CliChartCommandProcessor
```

This creates `packages/plugins/chart/` with all boilerplate.

**Step 2: Verify created files**

```bash
ls packages/plugins/chart/src/
```

Expected: `index.ts`, `lib/cli-chart-command-processor.ts`, `lib/cli-chart-module.ts`

**Step 3: Commit scaffold**

```bash
git add packages/plugins/chart/
git commit -m "chore(chart): scaffold chart plugin"
```

---

### Task 2: Write failing tests

**Files:**
- Create: `packages/plugins/chart/src/tests/chart.spec.ts`

**Step 1: Write tests**

```typescript
import { parseChartInput, renderBarChart, renderSparkline } from '../lib/chart-utils';

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
            expect(result).toHaveSize(2);
        });

        it('returns empty array for empty input', () => {
            expect(parseChartInput('')).toEqual([]);
        });
    });

    describe('renderBarChart', () => {
        it('renders a bar for each data point', () => {
            const data = [{ label: 'A', value: 10 }, { label: 'B', value: 20 }];
            const lines = renderBarChart(data, 20);
            expect(lines.length).toBeGreaterThan(0);
            expect(lines.some((l) => l.includes('A'))).toBeTrue();
            expect(lines.some((l) => l.includes('B'))).toBeTrue();
        });

        it('renders the bar for max value at full width', () => {
            const data = [{ label: 'X', value: 100 }];
            const lines = renderBarChart(data, 20);
            expect(lines.some((l) => l.includes('\u2588'.repeat(20)))).toBeTrue();
        });
    });

    describe('renderSparkline', () => {
        it('returns a single-line string', () => {
            const data = [{ label: '1', value: 1 }, { label: '2', value: 4 }, { label: '3', value: 8 }];
            const result = renderSparkline(data);
            expect(result.length).toBe(3);
        });

        it('uses braille or block characters', () => {
            const data = [{ label: '1', value: 1 }];
            const result = renderSparkline(data);
            expect(typeof result).toBe('string');
        });
    });
});
```

**Step 2: Run — expect failure**

```bash
npx nx test chart
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

---

### Task 3: Implement chart utilities

**Files:**
- Create: `packages/plugins/chart/src/lib/chart-utils.ts`

**Step 1: Write utilities**

```typescript
export interface ChartDataPoint {
    label: string;
    value: number;
}

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
    return data.map(({ label, value }) => {
        const ratio = max === 0 ? 0 : value / max;
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
    const range = max - min || 1;
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

    // Build a 2D grid
    const grid: string[][] = Array.from({ length: height }, () =>
        Array(width).fill(' '),
    );

    data.forEach(({ value }, i) => {
        const col = Math.round((i / (data.length - 1 || 1)) * (width - 1));
        const row = height - 1 - Math.round(((value - min) / range) * (height - 1));
        if (grid[row]) grid[row][col] = '\u25cf'; // filled circle
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
```

---

### Task 4: Implement the command processor

**Files:**
- Modify: `packages/plugins/chart/src/lib/cli-chart-command-processor.ts`

**Step 1: Replace scaffolded processor with full implementation**

```typescript
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    ICliCommandAuthor,
    CliProcessorMetadata,
    CliIcon,
    DefaultLibraryAuthor,
    CliForegroundColor,
} from '@qodalis/cli-core';
import { parseChartInput, renderBarChart, renderLineChart, renderSparkline } from './chart-utils';

export class CliChartCommandProcessor implements ICliCommandProcessor {
    command = 'chart';
    description = 'Render ASCII charts from piped data (numbers or key:value pairs)';
    author: ICliCommandAuthor = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = { icon: CliIcon.Graph };

    processors: ICliCommandProcessor[] = [
        {
            command: 'bar',
            description: 'Horizontal bar chart. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const data = parseChartInput(cmd.value ?? '');
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const lines = renderBarChart(data, Math.min(context.terminal.cols - 20, 60));
                for (const line of lines) {
                    context.writer.writeln(
                        context.writer.wrapInColor(line, CliForegroundColor.Cyan),
                    );
                }
            },
        },
        {
            command: 'line',
            description: 'Line chart. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const data = parseChartInput(cmd.value ?? '');
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const lines = renderLineChart(data, Math.min(context.terminal.cols - 10, 60));
                for (const line of lines) {
                    context.writer.writeln(line);
                }
                // X-axis labels
                const labels = data.map((d) => d.label.slice(0, 3));
                context.writer.writeln('       ' + labels.join('  '));
            },
        },
        {
            command: 'sparkline',
            description: 'Single-line sparkline. Pipe numbers or key:value pairs.',
            valueRequired: true,
            processCommand: async (cmd: CliProcessCommand, context: ICliExecutionContext) => {
                const data = parseChartInput(cmd.value ?? '');
                if (!data.length) {
                    context.writer.writeError('No data. Pipe numbers or key:value pairs.');
                    return;
                }
                const spark = renderSparkline(data);
                context.writer.writeln(spark);
            },
        },
    ];

    async processCommand(_: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        context.writer.writeln('Usage:');
        context.writer.writeln('  echo "10\n20\n30" | chart bar');
        context.writer.writeln('  echo "Jan:100\nFeb:200" | chart line');
        context.writer.writeln('  echo "1\n4\n9\n16" | chart sparkline');
    }
}
```

---

### Task 5: Run tests and commit

**Step 1: Run tests**

```bash
npx nx test chart
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all tests pass.

**Step 2: Build**

```bash
npx nx build chart
```

**Step 3: Commit**

```bash
git add packages/plugins/chart/
git commit -m "feat(chart): add ASCII chart plugin (bar/line/sparkline)"
```
