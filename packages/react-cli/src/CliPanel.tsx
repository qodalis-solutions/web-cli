import React, { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { ICliCommandProcessor, ICliModule, CliPanelConfig, CliPanelPosition, ICliPanelRef } from '@qodalis/cli-core';
import {
    CliEngine,
    CliEngineOptions,
    CliPanelController,
    CliPanelSnapshot,
    CLOSE_GLYPH,
    CLOSE_ICON,
    HIDE_ICON,
    HIDE_TAB_TERMINAL_ICON,
    MAXIMIZE_ICON,
    PANEL_LABELS,
    RESTORE_ICON,
    SvgIcon,
    TERMINAL_ICON,
    collapseChevronIcon,
    contextMenuItems,
    contextMenuStyle,
    glowLineClass,
    handleRenameKey,
    hideTabChevronIcon,
    joinClasses,
    mergeCliOptions,
    openStatusDropdown,
    paneClass,
    paneStyle,
    panelTabClass,
    panelTabDotClass,
    panelWrapperClass,
    panelWrapperStyle,
    panesContainerClass,
    panesContainerWidth,
    positionIcon,
    positionOptions,
    resolveCliHostConfig,
    runContextMenuAction,
    statusIndicators,
    svgAttrs,
} from '@qodalis/cli';
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

    // Bindable properties (controlled mode)
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
    hidden?: boolean;
    onHiddenChange?: (hidden: boolean) => void;
    maximized?: boolean;
    onMaximizedChange?: (maximized: boolean) => void;
    activeTabId?: number;
    onActiveTabIdChange?: (tabId: number) => void;
    position?: CliPanelPosition;
    onPositionChange?: (position: CliPanelPosition) => void;
    height?: number;
    onHeightChange?: (height: number) => void;
    width?: number;
    onWidthChange?: (width: number) => void;

    // Structural events
    onTabAdded?: (event: { tabId: number }) => void;
    onTabClosed?: (event: { tabId: number }) => void;
    onPaneSplit?: (event: { paneId: number; tabId: number }) => void;
    onPaneClosed?: (event: { paneId: number }) => void;
}

/* ─── Icons ──────────────────────────────────────────────── */

