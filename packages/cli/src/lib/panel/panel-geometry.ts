import { CliPanelPosition } from '@qodalis/cli-core';
import { CliPanelPane, CliPanelViewport } from './panel-types';

export const MIN_PANE_WIDTH_PERCENT = 10;
export const MIN_PANEL_SIZE = 100;
export const DEFAULT_PANEL_HEIGHT = 600;
export const DEFAULT_PANEL_WIDTH = 400;
export const PANEL_POSITIONS: readonly CliPanelPosition[] = ['bottom', 'top', 'left', 'right'];

/**
 * Below this panel width (px) the header's action buttons give way to a ⋮
 * menu, with only collapse/expand left beside it. Measured on the panel, not
 * the viewport, so a narrow docked panel behaves like a phone.
 */
export const COMPACT_HEADER_BREAKPOINT = 480;

/** Width the header menu is assumed to need when choosing the side it opens on. */
export const HEADER_MENU_WIDTH = 220;

/** Height the header menu is assumed to need when choosing whether it opens up or down. */
export const HEADER_MENU_HEIGHT = 600;

/** Whether a panel this wide (px) shows the ⋮ menu instead of the action buttons. */
export function isCompactHeaderWidth(width: number): boolean {
    return width > 0 && width < COMPACT_HEADER_BREAKPOINT;
}

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

/**
 * Fixed-position style of the header's ⋮ menu opened from `anchor`. It opens
 * toward the page (above a bottom panel, below a top one), or the other way
 * when that side is too short for it and the other side is taller; its
 * `max-height` keeps it on screen. Horizontally it lines up with the button's
 * outer edge; from a side panel it opens onto the page, or over the panel when
 * the page side has no room (a side panel as wide as a phone).
 */
export function headerMenuAnchorStyle(
    anchor: AnchorRect,
    position: CliPanelPosition,
    viewport: CliPanelViewport,
): Record<string, string> {
    const base = { position: 'fixed', zIndex: '1100' };
    const gap = 4;
    const margin = 8;

    if (position === 'left' || position === 'right') {
        // The button sits low in the vertical header: the menu grows upward from its bottom edge
        const roomRight = viewport.width - anchor.right >= HEADER_MENU_WIDTH + margin;
        const roomLeft = anchor.left >= HEADER_MENU_WIDTH + margin;
        const openRight = position === 'left' ? roomRight || !roomLeft : !roomLeft;
        const vertical = {
            bottom: `${Math.max(viewport.height - anchor.bottom, margin)}px`,
            maxHeight: `${Math.max(anchor.bottom - margin, 0)}px`,
        };
        return openRight
            ? { ...base, ...vertical, left: `${anchor.right + gap}px` }
            : { ...base, ...vertical, right: `${viewport.width - anchor.left + gap}px` };
    }

    const right = `${Math.max(viewport.width - anchor.right, gap)}px`;
    const above = anchor.top - gap - margin;
    const below = viewport.height - anchor.bottom - gap - margin;
    const towardPage = position === 'top' ? below : above;
    const otherSide = position === 'top' ? above : below;
    const openUp = (position === 'top') === (towardPage < HEADER_MENU_HEIGHT && otherSide > towardPage);
    return openUp
        ? { ...base, bottom: `${viewport.height - anchor.top + gap}px`, right, maxHeight: `${Math.max(above, 0)}px` }
        : { ...base, top: `${anchor.bottom + gap}px`, right, maxHeight: `${Math.max(below, 0)}px` };
}

/** Height below which the theme picker opens on the other side of its button, when that side is taller. */
export const THEME_DROPDOWN_MIN_HEIGHT = 240;

/** The theme picker scrolls beyond this height. */
export const THEME_DROPDOWN_MAX_HEIGHT = 420;

/**
 * Side and height of the header's theme picker, opened from `anchor` (its
 * button): toward the page (above a bottom panel, below a top one), or over
 * the panel when the page side is too short (a tall panel) and the other is
 * taller. `max-height` keeps it on screen; the stylesheet does the rest.
 */
export function themeDropdownAnchorStyle(
    anchor: AnchorRect,
    position: CliPanelPosition,
    viewport: CliPanelViewport,
): Record<string, string> {
    const margin = 12;
    const height = (room: number) => `${Math.min(Math.max(room, 0), THEME_DROPDOWN_MAX_HEIGHT)}px`;
    // Side panels: the picker grows upward from the button's bottom edge
    if (position === 'left' || position === 'right') {
        return { maxHeight: height(anchor.bottom - margin) };
    }
    const above = anchor.top - margin;
    const below = viewport.height - anchor.bottom - margin;
    const towardPage = position === 'top' ? below : above;
    const otherSide = position === 'top' ? above : below;
    const openUp = (position === 'top') === (towardPage < THEME_DROPDOWN_MIN_HEIGHT && otherSide > towardPage);
    return openUp
        ? { top: 'auto', bottom: 'calc(100% + 4px)', maxHeight: height(above) }
        : { top: 'calc(100% + 4px)', bottom: 'auto', maxHeight: height(below) };
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
