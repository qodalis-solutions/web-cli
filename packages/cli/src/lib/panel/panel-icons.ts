import { CliPanelPosition } from '@qodalis/cli-core';

/**
 * Geometry of the panel's SVG icons, shared by every framework wrapper.
 * All icons use a 24x24 view box, `stroke="currentColor"`, round caps and
 * joins, and no fill unless a shape says otherwise.
 */

export interface SvgShape {
    tag: 'polyline' | 'line' | 'rect';
    attrs: Record<string, string>;
}

export interface SvgIcon {
    size: number;
    strokeWidth: number;
    shapes: SvgShape[];
}

export const SVG_VIEW_BOX = '0 0 24 24';

export const SVG_COMMON_ATTRS: Record<string, string> = {
    viewBox: SVG_VIEW_BOX,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
};

const polyline = (points: string): SvgShape => ({ tag: 'polyline', attrs: { points } });
const line = (x1: string, y1: string, x2: string, y2: string): SvgShape => ({ tag: 'line', attrs: { x1, y1, x2, y2 } });
const rect = (attrs: Record<string, string>): SvgShape => ({ tag: 'rect', attrs });

const TERMINAL_SHAPES: SvgShape[] = [polyline('4 17 10 11 4 5'), line('12', '19', '20', '19')];

export const TERMINAL_ICON: SvgIcon = { size: 22, strokeWidth: 2, shapes: TERMINAL_SHAPES };
export const HIDE_TAB_TERMINAL_ICON: SvgIcon = { size: 16, strokeWidth: 2, shapes: TERMINAL_SHAPES };

export const MAXIMIZE_ICON: SvgIcon = {
    size: 20,
    strokeWidth: 1.8,
    shapes: [polyline('15 3 21 3 21 9'), polyline('9 21 3 21 3 15'), line('21', '3', '14', '10'), line('3', '21', '10', '14')],
};

export const RESTORE_ICON: SvgIcon = {
    size: 20,
    strokeWidth: 1.8,
    shapes: [polyline('4 14 10 14 10 20'), polyline('20 10 14 10 14 4'), line('14', '10', '21', '3'), line('3', '21', '10', '14')],
};

export const CLOSE_ICON: SvgIcon = {
    size: 20,
    strokeWidth: 1.8,
    shapes: [line('18', '6', '6', '18'), line('6', '6', '18', '18')],
};

export const HIDE_ICON: SvgIcon = {
    size: 20,
    strokeWidth: 1.8,
    shapes: [line('5', '18', '19', '18'), polyline('9 14 12 17 15 14')],
};

const CHEVRON_UP = '18 15 12 9 6 15';
const CHEVRON_DOWN = '6 9 12 15 18 9';
const CHEVRON_LEFT = '15 6 9 12 15 18';
const CHEVRON_RIGHT = '9 18 15 12 9 6';

/** Chevron that points where the panel body will go when the collapse button is pressed. */
export function collapseChevronIcon(position: CliPanelPosition, collapsed: boolean): SvgIcon {
    let points: string;
    switch (position) {
        case 'top':
            points = collapsed ? CHEVRON_DOWN : CHEVRON_UP;
            break;
        case 'left':
            points = collapsed ? CHEVRON_RIGHT : CHEVRON_LEFT;
            break;
        case 'right':
            points = collapsed ? CHEVRON_LEFT : CHEVRON_RIGHT;
            break;
        default:
            points = collapsed ? CHEVRON_UP : CHEVRON_DOWN;
            break;
    }
    return { size: 20, strokeWidth: 1.8, shapes: [polyline(points)] };
}

/** Chevron on the small "show CLI" tab, pointing into the page. */
export function hideTabChevronIcon(position: CliPanelPosition): SvgIcon {
    let points: string;
    switch (position) {
        case 'top':
            points = CHEVRON_DOWN;
            break;
        case 'left':
            points = CHEVRON_RIGHT;
            break;
        case 'right':
            points = CHEVRON_LEFT;
            break;
        default:
            points = CHEVRON_UP;
            break;
    }
    return { size: 14, strokeWidth: 2.5, shapes: [polyline(points)] };
}

/** Square with a filled bar on the side the panel is docked to. */
export function positionIcon(position: CliPanelPosition, size = 20): SvgIcon {
    let bar: Record<string, string>;
    switch (position) {
        case 'top':
            bar = { x: '4', y: '4', width: '16', height: '5' };
            break;
        case 'left':
            bar = { x: '4', y: '4', width: '5', height: '16' };
            break;
        case 'right':
            bar = { x: '15', y: '4', width: '5', height: '16' };
            break;
        default:
            bar = { x: '4', y: '15', width: '16', height: '5' };
            break;
    }
    return {
        size,
        strokeWidth: 1.8,
        shapes: [
            rect({ x: '3', y: '3', width: '18', height: '18', rx: '2' }),
            rect({ ...bar, rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' }),
        ],
    };
}

/** Attributes for the `<svg>` element of an icon. */
export function svgAttrs(icon: SvgIcon): Record<string, string> {
    return {
        ...SVG_COMMON_ATTRS,
        width: String(icon.size),
        height: String(icon.size),
        'stroke-width': String(icon.strokeWidth),
    };
}