/** SVG attribute names in React's camelCase spelling. */
function reactSvgProps(attrs: Record<string, string>): Record<string, string> {
    const props: Record<string, string> = {};
    for (const [key, value] of Object.entries(attrs)) {
        props[key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
    }
    return props;
}

function Icon({ icon, className }: { icon: SvgIcon; className?: string }) {
    return (
        <svg className={className} {...reactSvgProps(svgAttrs(icon))}>
            {icon.shapes.map((shape, i) => React.createElement(shape.tag, { key: i, ...reactSvgProps(shape.attrs) }))}
        </svg>
    );
}

/** Focus a freshly mounted rename input and select its text. */
const focusAndSelect = (input: HTMLInputElement | null) => {
    if (input && document.activeElement !== input) {
        input.focus();
        input.select();
    }
};

const asStyle = (style: Record<string, string>) => style as React.CSSProperties;

/* ─── Component ──────────────────────────────────────────── */

export const CliPanel = React.forwardRef<ICliPanelRef<CliEngine>, CliPanelProps>(function CliPanel(props, ref) {
    const config = useCliConfig();
    const options = mergeCliOptions<CliPanelOptions>(props.options, config.options);
    const { modules, processors, services } = resolveCliHostConfig(props, config);

    const [controller] = useState(
        () =>
            new CliPanelController({
                config: options,
                controlled: {
                    collapsed: props.collapsed,
                    hidden: props.hidden,
                    maximized: props.maximized,
                    activeTabId: props.activeTabId,
                    position: props.position,
                    height: props.height,
                    width: props.width,
                },
            }),
    );
    const s = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
    const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);

    // Keep the controller in sync with props before the browser paints.
    useLayoutEffect(() => {
        controller.setCallbacks({
            onCollapsedChange: props.onCollapsedChange,
            onHiddenChange: props.onHiddenChange,
            onMaximizedChange: props.onMaximizedChange,
            onActiveTabIdChange: props.onActiveTabIdChange,
            onPositionChange: props.onPositionChange,
            onHeightChange: props.onHeightChange,
            onWidthChange: props.onWidthChange,
            onClose: props.onClose,
            onTabAdded: props.onTabAdded,
            onTabClosed: props.onTabClosed,
            onPaneSplit: props.onPaneSplit,
            onPaneClosed: props.onPaneClosed,
        });
        controller.setControlled({
            collapsed: props.collapsed,
            hidden: props.hidden,
            maximized: props.maximized,
            activeTabId: props.activeTabId,
            position: props.position,
            height: props.height,
            width: props.width,
        });
        controller.setOptions(options);
    });

    useEffect(() => controller.setRootElement(rootElement), [controller, rootElement]);
    useEffect(() => () => controller.destroy(), [controller]);
    React.useImperativeHandle(ref, () => controller, [controller]);

    if (!s.visible) return null;

    return (
        <>
            {s.hidden && (
                <button
                    className="cli-panel-hide-tab"
                    data-position={s.position}
                    data-hide-align={s.hideAlignment}
                    style={asStyle(s.themeStyles)}
                    title={PANEL_LABELS.showCli}
                    onClick={() => controller.unhide()}
                >
                    <Icon icon={HIDE_TAB_TERMINAL_ICON} className="cli-panel-hide-tab-icon" />
                    <span className="cli-panel-hide-tab-label">{PANEL_LABELS.title}</span>
                    <Icon icon={hideTabChevronIcon(s.position)} className="cli-panel-hide-tab-arrow" />
                </button>
            )}
            <div
                ref={setRootElement}
                className={panelWrapperClass(s, props.className)}
                style={{ ...asStyle(panelWrapperStyle(s)), ...props.style }}
                data-position={s.position}
                data-resizable={String(s.resizable)}
                data-closable={String(s.closable)}
                data-hideable={String(s.hideable)}
            >
                <PanelHeader controller={controller} s={s} />
                {s.initialized && (
                    <div className="cli-panel-content" style={s.collapsed ? { display: 'none' } : undefined}>
                        <div className="cli-panel-tabs">
                            <ul className="cli-panel-tab-list">
                                {s.tabs.map((tab) => (
                                    <li
                                        key={tab.id}
                                        className={panelTabClass(s, tab)}
                                        onClick={() => controller.selectTab(tab.id)}
                                        onDoubleClick={() => controller.startRename(tab.id)}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            controller.openContextMenu(tab.id, e.clientX, e.clientY);
                                        }}
                                    >
                                        {tab.isEditing ? (
                                            <input
                                                className="cli-panel-tab-rename-input"
                                                type="text"
                                                defaultValue={tab.title}
                                                ref={focusAndSelect}
                                                onKeyDown={(e) => handleRenameKey(controller, tab.id, e.key, e.currentTarget.value)}
                                                onBlur={(e) => controller.commitRename(tab.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <>
                                                <span className={panelTabDotClass(s, tab)} />
                                                <span className="cli-panel-tab-title">{tab.title}</span>
                                                <button
                                                    className="cli-panel-tab-close-btn"
                                                    title={PANEL_LABELS.closeTab}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        controller.closeTab(tab.id);
                                                    }}
                                                >
                                                    {CLOSE_GLYPH}
                                                </button>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <button className="cli-panel-add-tab" title={PANEL_LABELS.newTerminal} onClick={() => controller.addTab()}>
                                +
                            </button>
                        </div>

                        <div className="cli-panel-instances">
                            {s.tabs.map((tab) => (
                                <div key={tab.id} className="cli-panel-instance" style={{ display: tab.id === s.activeTabId ? undefined : 'none' }}>
                                    <div className={panesContainerClass(s)}>
                                        {tab.panes.map((pane, i) => (
                                            <React.Fragment key={pane.id}>
                                                {i > 0 && (
                                                    <div
                                                        className="cli-panel-pane-divider"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            controller.startPaneResize(tab.id, i - 1, e.clientX, panesContainerWidth(e.target));
                                                        }}
                                                    >
                                                        <div className="cli-panel-pane-divider-grip" />
                                                    </div>
                                                )}
                                                <div
                                                    className={paneClass(s, tab.id, pane.id)}
                                                    style={paneStyle(pane.widthPercent)}
                                                    onClick={() => controller.activatePane(tab.id, pane.id)}
                                                >
                                                    {tab.panes.length > 1 && (
                                                        <button
                                                            className="cli-panel-pane-close-btn"
                                                            title={PANEL_LABELS.closePane}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                controller.closePane(pane.id);
                                                            }}
                                                        >
                                                            {CLOSE_GLYPH}
                                                        </button>
                                                    )}
                                                    <CliContext.Provider value={{ engine: null }}>
                                                        <Cli
                                                            options={options}
                                                            modules={modules}
                                                            processors={processors}
                                                            services={services}
                                                            snapshot={pane.snapshot}
                                                            onReady={(engine) => controller.registerEngine(tab.id, pane.id, engine)}
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

            {s.contextMenu.visible && (
                <div className="cli-panel-context-menu" style={asStyle(contextMenuStyle(s))} onClick={(e) => e.stopPropagation()}>
                    {contextMenuItems(s).map((item) => (
                        <React.Fragment key={item.action}>
                            {item.separatorBefore && <div className="cli-panel-context-menu-separator" />}
                            <button
                                className={joinClasses('cli-panel-context-menu-item', item.destructive && 'destructive')}
                                disabled={item.disabled}
                                onClick={() => runContextMenuAction(controller, item.action)}
                            >
                                {item.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}

            <StatusDropdown s={s} />
        </>
    );
});

/* ─── Services / servers dropdown ────────────────────────── */

function StatusDropdown({ s }: { s: CliPanelSnapshot }) {
    const dropdown = openStatusDropdown(s);
    if (!dropdown) return null;
    return (
        <div className="cli-panel-services-dropdown" style={asStyle(dropdown.style)} onClick={(e) => e.stopPropagation()}>
            <div className="cli-panel-services-dropdown-header">{dropdown.header}</div>
            <div className="cli-panel-services-dropdown-list">
                {dropdown.rows.map((row) => (
                    <div key={row.key} className="cli-panel-services-dropdown-item">
                        <span className={row.dotClass} />
                        <div className="cli-panel-svc-info">
                            <span className="cli-panel-svc-name">{row.name}</span>
                            {row.description && <span className="cli-panel-svc-desc">{row.description}</span>}
                        </div>
                        {dropdown.kind === 'servers' ? (
                            <div className="cli-panel-srv-meta">
                                <span className="cli-panel-svc-status">{row.status}</span>
                                {row.meta.map((m) => (
                                    <span key={m} className="cli-panel-svc-desc">
                                        {m}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="cli-panel-svc-status">{row.status}</span>
                        )}
                    </div>
                ))}
            </div>
            {dropdown.rows.length === 0 && <div className="cli-panel-services-dropdown-empty">{dropdown.emptyText}</div>}
        </div>
    );
}

/* ─── Header ─────────────────────────────────────────────── */

function PanelHeader({ controller, s }: { controller: CliPanelController; s: CliPanelSnapshot }) {
    const indicators = statusIndicators(s);
    const openDropdown = (e: React.MouseEvent, dropdown?: 'services' | 'servers') => {
        if (!dropdown) return;
        e.stopPropagation();
        if (dropdown === 'services') controller.toggleServicesDropdown(e.currentTarget);
        else controller.toggleServersDropdown(e.currentTarget);
    };

    return (
        <div className="cli-panel-header">
            <div
                className="cli-panel-resize-bar"
                onMouseDown={(e) => {
                    if (!s.resizable) return;
                    e.preventDefault();
                    controller.startPanelResize(e.clientX, e.clientY);
                }}
            >
                <div className="cli-panel-resize-grip" />
            </div>
            <div className="cli-panel-header-content">
                <p className="cli-panel-title">
                    <span className="cli-panel-title-icon">
                        <Icon icon={TERMINAL_ICON} />
                    </span>
                    {PANEL_LABELS.title}
                </p>

                {s.showStatusIndicators && (
                    <div className="cli-panel-status-indicators">
                        {indicators.map((item) => (
                            <span
                                key={item.key}
                                className={joinClasses('cli-panel-status-item', item.itemClass)}
                                onClick={item.dropdown ? (e) => openDropdown(e, item.dropdown) : undefined}
                            >
                                {item.dotClass && <span className={`cli-panel-status-dot ${item.dotClass}`} />}
                                {item.icon && <span className={joinClasses('cli-panel-status-icon', item.iconClass)}>{item.icon}</span>}
                                <span className="cli-panel-status-label">{item.label}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Compact indicators for left/right positions (CSS controls visibility). */}
                <div className="cli-panel-status-indicators-compact">
                    {indicators.map((item) => (
                        <span
                            key={item.key}
                            className={joinClasses('cli-panel-status-compact-item', item.compactClass)}
                            title={item.title}
                            onClick={item.dropdown ? (e) => openDropdown(e, item.dropdown) : undefined}
                        >
                            {item.compactDotClass && <span className={item.compactDotClass} />}
                            {item.dotClass && <span className={`cli-panel-status-dot ${item.dotClass}`} />}
                            {item.icon && <span className={joinClasses('cli-panel-status-icon', item.iconClass)}>{item.icon}</span>}
                        </span>
                    ))}
                </div>

                <div className="cli-panel-action-buttons">
                    <div className="cli-panel-btn-position-wrapper" onClick={(e) => e.stopPropagation()}>
                        <button className="cli-panel-btn cli-panel-btn-position" title={PANEL_LABELS.movePanel} onClick={() => controller.togglePositionDropdown()}>
                            <Icon icon={positionIcon(s.position)} />
                        </button>
                        {s.positionDropdownOpen && (
                            <div className="cli-panel-position-dropdown">
                                {positionOptions(s).map((opt) => (
                                    <button key={opt.position} className={opt.className} onClick={() => controller.setPosition(opt.position)}>
                                        <Icon icon={positionIcon(opt.position, 16)} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {s.hideable && (
                        <button className="cli-panel-btn cli-panel-btn-hide" title={PANEL_LABELS.hide} onClick={() => controller.hide()}>
                            <Icon icon={HIDE_ICON} />
                        </button>
                    )}
                    <button
                        className="cli-panel-btn"
                        title={s.maximized ? PANEL_LABELS.restore : PANEL_LABELS.maximize}
                        disabled={s.collapsed}
                        onClick={() => controller.toggleMaximize()}
                    >
                        <Icon icon={s.maximized ? RESTORE_ICON : MAXIMIZE_ICON} />
                    </button>
                    <button className="cli-panel-btn" title={s.collapsed ? PANEL_LABELS.expand : PANEL_LABELS.collapse} onClick={() => controller.toggle()}>
                        <Icon icon={collapseChevronIcon(s.position, s.collapsed)} />
                    </button>
                    {s.closable && (
                        <button className="cli-panel-btn cli-panel-btn-close" title={PANEL_LABELS.close} onClick={() => controller.close()}>
                            <Icon icon={CLOSE_ICON} />
                        </button>
                    )}
                </div>
            </div>
            <div className={glowLineClass(s)} />
        </div>
    );
}
