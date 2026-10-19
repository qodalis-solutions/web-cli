import {
    CliPanelConfig,
    CliPanelPosition,
    CliPanelState,
    ICliPanelRef,
    derivePanelThemeStyles,
    loadPanelPosition,
    savePanelPosition,
} from '@qodalis/cli-core';
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

    constructor(options: CliPanelControllerOptions = {}) {
        const config = options.config ?? {};
        this.callbacks = options.callbacks ?? {};
        this.controlled = options.controlled ?? {};
        this.viewport = options.viewport ?? defaultViewport;
        this.persistPosition = options.persistPosition ?? true;

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
            themeStyles: {},
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
        return () => {
            this.listeners.delete(listener);
        };
    };

    readonly getSnapshot = (): CliPanelSnapshot => this.snapshot;

    /** Apply a new panel configuration (chrome buttons, theme sync). */
    setOptions(config: CliPanelConfig | undefined): void {
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
        if (fields.syncTheme) this.startThemeSync();
        else this.stopThemeSync();
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
        this.rootElement = element;
        if (element && this.snapshot.syncTheme) this.startThemeSync();
    }

    /**
     * Stop timers, observers and document listeners. Engines are not
     * destroyed (their views own them). Registering an engine again
     * restarts status tracking, so a remounted view can reuse the controller.
     */
    destroy(): void {
        this.tracker.destroy();
        this.stopThemeSync();
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
        if (this.snapshot.collapsed !== this.preHideCollapsed) this.updateCollapsed(this.preHideCollapsed);
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
        this.engines.set(paneId, engine);
        this.tracker.registerEngine(tabId, paneId, engine);
        if (this.snapshot.syncTheme) this.startThemeSync();
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

    /** Mouse down on the panel's resize bar. */
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
        document.addEventListener('mousemove', this.onPanelResizeMove);
        document.addEventListener('mouseup', this.onPanelResizeEnd);
    }

    /** Mouse down on the divider before pane `dividerIndex + 1` of a tab. */
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
        document.addEventListener('mousemove', this.onPaneResizeMove);
        document.addEventListener('mouseup', this.onPaneResizeEnd);
    }

    private readonly onPanelResizeMove = (event: MouseEvent): void => {
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
        document.removeEventListener('mousemove', this.onPanelResizeMove);
        document.removeEventListener('mouseup', this.onPanelResizeEnd);
        this.commit({ panelResizing: false });
    }

    private readonly onPaneResizeMove = (event: MouseEvent): void => {
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
        document.removeEventListener('mousemove', this.onPaneResizeMove);
        document.removeEventListener('mouseup', this.onPaneResizeEnd);
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

    /** Read the first terminal's theme and derive the panel colours from it. */
    syncThemeFromEngine(): void {
        const engine = this.engines.values().next().value as CliEngine | undefined;
        if (!engine) return;
        const theme = engine.getTerminal().options.theme;
        if (!theme) return;
        const styles = derivePanelThemeStyles(theme);
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
                if (this.snapshot.syncTheme && !this.themeObserver) this.startThemeSync();
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
