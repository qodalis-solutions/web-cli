const MIN_INTERVAL_MS = 10_000; // 10 seconds minimum

/**
 * Parse duration string: 30s, 5m, 1h, 2h30m, etc.
 * Returns null for invalid or too-short durations.
 */
export function parseDuration(input: string): number | null {
    if (!input.trim()) return null;
    // Plain number = seconds
    if (/^\d+$/.test(input.trim())) {
        const ms = parseInt(input.trim(), 10) * 1000;
        return ms >= MIN_INTERVAL_MS ? ms : null;
    }
    const pattern = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
    const match = input.trim().match(pattern);
    if (!match || !match[0] || match[0] === '') return null;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    const total = h * 3_600_000 + m * 60_000 + s * 1_000;
    return total >= MIN_INTERVAL_MS ? total : null;
}

/**
 * Format milliseconds as HH:MM:SS.mmm
 */
export function formatDuration(ms: number): string {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    const millis = ms % 1_000;
    return [
        String(h).padStart(2, '0'),
        String(m).padStart(2, '0'),
        String(s).padStart(2, '0'),
    ].join(':') + '.' + String(millis).padStart(3, '0');
}
