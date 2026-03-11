export type DiffType = 'same' | 'add' | 'remove';

export interface DiffLine {
    type: DiffType;
    text: string;
}

/**
 * Compute line-by-line diff using LCS (longest common subsequence).
 */
export function computeDiff(left: string, right: string): DiffLine[] {
    const a = left === '' ? [] : left.split('\n');
    const b = right === '' ? [] : right.split('\n');
    const m = a.length;
    const n = b.length;

    // Build LCS table (bottom-up)
    const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j]
                ? 1 + lcs[i + 1][j + 1]
                : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }

    // Trace back
    const result: DiffLine[] = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) {
            result.push({ type: 'same', text: a[i++] });
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            result.push({ type: 'remove', text: a[i++] });
        } else {
            result.push({ type: 'add', text: b[j++] });
        }
    }
    while (i < m) result.push({ type: 'remove', text: a[i++] });
    while (j < n) result.push({ type: 'add', text: b[j++] });

    return result;
}

/**
 * Format diff with ANSI colors. Only shows lines near changes (contextLines around each change).
 */
export function formatDiff(lines: DiffLine[], contextLines = 3): string[] {
    const output: string[] = [];
    const changes = new Set<number>();
    lines.forEach((l, i) => { if (l.type !== 'same') changes.add(i); });

    const visible = new Set<number>();
    for (const idx of changes) {
        for (let k = Math.max(0, idx - contextLines); k <= Math.min(lines.length - 1, idx + contextLines); k++) {
            visible.add(k);
        }
    }

    let lastVisible = -1;
    for (let i = 0; i < lines.length; i++) {
        if (!visible.has(i)) continue;
        if (lastVisible !== -1 && i > lastVisible + 1) {
            output.push('\x1b[2m...\x1b[0m');
        }
        const { type, text } = lines[i];
        if (type === 'add') {
            output.push(`\x1b[32m+ ${text}\x1b[0m`);
        } else if (type === 'remove') {
            output.push(`\x1b[31m- ${text}\x1b[0m`);
        } else {
            output.push(`\x1b[2m  ${text}\x1b[0m`);
        }
        lastVisible = i;
    }
    return output;
}
