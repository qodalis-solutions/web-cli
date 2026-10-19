import { CliPanelPosition } from '@qodalis/cli-core';
import { CliPanelPane, CliPanelViewport } from './panel-types';

export const MIN_PANE_WIDTH_PERCENT = 10;
export const MIN_PANEL_SIZE = 100;
export const DEFAULT_PANEL_HEIGHT = 600;
export const DEFAULT_PANEL_WIDTH = 400;
export const PANEL_POSITIONS: readonly CliPanelPosition[] = ['bottom', 'top', 'left', 'right'];

/** Scale pane widths so they add up to 100. Returns new pane objects. */
export function normalizePaneWidths(panes: readonly CliPanelPane[]): CliPanelPane[] {
    const total = panes.reduce((s, p) => s + p.widthPercent, 0);
    if (total === 0) return panes.map((p) => ({ ...p }));
    const scale = 100 / total;
    return panes.map((p) => ({ ...p, widthPercent: p.widthPercent * scale }));
}

/** Give every pane the same width. Returns new pane objects. */
export function distributePaneWidths(panes: readonly CliPanelPane[]): CliPanelPane[] {
    if (panes.length === 0) return [];
    const even = 100 / panes.length;
    return panes.map((p) => ({ ...p, widthPercent: even }));
}

/**
 * Move the divider between pane `dividerIndex` and `dividerIndex + 1` by
 * `deltaPercent`, keeping both panes at least `MIN_PANE_WIDTH_PERCENT` wide.
 */
export function resizePaneWidths(
    startWidths: readonly number[],
    dividerIndex: number,
    deltaPercent: number,
): number[] {
    const widths = [...startWidths];
    const i = dividerIndex;
    if (i < 0 || i + 1 >= widths.length) return widths;
    const pair = startWidths[i] + startWidths[i + 1];

    let left = startWidths[i] + deltaPercent;
    let right = startWidths[i + 1] - deltaPercent;
    if (left < MIN_PANE_WIDTH_PERCENT) {
        left = MIN_PANE_WIDTH_PERCENT;
        right = pair - MIN_PANE_WIDTH_PERCENT;
    }
    if (right < MIN_PANE_WIDTH_PERCENT) {
        right = MIN_PANE_WIDTH_PERCENT;
        left = pair - MIN_PANE_WIDTH_PERCENT;
    }
    widths[i] = left;
    widths[i + 1] = right;
    return widths;
}

/** Clamp a dragged panel size between the minimum and the viewport. */
export function clampPanelSize(size: number, max: number): number {
    return Math.min(Math.max(MIN_PANEL_SIZE, size), max);
}

/**
 * New panel size for a drag that started at `start` and moved by
 * (`deltaX`, `deltaY`). Only the axis matching the position matters.
 */
export function resizedPanelSize(
    position: CliPanelPosition,
    start: { width: number; height: number },
    deltaX: number,
    deltaY: number,
    viewport: CliPanelViewport,
): { width?: number; height?: number } {
    switch (position) {
        case 'left':
            return { width: clampPanelSize(start.width + deltaX, viewport.width) };
        case 'right':
            return { width: clampPanelSize(start.width - deltaX, viewport.width) };
        case 'top':
            return { height: clampPanelSize(start.height + deltaY, viewport.height) };
        default:
            return { height: clampPanelSize(start.height - deltaY, viewport.height) };
    }
}

export interface AnchorRect {
    top: number;
    bottom: number;
    left: number;
    right: number;
}

/**
 * Fixed-position style for a dropdown opened from `anchor`, placed on the
 * side of the panel that faces the page.
 */
export function dropdownAnchorStyle(
    anchor: AnchorRect,
    position: CliPanelPosition,
    viewport: CliPanelViewport,
): Record<string, string> {
    const base = { position: 'fixed', zIndex: '1100' };
    switch (position) {
        case 'top':
            return { ...base, top: `${anchor.bottom + 4}px`, left: `${anchor.left}px` };
        case 'left':
            return { ...base, top: `${anchor.top}px`, left: `${anchor.right + 4}px` };
        case 'right':
            return { ...base, top: `${anchor.top}px`, right: `${viewport.width - anchor.left + 4}px` };
        default:
            return { ...base, bottom: `${viewport.height - anchor.top + 4}px`, left: `${anchor.left}px` };
    }
}

/** "12m", "1h05m"-style uptime label. */
export function formatUptime(ms: number): string {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h${mins % 60}m`;
}

export function isHorizontalPosition(position: CliPanelPosition): boolean {
    return position === 'left' || position === 'right';
}
