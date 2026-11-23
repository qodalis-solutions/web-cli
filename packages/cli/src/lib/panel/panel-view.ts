import {
    CliOptions,
    CliPanelCustomColors,
    CliPanelPosition,
    DefaultThemes,
    PANEL_CUSTOM_COLOR_KEYS,
    PANEL_CUSTOM_THEME,
    PANEL_THEME_MODES,
} from '@qodalis/cli-core';
import { CliPanelController } from './cli-panel-controller';
import { PANEL_POSITIONS } from './panel-geometry';
import {
    CLOSE_ICON,
    HIDE_ICON,
    KEYBOARD_ICON,
    MAXIMIZE_ICON,
    RESTORE_ICON,
    SvgIcon,
    expandChevronIcon,
    positionIcon,
    themeIcon,
} from './panel-icons';
import { CLI_SEND_KEYS, CliSendKey } from '../keys';
import { CliPanelSnapshot, CliPanelTab, CliPanelTabStatus } from './panel-types';

/**
 * View helpers shared by the React, Vue and Angular panels: class names,
 * inline styles, labels and the lists the header and menus are built from.
 */

export const PANEL_LABELS = {
    title: 'CLI',
    showCli: 'Show CLI',
    movePanel: 'Move panel',
    moreActions: 'More actions',
    position: 'Position',
    theme: 'Theme',
    changeTheme: 'Change theme',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeCustom: 'Custom',
    customBackground: 'Background',
    customForeground: 'Text',
    customAccent: 'Accent',
    moreThemes: 'More themes',
    sendKey: 'Send key',
    ctrlHeld: 'Ctrl is held for the next key',
    keys: 'Keys',
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
    stopService: 'Stop',
    stopCommand: 'Stop',
    stopCommandTitle: 'Stop the running command (Ctrl+C)',
    serversHeader: 'Server Connections',
    serversEmpty: 'No servers configured',
} as const;

/**
 * The panel's title and icon: the host's branding (`options.branding`), or
 * "CLI" with the terminal glyph (`iconUrl` unset).
 */
export function panelBranding(options?: CliOptions): { title: string; iconUrl?: string } {
    const name = options?.branding?.name?.trim();
    const icon = options?.branding?.icon?.trim();
    return { title: name || PANEL_LABELS.title, iconUrl: icon || undefined };
}

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
    return joinClasses(
        'cli-panel-wrapper',
        s.collapsed && 'collapsed',
        s.maximized && 'maximized',
        s.panelResizing && 'resizing',
        s.compactHeader && 'compact-header',
        // "Ctrl + key": the Send key button (or the ⋮) shows that the next letter gets Ctrl
        s.ctrlModifier !== 'off' && 'ctrl-held',
        extra,
    );
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

    // The stylesheet places the panel above the on-screen keyboard (or the host's
    // --cli-panel-bottom-offset) and caps it to the visible area, so the header stays reachable
    if (s.keyboardInset > 0) style['--cli-panel-keyboard-inset'] = `${s.keyboardInset}px`;
    if (s.visibleHeight > 0) style['--cli-panel-visible-height'] = `${s.visibleHeight}px`;

    if (s.hidden) style['display'] = 'none';
    return { ...style, ...s.themeStyles };
}

export function paneStyle(widthPercent: number): Record<string, string> {
    return { flex: `${widthPercent} 1 0` };
}

/** Menus render outside the panel element, so they carry the theme's variables themselves. */
export function contextMenuStyle(s: CliPanelSnapshot): Record<string, string> {
    return { ...s.themeStyles, left: `${s.contextMenu.x}px`, top: `${s.contextMenu.y}px` };
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
    /** Stop button of the running command (`controller.stopCommand()`); the compact item stops it on click. */
    stop?: { label: string; title: string };
}

