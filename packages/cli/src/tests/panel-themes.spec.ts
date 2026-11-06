import {
    CliPanelPalettes,
    DefaultThemes,
    colorSchemeOf,
    resolvePanelTheme,
} from '@qodalis/cli-core';
import { CliEngine } from '../lib/engine';
import {
    CliPanelController,
    contextMenuStyle,
    openStatusDropdown,
    panelWrapperStyle,
} from '../lib/panel';
import { CLI_TERMINAL_THEME_EVENT } from '../lib/processors/theme/terminal-theme';

function fakeEngine(theme: object = DefaultThemes.default) {
    const options = { theme };
    return {
        getContext: () => ({
            isExecuting: false,
            notifier: {},
            backgroundServices: { list: () => [], on: () => () => undefined },
            services: { get: () => undefined },
        }),
        getTerminal: () => ({ options }),
        setTheme: jasmine
            .createSpy('setTheme')
            .and.callFake((t: object) => (options.theme = t)),
        destroy: () => undefined,
        focus: () => undefined,
    } as unknown as CliEngine & { setTheme: jasmine.Spy };
}

function panel(config: object = {}) {
    return new CliPanelController({
        config,
        persistPosition: false,
        viewport: () => ({ width: 1000, height: 800 }),
    });
}

describe('resolvePanelTheme', () => {
    it('defaults to the dark palette and the default terminal theme', () => {
        const r = resolvePanelTheme(undefined, false);
        expect(r.scheme).toBe('dark');
        expect(r.terminal).toBe(DefaultThemes.default);
        expect(r.styles['--cli-panel-bg']).toBe(
            CliPanelPalettes.dark.background,
        );
        expect(r.styles['color-scheme']).toBe('dark');
    });

    it('has a light palette with a light terminal', () => {
        const r = resolvePanelTheme('light', true);
        expect(r.scheme).toBe('light');
        expect(r.terminal).toBe(DefaultThemes.light);
        expect(r.styles['--cli-panel-text']).toBe(CliPanelPalettes.light.text);
    });

    it("follows the system with 'auto'", () => {
        expect(resolvePanelTheme('auto', true).scheme).toBe('dark');
        expect(resolvePanelTheme('auto', false).scheme).toBe('light');
    });

    it('derives the panel from a terminal theme name, light or dark', () => {
        const dracula = resolvePanelTheme('dracula', false);
        expect(dracula.terminal).toBe(DefaultThemes.dracula);
        expect(dracula.styles['--cli-panel-bg']).toBe(
            DefaultThemes.dracula.background!,
        );
        expect(dracula.scheme).toBe('dark');
        expect(resolvePanelTheme('solarizedLight', true).scheme).toBe('light');
    });

    it('falls back to dark for an unknown name', () => {
        expect(resolvePanelTheme('no-such-theme', false).terminal).toBe(
            DefaultThemes.default,
        );
    });

    it('lays custom colors, font and radius over a base palette', () => {
        const r = resolvePanelTheme(
            {
                base: 'light',
                colors: { accent: '#0f766e' },
                fontFamily: 'Inter',
                radius: '0',
            },
            true,
        );
        expect(r.scheme).toBe('light');
        expect(r.terminal).toBe(DefaultThemes.light);
        expect(r.styles['--cli-panel-accent']).toBe('#0f766e');
        expect(r.styles['--cli-panel-bg']).toBe(
            CliPanelPalettes.light.background,
        );
        expect(r.styles['--cli-panel-font']).toBe('Inter');
        expect(r.styles['--cli-panel-radius']).toBe('0');
    });

    it('takes custom terminal colors and picks the scheme from their background', () => {
        const terminal = { background: '#fdf6e3', foreground: '#333333' };
        const r = resolvePanelTheme(
            { terminal, colors: { border: 'red' } },
            false,
        );
        expect(r.terminal).toBe(terminal);
        expect(r.scheme).toBe('light');
        expect(r.styles['--cli-panel-bg']).toBe('#fdf6e3');
        expect(r.styles['--cli-panel-border']).toBe('red');
    });

    it('tells light from dark colors', () => {
        expect(colorSchemeOf('#ffffff')).toBe('light');
        expect(colorSchemeOf('#fff')).toBe('light');
        expect(colorSchemeOf('#070b14')).toBe('dark');
        expect(colorSchemeOf('rgb(0,0,0)')).toBe('dark');
    });
});

