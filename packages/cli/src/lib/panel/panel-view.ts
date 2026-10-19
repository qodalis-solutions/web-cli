import { CliPanelPosition } from '@qodalis/cli-core';
import { CliPanelController } from './cli-panel-controller';
import { PANEL_POSITIONS } from './panel-geometry';
import { CliPanelSnapshot, CliPanelTab, CliPanelTabStatus } from './panel-types';

/**
 * View helpers shared by the React, Vue and Angular panels: class names,
 * inline styles, labels and the lists the header and menus are built from.
 */

export const PANEL_LABELS = {
    title: 'CLI',
    showCli: 'Show CLI',
    movePanel: 'Move panel',
    hide: 'Hide',
    maximize: 'Maximize',
    restore: 'Restore',
    expand: 'Expand',
    collapse: 'Collapse',
    close: 'Close',
    newTerminal: 'New terminal',
    closeTab: 'Close tab',
    closePane: 'Close pane',
    servicesHeader: 'Background Services',
    servicesEmpty: 'No services registered',
    serversHeader: 'Server Connections',
    serversEmpty: 'No servers configured',
} as const;

export const SERVICES_ICON = '⚙';
export const UPTIME_ICON = '↑';
export const SUCCESS_ICON = '✓';
export const ERROR_ICON = '✗';
export const CLOSE_GLYPH = '×';

export function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ─── Class names ───────────────────────────────────────────── */

export function joinClasses(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}

export function panelWrapperClass(s: CliPanelSnapshot, extra?: string): string {
    return joinClasses('cli-panel-wrapper', s.collapsed && 'collapsed', s.maximized && 'maximized', s.panelResizing && 'resizing', extra);
}

export function panelTabClass(s: CliPanelSnapshot, tab: CliPanelTab): string {
    return joinClasses('cli-panel-tab', tab.id === s.activeTabId && 'active');
}

/** Activity dot of a tab: running, last command failed, or idle. */
export function tabDotClass(status: CliPanelTabStatus | undefined): string {
    if (status?.executionState === 'running') return 'dot-running';
    if (status?.lastCommand && !status.lastCommand.success) return 'dot-error';
    return 'dot-idle';
}

export function panelTabDotClass(s: CliPanelSnapshot, tab: CliPanelTab): string {
    return joinClasses('cli-panel-tab-dot', tabDotClass(s.tabStatuses[tab.id]));
}

export function panesContainerClass(s: CliPanelSnapshot): string {
    return joinClasses('cli-panel-panes-container', s.paneResizing && 'resizing');
}

export function paneClass(s: CliPanelSnapshot, tabId: number, paneId: number): string {
    return joinClasses('cli-panel-pane', paneId === s.activePaneId && tabId === s.activeTabId && 'active-pane');
}

export function glowLineClass(s: CliPanelSnapshot): string {
    return joinClasses('cli-panel-glow-line', s.status.executionState === 'running' && 'glow-active');
}

export function positionDropdownItemClass(s: CliPanelSnapshot, position: CliPanelPosition): string {
    return joinClasses('cli-panel-position-dropdown-item', s.position === position && 'active');
}

/* ─── Styles ────────────────────────────────────────────────── */

/** Size, visibility and theme variables of the panel wrapper. */
export function panelWrapperStyle(s: CliPanelSnapshot): Record<string, string> {
    const style: Record<string, string> = s.isHorizontal ? { width: `${s.width}px` } : { height: `${s.height}px` };
    if (s.hidden) style['display'] = 'none';
    return { ...style, ...s.themeStyles };
}

export function paneStyle(widthPercent: number): Record<string, string> {
    return { flex: `${widthPercent} 1 0` };
}

export function contextMenuStyle(s: CliPanelSnapshot): Record<string, string> {
    return { left: `${s.contextMenu.x}px`, top: `${s.contextMenu.y}px` };
}

/* ─── Header ────────────────────────────────────────────────── */

