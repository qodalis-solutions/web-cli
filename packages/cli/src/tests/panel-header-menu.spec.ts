import {
    COMPACT_HEADER_BREAKPOINT,
    CliPanelController,
    CliPanelSnapshot,
    MORE_ICON,
    headerMenuAnchorStyle,
    headerMenuItems,
    headerMenuStyle,
    isCompactHeaderWidth,
    panelWrapperClass,
    runHeaderMenuAction,
} from '../lib/panel';

function createController(config = {}) {
    return new CliPanelController({
        config,
        persistPosition: false,
        persistTheme: false,
        viewport: () => ({ width: 412, height: 915 }),
    });
}

describe('Panel compact header (⋮ menu)', () => {
    describe('breakpoint', () => {
        it('is compact below 480px of panel width', () => {
            expect(COMPACT_HEADER_BREAKPOINT).toBe(480);
            expect(isCompactHeaderWidth(412)).toBeTrue();
            expect(isCompactHeaderWidth(479)).toBeTrue();
            expect(isCompactHeaderWidth(480)).toBeFalse();
            expect(isCompactHeaderWidth(1280)).toBeFalse();
        });

        it('ignores a panel that is not laid out', () => {
            expect(isCompactHeaderWidth(0)).toBeFalse();
        });

        it('switches the header as the panel width changes', () => {
            const c = createController();
            expect(c.getSnapshot().compactHeader).toBeFalse();
            c.updatePanelWidth(412);
            expect(c.getSnapshot().compactHeader).toBeTrue();
            expect(panelWrapperClass(c.getSnapshot())).toContain('compact-header');
            // display: none (hidden panel) keeps the header as it was
            c.updatePanelWidth(0);
            expect(c.getSnapshot().compactHeader).toBeTrue();
            c.updatePanelWidth(900);
            expect(c.getSnapshot().compactHeader).toBeFalse();
            expect(panelWrapperClass(c.getSnapshot())).not.toContain('compact-header');
            c.destroy();
        });

        it('widening the panel closes an open menu', () => {
            const c = createController();
            c.updatePanelWidth(400);
            c.toggleHeaderMenu();
            expect(c.getSnapshot().headerMenuOpen).toBeTrue();
            c.updatePanelWidth(800);
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
            c.destroy();
        });

        it('measures the panel element, not the viewport', (done) => {
            const el = document.createElement('div');
            el.style.width = '300px';
            el.style.height = '10px';
            document.body.appendChild(el);
            const c = createController();
            const unsubscribe = c.subscribe(() => {
                if (!c.getSnapshot().compactHeader) return;
                unsubscribe();
                const wide = c.subscribe(() => {
                    if (c.getSnapshot().compactHeader) return;
                    wide();
                    c.observePanelWidth(null);
                    c.destroy();
                    el.remove();
                    done();
                });
                // Resize outside the observer's callback, as a real layout change would
                setTimeout(() => (el.style.width = '700px'), 0);
            });
            c.observePanelWidth(el);
        });
    });

    describe('menu items', () => {
        let base: CliPanelSnapshot;
        beforeAll(() => {
            const c = createController();
            base = c.getSnapshot();
            c.destroy();
        });
        const s = (patch: Partial<CliPanelSnapshot> = {}): CliPanelSnapshot => ({ ...base, ...patch });

        it('lists maximize, the four positions, the theme picker, hide and close', () => {
            const items = headerMenuItems(s({ collapsed: false, position: 'bottom' }));
            expect(items.map((i) => i.key)).toEqual([
                'maximize',
                'position-bottom',
                'position-top',
                'position-left',
                'position-right',
                'theme-auto',
                'theme-light',
                'theme-dark',
                'theme-custom',
                'theme-list',
                'send-key',
                'hide',
                'close',
            ]);
            expect(items[0].label).toBe('Maximize');
            expect(items[0].disabled).toBeFalse();
            expect(items.every((i) => !!i.icon && i.label.length > 0)).toBeTrue();
        });

        it('says Restore when maximized and disables it while collapsed', () => {
            expect(headerMenuItems(s({ collapsed: false, maximized: true }))[0].label).toBe('Restore');
            expect(headerMenuItems(s({ collapsed: true }))[0].disabled).toBeTrue();
        });

        it('marks the current position as a checked radio item under a heading', () => {
            const positions = headerMenuItems(s({ position: 'left' })).filter((i) => i.action === 'position');
            expect(positions.every((i) => i.role === 'menuitemradio')).toBeTrue();
            expect(positions.filter((i) => i.checked).map((i) => i.position)).toEqual(['left']);
            expect(positions[0].heading).toBe('Position');
            expect(positions[0].separatorBefore).toBeTrue();
        });

        it('leaves out hide and close when the panel is not hideable or closable', () => {
            const keys = headerMenuItems(s({ hideable: false, closable: false })).map((i) => i.key);
            expect(keys).not.toContain('hide');
            expect(keys).not.toContain('close');
            const close = headerMenuItems(s({ hideable: false })).find((i) => i.key === 'close')!;
            expect(close.destructive).toBeTrue();
            expect(close.separatorBefore).toBeTrue();
        });

        it('carries the theme variables (it renders outside the panel)', () => {
            const style = headerMenuStyle(s({ themeStyles: { '--cli-panel-bg': '#fff' }, headerMenuStyle: { position: 'fixed' } }));
            expect(style).toEqual({ '--cli-panel-bg': '#fff', position: 'fixed' });
        });

        it('has a ⋮ icon', () => {
            expect(MORE_ICON.shapes.length).toBe(3);
        });
    });

    describe('opening and running items', () => {
        let c: CliPanelController;
        beforeEach(() => {
            c = createController();
            c.updatePanelWidth(412);
            c.toggle();
        });
        afterEach(() => c.destroy());

        it('toggles, and closes on an outside click', () => {
            c.toggleHeaderMenu();
            expect(c.getSnapshot().headerMenuOpen).toBeTrue();
            c.toggleHeaderMenu();
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
            c.toggleHeaderMenu();
            document.dispatchEvent(new MouseEvent('click'));
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
        });

        it('closes on Escape and returns focus to the ⋮ button', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);
            c.toggleHeaderMenu(button);
            button.blur();
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
            expect(document.activeElement).toBe(button);
            button.remove();
        });

        it('closes the other menus, and they close it', () => {
            c.toggleServicesDropdown();
            c.toggleHeaderMenu();
            expect(c.getSnapshot().servicesDropdownOpen).toBeFalse();
            c.togglePositionDropdown();
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
        });

        it('is placed at the ⋮ button, toward the page', () => {
            const anchor = document.createElement('button');
            spyOn(anchor, 'getBoundingClientRect').and.returnValue({ top: 500, bottom: 544, left: 320, right: 364 } as DOMRect);
            c.toggleHeaderMenu(anchor);
            expect(c.getSnapshot().headerMenuStyle).toEqual(
                jasmine.objectContaining({ position: 'fixed', bottom: '419px', right: '48px' }),
            );
        });

        it('runs an item and closes', () => {
            c.toggleHeaderMenu();
            const items = headerMenuItems(c.getSnapshot());
            runHeaderMenuAction(c, items.find((i) => i.key === 'maximize')!);
            expect(c.getSnapshot().maximized).toBeTrue();
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();

            c.toggleHeaderMenu();
            runHeaderMenuAction(c, items.find((i) => i.key === 'position-top')!);
            expect(c.getSnapshot().position).toBe('top');
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();

            c.toggleHeaderMenu();
            runHeaderMenuAction(c, items.find((i) => i.key === 'hide')!);
            expect(c.getSnapshot().hidden).toBeTrue();
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();

            c.unhide();
            c.toggleHeaderMenu();
            runHeaderMenuAction(c, items.find((i) => i.key === 'close')!);
            expect(c.getSnapshot().visible).toBeFalse();
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
        });

        it('moves focus between items with the arrow keys', () => {
            const menu = document.createElement('div');
            menu.className = 'cli-panel-header-menu';
            const a = document.createElement('button');
            const b = document.createElement('button');
            const disabled = document.createElement('button');
            [a, disabled, b].forEach((el) => el.setAttribute('role', 'menuitem'));
            disabled.disabled = true;
            menu.append(a, disabled, b);
            document.body.appendChild(menu);

            c.toggleHeaderMenu();
            a.focus();
            const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
            key('ArrowDown');
            expect(document.activeElement).toBe(b);
            key('ArrowDown');
            expect(document.activeElement).toBe(a);
            key('ArrowUp');
            expect(document.activeElement).toBe(b);
            key('Home');
            expect(document.activeElement).toBe(a);
            key('End');
            expect(document.activeElement).toBe(b);
            expect(c.getSnapshot().headerMenuOpen).toBeTrue();
            menu.remove();
        });
    });

    describe('anchor style', () => {
        const vp = { width: 412, height: 915 };
        const rect = { top: 100, bottom: 144, left: 4, right: 48 };

        it('opens upward from a bottom panel and downward from a top one, right-aligned', () => {
            expect(headerMenuAnchorStyle({ top: 500, bottom: 544, left: 320, right: 364 }, 'bottom', vp)).toEqual(
                jasmine.objectContaining({ bottom: '419px', right: '48px' }),
            );
            expect(headerMenuAnchorStyle({ top: 0, bottom: 44, left: 320, right: 364 }, 'top', vp)).toEqual(
                jasmine.objectContaining({ top: '48px', right: '48px' }),
            );
        });

        it('opens away from the page when the page side is too short, and caps its height', () => {
            // bottom panel expanded to near the top of the screen: the button is at y=200
            expect(headerMenuAnchorStyle({ top: 200, bottom: 244, left: 320, right: 364 }, 'bottom', vp)).toEqual(
                jasmine.objectContaining({ top: '248px', right: '48px', maxHeight: '659px' }),
            );
            // top panel reaching down the screen: the button is at y=600
            expect(headerMenuAnchorStyle({ top: 600, bottom: 644, left: 320, right: 364 }, 'top', vp)).toEqual(
                jasmine.objectContaining({ bottom: '319px', maxHeight: '588px' }),
            );
        });

        it('opens over the panel when a side panel leaves no room on the page side', () => {
            // right-docked, full width: the header is at the left edge
            expect(headerMenuAnchorStyle(rect, 'right', vp)).toEqual(jasmine.objectContaining({ left: '52px', bottom: '771px' }));
            // left-docked, full width: the header is at the right edge
            const atRight = { top: 100, bottom: 144, left: 364, right: 408 };
            expect(headerMenuAnchorStyle(atRight, 'left', vp)).toEqual(jasmine.objectContaining({ right: '52px' }));
            // a narrow left panel opens onto the page
            expect(headerMenuAnchorStyle(rect, 'left', { width: 1280, height: 800 })).toEqual(jasmine.objectContaining({ left: '52px' }));
        });
    });
});
