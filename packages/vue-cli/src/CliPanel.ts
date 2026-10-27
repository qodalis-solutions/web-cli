import { defineComponent, computed, inject, watch, PropType, h, onBeforeUnmount, onMounted, shallowRef, VNode, Fragment } from 'vue';
import { ICliModule, CliPanelConfig, CliPanelPosition, ICliPanelRef } from '@qodalis/cli-core';
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
import { CliConfigKey } from './CliConfigProvider';

export interface CliPanelOptions extends CliEngineOptions, CliPanelConfig {}

/** The methods exposed through a template ref. */
const PANEL_REF_METHODS: Array<keyof ICliPanelRef<CliEngine>> = [
    'open', 'collapse', 'toggleCollapse', 'hide', 'unhide', 'toggleHide', 'close',
    'maximize', 'restore', 'toggleMaximize', 'resize', 'setPosition',
    'addTab', 'closeTab', 'selectTab', 'renameTab', 'splitPane', 'closePane', 'getEngine', 'getState',
];

function icon(svg: SvgIcon, className?: string): VNode {
    return h('svg', { class: className, ...svgAttrs(svg) }, svg.shapes.map((shape) => h(shape.tag, shape.attrs)));
}

const stop = (e: Event) => e.stopPropagation();

export const CliPanel = defineComponent({
    name: 'CliPanel',
    props: {
        options: { type: Object as PropType<CliPanelOptions>, default: undefined },
        modules: { type: Array as PropType<ICliModule[]>, default: undefined },
        services: { type: Object as PropType<Record<string, any>>, default: undefined },
        onClose: { type: Function as PropType<() => void>, default: undefined },
        collapsed: { type: Boolean, default: undefined },
        hidden: { type: Boolean, default: undefined },
        maximized: { type: Boolean, default: undefined },
        activeTabId: { type: Number, default: undefined },
        position: { type: String as PropType<CliPanelPosition>, default: undefined },
        height: { type: Number, default: undefined },
        width: { type: Number, default: undefined },
        style: { type: Object as PropType<Record<string, string>>, default: undefined },
        class: { type: String, default: undefined },
    },
    emits: [
        'update:collapsed', 'update:hidden', 'update:maximized',
        'update:activeTabId', 'update:position', 'update:height', 'update:width',
        'close', 'tab-added', 'tab-closed', 'pane-split', 'pane-closed',
    ],
    setup(props, { expose, emit }) {
        const config = inject(CliConfigKey, null);

        // Merge: local props override config context
        const mergedOptions = computed(() => mergeCliOptions<CliPanelOptions>(props.options, config?.options));
        const hostConfig = computed(() => resolveCliHostConfig(props, config));

        const controlled = () => ({
            collapsed: props.collapsed,
            hidden: props.hidden,
            maximized: props.maximized,
            activeTabId: props.activeTabId,
            position: props.position,
            height: props.height,
            width: props.width,
        });

        const controller = new CliPanelController({
            config: mergedOptions.value,
            controlled: controlled(),
            callbacks: {
                onCollapsedChange: (v) => emit('update:collapsed', v),
                onHiddenChange: (v) => emit('update:hidden', v),
                onMaximizedChange: (v) => emit('update:maximized', v),
                onActiveTabIdChange: (v) => emit('update:activeTabId', v),
                onPositionChange: (v) => emit('update:position', v),
                onHeightChange: (v) => emit('update:height', v),
                onWidthChange: (v) => emit('update:width', v),
                onClose: () => {
                    emit('close');
                    props.onClose?.();
                },
                onTabAdded: (e) => emit('tab-added', e),
                onTabClosed: (e) => emit('tab-closed', e),
                onPaneSplit: (e) => emit('pane-split', e),
                onPaneClosed: (e) => emit('pane-closed', e),
            },
        });

        const state = shallowRef<CliPanelSnapshot>(controller.getSnapshot());
        const unsubscribe = controller.subscribe(() => {
            state.value = controller.getSnapshot();
        });

        watch(controlled, (values) => controller.setControlled(values));
        watch(mergedOptions, (options) => controller.setOptions(options));

        const root = shallowRef<HTMLElement | null>(null);
        onMounted(() => controller.setRootElement(root.value));
        onBeforeUnmount(() => {
            unsubscribe();
            controller.destroy();
        });

        const exposed: Record<string, unknown> = {};
        for (const method of PANEL_REF_METHODS) {
            exposed[method] = (controller[method] as (...args: unknown[]) => unknown).bind(controller);
        }
        expose(exposed);

        /* ─── Render helpers ─────────────────────────────── */

        const openDropdown = (e: MouseEvent, dropdown?: 'services' | 'servers') => {
            if (!dropdown) return;
            e.stopPropagation();
            const anchor = e.currentTarget as Element;
            if (dropdown === 'services') controller.toggleServicesDropdown(anchor);
            else controller.toggleServersDropdown(anchor);
        };

        const renderHeader = (s: CliPanelSnapshot) => {
            const indicators = statusIndicators(s);
            return h('div', { class: 'cli-panel-header' }, [
                h(
                    'div',
                    {
                        class: 'cli-panel-resize-bar',
                        onMousedown: (e: MouseEvent) => {
                            if (!s.resizable) return;
                            e.preventDefault();
                            controller.startPanelResize(e.clientX, e.clientY);
                        },
                    },
                    [h('div', { class: 'cli-panel-resize-grip' })],
                ),
                h('div', { class: 'cli-panel-header-content' }, [
                    h('p', { class: 'cli-panel-title' }, [h('span', { class: 'cli-panel-title-icon' }, [icon(TERMINAL_ICON)]), PANEL_LABELS.title]),
                    s.showStatusIndicators
                        ? h(
                              'div',
                              { class: 'cli-panel-status-indicators' },
                              indicators.map((item) =>
                                  h(
                                      'span',
                                      {
                                          key: item.key,
                                          class: joinClasses('cli-panel-status-item', item.itemClass),
                                          onClick: item.dropdown ? (e: MouseEvent) => openDropdown(e, item.dropdown) : undefined,
                                      },
                                      [
                                          item.dotClass ? h('span', { class: `cli-panel-status-dot ${item.dotClass}` }) : null,
                                          item.icon ? h('span', { class: joinClasses('cli-panel-status-icon', item.iconClass) }, item.icon) : null,
                                          h('span', { class: 'cli-panel-status-label' }, item.label),
                                      ],
                                  ),
                              ),
                          )
                        : null,
                    // Compact indicators for left/right positions (CSS controls visibility).
                    h(
                        'div',
                        { class: 'cli-panel-status-indicators-compact' },
                        indicators.map((item) =>
                            h(
                                'span',
                                {
                                    key: item.key,
                                    class: joinClasses('cli-panel-status-compact-item', item.compactClass),
                                    title: item.title,
                                    onClick: item.dropdown ? (e: MouseEvent) => openDropdown(e, item.dropdown) : undefined,
                                },
                                [
                                    item.compactDotClass ? h('span', { class: item.compactDotClass }) : null,
                                    item.dotClass ? h('span', { class: `cli-panel-status-dot ${item.dotClass}` }) : null,
                                    item.icon ? h('span', { class: joinClasses('cli-panel-status-icon', item.iconClass) }, item.icon) : null,
                                ],
                            ),
                        ),
                    ),
                    h('div', { class: 'cli-panel-action-buttons' }, [
                        h('div', { class: 'cli-panel-btn-position-wrapper', onClick: stop }, [
                            h(
                                'button',
                                {
                                    class: 'cli-panel-btn cli-panel-btn-position',
                                    title: PANEL_LABELS.movePanel,
                                    onClick: () => controller.togglePositionDropdown(),
                                },
                                [icon(positionIcon(s.position))],
                            ),
                            s.positionDropdownOpen
                                ? h(
                                      'div',
                                      { class: 'cli-panel-position-dropdown' },
                                      positionOptions(s).map((opt) =>
                                          h(
                                              'button',
                                              { key: opt.position, class: opt.className, onClick: () => controller.setPosition(opt.position) },
                                              [icon(positionIcon(opt.position, 16)), opt.label],
                                          ),
                                      ),
                                  )
                                : null,
                        ]),
                        s.hideable
                            ? h('button', { class: 'cli-panel-btn cli-panel-btn-hide', title: PANEL_LABELS.hide, onClick: () => controller.hide() }, [icon(HIDE_ICON)])
                            : null,
                        h(
                            'button',
                            {
                                class: 'cli-panel-btn',
                                title: s.maximized ? PANEL_LABELS.restore : PANEL_LABELS.maximize,
                                disabled: s.collapsed,
                                onClick: () => controller.toggleMaximize(),
                            },
                            [icon(s.maximized ? RESTORE_ICON : MAXIMIZE_ICON)],
                        ),
                        h(
                            'button',
                            {
                                class: 'cli-panel-btn',
                                title: s.collapsed ? PANEL_LABELS.expand : PANEL_LABELS.collapse,
                                onClick: () => controller.toggle(),
                            },
                            [icon(collapseChevronIcon(s.position, s.collapsed))],
                        ),
                        s.closable
                            ? h('button', { class: 'cli-panel-btn cli-panel-btn-close', title: PANEL_LABELS.close, onClick: () => controller.close() }, [icon(CLOSE_ICON)])
                            : null,
                    ]),
                ]),
                h('div', { class: glowLineClass(s) }),
            ]);
        };

        const renderTabs = (s: CliPanelSnapshot) =>
            h('div', { class: 'cli-panel-tabs' }, [
                h(
                    'ul',
                    { class: 'cli-panel-tab-list' },
                    s.tabs.map((tab) =>
                        h(
                            'li',
                            {
                                key: tab.id,
                                class: panelTabClass(s, tab),
                                onClick: () => controller.selectTab(tab.id),
                                onDblclick: () => controller.startRename(tab.id),
                                onContextmenu: (e: MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    controller.openContextMenu(tab.id, e.clientX, e.clientY);
                                },
                            },
                            tab.isEditing
                                ? [
                                      h('input', {
                                          class: 'cli-panel-tab-rename-input',
                                          type: 'text',
                                          value: tab.title,
                                          onVnodeMounted: (vnode: VNode) => {
                                              const input = vnode.el as HTMLInputElement;
                                              input.focus();
                                              input.select();
                                          },
                                          onKeydown: (e: KeyboardEvent) =>
                                              handleRenameKey(controller, tab.id, e.key, (e.target as HTMLInputElement).value),
                                          onBlur: (e: FocusEvent) => controller.commitRename(tab.id, (e.target as HTMLInputElement).value),
                                          onClick: stop,
                                          onDblclick: stop,
                                      }),
                                  ]
                                : [
                                      h('span', { class: panelTabDotClass(s, tab) }),
                                      h('span', { class: 'cli-panel-tab-title' }, tab.title),
                                      h(
                                          'button',
                                          {
                                              class: 'cli-panel-tab-close-btn',
                                              title: PANEL_LABELS.closeTab,
                                              onClick: (e: MouseEvent) => {
                                                  e.stopPropagation();
                                                  controller.closeTab(tab.id);
                                              },
                                          },
                                          CLOSE_GLYPH,
                                      ),
                                  ],
                        ),
                    ),
                ),
                h('button', { class: 'cli-panel-add-tab', title: PANEL_LABELS.newTerminal, onClick: () => controller.addTab() }, '+'),
            ]);

        const renderInstances = (s: CliPanelSnapshot) =>
            h(
                'div',
                { class: 'cli-panel-instances' },
                s.tabs.map((tab) =>
                    h('div', { key: tab.id, class: 'cli-panel-instance', style: { display: tab.id === s.activeTabId ? undefined : 'none' } }, [
                        h(
                            'div',
                            { class: panesContainerClass(s) },
                            tab.panes.flatMap((pane, i) => [
                                i > 0
                                    ? h(
                                          'div',
                                          {
                                              key: `divider-${pane.id}`,
                                              class: 'cli-panel-pane-divider',
                                              onMousedown: (e: MouseEvent) => {
                                                  e.preventDefault();
                                                  controller.startPaneResize(tab.id, i - 1, e.clientX, panesContainerWidth(e.target));
                                              },
                                          },
                                          [h('div', { class: 'cli-panel-pane-divider-grip' })],
                                      )
                                    : null,
                                h(
                                    'div',
                                    {
                                        key: pane.id,
                                        class: paneClass(s, tab.id, pane.id),
                                        style: paneStyle(pane.widthPercent),
                                        onClick: () => controller.activatePane(tab.id, pane.id),
                                    },
                                    [
                                        tab.panes.length > 1
                                            ? h(
                                                  'button',
                                                  {
                                                      class: 'cli-panel-pane-close-btn',
                                                      title: PANEL_LABELS.closePane,
                                                      onClick: (e: MouseEvent) => {
                                                          e.stopPropagation();
                                                          controller.closePane(pane.id);
                                                      },
                                                  },
                                                  CLOSE_GLYPH,
                                              )
                                            : null,
                                        h(Cli, {
                                            options: mergedOptions.value,
                                            modules: hostConfig.value.modules,
                                            services: hostConfig.value.services,
                                            snapshot: pane.snapshot,
                                            style: { height: '100%' },
                                            onReady: (engine: CliEngine) => controller.registerEngine(tab.id, pane.id, engine),
                                        }),
                                    ],
                                ),
                            ]),
                        ),
                    ]),
                ),
            );

        const renderContextMenu = (s: CliPanelSnapshot) =>
            h(
                'div',
                { class: 'cli-panel-context-menu', style: contextMenuStyle(s), onClick: stop },
                contextMenuItems(s).flatMap((item) => [
                    item.separatorBefore ? h('div', { class: 'cli-panel-context-menu-separator' }) : null,
                    h(
                        'button',
                        {
                            class: joinClasses('cli-panel-context-menu-item', item.destructive && 'destructive'),
                            disabled: item.disabled,
                            onClick: () => runContextMenuAction(controller, item.action),
                        },
                        item.label,
                    ),
                ]),
            );

        const renderStatusDropdown = (s: CliPanelSnapshot) => {
            const dropdown = openStatusDropdown(s);
            if (!dropdown) return null;
            return h('div', { class: 'cli-panel-services-dropdown', style: dropdown.style, onClick: stop }, [
                h('div', { class: 'cli-panel-services-dropdown-header' }, dropdown.header),
                h(
                    'div',
                    { class: 'cli-panel-services-dropdown-list' },
                    dropdown.rows.map((row) =>
                        h('div', { key: row.key, class: 'cli-panel-services-dropdown-item' }, [
                            h('span', { class: row.dotClass }),
                            h('div', { class: 'cli-panel-svc-info' }, [
                                h('span', { class: 'cli-panel-svc-name' }, row.name),
                                row.description ? h('span', { class: 'cli-panel-svc-desc' }, row.description) : null,
                            ]),
                            dropdown.kind === 'servers'
                                ? h('div', { class: 'cli-panel-srv-meta' }, [
                                      h('span', { class: 'cli-panel-svc-status' }, row.status),
                                      ...row.meta.map((m) => h('span', { key: m, class: 'cli-panel-svc-desc' }, m)),
                                  ])
                                : h('span', { class: 'cli-panel-svc-status' }, row.status),
                        ]),
                    ),
                ),
                dropdown.rows.length === 0 ? h('div', { class: 'cli-panel-services-dropdown-empty' }, dropdown.emptyText) : null,
            ]);
        };

        /* ─── Render ─────────────────────────────────────── */

        return () => {
            const s = state.value;
            if (!s.visible) return null;

            return h(Fragment, [
                s.hidden
                    ? h(
                          'button',
                          {
                              class: 'cli-panel-hide-tab',
                              'data-position': s.position,
                              'data-hide-align': s.hideAlignment,
                              style: s.themeStyles,
                              title: PANEL_LABELS.showCli,
                              onClick: () => controller.unhide(),
                          },
                          [
                              icon(HIDE_TAB_TERMINAL_ICON, 'cli-panel-hide-tab-icon'),
                              h('span', { class: 'cli-panel-hide-tab-label' }, PANEL_LABELS.title),
                              icon(hideTabChevronIcon(s.position), 'cli-panel-hide-tab-arrow'),
                          ],
                      )
                    : null,
                h(
                    'div',
                    {
                        ref: root,
                        class: panelWrapperClass(s, props.class),
                        style: { ...panelWrapperStyle(s), ...props.style },
                        'data-position': s.position,
                        'data-resizable': String(s.resizable),
                        'data-closable': String(s.closable),
                        'data-hideable': String(s.hideable),
                    },
                    [
                        renderHeader(s),
                        s.initialized
                            ? h('div', { class: 'cli-panel-content', style: s.collapsed ? { display: 'none' } : undefined }, [
                                  renderTabs(s),
                                  renderInstances(s),
                              ])
                            : null,
                    ],
                ),
                s.contextMenu.visible ? renderContextMenu(s) : null,
                renderStatusDropdown(s),
            ]);
        };
    },
});
