import {
    CliPanelPalettes,
    CliPanelThemeChange,
    DefaultThemes,
    customPanelTheme,
    loadPanelCustomColors,
    loadPanelTheme,
    savePanelTheme,
} from '@qodalis/cli-core';
import { CliEngine } from '../lib/engine';
import {
    CliPanelController,
    PANEL_TERMINAL_THEMES,
    headerMenuItems,
    runHeaderMenuAction,
    runThemeOption,
    themeDropdownAnchorStyle,
    themeLabel,
    themeOptions,
} from '../lib/panel';
import {
    CLI_TERMINAL_READY_EVENT,
    CLI_TERMINAL_THEME_EVENT,
    CLI_TERMINAL_THEME_RESET_EVENT,
} from '../lib/processors/theme/terminal-theme';

type FakeEngine = CliEngine & { setTheme: jasmine.Spy; clearUserTheme: jasmine.Spy; applyUserTheme: jasmine.Spy };

/** An engine whose terminal keeps a user theme over the host's, as the real one does. */
function fakeEngine(theme: object = DefaultThemes.default, userTheme = false): FakeEngine {
    const options = { theme };
    let base = theme;
    let user = userTheme;
    return {
        getContext: () => ({
            isExecuting: false,
            notifier: {},
            backgroundServices: { list: () => [], on: () => () => undefined },
            services: { get: () => undefined },
        }),
        getTerminal: () => ({ options, element: { isConnected: true } }),
        setTheme: jasmine.createSpy('setTheme').and.callFake((t: object) => {
            base = t;
            if (!user) options.theme = t;
        }),
        clearUserTheme: jasmine.createSpy('clearUserTheme').and.callFake(() => {
            const had = user;
            user = false;
            options.theme = base;
            return had;
        }),
        applyUserTheme: jasmine.createSpy('applyUserTheme').and.callFake((t: string | object) => {
            user = true;
            options.theme = typeof t === 'string' ? (DefaultThemes as Record<string, object>)[t] : t;
            return true;
        }),
        destroy: () => undefined,
        focus: () => undefined,
    } as unknown as FakeEngine;
}

function panel(config: object = {}, options: object = {}) {
    return new CliPanelController({
        config,
        persistPosition: false,
        persistTheme: false,
        viewport: () => ({ width: 1000, height: 800 }),
        ...options,
    });
}

/** A panel root holding one terminal container, as the views render it. */
function panelRoot() {
    const root = document.createElement('div');
    const container = document.createElement('div');
    container.className = 'terminal-container';
    root.appendChild(container);
    return { root, container };
}