describe('panel theme', () => {
    it('leaves the terminals alone without a theme', () => {
        const c = panel();
        const engine = fakeEngine();
        c.toggle();
        c.registerEngine(1, 1, engine);
        expect(engine.setTheme).not.toHaveBeenCalled();
        expect(c.getSnapshot().terminalTheme).toBeUndefined();
        // The stylesheet's colors apply, so its CSS variable overrides keep working
        expect(c.getSnapshot().themeStyles).toEqual({});
        c.destroy();
    });

    it('styles a new terminal in the host theme', () => {
        const c = panel({ theme: 'light' });
        const engine = fakeEngine();
        c.toggle();
        c.registerEngine(1, 1, engine);
        expect(engine.setTheme).toHaveBeenCalledWith(DefaultThemes.light);
        expect(c.getSnapshot().scheme).toBe('light');
        c.destroy();
    });

    it('restyles the panel and every terminal when the host changes the theme', () => {
        const c = panel({ theme: 'light' });
        const listener = jasmine.createSpy('listener');
        c.subscribe(listener);
        c.toggle();
        const first = fakeEngine(DefaultThemes.light);
        c.registerEngine(1, 1, first);
        const pane = c.splitPane();
        const second = fakeEngine(DefaultThemes.light);
        c.registerEngine(1, pane, second);

        c.setOptions({ theme: 'dark' });
        expect(first.setTheme).toHaveBeenCalledWith(DefaultThemes.default);
        expect(second.setTheme).toHaveBeenCalledWith(DefaultThemes.default);
        expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe(
            CliPanelPalettes.dark.background,
        );

        // The same theme again (a re-render with a new object) changes nothing
        listener.calls.reset();
        c.setOptions({ theme: 'dark' });
        expect(listener).not.toHaveBeenCalled();
        c.destroy();
    });

    it('keeps custom colors when only they change, without touching the terminals', () => {
        const c = panel({ theme: { base: 'light' } });
        c.toggle();
        const engine = fakeEngine(DefaultThemes.light);
        c.registerEngine(1, 1, engine);
        engine.setTheme.calls.reset();
        c.setTheme({ base: 'light', colors: { accent: '#ff0000' } });
        expect(c.getSnapshot().themeStyles['--cli-panel-accent']).toBe(
            '#ff0000',
        );
        expect(engine.setTheme).not.toHaveBeenCalled();
        c.destroy();
    });

    it("follows the system's color scheme with 'auto'", () => {
        let dark = false;
        const listeners: Array<() => void> = [];
        spyOn(window, 'matchMedia').and.callFake(
            (query: string) =>
                ({
                    get matches() {
                        return query.includes('dark') ? dark : false;
                    },
                    addEventListener: (_: string, fn: () => void) =>
                        listeners.push(fn),
                    removeEventListener: () => undefined,
                }) as unknown as MediaQueryList,
        );
        const c = panel({ theme: 'auto' });
        expect(c.getSnapshot().scheme).toBe('light');
        dark = true;
        listeners.forEach((fn) => fn());
        expect(c.getSnapshot().scheme).toBe('dark');
        c.destroy();
    });

    it("doesn't restyle a terminal again when a view re-registers it", () => {
        const c = panel({ theme: 'light' });
        const engine = fakeEngine();
        c.toggle();
        c.registerEngine(1, 1, engine);
        c.registerEngine(1, 1, engine);
        expect(engine.setTheme).toHaveBeenCalledTimes(1);
        c.destroy();
    });

    it('follows a theme the user applies in its first terminal', () => {
        const c = panel({ theme: 'light' });
        const root = document.createElement('div');
        const container = document.createElement('div');
        container.className = 'terminal-container';
        root.appendChild(container);
        c.setRootElement(root);
        c.toggle();

        container.dispatchEvent(
            new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: DefaultThemes.dracula }),
        );
        expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe(DefaultThemes.dracula.background!);

        // Back to the host's terminal theme: the host's panel colors again
        container.dispatchEvent(
            new CustomEvent(CLI_TERMINAL_THEME_EVENT, { bubbles: true, detail: DefaultThemes.light }),
        );
        expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe(CliPanelPalettes.light.background);
        c.destroy();
    });

    it('themes the menus that render outside the panel', () => {
        const c = panel({ theme: 'light' });
        const s = c.getSnapshot();
        expect(contextMenuStyle(s)['--cli-panel-bg']).toBe(
            CliPanelPalettes.light.background,
        );
        c.toggleServicesDropdown();
        const withServices = {
            ...c.getSnapshot(),
            global: {
                ...c.getSnapshot().global,
                serviceCount: { running: 1, total: 1 },
            },
        };
        expect(openStatusDropdown(withServices)!.style['--cli-panel-bg']).toBe(
            CliPanelPalettes.light.background,
        );
        c.destroy();
    });
});

describe('panel and the on-screen keyboard', () => {
    let vv: {
        height: number;
        offsetTop: number;
        listeners: Record<string, () => void>;
    };

    beforeEach(() => {
        vv = { height: window.innerHeight, offsetTop: 0, listeners: {} };
        spyOnProperty(window, 'visualViewport').and.returnValue({
            get height() {
                return vv.height;
            },
            get offsetTop() {
                return vv.offsetTop;
            },
            addEventListener: (type: string, fn: () => void) =>
                (vv.listeners[type] = fn),
            removeEventListener: () => undefined,
        } as unknown as VisualViewport);
    });

    it('hands the keyboard inset and the visible height to the stylesheet', () => {
        const c = panel();
        c.subscribe(() => undefined);
        expect(c.getSnapshot().keyboardInset).toBe(0);

        vv.height = window.innerHeight - 300;
        vv.listeners['resize']();
        const s = c.getSnapshot();
        expect(s.keyboardInset).toBe(300);
        const style = panelWrapperStyle(s);
        expect(style['--cli-panel-keyboard-inset']).toBe('300px');
        expect(style['--cli-panel-visible-height']).toBe(
            `${window.innerHeight - 300}px`,
        );

        vv.height = window.innerHeight;
        vv.listeners['resize']();
        expect(
            panelWrapperStyle(c.getSnapshot())['--cli-panel-keyboard-inset'],
        ).toBeUndefined();
        c.destroy();
    });

    it('ignores small changes, which are browser toolbars', () => {
        const c = panel();
        vv.height = window.innerHeight - 40;
        vv.listeners['resize']();
        expect(c.getSnapshot().keyboardInset).toBe(0);
        c.destroy();
    });

    it('follows the viewport again after a remount (destroy, then subscribe)', () => {
        const c = panel();
        c.destroy();
        c.subscribe(() => undefined);
        vv.height = window.innerHeight - 300;
        vv.listeners['resize']();
        expect(c.getSnapshot().keyboardInset).toBe(300);
        c.destroy();
    });
});