export interface PanelStatusIndicator {
    key: 'execution' | 'services' | 'lastCommand' | 'servers' | 'uptime' | 'notification';
    /** Extra classes on the full item (top/bottom positions). */
    itemClass: string;
    /** Extra classes on the compact item (left/right positions). */
    compactClass: string;
    /** Class of the leading dot, when the indicator shows a dot. */
    dotClass?: string;
    /** Glyph shown before the label, when the indicator shows an icon. */
    icon?: string;
    iconClass?: string;
    label: string;
    /** Tooltip of the compact variant. */
    title: string;
    /** Compact variant shows only this dot (notifications). */
    compactDotClass?: string;
    /** Which dropdown a click opens. */
    dropdown?: 'services' | 'servers';
}

/** Items of the header status bar, in display order. */
export function statusIndicators(s: CliPanelSnapshot): PanelStatusIndicator[] {
    const items: PanelStatusIndicator[] = [];
    const running = s.status.executionState === 'running';
    items.push({
        key: 'execution',
        itemClass: running ? 'status-running' : '',
        compactClass: '',
        dotClass: running ? 'dot-running' : 'dot-idle',
        label: s.status.executionState,
        title: s.status.executionState,
    });

    if (s.global.serviceCount.total > 0) {
        const label = `${s.global.serviceCount.running}/${s.global.serviceCount.total} services`;
        items.push({ key: 'services', itemClass: 'status-clickable', compactClass: 'status-clickable', icon: SERVICES_ICON, label, title: label, dropdown: 'services' });
    }

    if (s.status.lastCommand) {
        const ok = s.status.lastCommand.success;
        items.push({
            key: 'lastCommand',
            itemClass: '',
            compactClass: '',
            icon: ok ? SUCCESS_ICON : ERROR_ICON,
            iconClass: ok ? 'status-success' : 'status-error',
            label: s.status.lastCommand.name,
            title: `${ok ? SUCCESS_ICON : ERROR_ICON} ${s.status.lastCommand.name}`,
        });
    }

    if (s.global.serverState !== 'none') {
        const connected = s.global.serverDetails.filter((d) => d.connected).length;
        const label = `${connected}/${s.global.serverDetails.length} servers`;
        items.push({
            key: 'servers',
            itemClass: 'status-clickable',
            compactClass: 'status-clickable',
            dotClass: s.global.serverState === 'connected' ? 'dot-idle' : 'dot-error',
            label,
            title: label,
            dropdown: 'servers',
        });
    }

    if (s.global.uptime > 0) {
        items.push({ key: 'uptime', itemClass: 'status-muted', compactClass: 'status-muted', icon: UPTIME_ICON, label: s.formattedUptime, title: s.formattedUptime });
    }

    if (s.status.notification) {
        items.push({
            key: 'notification',
            itemClass: `status-text level-${s.status.notification.level}`,
            compactClass: '',
            compactDotClass: `cli-panel-status-compact-dot level-${s.status.notification.level}`,
            label: s.status.notification.message,
            title: s.status.notification.message,
        });
    }
    return items;
}

export interface PanelPositionOption {
    position: CliPanelPosition;
    label: string;
    className: string;
}

export function positionOptions(s: CliPanelSnapshot): PanelPositionOption[] {
    return PANEL_POSITIONS.map((position) => ({
        position,
        label: capitalize(position),
        className: positionDropdownItemClass(s, position),
    }));
}

/* ─── Context menu ──────────────────────────────────────────── */

export type PanelContextMenuAction =
    | 'rename'
    | 'duplicate'
    | 'split-right'
    | 'close'
    | 'close-others'
    | 'close-right'
    | 'close-all';

export interface PanelContextMenuItem {
    action: PanelContextMenuAction;
    label: string;
    disabled: boolean;
    destructive: boolean;
    /** Draw a separator above this item. */
    separatorBefore: boolean;
}

