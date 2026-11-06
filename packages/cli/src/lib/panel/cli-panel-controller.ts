import {
    CliPanelConfig,
    CliPanelPosition,
    CliPanelState,
    CliPanelThemeInput,
    CliResolvedPanelTheme,
    ICliPanelRef,
    derivePanelThemeStyles,
    prefersDarkScheme,
    resolvePanelTheme,
    loadPanelPosition,
    savePanelPosition,
} from '@qodalis/cli-core';
import type { ITheme } from '@xterm/xterm';
import { CliEngine } from '../engine';
import {
    DEFAULT_PANEL_HEIGHT,
    DEFAULT_PANEL_WIDTH,
    distributePaneWidths,
    dropdownAnchorStyle,
    formatUptime,
    isHorizontalPosition,
    normalizePaneWidths,
    resizePaneWidths,
    resizedPanelSize,
} from './panel-geometry';
import { CliPanelStatusTracker } from './panel-status';
import { CLI_TERMINAL_THEME_EVENT } from '../processors/theme/terminal-theme';
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

/** The root element as an event target (view roots are elements; test doubles may not be). */
function asEventTarget(node: ParentNode | null): EventTarget | null {
    return node && typeof (node as Partial<EventTarget>).addEventListener === 'function' ? (node as unknown as EventTarget) : null;
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
    /** The host's theme (`config.theme`); undefined leaves the terminals' own theme alone. */
    private themeInput?: CliPanelThemeInput;
    private resolvedTheme: CliResolvedPanelTheme;
    private schemeQuery?: MediaQueryList;
    private visualViewport?: VisualViewport;

    constructor(options: CliPanelControllerOptions = {}) {
        const config = options.config ?? {};
        this.callbacks = options.callbacks ?? {};
        this.controlled = options.controlled ?? {};
        this.viewport = options.viewport ?? defaultViewport;
        this.persistPosition = options.persistPosition ?? true;
        this.themeInput = config.theme;
        this.resolvedTheme = resolvePanelTheme(config.theme, prefersDarkScheme());
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
            // Without a host theme the stylesheet's colors (and its overrides) apply
            themeStyles: config.theme === undefined ? {} : this.resolvedTheme.styles,
            scheme: this.resolvedTheme.scheme,
            terminalTheme: config.theme === undefined ? undefined : this.resolvedTheme.terminal,
            ...visualViewportFields(),
            ...this.configFields(config),
            tabs: [],
            activeTabId: 0,
            activePaneId: 0,
            paneResizing: false,
            contextMenu: { visible: false, x: 0, y: 0, tabId: 0 },
            positionDropdownOpen: false,
            servicesDropdownOpen: false,
            servicesDropdownStyle: {},
            serversDropdownOpen: false,
            serversDropdownStyle: {},
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
        return () => {
            this.listeners.delete(listener);
        };
    };

    readonly getSnapshot = (): CliPanelSnapshot => this.snapshot;

    /** Apply a new panel configuration (chrome buttons, theme, theme sync). */
    setOptions(config: CliPanelConfig | undefined): void {
        if (themeKey(config?.theme) !== themeKey(this.themeInput)) this.setTheme(config?.theme);
        const fields = this.configFields(config ?? {});
        const s = this.snapshot;
        if (
            fields.closable === s.closable &&
            fields.resizable === s.resizable &&
            fields.hideable === s.hideable &&
            fields.hideAlignment === s.hideAlignment &&
            fields.syncTheme === s.syncTheme
        ) {
            return;
        }
        this.commit(fields);
        if (this.followsTerminalTheme) this.startThemeSync();
        else this.stopThemeSync();
    }

    /**
     * Restyle the panel and every terminal in it (see `CliPanelConfig.theme`).
     * `undefined` returns to the default palette and leaves the terminals' theme alone.
     */
    setTheme(theme: CliPanelThemeInput | undefined): void {
        this.themeInput = theme;
        this.watchSystemScheme();
        this.applyTheme();
        if (this.followsTerminalTheme) this.startThemeSync();
        else this.stopThemeSync();
    }

    /**
     * Whether the panel's colors follow its first terminal: with `syncTheme`, or
     * with a host theme so a theme the user applies restyles the panel too.
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
        asEventTarget(this.rootElement)?.removeEventListener(CLI_TERMINAL_THEME_EVENT, this.onTerminalTheme);
        this.rootElement = element;
        asEventTarget(element)?.addEventListener(CLI_TERMINAL_THEME_EVENT, this.onTerminalTheme);
        if (element && this.followsTerminalTheme) this.startThemeSync();
    }

    /**
     * Stop timers, observers and document listeners. Engines are not
     * destroyed (their views own them). Registering an engine again
     * restarts status tracking, so a remounted view can reuse the controller.
     */
    destroy(): void {
        this.tracker.destroy();
        this.stopThemeSync();
        this.schemeQuery?.removeEventListener('change', this.onSystemSchemeChange);
        this.schemeQuery = undefined;
        this.unwatchVisualViewport();
        this.endPanelResize();
        this.endPaneResize();
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
        this.commit({ positionDropdownOpen: false });
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
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
    }

    /** `anchor` is the clicked status item; the dropdown is placed next to it. */
    toggleServicesDropdown(anchor?: Element | null): void {
        const open = !this.snapshot.servicesDropdownOpen;
        this.commit({
            servicesDropdownOpen: open,
            serversDropdownOpen: false,
            positionDropdownOpen: false,
            servicesDropdownStyle: open ? this.anchorStyle(anchor) : {},
        });
    }

    toggleServersDropdown(anchor?: Element | null): void {
        const open = !this.snapshot.serversDropdownOpen;
        this.commit({
            serversDropdownOpen: open,
            servicesDropdownOpen: false,
            positionDropdownOpen: false,
            serversDropdownStyle: open ? this.anchorStyle(anchor) : {},
        });
    }

    /** Close the context menu and every dropdown. */
    closeMenus(): void {
        const s = this.snapshot;
        if (!s.contextMenu.visible && !s.positionDropdownOpen && !s.servicesDropdownOpen && !s.serversDropdownOpen) {
            return;
        }
        this.commit({
            contextMenu: { ...s.contextMenu, visible: false },
            positionDropdownOpen: false,
            servicesDropdownOpen: false,
            serversDropdownOpen: false,
        });
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
        if (event.key !== 'Escape') return;
        this.closeMenus();
        this.cancelRename();
    };

    private syncDocumentListeners(): void {
        if (typeof document === 'undefined') return;
        const s = this.snapshot;
        const needed =
            s.contextMenu.visible ||
            s.positionDropdownOpen ||
            s.servicesDropdownOpen ||
            s.serversDropdownOpen ||
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
        if (!theme) {
            const engine = this.engines.values().next().value as CliEngine | undefined;
            theme = engine?.getTerminal().options.theme;
        }
        if (!theme) return;
        // The host's own terminal theme keeps the host's panel colors
        const styles = sameTerminalTheme(theme, this.resolvedTheme.terminal)
            ? this.resolvedTheme.styles
            : derivePanelThemeStyles(theme);
        if (sameRecord(styles, this.snapshot.themeStyles)) return;
        this.commit({ themeStyles: styles });
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
        this.commit({ themeStyles, scheme: resolved.scheme, terminalTheme });
        if (terminalChanged) this.engines.forEach((engine) => engine.setTheme(terminalTheme!));
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

    /** A terminal in the panel changed theme: follow the first one. */
    private readonly onTerminalTheme = (event: Event): void => {
        if (!this.followsTerminalTheme) return;
        const first = this.rootElement?.querySelector('.terminal-container');
        if (event.target !== first) return;
        this.syncThemeFromEngine((event as CustomEvent<ITheme>).detail);
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