describe('panel theme picker', () => {
    afterEach(() => {
        savePanelTheme(null);
        localStorage.removeItem('cli-panel-theme-colors');
    });

    describe('rows', () => {
        it('offers Auto, Light, Dark and the terminal themes behind "More themes"', () => {
            const c = panel({ theme: 'light' });
            expect(themeOptions(c.getSnapshot()).map((o) => o.key)).toEqual([
                'theme-auto',
                'theme-light',
                'theme-dark',
                'theme-custom',
                'theme-list',
            ]);
            expect(themeOptions(c.getSnapshot()).map((o) => o.label)).toEqual(['Auto', 'Light', 'Dark', 'Custom', 'More themes']);

            c.toggleThemeList();
            const rows = themeOptions(c.getSnapshot());
            expect(rows[4].expanded).toBeTrue();
            expect(rows.slice(5).map((o) => o.theme)).toEqual([...PANEL_TERMINAL_THEMES]);
            // Dark and Light stand for the `default` and `light` terminal themes
            expect(PANEL_TERMINAL_THEMES).toContain('dracula');
            expect(PANEL_TERMINAL_THEMES).not.toContain('default');
            expect(PANEL_TERMINAL_THEMES).not.toContain('light');
            // `yellow` is another name of highContrastLight
            expect(PANEL_TERMINAL_THEMES).not.toContain('yellow');
            c.destroy();
        });

        it('labels terminal themes in words', () => {
            expect(themeLabel('solarizedDark')).toBe('Solarized Dark');
            expect(themeLabel('nord')).toBe('Nord');
        });

        it("checks the host's theme, and Dark when the host set none", () => {
            const checked = (c: CliPanelController) =>
                themeOptions(c.getSnapshot())
                    .filter((o) => o.checked)
                    .map((o) => o.theme);
            expect(checked(panel())).toEqual(['dark']);
            expect(checked(panel({ theme: 'auto' }))).toEqual(['auto']);
            expect(checked(panel({ theme: 'light' }))).toEqual(['light']);
            // A custom theme is none of the picker's choices
            expect(checked(panel({ theme: { base: 'light', colors: { accent: '#ff0000' } } }))).toEqual([]);
        });

        it('opens with the list shown when a terminal theme is the choice', () => {
            const c = panel({ theme: 'dracula' });
            c.toggleThemeDropdown();
            expect(c.getSnapshot().themeListOpen).toBeTrue();
            expect(themeOptions(c.getSnapshot()).find((o) => o.checked)!.theme).toBe('dracula');
            c.destroy();
        });
    });

    describe('picking', () => {
        it('restyles the panel and every terminal, and tells the host', () => {
            const changes: CliPanelThemeChange[] = [];
            const c = panel({ theme: 'dark' }, { callbacks: { onThemeChange: (change: CliPanelThemeChange) => changes.push(change) } });
            const a = fakeEngine();
            const b = fakeEngine();
            c.toggle();
            c.registerEngine(1, 1, a);
            const paneId = c.splitPane();
            c.registerEngine(1, paneId, b);

            c.pickTheme('light');
            const s = c.getSnapshot();
            expect(s.scheme).toBe('light');
            expect(s.themeChoice).toBe('light');
            expect(s.themeStyles['--cli-panel-bg']).toBe(CliPanelPalettes.light.background);
            expect(a.setTheme).toHaveBeenCalledWith(DefaultThemes.light);
            expect(b.setTheme).toHaveBeenCalledWith(DefaultThemes.light);
            expect(changes).toEqual([{ theme: 'light', scheme: 'light' }]);

            c.pickTheme('dracula');
            expect(c.getSnapshot().themeChoice).toBe('dracula');
            expect(c.getSnapshot().scheme).toBe('dark');
            expect(a.setTheme).toHaveBeenCalledWith(DefaultThemes.dracula);
            expect(changes[1]).toEqual({ theme: 'dracula', scheme: 'dark' });
            c.destroy();
        });

        it('ignores a theme the picker does not offer', () => {
            const onThemeChange = jasmine.createSpy('onThemeChange');
            const c = panel({ theme: 'dark' }, { callbacks: { onThemeChange } });
            c.pickTheme('no-such-theme');
            expect(c.getSnapshot().themeChoice).toBe('dark');
            expect(onThemeChange).not.toHaveBeenCalled();
            c.destroy();
        });

        it("doesn't report the host's own theme changes", () => {
            const onThemeChange = jasmine.createSpy('onThemeChange');
            const c = panel({ theme: 'dark' }, { callbacks: { onThemeChange } });
            c.setTheme('light');
            c.setOptions({ theme: 'auto' });
            expect(onThemeChange).not.toHaveBeenCalled();
            expect(c.getSnapshot().themeChoice).toBe('auto');
            c.destroy();
        });

        it('closes the dropdown and returns focus to its button', () => {
            const button = document.createElement('button');
            document.body.appendChild(button);
            const c = panel({ theme: 'dark' });
            c.toggleThemeDropdown(button);
            expect(c.getSnapshot().themeDropdownOpen).toBeTrue();
            runThemeOption(c, themeOptions(c.getSnapshot())[1]);
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            expect(c.getSnapshot().themeChoice).toBe('light');
            expect(document.activeElement).toBe(button);
            button.remove();
            c.destroy();
        });

        it('"More themes" opens the list and keeps the dropdown open', () => {
            const c = panel({ theme: 'dark' });
            c.toggleThemeDropdown();
            runThemeOption(c, themeOptions(c.getSnapshot()).find((o) => o.key === 'theme-list')!);
            expect(c.getSnapshot().themeDropdownOpen).toBeTrue();
            expect(c.getSnapshot().themeListOpen).toBeTrue();
            c.destroy();
        });

        it("follows the system after picking Auto", () => {
            const listeners: Array<() => void> = [];
            let dark = true;
            spyOn(window, 'matchMedia').and.callFake(
                () =>
                    ({
                        get matches() {
                            return dark;
                        },
                        addEventListener: (_: string, l: () => void) => listeners.push(l),
                        removeEventListener: () => undefined,
                    }) as unknown as MediaQueryList,
            );
            const c = panel({ theme: 'light' });
            c.pickTheme('auto');
            expect(c.getSnapshot().scheme).toBe('dark');
            dark = false;
            listeners.forEach((l) => l());
            expect(c.getSnapshot().scheme).toBe('light');
            expect(c.getSnapshot().themeChoice).toBe('auto');
            c.destroy();
        });
    });

    describe('remembering the pick', () => {
        it('restores it on the next load, over the host default', () => {
            const first = panel({ theme: 'light' }, { persistTheme: true });
            first.pickTheme('nord');
            first.destroy();
            expect(loadPanelTheme()).toBe('nord');

            const second = panel({ theme: 'light' }, { persistTheme: true });
            expect(second.getSnapshot().themeChoice).toBe('nord');
            expect(second.getSnapshot().terminalTheme).toBe(DefaultThemes.nord);
            // The host's unchanged option does not undo it
            second.setOptions({ theme: 'light' });
            expect(second.getSnapshot().themeChoice).toBe('nord');
            second.destroy();
        });

        it("gives way to the host's next theme change, which forgets it", () => {
            const c = panel({ theme: 'light' }, { persistTheme: true });
            c.pickTheme('dark');
            c.setOptions({ theme: 'auto' });
            expect(c.getSnapshot().themeChoice).toBe('auto');
            expect(loadPanelTheme()).toBeNull();
            c.pickTheme('dark');
            c.setTheme('light');
            expect(c.getSnapshot().themeChoice).toBe('light');
            expect(loadPanelTheme()).toBeNull();
            c.destroy();
        });

        it('is not restored with the picker turned off, or by a stored value the picker does not know', () => {
            savePanelTheme('dark');
            const off = panel({ theme: 'light', themePicker: false }, { persistTheme: true });
            expect(off.getSnapshot().themeChoice).toBe('light');
            off.destroy();

            localStorage.setItem('cli-panel-theme', 'no-such-theme');
            const unknown = panel({ theme: 'light' }, { persistTheme: true });
            expect(unknown.getSnapshot().themeChoice).toBe('light');
            unknown.destroy();
        });

        it('does not touch storage without persistTheme', () => {
            const c = panel({ theme: 'light' });
            c.pickTheme('dark');
            expect(loadPanelTheme()).toBeNull();
            c.destroy();
        });
    });

    describe('with the theme command', () => {
        it('shows a theme applied with `theme apply` as the choice', () => {
            const c = panel({ theme: 'light' });
            const { root, container } = panelRoot();
            c.setRootElement(root);
            c.toggle();

            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: DefaultThemes.dracula }));
            expect(c.getSnapshot().themeChoice).toBe('dracula');

            // Colors set with `theme set` are the Custom choice, shown in its color pickers
            container.dispatchEvent(
                new CustomEvent(CLI_TERMINAL_THEME_EVENT, {
                    bubbles: true,
                    detail: { background: '#123456', foreground: '#ABCDEF', cursor: '#f00', red: '#aa0000' },
                }),
            );
            expect(c.getSnapshot().themeChoice).toBe('custom');
            expect(c.getSnapshot().customColors).toEqual({ background: '#123456', foreground: '#abcdef', accent: '#ff0000' });

            // `theme reset`: the panel's theme again
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: DefaultThemes.light }));
            expect(c.getSnapshot().themeChoice).toBe('light');
            c.destroy();
        });

        it('a pick replaces it in every terminal', () => {
            const c = panel({ theme: 'light' });
            const engine = fakeEngine(DefaultThemes.dracula);
            c.toggle();
            c.registerEngine(1, 1, engine);
            c.syncThemeFromEngine(DefaultThemes.dracula);
            expect(c.getSnapshot().themeChoice).toBe('dracula');

            // Picking the panel's own theme again still clears the user's (`theme reset`)
            c.pickTheme('light');
            expect(engine.clearUserTheme).toHaveBeenCalledTimes(1);
            expect(engine.applyUserTheme).not.toHaveBeenCalled();
            expect(c.getSnapshot().themeChoice).toBe('light');
            expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe(CliPanelPalettes.light.background);
            c.destroy();
        });
    });

    describe("in the theme command's saved state", () => {
        it('a terminal theme is saved as `theme apply <name>`, Auto/Light/Dark as its default', () => {
            const c = panel({ theme: 'light' });
            const engine = fakeEngine();
            c.toggle();
            c.registerEngine(1, 1, engine);

            c.pickTheme('dracula');
            expect(engine.applyUserTheme).toHaveBeenCalledOnceWith('dracula');
            expect(engine.clearUserTheme).not.toHaveBeenCalled();

            c.pickTheme('auto');
            expect(engine.clearUserTheme).toHaveBeenCalledTimes(1);
            expect(engine.applyUserTheme).toHaveBeenCalledTimes(1);
            c.destroy();
        });

        it("`theme reset` returns the panel to the host's theme and forgets the pick", () => {
            const changes: CliPanelThemeChange[] = [];
            const c = panel(
                { theme: 'light' },
                { persistTheme: true, callbacks: { onThemeChange: (change: CliPanelThemeChange) => changes.push(change) } },
            );
            const { root, container } = panelRoot();
            c.setRootElement(root);
            const engine = fakeEngine();
            c.toggle();
            c.registerEngine(1, 1, engine);
            c.pickTheme('nord');

            // The command resets its terminal, then announces it
            engine.clearUserTheme();
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_RESET_EVENT, { bubbles: true }));
            expect(c.getSnapshot().themeChoice).toBe('light');
            expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe(CliPanelPalettes.light.background);
            expect(engine.setTheme).toHaveBeenCalledWith(DefaultThemes.light);
            expect(loadPanelTheme()).toBeNull();
            expect(changes[changes.length - 1]).toEqual({ theme: 'light', scheme: 'light' });

            // Nothing was picked: nothing to do
            const count = changes.length;
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_RESET_EVENT, { bubbles: true }));
            expect(changes.length).toBe(count);
            c.destroy();
        });
    });

    describe('custom colors', () => {
        const colorRows = (c: CliPanelController) =>
            themeOptions(c.getSnapshot())
                .filter((o) => o.color)
                .map((o) => [o.label, o.color!.key, o.color!.value]);

        it('starts from the current look and shows a color picker per color', () => {
            const changes: CliPanelThemeChange[] = [];
            const c = panel({ theme: 'light' }, { callbacks: { onThemeChange: (change: CliPanelThemeChange) => changes.push(change) } });
            expect(colorRows(c)).toEqual([]);
            c.toggleThemeDropdown();
            c.pickTheme('custom');

            const s = c.getSnapshot();
            expect(s.themeChoice).toBe('custom');
            // The picker stays open for the colors
            expect(s.themeDropdownOpen).toBeTrue();
            expect(colorRows(c)).toEqual([
                ['Background', 'background', DefaultThemes.light.background!.toLowerCase()],
                ['Text', 'foreground', DefaultThemes.light.foreground!.toLowerCase()],
                ['Accent', 'accent', CliPanelPalettes.light.accent],
            ]);
            expect(s.scheme).toBe('light');
            expect(changes).toEqual([{ theme: 'custom', scheme: 'light', colors: s.customColors }]);
            c.destroy();
        });

        it('a color restyles the panel and the terminals, saved as custom colors of the theme command', () => {
            const c = panel({ theme: 'light' }, { persistTheme: true });
            const engine = fakeEngine();
            c.toggle();
            c.registerEngine(1, 1, engine);
            c.pickTheme('custom');
            c.setCustomThemeColor('background', '#101820');
            c.setCustomThemeColor('accent', '#ff8800');

            const s = c.getSnapshot();
            expect(s.customColors.background).toBe('#101820');
            expect(s.scheme).toBe('dark');
            expect(s.themeStyles['--cli-panel-bg']).toBe('#101820');
            expect(s.themeStyles['--cli-panel-accent']).toBe('#ff8800');
            const terminal = engine.setTheme.calls.mostRecent().args[0];
            expect(terminal.background).toBe('#101820');
            expect(terminal.cursor).toBe('#ff8800');
            // A dark background takes the dark theme's ANSI colors
            expect(terminal.red).toBe(DefaultThemes.default.red);
            expect(engine.applyUserTheme.calls.mostRecent().args[0]).toBe(terminal);
            expect(loadPanelTheme()).toBe('custom');
            expect(loadPanelCustomColors()).toEqual(s.customColors);
            c.destroy();

            // Next visit: the same colors, and they are kept while another theme is picked
            const next = panel({ theme: 'light' }, { persistTheme: true });
            expect(next.getSnapshot().themeChoice).toBe('custom');
            expect(next.getSnapshot().themeStyles['--cli-panel-bg']).toBe('#101820');
            next.pickTheme('dark');
            next.pickTheme('custom');
            expect(next.getSnapshot().customColors.accent).toBe('#ff8800');
            next.destroy();
        });

        it('keeps every color changed in a row, over a theme the user had applied', () => {
            const c = panel({ theme: 'light' });
            const engine = fakeEngine({ background: '#000000', foreground: '#ffffff', cursor: '#8fe548' }, true);
            c.toggle();
            c.registerEngine(1, 1, engine);
            expect(c.getSnapshot().themeChoice).toBe('custom');

            c.setCustomThemeColor('background', '#1b2b3c');
            c.setCustomThemeColor('accent', '#ff8800');
            expect(c.getSnapshot().customColors).toEqual({ background: '#1b2b3c', foreground: '#ffffff', accent: '#ff8800' });
            expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe('#1b2b3c');
            expect(engine.getTerminal().options.theme).toEqual(jasmine.objectContaining({ background: '#1b2b3c', cursor: '#ff8800' }));
            c.destroy();
        });

        it('ignores a value that is not a color', () => {
            const c = panel({ theme: 'dark' });
            c.pickTheme('custom');
            const before = c.getSnapshot().customColors;
            c.setCustomThemeColor('foreground', 'javascript:1');
            expect(c.getSnapshot().customColors).toEqual(before);
            c.destroy();
        });

        it('keeps the other colors of a theme the user built with `theme set`', () => {
            const c = panel({ theme: 'light' });
            const { root, container } = panelRoot();
            c.setRootElement(root);
            const engine = fakeEngine();
            c.toggle();
            c.registerEngine(1, 1, engine);
            const own = { background: '#202020', foreground: '#eeeeee', cursor: '#00ff00', red: '#ab0000' };
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: own }));

            c.setCustomThemeColor('foreground', '#ffffff');
            const terminal = engine.applyUserTheme.calls.mostRecent().args[0];
            expect(terminal).toEqual(jasmine.objectContaining({ background: '#202020', foreground: '#ffffff', cursor: '#00ff00', red: '#ab0000' }));
            c.destroy();
        });

        it('builds a terminal theme around three colors', () => {
            const theme = customPanelTheme({ background: '#ffffff', foreground: '#111111', accent: '#0055ff' });
            expect(theme.terminal).toEqual(
                jasmine.objectContaining({ background: '#ffffff', foreground: '#111111', cursor: '#0055ff', red: DefaultThemes.light.red }),
            );
            expect(theme.colors!.accent).toBe('#0055ff');
        });

        it('has its color pickers in the ⋮ menu too, which stays open on Custom', () => {
            const c = panel({ theme: 'dark' });
            c.updatePanelWidth(400);
            c.toggleHeaderMenu();
            runHeaderMenuAction(c, headerMenuItems(c.getSnapshot()).find((i) => i.key === 'theme-custom')!);
            expect(c.getSnapshot().headerMenuOpen).toBeTrue();
            const colors = headerMenuItems(c.getSnapshot()).filter((i) => i.action === 'theme-color');
            expect(colors.map((i) => i.color!.key)).toEqual(['background', 'foreground', 'accent']);
            c.destroy();
        });
    });

    describe('a terminal that has not finished starting', () => {
        it('gets the picked theme as soon as it exists, and later changes too', () => {
            const c = panel({ theme: 'light' }, { persistTheme: true });
            c.pickTheme('dark');
            const { root, container } = panelRoot();
            c.setRootElement(root);
            c.toggle();

            // The engine announces its terminal; start() is still waiting (first-run wizard)
            const engine = fakeEngine(DefaultThemes.light);
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_READY_EVENT, { bubbles: true, detail: engine }));
            expect(engine.setTheme).toHaveBeenCalledWith(DefaultThemes.default);

            c.setTheme('light');
            expect(engine.setTheme).toHaveBeenCalledWith(DefaultThemes.light);
            c.pickTheme('nord');
            expect(engine.setTheme).toHaveBeenCalledWith(DefaultThemes.nord);
            expect(engine.applyUserTheme).toHaveBeenCalledWith('nord');

            // Started: registered once, not themed twice over
            const calls = engine.setTheme.calls.count();
            c.registerEngine(1, 1, engine);
            c.pickTheme('dark');
            expect(engine.setTheme.calls.count()).toBe(calls + 2);
            c.destroy();
        });

        it('is forgotten once its terminal is gone', () => {
            const c = panel({ theme: 'light' });
            const { root, container } = panelRoot();
            c.setRootElement(root);
            const engine = fakeEngine();
            const terminal = { options: {}, element: { isConnected: true } };
            (engine as unknown as { getTerminal: () => object }).getTerminal = () => terminal;
            container.dispatchEvent(new CustomEvent(CLI_TERMINAL_READY_EVENT, { bubbles: true, detail: engine }));
            terminal.element.isConnected = false;
            engine.setTheme.calls.reset();
            c.setTheme('dark');
            expect(engine.setTheme).not.toHaveBeenCalled();
            c.destroy();
        });
    });

    describe('in the ⋮ menu', () => {
        it('has a Theme group, unless the picker is off', () => {
            const c = panel({ theme: 'auto' });
            const items = headerMenuItems(c.getSnapshot());
            const auto = items.find((i) => i.key === 'theme-auto')!;
            expect(auto.heading).toBe('Theme');
            expect(auto.role).toBe('menuitemradio');
            expect(auto.checked).toBeTrue();
            expect(items.find((i) => i.key === 'theme-list')!.role).toBe('menuitem');
            c.destroy();

            const off = panel({ themePicker: false });
            expect(off.getSnapshot().themePicker).toBeFalse();
            expect(headerMenuItems(off.getSnapshot()).some((i) => i.key.startsWith('theme-'))).toBeFalse();
            off.destroy();
        });

        it('a theme closes the menu, "More themes" lists the terminal themes in place', () => {
            const c = panel({ theme: 'dark' });
            c.updatePanelWidth(400);
            c.toggleHeaderMenu();
            runHeaderMenuAction(c, headerMenuItems(c.getSnapshot()).find((i) => i.key === 'theme-list')!);
            expect(c.getSnapshot().headerMenuOpen).toBeTrue();
            const nord = headerMenuItems(c.getSnapshot()).find((i) => i.key === 'theme-nord')!;
            runHeaderMenuAction(c, nord);
            expect(c.getSnapshot().headerMenuOpen).toBeFalse();
            expect(c.getSnapshot().themeChoice).toBe('nord');
            c.destroy();
        });
    });

    describe('dropdown', () => {
        it('opens toward the page, or over a tall panel when the page side is too short', () => {
            const vp = { width: 1280, height: 800 };
            // A short bottom panel: plenty of page above the button
            expect(themeDropdownAnchorStyle({ top: 560, bottom: 590, left: 1100, right: 1130 }, 'bottom', vp)).toEqual({
                top: 'auto',
                bottom: 'calc(100% + 4px)',
                maxHeight: '420px',
            });
            // A tall bottom panel: the button is near the top of the screen
            expect(themeDropdownAnchorStyle({ top: 210, bottom: 240, left: 1100, right: 1130 }, 'bottom', vp)).toEqual({
                top: 'calc(100% + 4px)',
                bottom: 'auto',
                maxHeight: '420px',
            });
            expect(themeDropdownAnchorStyle({ top: 10, bottom: 40, left: 1100, right: 1130 }, 'top', vp)['top']).toBe('calc(100% + 4px)');
            // No room on either side: the taller one, as high as it is
            expect(themeDropdownAnchorStyle({ top: 150, bottom: 180, left: 0, right: 30 }, 'bottom', { width: 400, height: 380 })['maxHeight']).toBe('188px');
            // Side panels grow upward from the button
            expect(themeDropdownAnchorStyle({ top: 700, bottom: 730, left: 4, right: 34 }, 'left', vp)).toEqual({ maxHeight: '420px' });
        });

        it('is the only open menu, and closes with the others', () => {
            const c = panel();
            c.togglePositionDropdown();
            c.toggleThemeDropdown();
            expect(c.getSnapshot().positionDropdownOpen).toBeFalse();
            expect(c.getSnapshot().themeDropdownOpen).toBeTrue();
            c.togglePositionDropdown();
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            c.toggleThemeDropdown();
            c.closeMenus();
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            // The compact header has its own picker in the ⋮ menu
            c.toggleThemeDropdown();
            c.updatePanelWidth(400);
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            c.destroy();
        });

        it('moves between its rows with the arrow keys and closes on Escape, back on its button', () => {
            const button = document.createElement('button');
            const dropdown = document.createElement('div');
            dropdown.className = 'cli-panel-theme-dropdown';
            const rows = ['auto', 'light', 'dark'].map(() => {
                const row = document.createElement('button');
                row.setAttribute('role', 'menuitemradio');
                dropdown.appendChild(row);
                return row;
            });
            document.body.append(button, dropdown);

            const c = panel();
            c.toggleThemeDropdown(button);
            rows[0].focus();
            const key = (k: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
            key('ArrowDown');
            expect(document.activeElement).toBe(rows[1]);
            key('End');
            expect(document.activeElement).toBe(rows[2]);
            key('ArrowDown');
            expect(document.activeElement).toBe(rows[0]);
            key('Escape');
            expect(c.getSnapshot().themeDropdownOpen).toBeFalse();
            expect(document.activeElement).toBe(button);
            button.remove();
            dropdown.remove();
            c.destroy();
        });
    });
});