export function contextMenuItems(s: CliPanelSnapshot): PanelContextMenuItem[] {
    const single = s.tabs.length <= 1;
    return [
        { action: 'rename', label: 'Rename', disabled: false, destructive: false, separatorBefore: false },
        { action: 'duplicate', label: 'Duplicate', disabled: false, destructive: false, separatorBefore: false },
        { action: 'split-right', label: 'Split Right', disabled: false, destructive: false, separatorBefore: false },
        { action: 'close', label: 'Close', disabled: false, destructive: false, separatorBefore: true },
        { action: 'close-others', label: 'Close Others', disabled: single, destructive: false, separatorBefore: false },
        { action: 'close-right', label: 'Close to the Right', disabled: false, destructive: false, separatorBefore: false },
        { action: 'close-all', label: 'Close All', disabled: false, destructive: true, separatorBefore: true },
    ];
}

/** Run a context-menu action against the tab the menu was opened for. */
export function runContextMenuAction(controller: CliPanelController, action: PanelContextMenuAction): void {
    const tabId = controller.getSnapshot().contextMenu.tabId;
    controller.closeContextMenu();
    switch (action) {
        case 'rename':
            controller.startRename(tabId);
            break;
        case 'duplicate':
            controller.duplicateTab(tabId);
            break;
        case 'split-right':
            controller.splitPane(tabId);
            break;
        case 'close':
            controller.closeTab(tabId);
            break;
        case 'close-others':
            controller.closeOtherTabs(tabId);
            break;
        case 'close-right':
            controller.closeTabsToTheRight(tabId);
            break;
        case 'close-all':
            controller.closeAllTabs();
            break;
    }
}

/* ─── Input handlers ────────────────────────────────────────── */

/** Enter commits, Escape cancels an inline tab rename. */
export function handleRenameKey(controller: CliPanelController, tabId: number, key: string, value: string): void {
    if (key === 'Enter') controller.commitRename(tabId, value);
    else if (key === 'Escape') controller.cancelRename();
}

/** Width of the panes container the divider belongs to, for drag math. */
export function panesContainerWidth(target: EventTarget | null): number {
    const container = (target as Element | null)?.closest?.('.cli-panel-panes-container');
    return container ? container.clientWidth : 1;
}

/* ─── Status dropdowns ──────────────────────────────────────── */

export interface PanelDropdownRow {
    key: string;
    dotClass: string;
    name: string;
    description?: string;
    status: string;
    /** Extra lines under the status (servers: API version, command count). */
    meta: string[];
}

export interface PanelStatusDropdown {
    kind: 'services' | 'servers';
    header: string;
    emptyText: string;
    style: Record<string, string>;
    rows: PanelDropdownRow[];
}

/** The open services or servers dropdown, or null when neither is open. */
export function openStatusDropdown(s: CliPanelSnapshot): PanelStatusDropdown | null {
    if (s.servicesDropdownOpen && s.global.serviceCount.total > 0) {
        return {
            kind: 'services',
            header: PANEL_LABELS.servicesHeader,
            emptyText: PANEL_LABELS.servicesEmpty,
            style: s.servicesDropdownStyle,
            rows: s.global.serviceDetails.map((svc, i) => ({
                key: `${i}-${svc.name}`,
                dotClass: joinClasses('cli-panel-svc-dot', svc.status === 'running' ? 'svc-running' : 'svc-stopped'),
                name: svc.name,
                description: svc.description,
                status: svc.status,
                meta: [],
            })),
        };
    }
    if (s.serversDropdownOpen && s.global.serverState !== 'none') {
        return {
            kind: 'servers',
            header: PANEL_LABELS.serversHeader,
            emptyText: PANEL_LABELS.serversEmpty,
            style: s.serversDropdownStyle,
            rows: s.global.serverDetails.map((srv, i) => ({
                key: `${i}-${srv.name}`,
                dotClass: joinClasses('cli-panel-svc-dot', srv.connected ? 'svc-running' : 'svc-stopped'),
                name: srv.name,
                description: srv.url || undefined,
                status: srv.connected ? 'connected' : 'disconnected',
                meta: [srv.apiVersion ? `v${srv.apiVersion}` : '', srv.commandCount ? `${srv.commandCount} cmds` : ''].filter(Boolean),
            })),
        };
    }
    return null;
}
