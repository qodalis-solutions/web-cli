import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ICliCommandProcessor, ICliModule, CliPanelConfig, CliEngineSnapshot, derivePanelThemeStyles, loadPanelPosition, savePanelPosition, CliPanelPosition } from '@qodalis/cli-core';
import { CliEngineOptions, CliEngine } from '@qodalis/cli';
import { Cli } from './Cli';
import { CliContext } from './CliContext';
import { useCliConfig } from './CliConfigContext';

export interface CliPanelOptions extends CliEngineOptions, CliPanelConfig {}

export interface CliPanelProps {
    options?: CliPanelOptions;
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    services?: Record<string, any>;
    onClose?: () => void;
    style?: React.CSSProperties;
    className?: string;
}

interface TerminalPane {
    id: number;
    widthPercent: number;
    snapshot?: CliEngineSnapshot;
}

interface TerminalTab {
    id: number;
    title: string;
    isEditing: boolean;
    panes: TerminalPane[];
}

interface TabContextMenu {
    visible: boolean;
    x: number;
    y: number;
    tabId: number;
}

const MIN_PANE_WIDTH_PERCENT = 10;

/* ─── SVG icons ──────────────────────────────────────────── */

const TerminalIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
);

const MaximizeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

const RestoreIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="14" y1="10" x2="21" y2="3" />
        <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
);

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const HideIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="18" x2="19" y2="18" />
        <polyline points="9 14 12 17 15 14" />
    </svg>
);

function CollapseChevron({ position, isCollapsed }: { position: string; isCollapsed: boolean }) {
    let points: string;
    switch (position) {
        case 'top':
            points = isCollapsed ? '6 9 12 15 18 9' : '18 15 12 9 6 15';
            break;
        case 'left':
            points = isCollapsed ? '9 18 15 12 9 6' : '15 6 9 12 15 18';
            break;
        case 'right':
            points = isCollapsed ? '15 6 9 12 15 18' : '9 18 15 12 9 6';
            break;
        default: // bottom
            points = isCollapsed ? '18 15 12 9 6 15' : '6 9 12 15 18 9';
            break;
    }
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={points} />
        </svg>
    );
}

function HideTabChevron({ position }: { position: string }) {
    let points: string;
    switch (position) {
        case 'top': points = '6 9 12 15 18 9'; break;
        case 'left': points = '9 18 15 12 9 6'; break;
        case 'right': points = '15 6 9 12 15 18'; break;
        default: points = '18 15 12 9 6 15'; break; // bottom: up
    }
    return (
        <svg className="cli-panel-hide-tab-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={points} />
        </svg>
    );
}

function PositionIcon({ position, size = 20 }: { position: string; size?: number }) {
    let fillRect: React.ReactElement;
    switch (position) {
        case 'top':
            fillRect = <rect x="4" y="4" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        case 'left':
            fillRect = <rect x="4" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        case 'right':
            fillRect = <rect x="15" y="4" width="5" height="16" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
        default: // bottom
            fillRect = <rect x="4" y="15" width="16" height="5" rx="1" fill="currentColor" stroke="none" opacity="0.5" />;
            break;
    }
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            {fillRect}
        </svg>
    );
}

/* ─── Component ──────────────────────────────────────────── */

