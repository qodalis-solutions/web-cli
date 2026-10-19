import {
    CliEngineSnapshot,
    CliNotification,
    CliPanelConfig,
    CliPanelHideAlignment,
    CliPanelPosition,
} from '@qodalis/cli-core';

/** One terminal inside a tab. */
export interface CliPanelPane {
    id: number;
    widthPercent: number;
    /** Snapshot to restore when the pane's engine starts (used by "Duplicate"). */
    snapshot?: CliEngineSnapshot;
}

/** One tab of the panel: a title and one or more panes side by side. */
export interface CliPanelTab {
    id: number;
    title: string;
    isEditing: boolean;
    panes: CliPanelPane[];
}

export interface CliPanelContextMenu {
    visible: boolean;
    x: number;
    y: number;
    tabId: number;
}

export interface CliPanelServiceDetail {
    name: string;
    status: string;
    description?: string;
}

export interface CliPanelServerDetail {
    name: string;
    url: string;
    connected: boolean;
    apiVersion?: string;
    commandCount?: number;
}

export type CliPanelExecutionState = 'idle' | 'running';
export type CliPanelServerState = 'connected' | 'disconnected' | 'none';

/** Status derived from the engines of a single tab. */
export interface CliPanelTabStatus {
    executionState: CliPanelExecutionState;
    lastCommand: { name: string; success: boolean } | null;
    notification: CliNotification | null;
}

/** Status derived from the first engine of the active tab. */
export interface CliPanelGlobalStatus {
    serviceCount: { running: number; total: number };
    serviceDetails: CliPanelServiceDetail[];
    serverState: CliPanelServerState;
    serverDetails: CliPanelServerDetail[];
    /** Milliseconds since the engine started, 0 when unknown. */
    uptime: number;
}

export const DEFAULT_TAB_STATUS: CliPanelTabStatus = Object.freeze({
    executionState: 'idle',
    lastCommand: null,
    notification: null,
}) as CliPanelTabStatus;

export const DEFAULT_GLOBAL_STATUS: CliPanelGlobalStatus = Object.freeze({
    serviceCount: { running: 0, total: 0 },
    serviceDetails: [],
    serverState: 'none',
    serverDetails: [],
    uptime: 0,
}) as CliPanelGlobalStatus;

/**
 * Values a host may control from the outside. A defined value wins over the
 * panel's own state; `undefined` leaves the panel uncontrolled for that field.
 */
export interface CliPanelControlledState {
    collapsed?: boolean;
    hidden?: boolean;
    maximized?: boolean;
    activeTabId?: number;
    position?: CliPanelPosition;
    height?: number;
    width?: number;
}

/** Change notifications and structural events, mapped by each framework wrapper. */
export interface CliPanelCallbacks {
    onCollapsedChange?: (collapsed: boolean) => void;
    onHiddenChange?: (hidden: boolean) => void;
    onMaximizedChange?: (maximized: boolean) => void;
    onActiveTabIdChange?: (tabId: number) => void;
    onPositionChange?: (position: CliPanelPosition) => void;
    onHeightChange?: (height: number) => void;
    onWidthChange?: (width: number) => void;
    onClose?: () => void;
    onTabAdded?: (event: { tabId: number }) => void;
    onTabClosed?: (event: { tabId: number }) => void;
    onPaneSplit?: (event: { paneId: number; tabId: number }) => void;
    onPaneClosed?: (event: { paneId: number }) => void;
}

export interface CliPanelViewport {
    width: number;
    height: number;
}

export interface CliPanelControllerOptions {
    /** Panel configuration (initial state, chrome buttons, theme sync). */
    config?: CliPanelConfig;
    callbacks?: CliPanelCallbacks;
    controlled?: CliPanelControlledState;
    /** Viewport size used for maximize and resize clamping. Defaults to `window`. */
    viewport?: () => CliPanelViewport;
    /**
     * Restore and persist the position through localStorage.
     * @default true
     */
    persistPosition?: boolean;
}

/**
 * Immutable view of the whole panel. A new object is produced on every
 * change, so views can compare by reference.
 */
export interface CliPanelSnapshot {
    // ── Chrome ──
    visible: boolean;
    /** True once the first tab has been created (content rendered). */
    initialized: boolean;
    collapsed: boolean;
    hidden: boolean;
    maximized: boolean;
    position: CliPanelPosition;
    height: number;
    width: number;
    isHorizontal: boolean;
    /** Status text is shown in the header for top/bottom, compact dots otherwise. */
    showStatusIndicators: boolean;
    panelResizing: boolean;
    themeStyles: Record<string, string>;

    // ── Config ──
    closable: boolean;
    resizable: boolean;
    hideable: boolean;
    hideAlignment: CliPanelHideAlignment;
    syncTheme: boolean;

    // ── Tabs & panes ──
    tabs: readonly CliPanelTab[];
    activeTabId: number;
    activePaneId: number;
    paneResizing: boolean;

    // ── Menus ──
    contextMenu: CliPanelContextMenu;
    positionDropdownOpen: boolean;
    servicesDropdownOpen: boolean;
    servicesDropdownStyle: Record<string, string>;
    serversDropdownOpen: boolean;
    serversDropdownStyle: Record<string, string>;

    // ── Status ──
    /** Status of the active tab. */
    status: CliPanelTabStatus;
    tabStatuses: Readonly<Record<number, CliPanelTabStatus>>;
    global: CliPanelGlobalStatus;
    formattedUptime: string;
}
