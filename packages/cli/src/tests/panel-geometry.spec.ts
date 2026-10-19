import {
    clampPanelSize,
    distributePaneWidths,
    dropdownAnchorStyle,
    formatUptime,
    normalizePaneWidths,
    resizePaneWidths,
    resizedPanelSize,
    MIN_PANE_WIDTH_PERCENT,
} from '../lib/panel';

describe('panel geometry', () => {
    it('normalizes pane widths to 100', () => {
        const panes = normalizePaneWidths([
            { id: 1, widthPercent: 30 },
            { id: 2, widthPercent: 30 },
        ]);
        expect(panes.map((p) => p.widthPercent)).toEqual([50, 50]);
    });

    it('keeps zero-width panes untouched instead of dividing by zero', () => {
        const panes = normalizePaneWidths([{ id: 1, widthPercent: 0 }]);
        expect(panes[0].widthPercent).toBe(0);
    });

    it('distributes widths evenly', () => {
        const panes = distributePaneWidths([
            { id: 1, widthPercent: 100 },
            { id: 2, widthPercent: 0 },
            { id: 3, widthPercent: 0 },
        ]);
        expect(panes.map((p) => Math.round(p.widthPercent))).toEqual([33, 33, 33]);
    });

    it('moves a divider and keeps the minimum pane width', () => {
        expect(resizePaneWidths([50, 50], 0, 10)).toEqual([60, 40]);
        expect(resizePaneWidths([50, 50], 0, -80)).toEqual([MIN_PANE_WIDTH_PERCENT, 100 - MIN_PANE_WIDTH_PERCENT]);
        expect(resizePaneWidths([50, 50], 0, 80)).toEqual([100 - MIN_PANE_WIDTH_PERCENT, MIN_PANE_WIDTH_PERCENT]);
    });

    it('ignores an out-of-range divider', () => {
        expect(resizePaneWidths([100], 0, 10)).toEqual([100]);
    });

    it('clamps the panel size between the minimum and the viewport', () => {
        expect(clampPanelSize(10, 900)).toBe(100);
        expect(clampPanelSize(2000, 900)).toBe(900);
        expect(clampPanelSize(500, 900)).toBe(500);
    });

    it('resizes along the axis of the dock position', () => {
        const start = { width: 400, height: 600 };
        const viewport = { width: 1000, height: 800 };
        expect(resizedPanelSize('bottom', start, 0, -50, viewport)).toEqual({ height: 650 });
        expect(resizedPanelSize('top', start, 0, -50, viewport)).toEqual({ height: 550 });
        expect(resizedPanelSize('left', start, 30, 0, viewport)).toEqual({ width: 430 });
        expect(resizedPanelSize('right', start, 30, 0, viewport)).toEqual({ width: 370 });
    });

    it('places dropdowns on the page side of the panel', () => {
        const anchor = { top: 700, bottom: 720, left: 100, right: 160 };
        const viewport = { width: 1000, height: 800 };
        expect(dropdownAnchorStyle(anchor, 'bottom', viewport)).toEqual(
            jasmine.objectContaining({ position: 'fixed', bottom: '104px', left: '100px' }),
        );
        expect(dropdownAnchorStyle(anchor, 'top', viewport)).toEqual(jasmine.objectContaining({ top: '724px', left: '100px' }));
        expect(dropdownAnchorStyle(anchor, 'left', viewport)).toEqual(jasmine.objectContaining({ top: '700px', left: '164px' }));
        expect(dropdownAnchorStyle(anchor, 'right', viewport)).toEqual(jasmine.objectContaining({ top: '700px', right: '904px' }));
    });

    it('formats uptime in minutes and hours', () => {
        expect(formatUptime(0)).toBe('0m');
        expect(formatUptime(5 * 60000)).toBe('5m');
        expect(formatUptime(125 * 60000)).toBe('2h5m');
    });
});
