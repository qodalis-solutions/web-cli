import {
    CliProcessCommand,
    CliProcessorMetadata,
    DefaultLibraryAuthor,
    ICliBackgroundServiceInfo,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliManagedInterval,
    ICliProcessEntry,
    ICliProcessRegistry,
} from '@qodalis/cli-core';
import { CliProcessRegistry_TOKEN } from '../../services/cli-process-registry';

// ── ANSI helpers ─────────────────────────────────────────────────────

const ESC = '\x1b';
const CSI = `${ESC}[`;

const ansi = {
    clearScreen: `${CSI}2J`,
    cursorHome: `${CSI}H`,
    hideCursor: `${CSI}?25l`,
    cursorTo: (row: number, col: number) => `${CSI}${row};${col}H`,
    fg: {
        green: `${CSI}32m`,
        cyan: `${CSI}36m`,
        yellow: `${CSI}93m`,
        white: `${CSI}97m`,
        red: `${CSI}91m`,
        gray: `${CSI}90m`,
    },
    bg: {
        blue: `${CSI}44m`,
    },
    bold: `${CSI}1m`,
    dim: `${CSI}2m`,
    inverse: `${CSI}7m`,
    reset: `${CSI}0m`,
};

const BOX = {
    topLeft: '\u250C',
    topRight: '\u2510',
    bottomLeft: '\u2514',
    bottomRight: '\u2518',
    horizontal: '\u2500',
    vertical: '\u2502',
};

// ── Types ────────────────────────────────────────────────────────────

interface UnifiedRow {
    pid: number;
    name: string;
    type: string;
    status: string;
    time: string;
    mode: string;
    source: 'process' | 'service';
    /** Original service entry (for actions) */
    serviceInfo?: ICliBackgroundServiceInfo;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / (1000 * 60)) % 60;
    const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

function statusColor(status: string): string {
    switch (status) {
        case 'running':
            return ansi.fg.green;
        case 'completed':
        case 'done':
            return ansi.fg.cyan;
        case 'pending':
            return ansi.fg.yellow;
        case 'stopped':
            return ansi.fg.white;
        case 'failed':
        case 'killed':
            return ansi.fg.red;
        default:
            return ansi.fg.white;
    }
}

function truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 1) + '\u2026';
}