export function CliPanel({ options: optionsProp, modules: modulesProp, processors: processorsProp, services: servicesProp, onClose, style, className }: CliPanelProps) {
    const config = useCliConfig();
    const options = optionsProp ?? config.options as CliPanelOptions | undefined;
    const modules = modulesProp ?? config.modules;
    const processors = processorsProp ?? config.processors;
    const services = servicesProp ?? config.services;

    const [position, setPosition] = useState<CliPanelPosition>(
        () => loadPanelPosition() ?? options?.position ?? 'bottom'
    );
    const closable = options?.closable ?? true;
    const resizable = options?.resizable ?? true;
    const isHorizontal = position === 'left' || position === 'right';
    const hideable = options?.hideable ?? true;
    const hideAlignment = options?.hideAlignment ?? 'center';
    const syncTheme = options?.syncTheme ?? false;

    const [visible, setVisible] = useState(true);
    const [collapsed, setCollapsed] = useState(options?.isCollapsed ?? true);
    const [maximized, setMaximized] = useState(false);
    const [panelHeight, setPanelHeight] = useState(600);
    const [panelWidth, setPanelWidth] = useState(400);
    const [initialized, setInitialized] = useState(false);
    const [hidden, setHidden] = useState(options?.isHidden ?? false);
    const preHideCollapsedRef = useRef(true);
    const [themeStyles, setThemeStyles] = useState<Record<string, string>>({});
    const wrapperRef = useRef<HTMLDivElement>(null);

    const [tabs, setTabs] = useState<TerminalTab[]>([]);
    const [activeTabId, setActiveTabId] = useState(0);
    const [activePaneId, setActivePaneId] = useState(0);
    const nextIdRef = useRef({ tab: 1, pane: 1 });

    const [contextMenu, setContextMenu] = useState<TabContextMenu>({ visible: false, x: 0, y: 0, tabId: 0 });
    const engineMapRef = useRef<Map<number, CliEngine>>(new Map());

    // Pane resize state
    const [paneResizing, setPaneResizing] = useState(false);
    const paneResizeRef = useRef({ tabId: 0, dividerIndex: 0, startX: 0, startWidths: [] as number[], containerWidth: 0 });

    // Panel resize state
    const [panelResizing, setPanelResizing] = useState(false);
    const panelResizeRef = useRef({ startY: 0, startHeight: 0, startX: 0, startWidth: 0 });
    const prevHeightRef = useRef(600);
    const prevWidthRef = useRef(400);

    // Terminal height is handled via CSS flex layout (height: 100% default in Cli)

    /* ─── Tab management ─────────────────────────────────── */

    const addTab = useCallback(() => {
        const paneId = nextIdRef.current.pane++;
        const tabId = nextIdRef.current.tab++;
        const pane: TerminalPane = { id: paneId, widthPercent: 100 };
        const tab: TerminalTab = { id: tabId, title: `Terminal ${tabId}`, isEditing: false, panes: [pane] };
        setTabs(prev => [...prev, tab]);
        setActiveTabId(tabId);
        setActivePaneId(paneId);
    }, []);

    const toggle = useCallback(() => {
        setCollapsed(prev => {
            const next = !prev;
            if (!next && !initialized) {
                setInitialized(true);
                // Add first tab
                const paneId = nextIdRef.current.pane++;
                const tabId = nextIdRef.current.tab++;
                const pane: TerminalPane = { id: paneId, widthPercent: 100 };
                const tab: TerminalTab = { id: tabId, title: `Terminal ${tabId}`, isEditing: false, panes: [pane] };
                setTabs([tab]);
                setActiveTabId(tabId);
                setActivePaneId(paneId);
            }
            return next;
        });
    }, [initialized]);

    const closeTab = useCallback((id: number) => {
        setTabs(prev => {
            const tab = prev.find(t => t.id === id);
            if (tab) {
                tab.panes.forEach(p => engineMapRef.current.delete(p.id));
            }
            const next = prev.filter(t => t.id !== id);
            if (next.length === 0) {
                setInitialized(false);
                setCollapsed(true);
                return [];
            }
            setActiveTabId(current => {
                if (current === id) {
                    const oldIdx = prev.findIndex(t => t.id === id);
                    const newIdx = Math.min(oldIdx, next.length - 1);
                    return next[newIdx].id;
                }
                return current;
            });
            return next;
        });
    }, []);

    const selectTab = useCallback((id: number) => {
        setActiveTabId(id);
        setTabs(prev => {
            const tab = prev.find(t => t.id === id);
            if (tab && tab.panes.length > 0) {
                setActivePaneId(tab.panes[0].id);
            }
            return prev;
        });
    }, []);

    /* ─── Split / close pane ─────────────────────────────── */

    const normalizePanes = (panes: TerminalPane[]) => {
        const total = panes.reduce((s, p) => s + p.widthPercent, 0);
        if (total === 0) return;
        const scale = 100 / total;
        panes.forEach(p => { p.widthPercent *= scale; });
    };

    const splitRight = useCallback((tabId?: number, afterPaneId?: number) => {
        setTabs(prev => {
            const next = prev.map(t => ({ ...t, panes: t.panes.map(p => ({ ...p })) }));
            const tab = next.find(t => t.id === (tabId ?? activeTabId));
            if (!tab) return prev;

            const targetPaneId = afterPaneId ?? activePaneId;
            const idx = tab.panes.findIndex(p => p.id === targetPaneId);
            const insertIdx = idx === -1 ? tab.panes.length : idx + 1;

            const newPaneId = nextIdRef.current.pane++;
            const newPane: TerminalPane = { id: newPaneId, widthPercent: 0 };
            tab.panes.splice(insertIdx, 0, newPane);

            const evenWidth = 100 / tab.panes.length;
            tab.panes.forEach(p => { p.widthPercent = evenWidth; });
            normalizePanes(tab.panes);

            setActivePaneId(newPaneId);
            return next;
        });
    }, [activeTabId, activePaneId]);

    const closePane = useCallback((tabId: number, paneId: number) => {
        setTabs(prev => {
            const tab = prev.find(t => t.id === tabId);
            if (!tab) return prev;

            if (tab.panes.length <= 1) {
                const next = prev.filter(t => t.id !== tabId);
                if (next.length === 0) {
                    setInitialized(false);
                    setCollapsed(true);
                    return [];
                }
                return next;
            }

            const next = prev.map(t => ({ ...t, panes: t.panes.map(p => ({ ...p })) }));
            const updatedTab = next.find(t => t.id === tabId)!;
            const idx = updatedTab.panes.findIndex(p => p.id === paneId);
            if (idx === -1) return prev;

            updatedTab.panes.splice(idx, 1);
            const totalRemaining = updatedTab.panes.reduce((s, p) => s + p.widthPercent, 0);
            if (totalRemaining > 0) {
                updatedTab.panes.forEach(p => { p.widthPercent = (p.widthPercent / totalRemaining) * 100; });
            }
            normalizePanes(updatedTab.panes);

            setActivePaneId(curr => {
                if (curr === paneId) {
                    const newIdx = Math.min(idx, updatedTab.panes.length - 1);
                    return updatedTab.panes[newIdx].id;
                }
                return curr;
            });
            return next;
        });
    }, []);

    /* ─── Rename ─────────────────────────────────────────── */

    const startRename = useCallback((tabId: number) => {
        setTabs(prev => prev.map(t => ({ ...t, isEditing: t.id === tabId })));
    }, []);

    const commitRename = useCallback((tabId: number, value: string) => {
        const trimmed = value.trim();
        setTabs(prev => prev.map(t =>
            t.id === tabId ? { ...t, title: trimmed || t.title, isEditing: false } : t,
        ));
    }, []);

    /* ─── Context menu ───────────────────────────────────── */

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    useEffect(() => {
        if (!contextMenu.visible) return;
        const handler = () => closeContextMenu();
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [contextMenu.visible, closeContextMenu]);

    /* ─── Panel resize ───────────────────────────────────── */

    const onPanelResizeStart = useCallback((e: React.MouseEvent) => {
        if (!resizable) return;
        e.preventDefault();
        if (collapsed) {
            toggle();
        }
        setPanelResizing(true);
        panelResizeRef.current = {
            startY: e.clientY,
            startHeight: panelHeight,
            startX: e.clientX,
            startWidth: panelWidth,
        };
    }, [collapsed, toggle, panelHeight, panelWidth, resizable]);

    useEffect(() => {
        if (!panelResizing) return;
        const onMove = (e: MouseEvent) => {
            if (isHorizontal) {
                const deltaX = position === 'left'
                    ? e.clientX - panelResizeRef.current.startX
                    : panelResizeRef.current.startX - e.clientX;
                let next = Math.max(100, panelResizeRef.current.startWidth + deltaX);
                if (next > window.innerWidth) next = window.innerWidth;
                setPanelWidth(next);
            } else {
                const deltaY = position === 'top'
                    ? e.clientY - panelResizeRef.current.startY
                    : panelResizeRef.current.startY - e.clientY;
                let next = Math.max(100, panelResizeRef.current.startHeight + deltaY);
                if (next > window.innerHeight) next = window.innerHeight;
                setPanelHeight(next);
            }
        };
        const onUp = () => setPanelResizing(false);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    }, [panelResizing, isHorizontal, position]);

    /* ─── Pane resize ────────────────────────────────────── */

    const onPaneResizeStart = useCallback((e: React.MouseEvent, tabId: number, dividerIndex: number) => {
        e.preventDefault();
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;
        setPaneResizing(true);
        const container = (e.target as HTMLElement).closest('.cli-panel-panes-container');
        paneResizeRef.current = {
            tabId,
            dividerIndex,
            startX: e.clientX,
            startWidths: tab.panes.map(p => p.widthPercent),
            containerWidth: container ? container.clientWidth : 1,
        };
    }, [tabs]);

    useEffect(() => {
        if (!paneResizing) return;
        const onMove = (e: MouseEvent) => {
            const ref = paneResizeRef.current;
            const deltaX = e.clientX - ref.startX;
            const deltaPct = (deltaX / ref.containerWidth) * 100;
            const i = ref.dividerIndex;

            let leftWidth = ref.startWidths[i] + deltaPct;
            let rightWidth = ref.startWidths[i + 1] - deltaPct;

            if (leftWidth < MIN_PANE_WIDTH_PERCENT) {
                leftWidth = MIN_PANE_WIDTH_PERCENT;
                rightWidth = ref.startWidths[i] + ref.startWidths[i + 1] - MIN_PANE_WIDTH_PERCENT;
            }
            if (rightWidth < MIN_PANE_WIDTH_PERCENT) {
                rightWidth = MIN_PANE_WIDTH_PERCENT;
                leftWidth = ref.startWidths[i] + ref.startWidths[i + 1] - MIN_PANE_WIDTH_PERCENT;
            }

            setTabs(prev => {
                const next = prev.map(t => ({ ...t, panes: t.panes.map(p => ({ ...p })) }));
                const tab = next.find(t => t.id === ref.tabId);
                if (tab) {
                    tab.panes[i].widthPercent = leftWidth;
                    tab.panes[i + 1].widthPercent = rightWidth;
                }
                return next;
            });
        };
        const onUp = () => {
            setPaneResizing(false);
            document.body.classList.remove('cli-pane-resizing');
        };
        document.body.classList.add('cli-pane-resizing');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    }, [paneResizing]);

    /* ─── Theme sync ──────────────────────────────────────── */

    useEffect(() => {
        if (!syncTheme || !initialized) return;

        const syncFromEngine = () => {
            const engine = engineMapRef.current.values().next().value;
            if (!engine) return;
            const theme = engine.getTerminal().options.theme;
            if (theme) setThemeStyles(derivePanelThemeStyles(theme));
        };

        // Initial sync after terminals render
        const timer = setTimeout(() => {
            syncFromEngine();

            const container = wrapperRef.current?.querySelector('.terminal-container');
            if (!container) return;

            const observer = new MutationObserver(syncFromEngine);
            observer.observe(container, { attributes: true, attributeFilter: ['style'] });

            return () => observer.disconnect();
        }, 200);

        return () => clearTimeout(timer);
    }, [syncTheme, initialized]);

    /* ─── Maximize ───────────────────────────────────────── */

    const toggleMaximize = useCallback(() => {
        setMaximized(prev => {
            if (!prev) {
                if (isHorizontal) {
                    prevWidthRef.current = panelWidth;
                    setPanelWidth(window.innerWidth);
                } else {
                    prevHeightRef.current = panelHeight;
                    setPanelHeight(window.innerHeight);
                }
            } else {
                if (isHorizontal) {
                    setPanelWidth(prevWidthRef.current);
                } else {
                    setPanelHeight(prevHeightRef.current);
                }
            }
            return !prev;
        });
    }, [panelHeight, panelWidth, isHorizontal]);

    /* ─── Close handler ──────────────────────────────────── */

    const handleClose = useCallback(() => {
        setVisible(false);
        onClose?.();
    }, [onClose]);

    const handleHide = useCallback(() => {
        preHideCollapsedRef.current = collapsed;
        setHidden(true);
    }, [collapsed]);

    const handleUnhide = useCallback(() => {
        setHidden(false);
        setCollapsed(preHideCollapsedRef.current);
    }, []);

    const [positionDropdownOpen, setPositionDropdownOpen] = useState(false);

    const closePositionDropdown = useCallback(() => setPositionDropdownOpen(false), []);

    useEffect(() => {
        if (!positionDropdownOpen) return;
        document.addEventListener('click', closePositionDropdown);
        return () => document.removeEventListener('click', closePositionDropdown);
    }, [positionDropdownOpen, closePositionDropdown]);

    const handlePositionButtonClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setPositionDropdownOpen(prev => !prev);
    }, []);

    const selectPosition = useCallback((pos: CliPanelPosition) => {
        setPositionDropdownOpen(false);
        setPosition(pos);
        savePanelPosition(pos);
    }, []);

    /* ─── Render ─────────────────────────────────────────── */

    if (!visible) return null;

    const wrapperStyle: React.CSSProperties = {
        ...(isHorizontal ? { width: `${panelWidth}px` } : { height: `${panelHeight}px` }),
        ...(hidden ? { display: 'none' } : {}),
        ...themeStyles,
        ...style,
    } as React.CSSProperties;

    return (
        <>
            {/* Hide tab (shown when panel is hidden) */}
            {hidden && (
                <button
                    className="cli-panel-hide-tab"
                    data-position={position}
                    data-hide-align={hideAlignment}
                    style={themeStyles as React.CSSProperties}
                    title="Show CLI"
                    onClick={handleUnhide}
                >
                    <svg className="cli-panel-hide-tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                    <span className="cli-panel-hide-tab-label">CLI</span>
                    <HideTabChevron position={position} />
                </button>
            )}
            <div
                ref={wrapperRef}
                className={`cli-panel-wrapper ${collapsed ? 'collapsed' : ''} ${maximized ? 'maximized' : ''} ${panelResizing ? 'resizing' : ''} ${className ?? ''}`}
                style={wrapperStyle}
                data-position={position}
                data-resizable={String(resizable)}
                data-closable={String(closable)}
                data-hideable={String(hideable)}
            >
                {/* Header */}
                <div className="cli-panel-header">
                    <div className="cli-panel-resize-bar" onMouseDown={onPanelResizeStart}>
                        <div className="cli-panel-resize-grip" />
                    </div>
                    <div className="cli-panel-header-content">
                        <p className="cli-panel-title">
                            <span className="cli-panel-title-icon"><TerminalIcon /></span>
                            CLI
                        </p>
                        <div className="cli-panel-action-buttons">
                            <div className="cli-panel-btn-position-wrapper" onClick={e => e.stopPropagation()}>
                                <button className="cli-panel-btn cli-panel-btn-position" title="Move panel" onClick={handlePositionButtonClick}>
                                    <PositionIcon position={position} />
                                </button>
                                {positionDropdownOpen && (
                                    <div className="cli-panel-position-dropdown">
                                        {(['bottom', 'top', 'left', 'right'] as CliPanelPosition[]).map(pos => (
                                            <button
                                                key={pos}
                                                className={`cli-panel-position-dropdown-item${position === pos ? ' active' : ''}`}
                                                onClick={() => selectPosition(pos)}
                                            >
                                                <PositionIcon position={pos} size={16} />
                                                {pos.charAt(0).toUpperCase() + pos.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {hideable && (
                                <button className="cli-panel-btn cli-panel-btn-hide" title="Hide" onClick={handleHide}>
                                    <HideIcon />
                                </button>
                            )}
                            <button className="cli-panel-btn" title={maximized ? 'Restore' : 'Maximize'} disabled={collapsed} onClick={toggleMaximize}>
                                {maximized ? <RestoreIcon /> : <MaximizeIcon />}
                            </button>
                            <button className="cli-panel-btn" title={collapsed ? 'Expand' : 'Collapse'} onClick={toggle}>
                                <CollapseChevron position={position} isCollapsed={collapsed} />
                            </button>
                            {closable && (
                                <button className="cli-panel-btn cli-panel-btn-close" title="Close" onClick={handleClose}>
                                    <CloseIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content (kept in DOM to preserve terminal state) */}
                {initialized && (
                    <div className="cli-panel-content" style={collapsed ? { display: 'none' } : undefined}>
                        {/* Tab bar */}
                        <div className="cli-panel-tabs">
                            <ul className="cli-panel-tab-list">
                                {tabs.map(tab => (
                                    <li
                                        key={tab.id}
                                        className={`cli-panel-tab ${tab.id === activeTabId ? 'active' : ''}`}
                                        onClick={() => selectTab(tab.id)}
                                        onDoubleClick={() => startRename(tab.id)}
                                        onContextMenu={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, tabId: tab.id });
                                        }}
                                    >
                                        {tab.isEditing ? (
                                            <input
                                                className="cli-panel-tab-rename-input"
                                                type="text"
                                                defaultValue={tab.title}
                                                autoFocus
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') commitRename(tab.id, (e.target as HTMLInputElement).value);
                                                    else if (e.key === 'Escape') setTabs(prev => prev.map(t => ({ ...t, isEditing: false })));
                                                }}
                                                onBlur={e => commitRename(tab.id, e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                onDoubleClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <>
                                                <span className="cli-panel-tab-title">{tab.title}</span>
                                                <button
                                                    className="cli-panel-tab-close-btn"
                                                    title="Close tab"
                                                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                                >&times;</button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <button className="cli-panel-add-tab" title="New terminal" onClick={addTab}>+</button>
                        </div>

                        {/* Terminal instances */}
                        <div className="cli-panel-instances">
                            {tabs.map(tab => (
                                <div key={tab.id} className="cli-panel-instance" style={{ display: tab.id === activeTabId ? undefined : 'none' }}>
                                    <div className={`cli-panel-panes-container ${paneResizing ? 'resizing' : ''}`}>
                                        {tab.panes.map((pane, i) => (
                                            <React.Fragment key={pane.id}>
                                                {i > 0 && (
                                                    <div className="cli-panel-pane-divider" onMouseDown={e => onPaneResizeStart(e, tab.id, i - 1)}>
                                                        <div className="cli-panel-pane-divider-grip" />
                                                    </div>
                                                )}
                                                <div
                                                    className={`cli-panel-pane ${pane.id === activePaneId && tab.id === activeTabId ? 'active-pane' : ''}`}
                                                    style={{ flex: `${pane.widthPercent} 1 0` }}
                                                    onClick={() => { setActivePaneId(pane.id); setActiveTabId(tab.id); }}
                                                >
                                                    {tab.panes.length > 1 && (
                                                        <button
                                                            className="cli-panel-pane-close-btn"
                                                            onClick={e => { e.stopPropagation(); closePane(tab.id, pane.id); }}
                                                            title="Close pane"
                                                        >&times;</button>
                                                    )}
                                                    <CliContext.Provider value={{ engine: null }}>
                                                        <Cli
                                                            options={options}
                                                            modules={modules}
                                                            processors={processors}
                                                            services={services}
                                                            snapshot={pane.snapshot}
                                                            onReady={(engine) => engineMapRef.current.set(pane.id, engine)}
                                                        />
                                                    </CliContext.Provider>
                                                </div>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Context menu */}
            {contextMenu.visible && (
                <div
                    className="cli-panel-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="cli-panel-context-menu-item" onClick={() => { closeContextMenu(); startRename(contextMenu.tabId); }}>Rename</button>
                    <button className="cli-panel-context-menu-item" onClick={() => {
                        closeContextMenu();
                        const tab = tabs.find(t => t.id === contextMenu.tabId);
                        if (!tab) return;

                        const sourceEngine = engineMapRef.current.get(tab.panes[0]?.id);
                        const snapshot = sourceEngine?.snapshot();

                        const paneId = nextIdRef.current.pane++;
                        const tabId = nextIdRef.current.tab++;
                        const pane: TerminalPane = { id: paneId, widthPercent: 100, snapshot };
                        const newTab: TerminalTab = { id: tabId, title: `${tab.title} (copy)`, isEditing: false, panes: [pane] };
                        const idx = tabs.indexOf(tab);
                        setTabs(prev => { const next = [...prev]; next.splice(idx + 1, 0, newTab); return next; });
                        setActiveTabId(tabId);
                        setActivePaneId(paneId);
                    }}>Duplicate</button>
                    <button className="cli-panel-context-menu-item" onClick={() => { closeContextMenu(); splitRight(contextMenu.tabId); }}>Split Right</button>
                    <div className="cli-panel-context-menu-separator" />
                    <button className="cli-panel-context-menu-item" onClick={() => { closeContextMenu(); closeTab(contextMenu.tabId); }}>Close</button>
                    <button className="cli-panel-context-menu-item" disabled={tabs.length <= 1} onClick={() => { closeContextMenu(); setTabs(prev => prev.filter(t => t.id === contextMenu.tabId)); setActiveTabId(contextMenu.tabId); }}>Close Others</button>
                    <button className="cli-panel-context-menu-item" onClick={() => {
                        const id = contextMenu.tabId;
                        closeContextMenu();
                        setTabs(prev => {
                            const idx = prev.findIndex(t => t.id === id);
                            if (idx === -1) return prev;
                            return prev.slice(0, idx + 1);
                        });
                    }}>Close to the Right</button>
                    <div className="cli-panel-context-menu-separator" />
                    <button className="cli-panel-context-menu-item destructive" onClick={() => { closeContextMenu(); setTabs([]); setInitialized(false); setCollapsed(true); }}>Close All</button>
                </div>
            )}
        </>
    );
}
