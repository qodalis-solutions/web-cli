import { CliPanelPosition } from '../models/options';

/**
 * Framework-agnostic interface for programmatic control of the CLI panel.
 *
 * CliEngine is referenced as a generic to avoid a circular dependency
 * between @qodalis/cli-core and @qodalis/cli. Framework implementations
 * resolve this to the concrete CliEngine class.
 */
export interface ICliPanelRef<TEngine = unknown> {
    // ── Panel chrome ──

    /** Expand the panel (sets collapsed=false). Initializes the first tab on first call. */
    open(): void;
    /** Collapse the panel body (sets collapsed=true). */
    collapse(): void;
    toggleCollapse(): void;
    /** Hide the panel to a small viewport-edge tab (reversible via unhide). */
    hide(): void;
    unhide(): void;
    toggleHide(): void;
    /** Destroy the panel (removes from DOM). Irreversible. */
    close(): void;
    maximize(): void;
    restore(): void;
    toggleMaximize(): void;
    /**
     * Set panel dimensions. Only the dimension relevant to the current
     * position is applied immediately (height for top/bottom, width for
     * left/right). The other dimension is stored for when the position changes.
     */
    resize(dimensions: { height?: number; width?: number }): void;
    setPosition(position: CliPanelPosition): void;

    // ── Tabs ──

    /** Create a new tab. Returns the new tab's ID. Title defaults to "Terminal {id}". */
    addTab(title?: string): number;
    /** Close a tab by ID. No-op if the ID does not exist. */
    closeTab(tabId: number): void;
    /** Activate a tab by ID. No-op if the ID does not exist. */
    selectTab(tabId: number): void;
    /** Programmatically rename a tab. No-op if the ID does not exist. */
    renameTab(tabId: number, title: string): void;

    // ── Panes ──

    /**
     * Split the active pane (or a pane within the specified tab) to create
     * a new pane to the right. Returns the new pane's ID.
     */
    splitPane(tabId?: number): number;
    /**
     * Close a pane by ID. Searches all tabs for the pane.
     * No-op if the ID does not exist.
     */
    closePane(paneId: number): void;

    // ── Engine access ──

    /** Get the engine for a specific pane, or the active pane if omitted. */
    getEngine(paneId?: number): TEngine | undefined;

    // ── State ──

    getState(): CliPanelState;
}

export interface CliPanelState {
    collapsed: boolean;
    hidden: boolean;
    maximized: boolean;
    position: CliPanelPosition;
    height: number;
    width: number;
    activeTabId: number;
    activePaneId: number;
    tabs: CliPanelTabState[];
}

export interface CliPanelTabState {
    id: number;
    title: string;
    panes: CliPanelPaneState[];
}

export interface CliPanelPaneState {
    id: number;
    widthPercent: number;
}
