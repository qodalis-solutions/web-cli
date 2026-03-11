const MIN_INTERVAL_MS = 10_000; // 10 seconds minimum

export function parseInterval(input: string): number | null {
    if (!input.trim()) return null;
    if (/^\d+$/.test(input.trim())) {
        const ms = parseInt(input.trim(), 10) * 1000;
        return ms >= MIN_INTERVAL_MS ? ms : null;
    }
    const pattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
    const match = input.trim().match(pattern);
    if (!match || match[0] === '') return null;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    const total = h * 3_600_000 + m * 60_000 + s * 1_000;
    return total >= MIN_INTERVAL_MS ? total : null;
}

export function formatInterval(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(' ') || '0s';
}