/** Items of the header status bar, in display order. */
export function statusIndicators(s: CliPanelSnapshot): PanelStatusIndicator[] {
    const items: PanelStatusIndicator[] = [];
    const running = s.status.executionState === 'running';
    items.push({
        key: 'execution',
        itemClass: running ? 'status-running' : '',
        compactClass: running ? 'status-clickable' : '',
        dotClass: running ? 'dot-running' : 'dot-idle',
        label: s.status.executionState,
        title: running ? PANEL_LABELS.stopCommandTitle : s.status.executionState,
        stop: running ? { label: PANEL_LABELS.stopCommand, title: PANEL_LABELS.stopCommandTitle } : undefined,
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

/* ─── Theme picker ──────────────────────────────────────────── */

/**
 * Terminal themes listed under "More themes": `default` and `light` are the
 * Dark and Light choices, and an alias (`yellow`) is listed under its first name.
 */
export const PANEL_TERMINAL_THEMES: readonly string[] = Object.keys(DefaultThemes).filter(
    (name, i, names) =>
        name !== 'default' && name !== 'light' && names.findIndex((other) => DefaultThemes[other] === DefaultThemes[name]) === i,
);

/** "Auto", "Solarized Dark": the label of a theme picker choice. */
export function themeLabel(theme: string): string {
    if (theme === 'auto') return PANEL_LABELS.themeAuto;
    if (theme === 'light') return PANEL_LABELS.themeLight;
    if (theme === 'dark') return PANEL_LABELS.themeDark;
    if (theme === PANEL_CUSTOM_THEME) return PANEL_LABELS.themeCustom;
    return capitalize(theme.replace(/([a-z0-9])([A-Z])/g, '$1 $2'));
}

export interface PanelThemeOption {
    /** Unique key (`theme-<name>`, `theme-color-<color>`, or `theme-list` for the "More themes" row). */
    key: string;
    /** The theme a click picks; absent on the "More themes" row, which opens the list, and on color rows. */
    theme?: string;
    /** A color of the Custom choice: the row is a color picker (`<input type="color">`). */
    color?: { key: keyof CliPanelCustomColors; value: string };
    label: string;
    icon: SvgIcon;
    /** The panel's current theme. */
    checked: boolean;
    /** The "More themes" row: whether the list is open (`aria-expanded`). */
    expanded?: boolean;
    /** Draw a separator above this row. */
    separatorBefore: boolean;
    /** Class of the row in the header's theme dropdown. */
    className: string;
}

const CUSTOM_COLOR_LABELS: Record<keyof CliPanelCustomColors, string> = {
    background: PANEL_LABELS.customBackground,
    foreground: PANEL_LABELS.customForeground,
    accent: PANEL_LABELS.customAccent,
};

/**
 * Rows of the theme picker: Auto, Light, Dark, Custom (followed by its color
 * pickers while it is the choice), then "More themes" and, once opened, the
 * terminal themes (the list of `theme list`).
 */
export function themeOptions(s: CliPanelSnapshot): PanelThemeOption[] {
    const option = (theme: string): PanelThemeOption => ({
        key: `theme-${theme}`,
        theme,
        label: themeLabel(theme),
        icon: themeIcon(theme),
        checked: s.themeChoice === theme,
        separatorBefore: false,
        className: joinClasses('cli-panel-theme-dropdown-item', s.themeChoice === theme && 'active'),
    });
    const options = PANEL_THEME_MODES.map(option);
    if (s.themeChoice === PANEL_CUSTOM_THEME) {
        options.push(
            ...PANEL_CUSTOM_COLOR_KEYS.map((key) => ({
                key: `theme-color-${key}`,
                color: { key, value: s.customColors[key] },
                label: CUSTOM_COLOR_LABELS[key],
                icon: themeIcon(PANEL_CUSTOM_THEME),
                checked: false,
                separatorBefore: false,
                className: 'cli-panel-theme-dropdown-color',
            })),
        );
    }
    options.push({
        key: 'theme-list',
        label: PANEL_LABELS.moreThemes,
        icon: expandChevronIcon(s.themeListOpen),
        checked: false,
        expanded: s.themeListOpen,
        separatorBefore: true,
        className: 'cli-panel-theme-dropdown-item',
    });
    if (s.themeListOpen) options.push(...PANEL_TERMINAL_THEMES.map(option));
    return options;
}

/** Run a row of the header's theme dropdown: pick its theme, or open/close the list. */
export function runThemeOption(controller: CliPanelController, option: PanelThemeOption): void {
    if (option.color) return;
    if (option.theme) controller.pickTheme(option.theme);
    else controller.toggleThemeList();
}

/** Value of a color picker's `input` event. */
export function colorInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
}

/* ─── Header ⋮ menu (compact header) ────────────────────────── */

export type PanelHeaderMenuAction = 'maximize' | 'position' | 'theme' | 'theme-color' | 'theme-list' | 'send-key' | 'hide' | 'close';

export interface PanelHeaderMenuItem {
    /** Unique key (the action, `position-<position>` or `theme-<theme>`). */
    key: string;
    action: PanelHeaderMenuAction;
    label: string;
    icon: SvgIcon;
    /** `menuitemradio` for the position and theme options, `menuitem` otherwise. */
    role: 'menuitem' | 'menuitemradio';
    /** The position an option moves the panel to. */
    position?: CliPanelPosition;
    /** The theme an option picks. */
    theme?: string;
    /** A color of the Custom theme: the item is a color picker (`<input type="color">`), not a button. */
    color?: { key: keyof CliPanelCustomColors; value: string };
    /** The panel's current position or theme (`aria-checked`). */
    checked?: boolean;
    /** The "More themes" row: whether the list is open (`aria-expanded`). */
    expanded?: boolean;
    disabled: boolean;
    destructive: boolean;
    /** Draw a separator above this item. */
    separatorBefore: boolean;
    /** Group label shown above this item (the position and theme options). */
    heading?: string;
}

/** Fixed position and theme variables of the ⋮ menu, rendered outside the panel. */
export function headerMenuStyle(s: CliPanelSnapshot): Record<string, string> {
    return { ...s.themeStyles, ...s.headerMenuStyle };
}

/**
 * Items of the ⋮ menu that replaces the action buttons on a narrow panel:
 * maximize/restore, the four positions, the theme picker (unless turned off),
 * Send key (unless turned off), hide (when hideable) and close (when
 * closable). Collapse/expand stays a button next to the ⋮.
 */
export function headerMenuItems(s: CliPanelSnapshot): PanelHeaderMenuItem[] {
    const items: PanelHeaderMenuItem[] = [
        {
            key: 'maximize',
            action: 'maximize',
            label: s.maximized ? PANEL_LABELS.restore : PANEL_LABELS.maximize,
            icon: s.maximized ? RESTORE_ICON : MAXIMIZE_ICON,
            role: 'menuitem',
            disabled: s.collapsed,
            destructive: false,
            separatorBefore: false,
        },
    ];
    PANEL_POSITIONS.forEach((position, i) => {
        items.push({
            key: `position-${position}`,
            action: 'position',
            label: capitalize(position),
            icon: positionIcon(position, 18),
            role: 'menuitemradio',
            position,
            checked: s.position === position,
            disabled: false,
            destructive: false,
            separatorBefore: i === 0,
            heading: i === 0 ? PANEL_LABELS.position : undefined,
        });
    });
    if (s.themePicker) {
        themeOptions(s).forEach((option, i) => {
            items.push({
                key: option.key,
                action: option.color ? 'theme-color' : option.theme ? 'theme' : 'theme-list',
                color: option.color,
                label: option.label,
                icon: option.icon,
                role: option.theme ? 'menuitemradio' : 'menuitem',
                theme: option.theme,
                checked: option.theme ? option.checked : undefined,
                expanded: option.expanded,
                disabled: false,
                destructive: false,
                separatorBefore: i === 0,
                heading: i === 0 ? PANEL_LABELS.theme : undefined,
            });
        });
    }
    if (s.sendKeys) {
        items.push({
            key: 'send-key',
            action: 'send-key',
            label: PANEL_LABELS.sendKey,
            icon: KEYBOARD_ICON,
            role: 'menuitem',
            disabled: false,
            destructive: false,
            separatorBefore: true,
        });
    }
    if (s.hideable) {
        items.push({ key: 'hide', action: 'hide', label: PANEL_LABELS.hide, icon: HIDE_ICON, role: 'menuitem', disabled: false, destructive: false, separatorBefore: true });
    }
    if (s.closable) {
        items.push({ key: 'close', action: 'close', label: PANEL_LABELS.close, icon: CLOSE_ICON, role: 'menuitem', disabled: false, destructive: true, separatorBefore: !s.hideable });
    }
    return items;
}

export function headerMenuItemClass(item: PanelHeaderMenuItem): string {
    if (item.color) return 'cli-panel-header-menu-color';
    return joinClasses('cli-panel-header-menu-item', item.checked && 'active', item.destructive && 'destructive');
}

/**
 * Run a ⋮ menu item; the menu closes, except for "More themes", which opens its
 * list in place, and Custom, which shows its color pickers.
 */
export function runHeaderMenuAction(controller: CliPanelController, item: PanelHeaderMenuItem): void {
    if (item.action === 'theme-color') return;
    if (item.action === 'send-key') {
        controller.openSendKeyMenuFromHeaderMenu();
        return;
    }
    if (item.action === 'theme-list') {
        controller.toggleThemeList();
        return;
    }
    if (item.action === 'theme' && item.theme === PANEL_CUSTOM_THEME) {
        controller.pickTheme(item.theme);
        return;
    }
    // The ⋮ button stays after maximize, position and theme changes: keyboard users continue from it
    controller.closeHeaderMenu(item.action === 'maximize' || item.action === 'position' || item.action === 'theme');
    switch (item.action) {
        case 'maximize':
            controller.toggleMaximize();
            break;
        case 'position':
            if (item.position) controller.setPosition(item.position);
            break;
        case 'theme':
            if (item.theme) controller.pickTheme(item.theme);
            break;
        case 'hide':
            controller.hide();
            break;
        case 'close':
            controller.close();
            break;
    }
}

/* ─── Send key (phones) ─────────────────────────────────────── */

export interface PanelSendKeyItem {
    /** Unique key. */
    id: string;
    /** `'Ctrl+C'`, or the button text of a command's key. */
    label: string;
    description: string;
    /** Group label shown above this item. */
    heading?: string;
    separatorBefore: boolean;
    send: CliSendKey | { data: string };
}

/** Fixed position and theme variables of the Send key menu, rendered outside the panel. */
export function sendKeyMenuStyle(s: CliPanelSnapshot): Record<string, string> {
    return { ...s.themeStyles, ...s.sendKeyMenuStyle };
}

/**
 * Items of the Send key menu: the keys of the full-screen command running
 * (an editor's Save and Exit), then the prompt's shortcuts and "Ctrl + key".
 */
export function sendKeyMenuItems(s: CliPanelSnapshot): PanelSendKeyItem[] {
    const items: PanelSendKeyItem[] = s.commandKeys.map((key, i) => ({
        id: `command-${i}`,
        label: key.key ?? key.label,
        description: key.description ?? key.label,
        heading: i === 0 ? s.commandName || undefined : undefined,
        separatorBefore: false,
        send: { data: key.data },
    }));
    const commandKeys = items.length > 0;
    CLI_SEND_KEYS.forEach((key, i) =>
        items.push({
            id: `key-${key.label}`,
            label: key.label,
            description: key.description,
            heading: i === 0 && commandKeys ? PANEL_LABELS.keys : undefined,
            separatorBefore: i === 0 && commandKeys,
            send: key,
        }),
    );
    return items;
}

/** Send an item of the Send key menu; the pointer press must not take the focus from the terminal. */
export function runSendKeyItem(controller: CliPanelController, item: PanelSendKeyItem): void {
    controller.sendKey(item.send);
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
    /** Stop button of a running service (`controller.killProcess(pid)`); absent for stopped services and servers. */
    stop?: { pid: number; label: string; title: string };
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
            style: { ...s.themeStyles, ...s.servicesDropdownStyle },
            rows: s.global.serviceDetails.map((svc, i) => ({
                key: `${i}-${svc.name}`,
                dotClass: joinClasses('cli-panel-svc-dot', svc.status === 'running' ? 'svc-running' : 'svc-stopped'),
                name: svc.name,
                description: svc.description,
                status: svc.status,
                meta: [],
                stop:
                    svc.status === 'running' && svc.pid !== undefined
                        ? { pid: svc.pid, label: PANEL_LABELS.stopService, title: `${PANEL_LABELS.stopService} ${svc.name} (kill ${svc.pid})` }
                        : undefined,
            })),
        };
    }
    if (s.serversDropdownOpen && s.global.serverState !== 'none') {
        return {
            kind: 'servers',
            header: PANEL_LABELS.serversHeader,
            emptyText: PANEL_LABELS.serversEmpty,
            style: { ...s.themeStyles, ...s.serversDropdownStyle },
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
