import {
    CliPanelConfig,
    CliPanelCustomColors,
    CliPanelPosition,
    CliPanelState,
    CliPanelThemeInput,
    CliResolvedPanelTheme,
    DefaultThemes,
    ICliPanelRef,
    PANEL_CUSTOM_THEME,
    PANEL_THEME_MODES,
    customPanelTheme,
    derivePanelThemeStyles,
    isPanelThemeChoice,
    normalizeHexColor,
    normalizePanelCustomColors,
    prefersDarkScheme,
    resolvePanelTheme,
    loadPanelCustomColors,
    loadPanelPosition,
    loadPanelTheme,
    savePanelCustomColors,
    savePanelPosition,
    savePanelTheme,
} from '@qodalis/cli-core';
import type { ITheme } from '@xterm/xterm';
import { CliEngine } from '../engine';
import {
    DEFAULT_PANEL_HEIGHT,
    DEFAULT_PANEL_WIDTH,
    distributePaneWidths,
    dropdownAnchorStyle,
    formatUptime,
    headerMenuAnchorStyle,
    isCompactHeaderWidth,
    isHorizontalPosition,
    normalizePaneWidths,
    resizePaneWidths,
    resizedPanelSize,
    themeDropdownAnchorStyle,
} from './panel-geometry';
import { CliPanelStatusTracker, interruptCommand, killProcess } from './panel-status';
import { CLI_TERMINAL_READY_EVENT, CLI_TERMINAL_THEME_EVENT, CLI_TERMINAL_THEME_RESET_EVENT } from '../processors/theme/terminal-theme';
import { CliSendKey, CliStickyModifier, applyStickyCtrlToKeyboard, sendTerminalKey } from '../keys';
import {
    CliPanelCallbacks,
    CliPanelControlledState,
    CliPanelControllerOptions,
    CliPanelGlobalStatus,
    CliPanelPane,
    CliPanelSnapshot,
    CliPanelTab,
    CliPanelTabStatus,
    CliPanelViewport,
    DEFAULT_GLOBAL_STATUS,
    DEFAULT_TAB_STATUS,
} from './panel-types';

interface InternalState {
    collapsed: boolean;
    hidden: boolean;
    maximized: boolean;
    activeTabId: number;
    position: CliPanelPosition;
    height: number;
    width: number;
}

interface PanelResizeDrag {
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
}

interface PaneResizeDrag {
    tabId: number;
    dividerIndex: number;
    startX: number;
    startWidths: number[];
    containerWidth: number;
}

const PANE_RESIZING_BODY_CLASS = 'cli-pane-resizing';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const HEADER_MENU_SELECTOR = '.cli-panel-header-menu';
const THEME_DROPDOWN_SELECTOR = '.cli-panel-theme-dropdown';
const SEND_KEY_MENU_SELECTOR = '.cli-panel-send-key-menu';
const HEADER_MENU_ITEM_SELECTOR = '[role^="menuitem"]:not(:disabled), input[type="color"]';

/** The root element as an event target (view roots are elements; test doubles may not be). */
function asEventTarget(node: ParentNode | null): EventTarget | null {
    return node && typeof (node as Partial<EventTarget>).addEventListener === 'function' ? (node as unknown as EventTarget) : null;
}

/**
 * Whether an element between `target` and `root` can still scroll in the
 * wheel's direction (the tab strip, menus); the page must not take that wheel.
 */
function canScrollWithin(target: EventTarget | null, root: Node, dx: number, dy: number): boolean {
    for (let el = target as HTMLElement | null; el && el !== root; el = el.parentElement) {
        if (!(el instanceof HTMLElement)) continue;
        const style = getComputedStyle(el);
        const scrollsY = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight;
        const scrollsX = /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth;
        if (dy !== 0 && scrollsY) {
            if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight) return true;
        }
        if (dx !== 0 && scrollsX) {
            if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth) return true;
        }
    }
    return false;
}

/** Whether a theme input follows the system's color scheme. */
function followsSystem(input: CliPanelThemeInput | undefined): boolean {
    return input === 'auto' || (typeof input === 'object' && input !== null && input.base === 'auto');
}

function themeKey(input: CliPanelThemeInput | undefined): string {
    return input === undefined ? '' : JSON.stringify(input);
}

function sameTerminalTheme(a: ITheme | undefined, b: ITheme | undefined): boolean {
    return !!a && !!b && a.background === b.background && a.foreground === b.foreground && a.cursor === b.cursor;
}

/** The theme picker's choice for a theme input; empty for a custom theme it does not list. */
function themeChoiceOf(input: CliPanelThemeInput | undefined): string {
    if (input === undefined) return 'dark';
    return typeof input === 'string' ? input : '';
}

/** The theme picker's choice for a terminal theme: a built-in one's name, or Custom for the user's own colors. */
function terminalThemeChoice(theme: ITheme): string {
    const themes: Record<string, ITheme> = DefaultThemes;
    const name = Object.keys(themes).find((key) => sameTerminalTheme(themes[key], theme));
    return name === 'default' ? 'dark' : (name ?? PANEL_CUSTOM_THEME);
}

/** Smaller gaps are browser toolbars sliding, not a keyboard. */
const MIN_KEYBOARD_INSET = 80;

/** Keyboard inset and visible height from the visual viewport. */
function visualViewportFields(): { keyboardInset: number; visibleHeight: number } {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return { keyboardInset: 0, visibleHeight: 0 };
    const inset = Math.round(window.innerHeight - vv.height - vv.offsetTop);
    return { keyboardInset: inset >= MIN_KEYBOARD_INSET ? inset : 0, visibleHeight: Math.round(vv.height) };
}