function pad(str: string, len: number): string {
    return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

// ── Processor ────────────────────────────────────────────────────────

export class CliHtopCommandProcessor implements ICliCommandProcessor {
    command = 'htop';
    description = 'Interactive process and service monitor';
    author = DefaultLibraryAuthor;
    metadata?: CliProcessorMetadata = {
        icon: '\uD83D\uDCCA',
        sealed: true,
        module: 'system',
    };

    private context: ICliExecutionContext | null = null;
    private registry: ICliProcessRegistry | null = null;
    private refreshTimer: ICliManagedInterval | null = null;
    private rows: UnifiedRow[] = [];
    private selectedIndex = 0;
    private scrollOffset = 0;
    private termCols = 80;
    private termRows = 24;
    private showingLogs = false;
    private errorMessage: string | null = null;
    private errorTimeout: ICliManagedInterval | null = null;

    async processCommand(
        _command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        try {
            this.registry = context.services.get<ICliProcessRegistry>(
                CliProcessRegistry_TOKEN,
            );
        } catch {
            context.writer.writeError('Process registry not available');
            return;
        }

        this.context = context;
        this.termCols = context.terminal.cols || 80;
        this.termRows = context.terminal.rows || 24;
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.showingLogs = false;
        this.errorMessage = null;

        context.enterFullScreenMode(this);
        this.refreshData();
        this.render();

        this.refreshTimer = context.createInterval(() => {
            if (!this.showingLogs) {
                this.refreshData();
                this.render();
            }
        }, 1000);
    }

    async onData(data: string, context: ICliExecutionContext): Promise<void> {
        if (this.showingLogs) {
            // Any key dismisses logs overlay
            this.showingLogs = false;
            this.render();
            return;
        }

        switch (data) {
            case `${ESC}[A`: // Arrow Up
                this.moveSelection(-1);
                this.render();
                break;

            case `${ESC}[B`: // Arrow Down
                this.moveSelection(1);
                this.render();
                break;

            case 'q':
            case ESC:
                this.exit(context);
                break;

            case 'k':
                this.actionKill();
                break;

            case 's':
                await this.actionStart();
                break;

            case 't':
                await this.actionStop();
                break;

            case 'r':
                await this.actionRestart();
                break;

            case 'l':
                this.actionLogs();
                break;
        }
    }

    onResize(cols: number, rows: number, _context: ICliExecutionContext): void {
        this.termCols = cols;
        this.termRows = rows;
        this.clampScroll();
        this.render();
    }

    onDispose(_context: ICliExecutionContext): void {
        this.refreshTimer = null;
        this.context = null;
        this.registry = null;
        this.rows = [];
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Interactive process and service monitor');
        writer.writeln();
        writer.writeln('Usage:');
        writer.writeln(`  ${writer.wrapInColor('htop', 36 as any)}`);
    }

    // ── Data ─────────────────────────────────────────────────────────

    private refreshData(): void {
        if (!this.registry || !this.context) return;

        const processEntries = this.registry.list();
        const serviceEntries = this.context.backgroundServices.list();

        // Build a set of PIDs from services for dedup
        const servicePids = new Set<number>();
        for (const svc of serviceEntries) {
            if (svc.pid !== undefined) {
                servicePids.add(svc.pid);
            }
        }

        const unified: UnifiedRow[] = [];

        // Add process entries that don't have a matching service
        for (const p of processEntries) {
            if (servicePids.has(p.pid)) continue;
            unified.push({
                pid: p.pid,
                name: p.name,
                type: p.type,
                status: p.status,
                time: formatElapsed(Date.now() - p.startTime),
                mode: 'main',
                source: 'process',
            });
        }

        // Add all service entries
        for (const svc of serviceEntries) {
            let time = '-';
            if (svc.status === 'running' && svc.startedAt) {
                time = formatElapsed(Date.now() - new Date(svc.startedAt).getTime());
            }
            unified.push({
                pid: svc.pid ?? 0,
                name: svc.name,
                type: svc.type,
                status: svc.status,
                time,
                mode: svc.executionMode === 'worker' ? 'worker' : 'main',
                source: 'service',
                serviceInfo: svc,
            });
        }

        // Sort: running first, then by PID descending
        unified.sort((a, b) => {
            const aRunning = a.status === 'running' ? 0 : 1;
            const bRunning = b.status === 'running' ? 0 : 1;
            if (aRunning !== bRunning) return aRunning - bRunning;
            return b.pid - a.pid;
        });

        this.rows = unified;

        // Clamp selection
        if (this.rows.length === 0) {
            this.selectedIndex = 0;
        } else {
            this.selectedIndex = Math.min(this.selectedIndex, this.rows.length - 1);
        }
        this.clampScroll();
    }

    // ── Actions ──────────────────────────────────────────────────────

    private actionKill(): void {
        const row = this.rows[this.selectedIndex];
        if (!row || row.status !== 'running') return;

        // Killing self = exit
        if (row.name === 'htop' && row.source === 'process') {
            if (this.context) this.exit(this.context);
            return;
        }

        try {
            if (this.registry) {
                this.registry.kill(row.pid);
            }
        } catch (e: any) {
            this.showError(e?.message || 'Kill failed');
        }

        this.refreshData();
        this.render();
    }

    private async actionStart(): Promise<void> {
        const row = this.rows[this.selectedIndex];
        if (!row || row.source !== 'service') return;
        if (row.status !== 'stopped' && row.status !== 'pending' && row.status !== 'failed') return;

        try {
            await this.context!.backgroundServices.start(row.name);
        } catch (e: any) {
            this.showError(e?.message || 'Start failed');
        }

        this.refreshData();
        this.render();
    }

    private async actionStop(): Promise<void> {
        const row = this.rows[this.selectedIndex];
        if (!row || row.source !== 'service' || row.status !== 'running') return;

        try {
            await this.context!.backgroundServices.stop(row.name);
        } catch (e: any) {
            this.showError(e?.message || 'Stop failed');
        }

        this.refreshData();
        this.render();
    }

    private async actionRestart(): Promise<void> {
        const row = this.rows[this.selectedIndex];
        if (!row || row.source !== 'service') return;

        try {
            await this.context!.backgroundServices.restart(row.name);
        } catch (e: any) {
            this.showError(e?.message || 'Restart failed');
        }

        this.refreshData();
        this.render();
    }

    private actionLogs(): void {
        const row = this.rows[this.selectedIndex];
        if (!row || row.source !== 'service' || !this.context) return;

        this.showingLogs = true;
        this.renderLogsOverlay(row.name);
    }

    // ── Navigation ───────────────────────────────────────────────────

    private moveSelection(delta: number): void {
        if (this.rows.length === 0) return;
        this.selectedIndex += delta;
        if (this.selectedIndex < 0) {
            this.selectedIndex = this.rows.length - 1;
        } else if (this.selectedIndex >= this.rows.length) {
            this.selectedIndex = 0;
        }
        this.clampScroll();
    }

    private get visibleRows(): number {
        return Math.max(1, this.termRows - 4);
    }

    private clampScroll(): void {
        if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
        } else if (this.selectedIndex >= this.scrollOffset + this.visibleRows) {
            this.scrollOffset = this.selectedIndex - this.visibleRows + 1;
        }
        this.scrollOffset = Math.max(0, this.scrollOffset);
    }

    // ── Rendering ────────────────────────────────────────────────────

    private render(): void {
        if (!this.context) return;

        const buf: string[] = [];
        const cols = this.termCols;

        buf.push(ansi.clearScreen, ansi.cursorHome, ansi.hideCursor);

        // ── Header ───────────────────────────────────────────────
        const runningCount = this.rows.filter((r) => r.status === 'running').length;
        const totalCount = this.rows.length;

        let headerLeft: string;
        if (this.errorMessage) {
            headerLeft = `${ansi.bold}${ansi.fg.red} htop ${ansi.reset}${ansi.fg.red}${ansi.dim} ${this.errorMessage}${ansi.reset}`;
        } else {
            headerLeft = `${ansi.bold}${ansi.fg.cyan} htop${ansi.reset}${ansi.fg.gray} \u2014 ${runningCount} running / ${totalCount} total${ansi.reset}`;
        }
        const headerRight = `${ansi.fg.gray}Refresh: 1s${ansi.reset}`;

        buf.push(ansi.cursorTo(1, 1));
        buf.push(headerLeft);
        // Right-align refresh indicator
        buf.push(ansi.cursorTo(1, Math.max(1, cols - 11)));
        buf.push(headerRight);

        // ── Separator ────────────────────────────────────────────
        buf.push(ansi.cursorTo(2, 1));
        buf.push(ansi.fg.gray, BOX.horizontal.repeat(cols), ansi.reset);

        // ── Column headers ───────────────────────────────────────
        const colPid = 6;
        const colType = 9;
        const colStatus = 11;
        const colMode = 8;
        const colTime = 9;
        const colName = Math.max(10, cols - colPid - colType - colStatus - colMode - colTime - 2);

        buf.push(ansi.cursorTo(3, 1));
        buf.push(
            ansi.bold,
            ansi.fg.white,
            ' ',
            pad('PID', colPid),
            pad('NAME', colName),
            pad('TYPE', colType),
            pad('STATUS', colStatus),
            pad('MODE', colMode),
            pad('TIME', colTime),
            ansi.reset,
        );

        // ── Rows ─────────────────────────────────────────────────
        if (this.rows.length === 0) {
            const emptyMsg = 'No processes';
            const emptyRow = Math.floor(this.visibleRows / 2) + 4;
            const emptyCol = Math.max(1, Math.floor((cols - emptyMsg.length) / 2));
            buf.push(ansi.cursorTo(emptyRow, emptyCol));
            buf.push(ansi.fg.gray, emptyMsg, ansi.reset);
        } else {
            const endIdx = Math.min(
                this.scrollOffset + this.visibleRows,
                this.rows.length,
            );

            for (let i = this.scrollOffset; i < endIdx; i++) {
                const row = this.rows[i];
                const screenRow = 4 + (i - this.scrollOffset);
                const isSelected = i === this.selectedIndex;
                const prefix = isSelected ? '>' : ' ';

                const pidStr = pad(String(row.pid), colPid);
                const nameStr = pad(truncate(row.name, colName - 1), colName);
                const typeStr = pad(row.type, colType);
                const statusStr = pad(row.status, colStatus);
                const modeStr = pad(row.mode, colMode);
                const timeStr = pad(row.time, colTime);

                buf.push(ansi.cursorTo(screenRow, 1));

                if (isSelected) {
                    buf.push(ansi.inverse);
                }

                buf.push(
                    prefix,
                    pidStr,
                    nameStr,
                    typeStr,
                    isSelected ? '' : statusColor(row.status),
                    statusStr,
                    isSelected ? '' : ansi.reset,
                    modeStr,
                    timeStr,
                );

                // Pad to fill the row (avoid partial inverse)
                const contentLen = 1 + colPid + colName + colType + colStatus + colMode + colTime;
                if (contentLen < cols) {
                    buf.push(' '.repeat(cols - contentLen));
                }

                if (isSelected) {
                    buf.push(ansi.reset);
                }
            }

            // Scroll indicators
            if (this.scrollOffset > 0) {
                buf.push(ansi.cursorTo(4, cols));
                buf.push(ansi.fg.gray, '\u2191', ansi.reset);
            }
            if (endIdx < this.rows.length) {
                buf.push(ansi.cursorTo(3 + this.visibleRows, cols));
                buf.push(ansi.fg.gray, '\u2193', ansi.reset);
            }
        }

        // ── Footer separator ─────────────────────────────────────
        const footerSepRow = this.termRows - 1;
        buf.push(ansi.cursorTo(footerSepRow, 1));
        buf.push(ansi.fg.gray, BOX.horizontal.repeat(cols), ansi.reset);

        // ── Footer keybindings ───────────────────────────────────
        buf.push(ansi.cursorTo(this.termRows, 1));
        buf.push(ansi.dim, ' ', this.buildFooter(), ansi.reset);

        this.context.terminal.write(buf.join(''));
    }

    private buildFooter(): string {
        const selected = this.rows[this.selectedIndex];
        const parts: string[] = [];

        if (selected) {
            if (selected.status === 'running') {
                parts.push('k:Kill');
            }
            if (
                selected.source === 'service' &&
                (selected.status === 'stopped' ||
                    selected.status === 'pending' ||
                    selected.status === 'failed')
            ) {
                parts.push('s:Start');
            }
            if (selected.source === 'service' && selected.status === 'running') {
                parts.push('t:Stop');
            }
            if (selected.source === 'service') {
                parts.push('r:Restart');
                parts.push('l:Logs');
            }
        }

        parts.push('q:Quit');
        parts.push('\u2191\u2193:Navigate');

        return parts.join('  ');
    }

    // ── Logs overlay ─────────────────────────────────────────────

    private renderLogsOverlay(serviceName: string): void {
        if (!this.context) return;

        const logs = this.context.backgroundServices.getLogs(serviceName, 15);
        const buf: string[] = [];

        const boxWidth = Math.min(this.termCols - 4, 70);
        const boxHeight = Math.min(this.termRows - 4, logs.length + 4);
        const startCol = Math.max(1, Math.floor((this.termCols - boxWidth) / 2));
        const startRow = Math.max(1, Math.floor((this.termRows - boxHeight) / 2));
        const innerWidth = boxWidth - 2;

        // Top border
        const title = ` Logs: ${truncate(serviceName, innerWidth - 10)} `;
        const topBorder =
            BOX.topLeft +
            BOX.horizontal +
            title +
            BOX.horizontal.repeat(Math.max(0, boxWidth - title.length - 3)) +
            BOX.topRight;

        buf.push(ansi.cursorTo(startRow, startCol));
        buf.push(ansi.fg.cyan, topBorder, ansi.reset);

        // Log lines
        const contentRows = boxHeight - 3; // top border + bottom border + "press any key" line
        if (logs.length === 0) {
            const noLogs = 'No log entries';
            buf.push(ansi.cursorTo(startRow + 1, startCol));
            buf.push(
                ansi.fg.cyan,
                BOX.vertical,
                ansi.reset,
                ' ',
                ansi.fg.gray,
                pad(noLogs, innerWidth - 1),
                ansi.reset,
                ansi.fg.cyan,
                BOX.vertical,
                ansi.reset,
            );

            for (let r = 2; r <= contentRows; r++) {
                buf.push(ansi.cursorTo(startRow + r, startCol));
                buf.push(
                    ansi.fg.cyan,
                    BOX.vertical,
                    ansi.reset,
                    ' '.repeat(innerWidth),
                    ansi.fg.cyan,
                    BOX.vertical,
                    ansi.reset,
                );
            }
        } else {
            const displayLogs = logs.slice(-contentRows);
            let lineIdx = 0;
            for (const entry of displayLogs) {
                const ts = new Date(entry.timestamp).toLocaleTimeString();
                const levelTag =
                    entry.level === 'error'
                        ? `${ansi.fg.red}ERR${ansi.reset}`
                        : entry.level === 'warn'
                            ? `${ansi.fg.yellow}WRN${ansi.reset}`
                            : `${ansi.fg.cyan}INF${ansi.reset}`;
                const line = `[${ts}] ${levelTag} ${truncate(entry.message, innerWidth - 18)}`;

                buf.push(ansi.cursorTo(startRow + 1 + lineIdx, startCol));
                buf.push(
                    ansi.fg.cyan,
                    BOX.vertical,
                    ansi.reset,
                    ' ',
                    line,
                );
                // Pad to inner width (approximate — ANSI codes are zero-width)
                buf.push(ansi.cursorTo(startRow + 1 + lineIdx, startCol + boxWidth - 1));
                buf.push(ansi.fg.cyan, BOX.vertical, ansi.reset);
                lineIdx++;
            }

            // Fill remaining empty rows
            for (let r = lineIdx; r < contentRows; r++) {
                buf.push(ansi.cursorTo(startRow + 1 + r, startCol));
                buf.push(
                    ansi.fg.cyan,
                    BOX.vertical,
                    ansi.reset,
                    ' '.repeat(innerWidth),
                    ansi.fg.cyan,
                    BOX.vertical,
                    ansi.reset,
                );
            }
        }

        // "Press any key" line
        const pressMsg = 'Press any key to close';
        const pressPad = Math.max(0, Math.floor((innerWidth - pressMsg.length) / 2));
        buf.push(ansi.cursorTo(startRow + contentRows + 1, startCol));
        buf.push(
            ansi.fg.cyan,
            BOX.vertical,
            ansi.reset,
            ' '.repeat(pressPad),
            ansi.fg.gray,
            pressMsg,
            ansi.reset,
            ' '.repeat(Math.max(0, innerWidth - pressPad - pressMsg.length)),
            ansi.fg.cyan,
            BOX.vertical,
            ansi.reset,
        );

        // Bottom border
        buf.push(ansi.cursorTo(startRow + contentRows + 2, startCol));
        buf.push(
            ansi.fg.cyan,
            BOX.bottomLeft,
            BOX.horizontal.repeat(boxWidth - 2),
            BOX.bottomRight,
            ansi.reset,
        );

        this.context.terminal.write(buf.join(''));
    }

    // ── Utilities ────────────────────────────────────────────────

    private showError(msg: string): void {
        this.errorMessage = msg;
        // Clear error after 3 seconds
        if (this.errorTimeout) {
            this.errorTimeout.clear();
        }
        if (this.context) {
            this.errorTimeout = this.context.createInterval(() => {
                this.errorMessage = null;
                this.errorTimeout?.clear();
                this.errorTimeout = null;
            }, 3000);
        }
    }

    private exit(context: ICliExecutionContext): void {
        context.exitFullScreenMode();
        this.context = null;
    }
}