function defaultViewport(): CliPanelViewport {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Framework-agnostic state and behaviour of the collapsible CLI panel:
 * tabs and panes, chrome (collapse, hide, maximize, position, size),
 * menus, drag resizing, theme sync and the status bar.
 *
 * Views subscribe with {@link subscribe} and render {@link getSnapshot};
 * every change produces a new immutable snapshot. Hosts may control any of
 * the bindable values through {@link setControlled}; the matching
 * `onXChange` callback is invoked whenever the panel wants to change it.
 */
export class CliPanelController implements ICliPanelRef<CliEngine> {
    callbacks: CliPanelCallbacks;

    private snapshot: CliPanelSnapshot;
    private internal: InternalState;
    private controlled: CliPanelControlledState;
    private readonly listeners = new Set<() => void>();
    private readonly engines = new Map<number, CliEngine>();
    private readonly tracker: CliPanelStatusTracker;
    private readonly viewport: () => CliPanelViewport;
    private readonly persistPosition: boolean;
    private readonly persistTheme: boolean;
    /** The user has chosen custom colors before (now or on an earlier visit). */
    private customColorsSaved = false;
    /** Engines whose terminal exists but that have not finished starting (boot, first-run wizards). */
    private readonly startingEngines = new Set<CliEngine>();

    private nextTabId = 1;
    private nextPaneId = 1;
    private preHideCollapsed = true;
    private previousHeight = DEFAULT_PANEL_HEIGHT;
    private previousWidth = DEFAULT_PANEL_WIDTH;

    private panelDrag?: PanelResizeDrag;
    private paneDrag?: PaneResizeDrag;
    private documentListenersAttached = false;
    private rootElement: ParentNode | null = null;
    private themeObserver?: MutationObserver;
    /** `config.theme` as the host last gave it. */
    private hostTheme?: CliPanelThemeInput;
    /**
     * The theme in effect: the host's, or the one picked in the theme picker.
     * Undefined leaves the terminals' own theme alone.
     */
    private themeInput?: CliPanelThemeInput;
    /** The theme in effect is the picker's Custom choice (`themeInput` is built from the user's colors). */
    private customPicked = false;
    /** Custom terminal colors the user set with the `theme` command; the Custom choice keeps the ones it has no picker for. */
    private customTerminal?: ITheme;
    /** A pick is being applied to the terminals; their theme is read when it is done. */
    private pickingTheme = false;
    /** "Ctrl + key" of the Send key menu. */
    private readonly ctrl = new CliStickyModifier((state) => this.commit({ ctrlModifier: state }));
    private stopStickyCtrl?: () => void;
    /** The button that opened the Send key menu; focus returns to it on Escape. */
    private sendKeyMenuAnchor: HTMLElement | null = null;
    private resolvedTheme: CliResolvedPanelTheme;
    private schemeQuery?: MediaQueryList;
    private visualViewport?: VisualViewport;
    private widthObserver?: ResizeObserver;
    private observedPanel: Element | null = null;
    /** The ⋮ button that opened the header menu; focus returns to it on Escape. */
    private headerMenuAnchor: HTMLElement | null = null;
    /** The button that opened the theme picker; focus returns to it on Escape and after a pick. */
    private themeDropdownAnchor: HTMLElement | null = null;

    constructor(options: CliPanelControllerOptions = {}) {
        const config = options.config ?? {};
        this.callbacks = options.callbacks ?? {};
        this.controlled = options.controlled ?? {};
        this.viewport = options.viewport ?? defaultViewport;
        this.persistPosition = options.persistPosition ?? true;
        this.persistTheme = options.persistTheme ?? true;
        this.hostTheme = config.theme;
        // The theme picked on an earlier visit wins over the host's default
        const picked = this.persistTheme && (config.themePicker ?? true) ? loadPanelTheme() : null;
        this.themeInput = picked ?? config.theme;
        this.resolvedTheme = resolvePanelTheme(this.themeInput, prefersDarkScheme());
        // The Custom choice starts from the look it replaces
        const savedColors = this.persistTheme ? loadPanelCustomColors() : null;
        this.customColorsSaved = savedColors !== null;
        const customColors = normalizePanelCustomColors(savedColors, this.resolvedColors());
        if (picked === PANEL_CUSTOM_THEME) {
            this.customPicked = true;
            this.themeInput = customPanelTheme(customColors);
            this.resolvedTheme = resolvePanelTheme(this.themeInput, prefersDarkScheme());
        }
        this.watchSystemScheme();
        this.watchVisualViewport();

        this.internal = {
            collapsed: config.isCollapsed ?? true,
            hidden: config.isHidden ?? false,
            maximized: false,
            activeTabId: 0,
            position: (this.persistPosition ? loadPanelPosition() : null) ?? config.position ?? 'bottom',
            height: DEFAULT_PANEL_HEIGHT,
            width: DEFAULT_PANEL_WIDTH,
        };
        this.preHideCollapsed = this.internal.collapsed;

        this.tracker = new CliPanelStatusTracker({
            onTabStatus: (tabId, status) => this.setTabStatus(tabId, status),
            onGlobalStatus: (status) => this.commit({ global: status }),
        });

        this.snapshot = this.derive({
            visible: true,
            initialized: false,
            collapsed: this.internal.collapsed,
            hidden: this.internal.hidden,
            maximized: false,
            position: this.internal.position,
            height: this.internal.height,
            width: this.internal.width,
            isHorizontal: false,
            showStatusIndicators: true,
            panelResizing: false,
            // Without a theme the stylesheet's colors (and its overrides) apply
            themeStyles: this.themeInput === undefined ? {} : this.resolvedTheme.styles,
            scheme: this.resolvedTheme.scheme,
            terminalTheme: this.themeInput === undefined ? undefined : this.resolvedTheme.terminal,
            themeChoice: this.ownThemeChoice,
            customColors,
            ...visualViewportFields(),
            compactHeader: false,
            ...this.configFields(config),
            tabs: [],
            activeTabId: 0,
            activePaneId: 0,
            paneResizing: false,
            contextMenu: { visible: false, x: 0, y: 0, tabId: 0 },
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            sendKeyMenuStyle: {},
            ctrlModifier: 'off',
            commandKeys: [],
            commandName: '',
            themeDropdownStyle: {},
            themeListOpen: false,
            servicesDropdownOpen: false,
            servicesDropdownStyle: {},
            serversDropdownOpen: false,
            serversDropdownStyle: {},
            headerMenuOpen: false,
            headerMenuStyle: {},
            status: DEFAULT_TAB_STATUS,
            tabStatuses: {},
            global: DEFAULT_GLOBAL_STATUS,
            formattedUptime: formatUptime(0),
        });
    }

    /* ─── Subscription ──────────────────────────────────────── */

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        // A view remounted after destroy() reuses the controller: follow the viewport and system scheme again
        this.watchSystemScheme();
        this.watchVisualViewport();
        this.onVisualViewportChange();
        if (this.rootElement) this.watchStickyCtrl();
        return () => {
            this.listeners.delete(listener);
        };
    };

    readonly getSnapshot = (): CliPanelSnapshot => this.snapshot;

    /** Apply a new panel configuration (chrome buttons, theme, theme sync). */
    setOptions(config: CliPanelConfig | undefined): void {
        if (themeKey(config?.theme) !== themeKey(this.hostTheme)) this.setTheme(config?.theme);
        const fields = this.configFields(config ?? {});
        const s = this.snapshot;
        if (
            fields.closable === s.closable &&
            fields.resizable === s.resizable &&
            fields.hideable === s.hideable &&
            fields.hideAlignment === s.hideAlignment &&
            fields.syncTheme === s.syncTheme &&
            fields.themePicker === s.themePicker &&
            fields.sendKeys === s.sendKeys
        ) {
            return;
        }
        this.commit({
            ...fields,
            ...(fields.themePicker ? {} : { themeDropdownOpen: false }),
            ...(fields.sendKeys ? {} : { sendKeyMenuOpen: false }),
        });
        if (this.followsTerminalTheme) this.startThemeSync();
        else this.stopThemeSync();
    }

    /**
     * Restyle the panel and every terminal in it (see `CliPanelConfig.theme`).
     * `undefined` returns to the default palette and leaves the terminals' theme alone.
     * This is the host's theme: it replaces a theme picked in the theme picker, which
     * is forgotten, so the host's own setting and the panel agree on the next visit too.
     */
    setTheme(theme: CliPanelThemeInput | undefined): void {
        this.hostTheme = theme;
        this.themeInput = theme;
        this.customPicked = false;
        if (this.persistTheme) savePanelTheme(null);
        this.watchSystemScheme();
        this.applyTheme();
        if (this.followsTerminalTheme) this.startThemeSync();
        else this.stopThemeSync();
    }

    /**
     * The user picks a theme in the theme picker: `'auto'`, `'light'`, `'dark'`,
     * a terminal theme's name, or `'custom'` for their own colors (the saved ones,
     * or the current look to start from; `colors` replaces any of them). The panel
     * and every terminal in it change, a theme applied with the `theme` command
     * gives way to it, the pick is remembered for the next visit and the host is
     * told (`onThemeChange`). The picker stays open on Custom, for its color pickers.
     */
    pickTheme(theme: string, colors?: Partial<CliPanelCustomColors>): void {
        if (!isPanelThemeChoice(theme)) return;
        const custom = theme === PANEL_CUSTOM_THEME;
        let customColors = this.snapshot.customColors;
        if (custom) {
            // Picked for the first time, Custom keeps the look it replaces
            const current =
                this.snapshot.themeChoice === PANEL_CUSTOM_THEME || this.customColorsSaved ? customColors : this.resolvedColors();
            customColors = normalizePanelCustomColors({ ...current, ...colors }, current);
            this.customColorsSaved = true;
            if (this.persistTheme) savePanelCustomColors(customColors);
        }
        const anchor = !custom && this.snapshot.themeDropdownOpen ? this.themeDropdownAnchor : null;
        if (!custom) {
            this.themeDropdownAnchor = null;
            if (this.snapshot.themeDropdownOpen) this.commit({ themeDropdownOpen: false });
        }
        this.customPicked = custom;
        this.themeInput = custom ? customPanelTheme(customColors, this.customTerminal) : theme;
        if (this.persistTheme) savePanelTheme(theme);
        this.watchSystemScheme();
        // The `theme` command's saved state says the same as the picker: Auto, Light
        // and Dark are its default (`theme reset`), a terminal theme is `theme apply
        // <name>` and Custom its custom colors, so `theme current`, the other
        // terminals and other browser tabs agree with the panel
        const engines = this.allEngines();
        const mode = !custom && PANEL_THEME_MODES.includes(theme);
        // The terminals pass through their old theme on the way: follow them once they are done
        this.pickingTheme = true;
        try {
            if (mode) engines.forEach((engine) => engine.clearUserTheme());
            if (custom) this.commit({ customColors });
            this.applyTheme();
            if (!mode) engines.forEach((engine) => engine.applyUserTheme(custom ? this.resolvedTheme.terminal : theme));
        } finally {
            this.pickingTheme = false;
        }
        this.startThemeSync();
        anchor?.focus();
        const scheme = this.resolvedTheme.scheme;
        this.callbacks.onThemeChange?.(custom ? { theme, scheme, colors: customColors } : { theme, scheme });
    }

    /** A color picker of the Custom choice changed: `color` is `#rrggbb`. */
    setCustomThemeColor(key: keyof CliPanelCustomColors, color: string): void {
        this.pickTheme(PANEL_CUSTOM_THEME, { [key]: color });
    }

    /** The picker's choice for the theme in effect, when the terminals show it. */
    private get ownThemeChoice(): string {
        return this.customPicked ? PANEL_CUSTOM_THEME : themeChoiceOf(this.themeInput);
    }

    /** Background, text and accent of the theme in effect, as colors a color picker takes. */
    private resolvedColors(): CliPanelCustomColors {
        const { terminal, styles } = this.resolvedTheme;
        return {
            background: normalizeHexColor(terminal.background) ?? '#070b14',
            foreground: normalizeHexColor(terminal.foreground) ?? '#e2e8f0',
            accent: normalizeHexColor(styles['--cli-panel-accent']) ?? '#818cf8',
        };
    }

    /**
     * Whether the panel's colors follow its first terminal: with `syncTheme`, or
     * with a theme so a theme the user applies restyles the panel too.
     */
    private get followsTerminalTheme(): boolean {
        return this.snapshot.syncTheme || this.themeInput !== undefined;
    }

    /** Replace the change callbacks (wrappers call this when their props change). */
    setCallbacks(callbacks: CliPanelCallbacks): void {
        this.callbacks = callbacks;
    }

    /** Update host-controlled values. Unchanged values are ignored. */
    setControlled(values: CliPanelControlledState): void {
        const keys = Object.keys(values) as Array<keyof CliPanelControlledState>;
        const changed = keys.some((k) => values[k] !== this.controlled[k]);
        if (!changed) return;
        this.controlled = { ...this.controlled, ...values };
        this.commit({});
    }

    /** Element containing the terminals, used for theme sync. */
    setRootElement(element: ParentNode | null): void {
        if (element === this.rootElement) return;
        const previous = asEventTarget(this.rootElement);
        previous?.removeEventListener(CLI_TERMINAL_THEME_EVENT, this.onTerminalTheme);
        previous?.removeEventListener(CLI_TERMINAL_READY_EVENT, this.onTerminalReady);
        previous?.removeEventListener(CLI_TERMINAL_THEME_RESET_EVENT, this.onTerminalThemeReset);
        previous?.removeEventListener('wheel', this.onPanelWheel);
        this.rootElement = element;
        const next = asEventTarget(element);
        next?.addEventListener(CLI_TERMINAL_THEME_EVENT, this.onTerminalTheme);
        next?.addEventListener(CLI_TERMINAL_READY_EVENT, this.onTerminalReady);
        next?.addEventListener(CLI_TERMINAL_THEME_RESET_EVENT, this.onTerminalThemeReset);
        next?.addEventListener('wheel', this.onPanelWheel, { passive: false });
        if (element) this.watchStickyCtrl();
        else this.unwatchStickyCtrl();
        if (element && this.followsTerminalTheme) this.startThemeSync();
    }

    /**
     * Stop timers, observers and document listeners. Engines are not
     * destroyed (their views own them). Registering an engine again
     * restarts status tracking, so a remounted view can reuse the controller.
     */
    destroy(): void {
        this.tracker.destroy();
        this.startingEngines.clear();
        this.stopThemeSync();
        this.schemeQuery?.removeEventListener('change', this.onSystemSchemeChange);
        this.schemeQuery = undefined;
        this.unwatchVisualViewport();
        this.observePanelWidth(null);
        this.endPanelResize();
        this.endPaneResize();
        this.unwatchStickyCtrl();
        this.detachDocumentListeners();
    }

    /* ─── Chrome ────────────────────────────────────────────── */

    /** Header collapse button: expand (creating the first tab) or collapse. */
    toggle(): void {
        if (this.snapshot.collapsed) {
            this.updateCollapsed(false);
            this.ensureInitialized();
        } else {
            this.updateCollapsed(true);
        }
    }

    open(): void {
        if (!this.snapshot.visible) this.commit({ visible: true });
        if (this.snapshot.hidden) this.updateHidden(false);
        if (this.snapshot.collapsed) {
            this.updateCollapsed(false);
            this.ensureInitialized();
        }
    }

    collapse(): void {
        if (!this.snapshot.collapsed) this.updateCollapsed(true);
    }

    toggleCollapse(): void {
        this.toggle();
    }

    hide(): void {
        if (this.snapshot.hidden) return;
        this.preHideCollapsed = this.snapshot.collapsed;
        this.updateHidden(true);
    }

    unhide(): void {
        if (!this.snapshot.hidden) return;
        this.updateHidden(false);
        // A panel that started hidden opens with its terminal: the tab is how
        // one asks for the CLI, and a bare header would need a second click.
        // Hidden after use, it comes back as it was.
        const collapsed = this.snapshot.initialized ? this.preHideCollapsed : false;
        if (this.snapshot.collapsed !== collapsed) this.updateCollapsed(collapsed);
        if (!collapsed) this.ensureInitialized();
    }

    toggleHide(): void {
        if (this.snapshot.hidden) this.unhide();
        else this.hide();
    }

    close(): void {
        this.closeMenus();
        this.commit({ visible: false });
        this.callbacks.onClose?.();
    }

    maximize(): void {
        if (this.snapshot.maximized) return;
        const vp = this.viewport();
        if (this.snapshot.isHorizontal) {
            this.previousWidth = this.snapshot.width;
            this.updateWidth(vp.width);
        } else {
            this.previousHeight = this.snapshot.height;
            this.updateHeight(vp.height);
        }
        this.updateMaximized(true);
    }

    restore(): void {
        if (!this.snapshot.maximized) return;
        if (this.snapshot.isHorizontal) this.updateWidth(this.previousWidth);
        else this.updateHeight(this.previousHeight);
        this.updateMaximized(false);
    }

    toggleMaximize(): void {
        if (this.snapshot.maximized) this.restore();
        else this.maximize();
    }

    resize(dimensions: { height?: number; width?: number }): void {
        if (dimensions.height !== undefined) {
            this.previousHeight = dimensions.height;
            this.updateHeight(dimensions.height);
        }
        if (dimensions.width !== undefined) {
            this.previousWidth = dimensions.width;
            this.updateWidth(dimensions.width);
        }
    }

    setPosition(position: CliPanelPosition): void {
        this.commit({ positionDropdownOpen: false, themeDropdownOpen: false, sendKeyMenuOpen: false, headerMenuOpen: false });
        this.internal.position = position;
        if (this.persistPosition) savePanelPosition(position);
        this.commit({});
        this.callbacks.onPositionChange?.(position);
    }

    /* ─── Tabs ──────────────────────────────────────────────── */

    addTab(title?: string): number {
        const tabId = this.nextTabId++;
        const pane: CliPanelPane = { id: this.nextPaneId++, widthPercent: 100 };
        const tab: CliPanelTab = { id: tabId, title: title ?? `Terminal ${tabId}`, isEditing: false, panes: [pane] };
        this.commit({ tabs: [...this.snapshot.tabs, tab], activePaneId: pane.id });
        this.updateActiveTabId(tabId);
        this.callbacks.onTabAdded?.({ tabId });
        return tabId;
    }

    closeTab(tabId: number): void {
        const tabs = this.snapshot.tabs;
        const index = tabs.findIndex((t) => t.id === tabId);
        if (index === -1) return;

        this.releaseTab(tabs[index]);
        const remaining = tabs.filter((t) => t.id !== tabId);
        this.commit({ tabs: remaining, tabStatuses: omit(this.snapshot.tabStatuses, tabId) });
        this.callbacks.onTabClosed?.({ tabId });

        if (remaining.length === 0) {
            this.commit({ initialized: false });
            this.updateCollapsed(true);
            return;
        }
        if (this.snapshot.activeTabId === tabId) {
            this.selectTab(remaining[Math.min(index, remaining.length - 1)].id);
        }
    }

    selectTab(tabId: number): void {
        const tab = this.findTab(tabId);
        if (!tab) return;
        if (tab.panes.length > 0) this.commit({ activePaneId: tab.panes[0].id });
        this.updateActiveTabId(tabId);
        this.focusPane(this.snapshot.activePaneId);
    }

    renameTab(tabId: number, title: string): void {
        if (!this.findTab(tabId)) return;
        this.patchTab(tabId, { title });
    }

    /** Switch a tab's title into inline editing. */
    startRename(tabId: number): void {
        if (!this.findTab(tabId)) return;
        this.commit({ tabs: this.snapshot.tabs.map((t) => ({ ...t, isEditing: t.id === tabId })) });
    }

    /** Finish inline editing; an empty value keeps the old title. */
    commitRename(tabId: number, value: string): void {
        const tab = this.findTab(tabId);
        if (!tab) return;
        const trimmed = value.trim();
        this.patchTab(tabId, { title: trimmed || tab.title, isEditing: false });
    }

    cancelRename(): void {
        if (!this.snapshot.tabs.some((t) => t.isEditing)) return;
        this.commit({ tabs: this.snapshot.tabs.map((t) => (t.isEditing ? { ...t, isEditing: false } : t)) });
    }

    /** Open a new tab next to `tabId` with a copy of its first terminal's content. */
    duplicateTab(tabId: number): number {
        const tabs = this.snapshot.tabs;
        const index = tabs.findIndex((t) => t.id === tabId);
        if (index === -1) return -1;
        const source = tabs[index];
        const snapshot = this.engines.get(source.panes[0]?.id)?.snapshot();

        const newTabId = this.nextTabId++;
        const pane: CliPanelPane = { id: this.nextPaneId++, widthPercent: 100, snapshot };
        const tab: CliPanelTab = { id: newTabId, title: `${source.title} (copy)`, isEditing: false, panes: [pane] };
        const next = [...tabs];
        next.splice(index + 1, 0, tab);
        this.commit({ tabs: next, activePaneId: pane.id });
        this.updateActiveTabId(newTabId);
        this.callbacks.onTabAdded?.({ tabId: newTabId });
        return newTabId;
    }

    closeOtherTabs(tabId: number): void {
        const keep = this.findTab(tabId);
        if (!keep) return;
        this.removeTabs(this.snapshot.tabs.filter((t) => t.id !== tabId));
        this.selectTab(tabId);
    }

    closeTabsToTheRight(tabId: number): void {
        const index = this.snapshot.tabs.findIndex((t) => t.id === tabId);
        if (index === -1) return;
        this.removeTabs(this.snapshot.tabs.slice(index + 1));
        if (!this.findTab(this.snapshot.activeTabId)) this.selectTab(tabId);
    }

    closeAllTabs(): void {
        this.removeTabs(this.snapshot.tabs);
        this.commit({ initialized: false });
        this.updateCollapsed(true);
    }

    /* ─── Panes ─────────────────────────────────────────────── */

    splitPane(tabId?: number): number {
        const targetTabId = tabId ?? this.snapshot.activeTabId;
        const tab = this.findTab(targetTabId);
        if (!tab) return -1;
        const paneId = this.nextPaneId++;
        const panes = distributePaneWidths([...tab.panes, { id: paneId, widthPercent: 0 }]);
        this.patchTab(targetTabId, { panes });
        this.commit({ activePaneId: paneId });
        this.callbacks.onPaneSplit?.({ paneId, tabId: targetTabId });
        return paneId;
    }

    closePane(paneId: number): void {
        const tab = this.snapshot.tabs.find((t) => t.panes.some((p) => p.id === paneId));
        if (!tab) return;
        if (tab.panes.length <= 1) {
            this.closeTab(tab.id);
            return;
        }
        const index = tab.panes.findIndex((p) => p.id === paneId);
        this.releasePane(paneId);
        const panes = normalizePaneWidths(tab.panes.filter((p) => p.id !== paneId));
        this.patchTab(tab.id, { panes });
        if (this.snapshot.activePaneId === paneId) {
            this.commit({ activePaneId: panes[Math.min(index, panes.length - 1)].id });
        }
        this.callbacks.onPaneClosed?.({ paneId });
        this.focusPane(this.snapshot.activePaneId);
    }

    /** A pane was clicked: make it (and its tab) active and focus its terminal. */
    activatePane(tabId: number, paneId: number): void {
        this.commit({ activePaneId: paneId });
        if (this.snapshot.activeTabId !== tabId) this.updateActiveTabId(tabId);
        this.focusPane(paneId);
    }

    /* ─── Engines ───────────────────────────────────────────── */

    /** Called by the view once a pane's terminal engine is running. */
    registerEngine(tabId: number, paneId: number, engine: CliEngine): void {
        if (!this.findTab(tabId)) return;
        // Views may report the same engine again when they re-render
        const known = this.engines.get(paneId) === engine;
        this.startingEngines.delete(engine);
        this.engines.set(paneId, engine);
        this.tracker.registerEngine(tabId, paneId, engine);
        if (this.snapshot.terminalTheme && !known) engine.setTheme(this.snapshot.terminalTheme);
        if (this.followsTerminalTheme) this.startThemeSync();
    }

    getEngine(paneId?: number): CliEngine | undefined {
        return this.engines.get(paneId ?? this.snapshot.activePaneId);
    }

    getState(): CliPanelState {
        const s = this.snapshot;
        return {
            collapsed: s.collapsed,
            hidden: s.hidden,
            maximized: s.maximized,
            position: s.position,
            height: s.height,
            width: s.width,
            activeTabId: s.activeTabId,
            activePaneId: s.activePaneId,
            tabs: s.tabs.map((t) => ({
                id: t.id,
                title: t.title,
                panes: t.panes.map((p) => ({ id: p.id, widthPercent: p.widthPercent })),
            })),
        };
    }

    /* ─── Menus ─────────────────────────────────────────────── */

    openContextMenu(tabId: number, x: number, y: number): void {
        if (!this.findTab(tabId)) return;
        this.commit({
            contextMenu: { visible: true, x, y, tabId },
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            headerMenuOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
    }

    closeContextMenu(): void {
        if (!this.snapshot.contextMenu.visible) return;
        this.commit({ contextMenu: { ...this.snapshot.contextMenu, visible: false } });
    }

    togglePositionDropdown(): void {
        this.commit({
            positionDropdownOpen: !this.snapshot.positionDropdownOpen,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            headerMenuOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
    }

    /**
     * The header's theme button: open or close the theme picker. `anchor` is the
     * button; focus moves to the current choice and returns to the button on
     * Escape and after a pick.
     */
    toggleThemeDropdown(anchor?: HTMLElement | null): void {
        if (this.snapshot.themeDropdownOpen) {
            this.themeDropdownAnchor = null;
            this.commit({ themeDropdownOpen: false });
            return;
        }
        this.themeDropdownAnchor = anchor ?? null;
        this.commit({
            themeDropdownOpen: true,
            themeDropdownStyle: anchor ? themeDropdownAnchorStyle(anchor.getBoundingClientRect(), this.snapshot.position, this.viewport()) : {},
            themeListOpen: this.terminalThemeChosen,
            contextMenu: { ...this.snapshot.contextMenu, visible: false },
            positionDropdownOpen: false,
            sendKeyMenuOpen: false,
            headerMenuOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
        // The views render the picker on this change; focus the current choice after that
        setTimeout(() => {
            if (!this.snapshot.themeDropdownOpen) return;
            const items = this.openMenuElements();
            (items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
        }, 0);
    }

    /** The "More themes" row: show or hide the terminal themes in the theme picker. */
    toggleThemeList(): void {
        this.commit({ themeListOpen: !this.snapshot.themeListOpen });
    }

    /** The current choice is a terminal theme: the picker opens with its list shown. */
    private get terminalThemeChosen(): boolean {
        const choice = this.snapshot.themeChoice;
        return choice !== '' && !PANEL_THEME_MODES.includes(choice);
    }

    /**
     * Stop the command running in the active tab, as Ctrl+C does. False when
     * no command runs there.
     */
    stopCommand(): boolean {
        const stopped = interruptCommand(this.tracker.activeTabEngines);
        if (stopped) this.tracker.refresh();
        return stopped;
    }

    /**
     * Stop a running background service listed in the services dropdown, as
     * `kill <pid>` does; the list refreshes. False when nothing was running
     * under that pid.
     */
    killProcess(pid: number): boolean {
        const killed = killProcess(this.tracker.globalEngine, pid);
        if (killed) this.tracker.refresh();
        return killed;
    }

    /** `anchor` is the clicked status item; the dropdown is placed next to it. */
    toggleServicesDropdown(anchor?: Element | null): void {
        const open = !this.snapshot.servicesDropdownOpen;
        this.commit({
            servicesDropdownOpen: open,
            serversDropdownOpen: false,
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            headerMenuOpen: false,
            servicesDropdownStyle: open ? this.anchorStyle(anchor) : {},
        });
    }

    toggleServersDropdown(anchor?: Element | null): void {
        const open = !this.snapshot.serversDropdownOpen;
        this.commit({
            serversDropdownOpen: open,
            servicesDropdownOpen: false,
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            headerMenuOpen: false,
            serversDropdownStyle: open ? this.anchorStyle(anchor) : {},
        });
    }

    /**
     * The ⋮ button of the compact header: open or close the menu holding the
     * actions that do not fit (maximize, position, hide, close). `anchor` is
     * the button; the menu is placed next to it and focus moves into it.
     */
    toggleHeaderMenu(anchor?: HTMLElement | null): void {
        if (this.snapshot.headerMenuOpen) {
            this.closeHeaderMenu();
            return;
        }
        this.headerMenuAnchor = anchor ?? null;
        this.commit({
            headerMenuOpen: true,
            headerMenuStyle: anchor ? headerMenuAnchorStyle(anchor.getBoundingClientRect(), this.snapshot.position, this.viewport()) : {},
            contextMenu: { ...this.snapshot.contextMenu, visible: false },
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            themeListOpen: this.terminalThemeChosen,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
        // The views render the menu on this change; focus its first item after that
        setTimeout(() => {
            if (this.snapshot.headerMenuOpen) this.openMenuElements()[0]?.focus();
        }, 0);
    }

    /** Close the ⋮ menu; with `restoreFocus`, focus goes back to its button (as on Escape). */
    closeHeaderMenu(restoreFocus = false): void {
        if (!this.snapshot.headerMenuOpen) return;
        const anchor = this.headerMenuAnchor;
        this.headerMenuAnchor = null;
        this.commit({ headerMenuOpen: false });
        if (restoreFocus) anchor?.focus();
    }

    /** Close the context menu and every dropdown. */
    closeMenus(): void {
        const s = this.snapshot;
        if (
            !s.contextMenu.visible &&
            !s.positionDropdownOpen &&
            !s.themeDropdownOpen &&
            !s.sendKeyMenuOpen &&
            !s.servicesDropdownOpen &&
            !s.serversDropdownOpen &&
            !s.headerMenuOpen
        ) {
            return;
        }
        this.headerMenuAnchor = null;
        this.themeDropdownAnchor = null;
        this.sendKeyMenuAnchor = null;
        this.commit({
            contextMenu: { ...s.contextMenu, visible: false },
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            sendKeyMenuOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
            headerMenuOpen: false,
        });
    }

    /* ─── Panel width (compact header) ──────────────────────── */

    /**
     * Follow the panel element's width (views pass their wrapper element, and
     * null on unmount): below `COMPACT_HEADER_BREAKPOINT` the header switches
     * to the ⋮ menu.
     */
    observePanelWidth(element: Element | null): void {
        if (element === this.observedPanel) return;
        this.widthObserver?.disconnect();
        this.widthObserver = undefined;
        this.observedPanel = element;
        if (!element) return;
        if (typeof ResizeObserver === 'undefined') {
            this.updatePanelWidth(element.getBoundingClientRect().width);
            return;
        }
        this.widthObserver = new ResizeObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            this.updatePanelWidth(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
        });
        this.widthObserver.observe(element);
    }

    /**
     * The panel is `width` px wide. A width of 0 (hidden with `display: none`,
     * not laid out yet) keeps the current header.
     */
    updatePanelWidth(width: number): void {
        if (!(width > 0)) return;
        const compact = isCompactHeaderWidth(width);
        if (compact === this.snapshot.compactHeader) return;
        if (!compact) this.headerMenuAnchor = null;
        // Each header has its own theme picker (button or ⋮ menu): close the one that goes away
        this.commit(compact ? { compactHeader: true, themeDropdownOpen: false } : { compactHeader: false, headerMenuOpen: false });
    }

    /* ─── Send key (phones) ─────────────────────────────────── */

    /**
     * The Send key button (or "Send key" in the ⋮ menu): open or close the list
     * of combinations, next to `anchor`. It lists the keys of the full-screen
     * command running in the active pane first.
     */
    toggleSendKeyMenu(anchor?: HTMLElement | null): void {
        if (this.snapshot.sendKeyMenuOpen) {
            this.sendKeyMenuAnchor = null;
            this.commit({ sendKeyMenuOpen: false });
            return;
        }
        const processor = this.getEngine()?.getContext?.()?.contextProcessor;
        this.sendKeyMenuAnchor = anchor ?? null;
        this.headerMenuAnchor = null;
        this.commit({
            sendKeyMenuOpen: true,
            sendKeyMenuStyle: anchor ? headerMenuAnchorStyle(anchor.getBoundingClientRect(), this.snapshot.position, this.viewport()) : {},
            commandKeys: processor?.controls?.keys ?? [],
            commandName: processor?.command ?? '',
            contextMenu: { ...this.snapshot.contextMenu, visible: false },
            positionDropdownOpen: false,
            themeDropdownOpen: false,
            headerMenuOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
        setTimeout(() => {
            if (this.snapshot.sendKeyMenuOpen) this.openMenuElements()[0]?.focus();
        }, 0);
    }

    /** "Send key" in the ⋮ menu: the ⋮ menu closes and the Send key menu opens from its button. */
    openSendKeyMenuFromHeaderMenu(): void {
        const anchor = this.headerMenuAnchor;
        this.closeHeaderMenu();
        if (this.snapshot.sendKeyMenuOpen) this.commit({ sendKeyMenuOpen: false });
        this.toggleSendKeyMenu(anchor);
    }

    /**
     * Send a combination from the Send key menu to the active terminal (a
     * command's key sends the data it reads). One without a key press ("Ctrl +
     * key") gives the next letter typed Ctrl. The menu closes and
     * the terminal gets the focus back, so the on-screen keyboard stays.
     */
    sendKey(key: CliSendKey | { data: string }): void {
        this.sendKeyMenuAnchor = null;
        if (this.snapshot.sendKeyMenuOpen) this.commit({ sendKeyMenuOpen: false });
        const engine = this.getEngine();
        const terminal = this.activeTerminal();
        if ('data' in key) {
            if (terminal) sendTerminalKey(terminal, { text: key.data });
        } else if (key.press) {
            this.ctrl.reset();
            if (terminal) sendTerminalKey(terminal, { press: key.press });
        } else {
            this.ctrl.arm();
        }
        engine?.focus();
    }

    private activeTerminal() {
        try {
            return this.getEngine()?.getTerminal();
        } catch {
            return undefined;
        }
    }

    /** Letters typed on the on-screen keyboard while the sticky Ctrl is on become Ctrl+<letter>. */
    private watchStickyCtrl(): void {
        if (this.stopStickyCtrl) return;
        this.stopStickyCtrl = applyStickyCtrlToKeyboard(this.ctrl, (target) => {
            if (!target || !this.ctrl.active) return undefined;
            for (const engine of this.allEngines()) {
                try {
                    const terminal = engine.getTerminal();
                    if (terminal?.textarea === target) return terminal;
                } catch {
                    /* destroyed */
                }
            }
            return undefined;
        });
    }

    private unwatchStickyCtrl(): void {
        this.stopStickyCtrl?.();
        this.stopStickyCtrl = undefined;
    }

    /* ─── Drag resizing ─────────────────────────────────────── */

    /** Pointer (mouse, touch or pen) down on the panel's resize bar. */
    startPanelResize(clientX: number, clientY: number): void {
        if (!this.snapshot.resizable || typeof document === 'undefined') return;
        if (this.snapshot.collapsed) this.toggle();
        this.panelDrag = {
            startX: clientX,
            startY: clientY,
            startWidth: this.snapshot.width,
            startHeight: this.snapshot.height,
        };
        this.commit({ panelResizing: true });
        document.addEventListener('pointermove', this.onPanelResizeMove);
        document.addEventListener('pointerup', this.onPanelResizeEnd);
        document.addEventListener('pointercancel', this.onPanelResizeEnd);
    }

    /** Pointer down on the divider before pane `dividerIndex + 1` of a tab. */
    startPaneResize(tabId: number, dividerIndex: number, clientX: number, containerWidth: number): void {
        const tab = this.findTab(tabId);
        if (!tab || typeof document === 'undefined') return;
        this.paneDrag = {
            tabId,
            dividerIndex,
            startX: clientX,
            startWidths: tab.panes.map((p) => p.widthPercent),
            containerWidth: containerWidth > 0 ? containerWidth : 1,
        };
        this.commit({ paneResizing: true });
        document.body.classList.add(PANE_RESIZING_BODY_CLASS);
        document.addEventListener('pointermove', this.onPaneResizeMove);
        document.addEventListener('pointerup', this.onPaneResizeEnd);
        document.addEventListener('pointercancel', this.onPaneResizeEnd);
    }

    private readonly onPanelResizeMove = (event: PointerEvent | MouseEvent): void => {
        const drag = this.panelDrag;
        if (!drag) return;
        const size = resizedPanelSize(
            this.snapshot.position,
            { width: drag.startWidth, height: drag.startHeight },
            event.clientX - drag.startX,
            event.clientY - drag.startY,
            this.viewport(),
        );
        if (size.width !== undefined) this.updateWidth(size.width);
        if (size.height !== undefined) this.updateHeight(size.height);
    };

    private readonly onPanelResizeEnd = (): void => this.endPanelResize();

    private endPanelResize(): void {
        if (!this.panelDrag) return;
        this.panelDrag = undefined;
        document.removeEventListener('pointermove', this.onPanelResizeMove);
        document.removeEventListener('pointerup', this.onPanelResizeEnd);
        document.removeEventListener('pointercancel', this.onPanelResizeEnd);
        this.commit({ panelResizing: false });
    }

    private readonly onPaneResizeMove = (event: PointerEvent | MouseEvent): void => {
        const drag = this.paneDrag;
        if (!drag) return;
        const tab = this.findTab(drag.tabId);
        if (!tab) return;
        const deltaPercent = ((event.clientX - drag.startX) / drag.containerWidth) * 100;
        const widths = resizePaneWidths(drag.startWidths, drag.dividerIndex, deltaPercent);
        this.patchTab(tab.id, { panes: tab.panes.map((p, i) => ({ ...p, widthPercent: widths[i] ?? p.widthPercent })) });
    };

    private readonly onPaneResizeEnd = (): void => this.endPaneResize();

    private endPaneResize(): void {
        if (!this.paneDrag) return;
        this.paneDrag = undefined;
        document.body.classList.remove(PANE_RESIZING_BODY_CLASS);
        document.removeEventListener('pointermove', this.onPaneResizeMove);
        document.removeEventListener('pointerup', this.onPaneResizeEnd);
        document.removeEventListener('pointercancel', this.onPaneResizeEnd);
        this.commit({ paneResizing: false });
    }

    /* ─── Document listeners (outside click, Escape) ───────── */

    private readonly onDocumentClick = (): void => this.closeMenus();

    private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
        const s = this.snapshot;
        if ((s.headerMenuOpen || s.themeDropdownOpen || s.sendKeyMenuOpen) && this.moveMenuFocus(event)) return;
        if (event.key !== 'Escape') return;
        const restoreFocus = s.headerMenuOpen
            ? this.headerMenuAnchor
            : s.themeDropdownOpen
              ? this.themeDropdownAnchor
              : s.sendKeyMenuOpen
                ? this.sendKeyMenuAnchor
                : null;
        this.closeMenus();
        this.cancelRename();
        restoreFocus?.focus();
    };

    /** Items of the open ⋮ menu, theme picker or Send key menu. */
    private openMenuElements(): HTMLElement[] {
        if (typeof document === 'undefined') return [];
        const s = this.snapshot;
        const selector = s.headerMenuOpen ? HEADER_MENU_SELECTOR : s.sendKeyMenuOpen ? SEND_KEY_MENU_SELECTOR : THEME_DROPDOWN_SELECTOR;
        const menu = document.querySelector(selector);
        return menu ? Array.from(menu.querySelectorAll<HTMLElement>(HEADER_MENU_ITEM_SELECTOR)) : [];
    }

    /** Arrow keys, Home and End move between the items of the ⋮ menu or the theme picker; Tab leaves and closes it. */
    private moveMenuFocus(event: KeyboardEvent): boolean {
        if (event.key === 'Tab') {
            this.closeMenus();
            return true;
        }
        const items = this.openMenuElements();
        if (items.length === 0) return false;
        const current = items.indexOf(document.activeElement as HTMLElement);
        let next: number;
        switch (event.key) {
            case 'ArrowDown':
                next = current < 0 ? 0 : (current + 1) % items.length;
                break;
            case 'ArrowUp':
                next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
                break;
            case 'Home':
                next = 0;
                break;
            case 'End':
                next = items.length - 1;
                break;
            default:
                return false;
        }
        event.preventDefault();
        items[next].focus();
        return true;
    }

    private syncDocumentListeners(): void {
        if (typeof document === 'undefined') return;
        const s = this.snapshot;
        const needed =
            s.contextMenu.visible ||
            s.positionDropdownOpen ||
            s.themeDropdownOpen ||
            s.sendKeyMenuOpen ||
            s.servicesDropdownOpen ||
            s.serversDropdownOpen ||
            s.headerMenuOpen ||
            s.tabs.some((t) => t.isEditing);
        if (needed && !this.documentListenersAttached) {
            document.addEventListener('click', this.onDocumentClick);
            document.addEventListener('keydown', this.onDocumentKeydown);
            this.documentListenersAttached = true;
        } else if (!needed && this.documentListenersAttached) {
            this.detachDocumentListeners();
        }
    }

    private detachDocumentListeners(): void {
        if (!this.documentListenersAttached) return;
        document.removeEventListener('click', this.onDocumentClick);
        document.removeEventListener('keydown', this.onDocumentKeydown);
        this.documentListenersAttached = false;
    }

    /* ─── Theme sync ────────────────────────────────────────── */

    /** Read the first terminal's theme (or use `theme`) and derive the panel colours from it. */
    syncThemeFromEngine(theme?: ITheme): void {
        if (this.pickingTheme) return;
        if (!theme) {
            const engine = (this.engines.values().next().value ?? this.allEngines()[0]) as CliEngine | undefined;
            theme = engine?.getTerminal().options.theme;
        }
        if (!theme) return;
        // The panel's own terminal theme keeps the panel's colors; a theme the user
        // applied with the `theme` command restyles the panel and shows in the picker
        const own = sameTerminalTheme(theme, this.resolvedTheme.terminal);
        const styles = own ? this.resolvedTheme.styles : derivePanelThemeStyles(theme);
        const themeChoice = own ? this.ownThemeChoice : terminalThemeChoice(theme);
        // Colors set with `theme set` (or imported) show in the Custom choice's color pickers
        let customColors = this.snapshot.customColors;
        if (!own) this.customTerminal = themeChoice === PANEL_CUSTOM_THEME ? theme : undefined;
        if (!own && themeChoice === PANEL_CUSTOM_THEME) {
            customColors = normalizePanelCustomColors(
                { background: theme.background, foreground: theme.foreground, accent: theme.cursor },
                customColors,
            );
        }
        if (sameRecord(styles, this.snapshot.themeStyles) && themeChoice === this.snapshot.themeChoice && customColors === this.snapshot.customColors) {
            return;
        }
        this.commit({ themeStyles: styles, themeChoice, customColors });
    }

    /**
     * Sync now and follow the first terminal's container: the `theme`
     * command restyles it, which re-derives the panel colours.
     * Engines are registered after they start, so their theme is set.
     */
    private startThemeSync(): void {
        this.syncThemeFromEngine();
        if (this.themeObserver || typeof MutationObserver === 'undefined') return;
        const container = this.rootElement?.querySelector('.terminal-container');
        if (!container) return;
        this.themeObserver = new MutationObserver(() => this.syncThemeFromEngine());
        this.themeObserver.observe(container, { attributes: true, attributeFilter: ['style'] });
    }

    private applyTheme(): void {
        const resolved = resolvePanelTheme(this.themeInput, prefersDarkScheme());
        this.resolvedTheme = resolved;
        const terminalTheme = this.themeInput === undefined ? undefined : resolved.terminal;
        const terminalChanged = !!terminalTheme && !sameTerminalTheme(terminalTheme, this.snapshot.terminalTheme);
        const themeStyles = this.themeInput === undefined ? {} : resolved.styles;
        this.commit({ themeStyles, scheme: resolved.scheme, terminalTheme, themeChoice: this.ownThemeChoice });
        if (terminalChanged) this.allEngines().forEach((engine) => engine.setTheme(terminalTheme!));
        if (this.followsTerminalTheme) this.syncThemeFromEngine();
    }

    /** Follow the system's light/dark setting while the theme is 'auto'. */
    private watchSystemScheme(): void {
        const follow = followsSystem(this.themeInput) && typeof window !== 'undefined' && !!window.matchMedia;
        if (follow && !this.schemeQuery) {
            this.schemeQuery = window.matchMedia(DARK_SCHEME_QUERY);
            this.schemeQuery.addEventListener?.('change', this.onSystemSchemeChange);
        } else if (!follow && this.schemeQuery) {
            this.schemeQuery.removeEventListener?.('change', this.onSystemSchemeChange);
            this.schemeQuery = undefined;
        }
    }

    private readonly onSystemSchemeChange = (): void => this.applyTheme();

    /** Registered engines, then those still starting (dropping the ones whose terminal is gone). */
    private allEngines(): CliEngine[] {
        for (const engine of Array.from(this.startingEngines)) {
            let connected = false;
            try {
                connected = !!engine.getTerminal()?.element?.isConnected;
            } catch {
                /* destroyed */
            }
            if (!connected) this.startingEngines.delete(engine);
        }
        return [...this.engines.values(), ...this.startingEngines];
    }

    /**
     * A terminal was created in the panel. Its engine registers only once it has
     * started, which waits for the modules to boot (and a first-run wizard to be
     * answered): theme it from now on.
     */
    private readonly onTerminalReady = (event: Event): void => {
        const engine = (event as CustomEvent<CliEngine>).detail;
        if (!engine || typeof engine.setTheme !== 'function') return;
        if (Array.from(this.engines.values()).includes(engine)) return;
        this.startingEngines.add(engine);
        if (this.snapshot.terminalTheme) engine.setTheme(this.snapshot.terminalTheme);
        if (this.followsTerminalTheme) this.startThemeSync();
    };

    /**
     * `theme reset` in a terminal: a theme picked in the theme picker is forgotten
     * and the panel returns to the host's theme, which the host is told when it is
     * one of the picker's choices.
     */
    private readonly onTerminalThemeReset = (): void => {
        if (themeKey(this.themeInput) === themeKey(this.hostTheme)) return;
        this.themeInput = this.hostTheme;
        this.customPicked = false;
        this.customTerminal = undefined;
        if (this.persistTheme) savePanelTheme(null);
        this.watchSystemScheme();
        this.applyTheme();
        if (this.followsTerminalTheme) this.startThemeSync();
        else this.stopThemeSync();
        const theme = themeChoiceOf(this.hostTheme);
        if (this.hostTheme !== undefined && theme) this.callbacks.onThemeChange?.({ theme, scheme: this.resolvedTheme.scheme });
    };

    /** A terminal in the panel changed theme: follow the first one. */
    private readonly onTerminalTheme = (event: Event): void => {
        if (!this.followsTerminalTheme) return;
        const first = this.rootElement?.querySelector('.terminal-container');
        if (event.target !== first) return;
        this.syncThemeFromEngine((event as CustomEvent<ITheme>).detail);
    };

    /**
     * A wheel over the panel chrome (header, icon strip, empty pane) would
     * scroll the page behind it; the terminals already keep their own wheel.
     */
    private readonly onPanelWheel = (event: Event): void => {
        const wheel = event as WheelEvent;
        const root = this.rootElement as unknown as Node | null;
        if (!root || canScrollWithin(wheel.target, root, wheel.deltaX, wheel.deltaY)) return;
        wheel.preventDefault();
    };

    /* ─── On-screen keyboard ────────────────────────────────── */

    /**
     * Phone browsers open the keyboard over the page and shrink only the visual
     * viewport; follow it so the panel stays above the keyboard.
     */
    private watchVisualViewport(): void {
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (!vv || this.visualViewport) return;
        this.visualViewport = vv;
        vv.addEventListener('resize', this.onVisualViewportChange);
        vv.addEventListener('scroll', this.onVisualViewportChange);
    }

    private unwatchVisualViewport(): void {
        this.visualViewport?.removeEventListener('resize', this.onVisualViewportChange);
        this.visualViewport?.removeEventListener('scroll', this.onVisualViewportChange);
        this.visualViewport = undefined;
    }

    private readonly onVisualViewportChange = (): void => {
        const fields = visualViewportFields();
        const s = this.snapshot;
        if (fields.keyboardInset === s.keyboardInset && fields.visibleHeight === s.visibleHeight) return;
        this.commit(fields);
    };

    private stopThemeSync(): void {
        this.themeObserver?.disconnect();
        this.themeObserver = undefined;
    }

    /* ─── Internals ─────────────────────────────────────────── */

    private ensureInitialized(): void {
        if (this.snapshot.initialized) return;
        this.commit({ initialized: true });
        this.addTab();
    }

    private updateCollapsed(value: boolean): void {
        this.internal.collapsed = value;
        this.commit({});
        this.callbacks.onCollapsedChange?.(value);
    }

    private updateHidden(value: boolean): void {
        this.internal.hidden = value;
        this.commit({});
        this.callbacks.onHiddenChange?.(value);
    }

    private updateMaximized(value: boolean): void {
        this.internal.maximized = value;
        this.commit({});
        this.callbacks.onMaximizedChange?.(value);
    }

    private updateHeight(value: number): void {
        this.internal.height = value;
        this.commit({});
        this.callbacks.onHeightChange?.(value);
    }

    private updateWidth(value: number): void {
        this.internal.width = value;
        this.commit({});
        this.callbacks.onWidthChange?.(value);
    }

    private updateActiveTabId(value: number): void {
        this.internal.activeTabId = value;
        this.commit({});
        this.tracker.setActiveTab(this.snapshot.activeTabId);
        this.callbacks.onActiveTabIdChange?.(value);
    }

    private findTab(tabId: number): CliPanelTab | undefined {
        return this.snapshot.tabs.find((t) => t.id === tabId);
    }

    private patchTab(tabId: number, patch: Partial<CliPanelTab>): void {
        this.commit({ tabs: this.snapshot.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)) });
    }

    /** Remove tabs without touching collapsed/initialized state. */
    private removeTabs(tabs: readonly CliPanelTab[]): void {
        if (tabs.length === 0) return;
        const ids = new Set(tabs.map((t) => t.id));
        tabs.forEach((t) => this.releaseTab(t));
        let statuses = this.snapshot.tabStatuses;
        ids.forEach((id) => (statuses = omit(statuses, id)));
        this.commit({ tabs: this.snapshot.tabs.filter((t) => !ids.has(t.id)), tabStatuses: statuses });
        tabs.forEach((t) => this.callbacks.onTabClosed?.({ tabId: t.id }));
    }

    private releaseTab(tab: CliPanelTab): void {
        tab.panes.forEach((p) => this.releasePane(p.id));
        this.tracker.unregisterTab(tab.id);
    }

    private releasePane(paneId: number): void {
        const engine = this.engines.get(paneId);
        if (!engine) return;
        this.engines.delete(paneId);
        this.tracker.unregisterPane(paneId);
        // The observed container may belong to this pane: follow the next terminal.
        if (this.themeObserver) {
            this.stopThemeSync();
            // Wait for the view to remove the closed pane's DOM first.
            setTimeout(() => {
                if (this.followsTerminalTheme && !this.themeObserver) this.startThemeSync();
            }, 0);
        }
        try {
            engine.destroy();
        } catch {
            /* already destroyed by the view */
        }
    }

    private focusPane(paneId: number): void {
        setTimeout(() => {
            // A double-click on a tab starts a rename after the click that
            // scheduled this focus; don't steal focus from the rename input.
            if (this.snapshot.tabs.some((t) => t.isEditing)) return;
            this.engines.get(paneId)?.focus();
        }, 0);
    }

    private anchorStyle(anchor?: Element | null): Record<string, string> {
        if (!anchor) return {};
        return dropdownAnchorStyle(anchor.getBoundingClientRect(), this.snapshot.position, this.viewport());
    }

    private setTabStatus(tabId: number, status: CliPanelTabStatus): void {
        if (!this.findTab(tabId)) return;
        this.commit({ tabStatuses: { ...this.snapshot.tabStatuses, [tabId]: status } });
    }

    private configFields(config: CliPanelConfig) {
        return {
            closable: config.closable ?? true,
            resizable: config.resizable ?? true,
            hideable: config.hideable ?? true,
            hideAlignment: config.hideAlignment ?? 'center',
            syncTheme: config.syncTheme ?? false,
            themePicker: config.themePicker ?? true,
            sendKeys: config.sendKeys ?? true,
        };
    }

    /** Resolve controlled values and derived fields on top of a snapshot. */
    private derive(base: CliPanelSnapshot): CliPanelSnapshot {
        const c = this.controlled;
        const i = this.internal;
        const position = c.position ?? i.position;
        const activeTabId = c.activeTabId ?? i.activeTabId;
        const global: CliPanelGlobalStatus = base.global;
        return {
            ...base,
            collapsed: c.collapsed ?? i.collapsed,
            hidden: c.hidden ?? i.hidden,
            maximized: c.maximized ?? i.maximized,
            height: c.height ?? i.height,
            width: c.width ?? i.width,
            position,
            activeTabId,
            isHorizontal: isHorizontalPosition(position),
            showStatusIndicators: !isHorizontalPosition(position),
            status: base.tabStatuses[activeTabId] ?? DEFAULT_TAB_STATUS,
            formattedUptime: formatUptime(global.uptime),
        };
    }

    private commit(patch: Partial<CliPanelSnapshot>): void {
        this.snapshot = this.derive({ ...this.snapshot, ...patch });
        this.syncDocumentListeners();
        for (const listener of Array.from(this.listeners)) listener();
    }
}

function omit<T>(record: Readonly<Record<number, T>>, key: number): Record<number, T> {
    if (!(key in record)) return record as Record<number, T>;
    const copy: Record<number, T> = { ...record };
    delete copy[key];
    return copy;
}

function sameRecord(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}
