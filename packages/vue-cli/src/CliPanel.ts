import {
    defineComponent,
    ref,
    computed,
    inject,
    watch,
    PropType,
    h,
    onMounted,
    onBeforeUnmount,
} from 'vue';
import { ICliCommandProcessor, ICliModule, CliPanelConfig, CliPanelPosition, CliPanelHideAlignment, CliEngineSnapshot, CliPanelState, derivePanelThemeStyles, loadPanelPosition, savePanelPosition, CliNotification } from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { Cli } from './Cli';
import { CliConfigKey } from './CliConfigProvider';

export interface CliPanelOptions extends CliEngineOptions, CliPanelConfig {}

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

function normalizePanes(panes: TerminalPane[]) {
    const total = panes.reduce((s, p) => s + p.widthPercent, 0);
    if (total === 0) return;
    const scale = 100 / total;
    panes.forEach((p) => {
        p.widthPercent *= scale;
    });
}

/* ─── SVG helpers ────────────────────────────────────────── */

const svgAttrs = {
    width: '20',
    height: '20',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
};

const terminalIcon = () =>
    h('svg', { ...svgAttrs, width: '22', height: '22', 'stroke-width': '2' }, [
        h('polyline', { points: '4 17 10 11 4 5' }),
        h('line', { x1: '12', y1: '19', x2: '20', y2: '19' }),
    ]);
const maximizeIcon = () =>
    h('svg', svgAttrs, [
        h('polyline', { points: '15 3 21 3 21 9' }),
        h('polyline', { points: '9 21 3 21 3 15' }),
        h('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
        h('line', { x1: '3', y1: '21', x2: '10', y2: '14' }),
    ]);
const restoreIcon = () =>
    h('svg', svgAttrs, [
        h('polyline', { points: '4 14 10 14 10 20' }),
        h('polyline', { points: '20 10 14 10 14 4' }),
        h('line', { x1: '14', y1: '10', x2: '21', y2: '3' }),
        h('line', { x1: '3', y1: '21', x2: '10', y2: '14' }),
    ]);
const closeIcon = () =>
    h('svg', svgAttrs, [
        h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
        h('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
    ]);
const hideIcon = () =>
    h('svg', svgAttrs, [
        h('line', { x1: '5', y1: '18', x2: '19', y2: '18' }),
        h('polyline', { points: '9 14 12 17 15 14' }),
    ]);

function collapseChevron(position: CliPanelPosition, isCollapsed: boolean) {
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
    return h('svg', svgAttrs, [h('polyline', { points })]);
}

function hideTabChevron(position: CliPanelPosition) {
    let points: string;
    switch (position) {
        case 'top': points = '6 9 12 15 18 9'; break;
        case 'left': points = '9 18 15 12 9 6'; break;
        case 'right': points = '15 6 9 12 15 18'; break;
        default: points = '18 15 12 9 6 15'; break;
    }
    return h('svg', { class: 'cli-panel-hide-tab-arrow', ...svgAttrs, width: '14', height: '14', 'stroke-width': '2.5' }, [
        h('polyline', { points }),
    ]);
}

function positionIcon(pos: string, size = 20) {
    let fillRect: any;
    switch (pos) {
        case 'top':
            fillRect = h('rect', { x: '4', y: '4', width: '16', height: '5', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        case 'left':
            fillRect = h('rect', { x: '4', y: '4', width: '5', height: '16', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        case 'right':
            fillRect = h('rect', { x: '15', y: '4', width: '5', height: '16', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
        default: // bottom
            fillRect = h('rect', { x: '4', y: '15', width: '16', height: '5', rx: '1', fill: 'currentColor', stroke: 'none', opacity: '0.5' });
            break;
    }
    return h('svg', { ...svgAttrs, width: String(size), height: String(size) }, [
        h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
        fillRect,
    ]);
}

/* ─── Component ──────────────────────────────────────────── */

export const CliPanel = defineComponent({
    name: 'CliPanel',
    props: {
        options: {
            type: Object as PropType<CliPanelOptions>,
            default: undefined,
        },
        modules: { type: Array as PropType<ICliModule[]>, default: undefined },
        processors: {
            type: Array as PropType<ICliCommandProcessor[]>,
            default: undefined,
        },
        services: {
            type: Object as PropType<Record<string, any>>,
            default: undefined,
        },
        onClose: {
            type: Function as PropType<() => void>,
            default: undefined,
        },
        collapsed: { type: Boolean, default: undefined },
        hidden: { type: Boolean, default: undefined },
        maximized: { type: Boolean, default: undefined },
        activeTabId: { type: Number, default: undefined },
        position: { type: String as PropType<CliPanelPosition>, default: undefined },
        height: { type: Number, default: undefined },
        width: { type: Number, default: undefined },
        style: {
            type: Object as PropType<Record<string, string>>,
            default: undefined,
        },
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
        const mergedOptions = computed(() => props.options
            ? { ...(config?.options as CliPanelOptions | undefined), ...props.options }
            : config?.options as CliPanelOptions | undefined);
        const mergedModules = computed(() => props.modules ?? config?.modules);
        const mergedProcessors = computed(() => props.processors ?? config?.processors);
        const mergedServices = computed(() => props.services ?? config?.services);

        const visible = ref(true);
        const internalCollapsed = ref(mergedOptions.value?.isCollapsed ?? true);
        const internalMaximized = ref(false);
        const internalHeight = ref(600);
        const internalWidth = ref(400);
        const prevHeight = ref(600);
        const prevWidth = ref(400);
        const initialized = ref(false);
        const internalHidden = ref(props.options?.isHidden ?? false);
        let preHideCollapsed = true;
        const internalActiveTabId = ref(0);

        const internalPosition = ref<CliPanelPosition>(
            loadPanelPosition() ?? mergedOptions.value?.position ?? 'bottom',
        );

        /* ─── Resolved (controlled/uncontrolled) ────────── */

        const resolvedCollapsed = computed(() =>
            props.collapsed !== undefined ? props.collapsed : internalCollapsed.value);
        const resolvedHidden = computed(() =>
            props.hidden !== undefined ? props.hidden : internalHidden.value);
        const resolvedMaximized = computed(() =>
            props.maximized !== undefined ? props.maximized : internalMaximized.value);
        const resolvedActiveTabId = computed(() =>
            props.activeTabId !== undefined ? props.activeTabId : internalActiveTabId.value);
        const resolvedHeight = computed(() =>
            props.height !== undefined ? props.height : internalHeight.value);
        const resolvedWidth = computed(() =>
            props.width !== undefined ? props.width : internalWidth.value);
        const resolvedPosition = computed(() =>
            props.position !== undefined ? props.position as CliPanelPosition : internalPosition.value);

        /* ─── Update helpers ────────────────────────────── */

        function updateCollapsed(value: boolean) {
            internalCollapsed.value = value;
            emit('update:collapsed', value);
        }
        function updateHidden(value: boolean) {
            internalHidden.value = value;
            emit('update:hidden', value);
        }
        function updateMaximized(value: boolean) {
            internalMaximized.value = value;
            emit('update:maximized', value);
        }
        function updateActiveTabId(value: number) {
            internalActiveTabId.value = value;
            emit('update:activeTabId', value);
        }
        function updateHeight(value: number) {
            internalHeight.value = value;
            emit('update:height', value);
        }
        function updateWidth(value: number) {
            internalWidth.value = value;
            emit('update:width', value);
        }
        function updatePosition(value: CliPanelPosition) {
            internalPosition.value = value;
            savePanelPosition(value);
            emit('update:position', value);
        }
        const closable = computed(() => mergedOptions.value?.closable ?? true);
        const resizable = computed(() => mergedOptions.value?.resizable ?? true);
        const isHorizontal = computed(() => resolvedPosition.value === 'left' || resolvedPosition.value === 'right');
        const hideable = computed(() => mergedOptions.value?.hideable ?? true);
        const hideAlignment = computed<CliPanelHideAlignment>(() => mergedOptions.value?.hideAlignment ?? 'center');
        const syncTheme = computed(() => mergedOptions.value?.syncTheme ?? false);
        const themeStyles = ref<Record<string, string>>({});

        const tabs = ref<TerminalTab[]>([]);
        const activePaneId = ref(0);
        let nextTabId = 1;
        let nextPaneId = 1;

        const contextMenu = ref<TabContextMenu>({
            visible: false,
            x: 0,
            y: 0,
            tabId: 0,
        });

        const engineMap = new Map<number, CliEngine>();

        const paneResizing = ref(false);
        let paneResizeState = {
            tabId: 0,
            dividerIndex: 0,
            startX: 0,
            startWidths: [] as number[],
            containerWidth: 0,
        };

        const panelResizing = ref(false);
        let panelResizeState = { startY: 0, startHeight: 0, startX: 0, startWidth: 0 };

        /* ─── Status bar state ──────────────────────────── */

        const statusExecutionState = ref<'idle' | 'running'>('idle');
        const statusLastCommand = ref<{ name: string; success: boolean } | null>(null);
        const statusServiceCount = ref({ running: 0, total: 0 });
        const statusServiceDetails = ref<Array<{ name: string; status: string; description?: string }>>([]);
        const statusServerState = ref<'connected' | 'disconnected' | 'none'>('none');
        const statusServerDetails = ref<Array<{ name: string; url: string; connected: boolean; apiVersion?: string; commandCount?: number }>>([]);
        const statusUptime = ref(0);
        const notification = ref<CliNotification | null>(null);
        const servicesDropdownOpen = ref(false);
        const serversDropdownOpen = ref(false);
        const servicesDropdownTriggerRect = ref<DOMRect | null>(null);
        const serversDropdownTriggerRect = ref<DOMRect | null>(null);

        const formattedUptime = computed(() => {
            const mins = Math.floor(statusUptime.value / 60000);
            if (mins < 60) return `${mins}m`;
            const hrs = Math.floor(mins / 60);
            return `${hrs}h${mins % 60}m`;
        });

        let execPollTimer: ReturnType<typeof setInterval> | undefined;
        let globalPollTimer: ReturnType<typeof setInterval> | undefined;

        function startStatusPolling() {
            stopStatusPolling();
            execPollTimer = setInterval(() => {
                const tab = tabs.value.find(t => t.id === resolvedActiveTabId.value);
                if (!tab) return;
                const engine = engineMap.get(tab.panes[0]?.id);
                if (!engine) return;
                const context = engine.getContext();
                if (!context) return;

                const running = !!(context as any).isExecuting || !!(context as any).contextProcessor;
                statusExecutionState.value = running ? 'running' : 'idle';

                const result = (context as any).lastCommandResult;
                statusLastCommand.value = result ? { name: result.command, success: result.success } : null;

                const notif = context.notifier?.current;
                notification.value = notif || null;
            }, 300);

            globalPollTimer = setInterval(() => {
                const tab = tabs.value.find(t => t.id === resolvedActiveTabId.value);
                if (!tab) return;
                const engine = engineMap.get(tab.panes[0]?.id);
                if (!engine) return;
                const context = engine.getContext();
                if (!context) return;

                try {
                    const services = context.backgroundServices?.list() ?? [];
                    statusServiceCount.value = { running: services.filter((s: any) => s.status === 'running').length, total: services.length };
                    statusServiceDetails.value = services.map((s: any) => ({ name: s.name, status: s.status, description: s.description }));
                } catch { /* not available */ }

                try {
                    const serverManager = (context as any).services?.get?.('cli-server-manager');
                    const details: Array<{ name: string; url: string; connected: boolean; apiVersion?: string; commandCount?: number }> = [];
                    if (serverManager?.connections?.size > 0) {
                        let anyConnected = false;
                        for (const [name, conn] of serverManager.connections) {
                            if ((conn as any).connected) anyConnected = true;
                            details.push({
                                name,
                                url: (conn as any).config?.url ?? '',
                                connected: !!(conn as any).connected,
                                apiVersion: (conn as any).connected ? (conn as any).apiVersion : undefined,
                                commandCount: (conn as any).connected ? (conn as any).commands?.length : undefined,
                            });
                        }
                        statusServerState.value = anyConnected ? 'connected' : 'disconnected';
                    } else {
                        // Fall back to configured servers from engine options
                        const configuredServers = (engine as any).options?.servers;
                        if (Array.isArray(configuredServers) && configuredServers.length > 0) {
                            for (const srv of configuredServers) {
                                if (srv.enabled === false) continue;
                                details.push({
                                    name: srv.name,
                                    url: srv.url ?? '',
                                    connected: false,
                                });
                            }
                            statusServerState.value = 'disconnected';
                        } else {
                            statusServerState.value = 'none';
                        }
                    }
                    statusServerDetails.value = details;
                } catch { /* not available */ }

                statusUptime.value = engine.startedAt ? Date.now() - engine.startedAt : 0;
            }, 2000);
        }

        function stopStatusPolling() {
            if (execPollTimer) { clearInterval(execPollTimer); execPollTimer = undefined; }
            if (globalPollTimer) { clearInterval(globalPollTimer); globalPollTimer = undefined; }
        }

        watch(initialized, (val) => {
            if (val) startStatusPolling();
            else stopStatusPolling();
        });

        // Terminal height is handled via CSS flex layout (height: 100% default in Cli)

        /* ─── Tab management ─────────────────────────────── */

        function addTab(title?: string): number {
            const tabId = nextTabId++;
            const paneId = nextPaneId++;
            tabs.value = [...tabs.value, {
                id: tabId,
                title: title ?? `Terminal ${tabId}`,
                isEditing: false,
                panes: [{ id: paneId, widthPercent: 100 }],
            }];
            updateActiveTabId(tabId);
            activePaneId.value = paneId;
            emit('tab-added', { tabId });
            return tabId;
        }

        let themeObserver: MutationObserver | undefined;

        function syncThemeFromEngine() {
            const engine = engineMap.values().next().value;
            if (!engine) return;
            const theme = (engine as CliEngine).getTerminal().options.theme;
            if (theme) themeStyles.value = derivePanelThemeStyles(theme);
        }

        function setupThemeSync() {
            if (!syncTheme.value) return;
            setTimeout(() => {
                syncThemeFromEngine();
                const container = document.querySelector('.cli-panel-wrapper .terminal-container');
                if (!container) return;
                themeObserver?.disconnect();
                themeObserver = new MutationObserver(syncThemeFromEngine);
                themeObserver.observe(container, { attributes: true, attributeFilter: ['style'] });
            }, 200);
        }

        onMounted(() => {
            document.addEventListener('click', closePositionDropdown);
        });

        onBeforeUnmount(() => {
            themeObserver?.disconnect();
            document.removeEventListener('click', closePositionDropdown);
        });

        function toggle() {
            const newVal = !resolvedCollapsed.value;
            updateCollapsed(newVal);
            if (!newVal && !initialized.value) {
                initialized.value = true;
                addTab();
                setupThemeSync();
            }
        }

        function closeTab(id: number) {
            const idx = tabs.value.findIndex((t) => t.id === id);
            if (idx === -1) return;
            tabs.value.splice(idx, 1);
            emit('tab-closed', { tabId: id });
            if (tabs.value.length === 0) {
                initialized.value = false;
                updateCollapsed(true);
                return;
            }
            if (resolvedActiveTabId.value === id) {
                const newIdx = Math.min(idx, tabs.value.length - 1);
                selectTab(tabs.value[newIdx].id);
            }
        }

        function selectTab(id: number) {
            updateActiveTabId(id);
            const tab = tabs.value.find((t) => t.id === id);
            if (tab && tab.panes.length > 0) {
                activePaneId.value = tab.panes[0].id;
            }
        }

        /* ─── Split / close pane ─────────────────────────── */

        function splitPane(tabId?: number): number {
            const targetTabId = tabId ?? resolvedActiveTabId.value;
            const paneId = nextPaneId++;
            tabs.value = tabs.value.map(t => {
                if (t.id !== targetTabId) return t;
                const newPanes = [...t.panes, { id: paneId, widthPercent: 0 }];
                const evenWidth = 100 / newPanes.length;
                newPanes.forEach(p => { p.widthPercent = evenWidth; });
                normalizePanes(newPanes);
                return { ...t, panes: newPanes };
            });
            activePaneId.value = paneId;
            emit('pane-split', { paneId, tabId: targetTabId });
            return paneId;
        }

        function closePane(paneId: number): void {
            for (const tab of tabs.value) {
                const idx = tab.panes.findIndex(p => p.id === paneId);
                if (idx === -1) continue;
                if (tab.panes.length <= 1) { closeTab(tab.id); return; }
                engineMap.get(paneId)?.destroy();
                engineMap.delete(paneId);
                const newPanes = tab.panes.filter(p => p.id !== paneId);
                normalizePanes(newPanes);
                if (activePaneId.value === paneId) {
                    activePaneId.value = newPanes[Math.min(idx, newPanes.length - 1)].id;
                }
                emit('pane-closed', { paneId });
                tabs.value = tabs.value.map(t =>
                    t.id === tab.id ? { ...t, panes: newPanes } : t,
                );
                return;
            }
        }

        /** Add renameTab for programmatic use */
        function renameTab(tabId: number, title: string): void {
            tabs.value = tabs.value.map(t => t.id === tabId ? { ...t, title } : t);
        }

        /* ─── Rename ─────────────────────────────────────── */

        function startRename(tabId: number) {
            tabs.value.forEach((t) => {
                t.isEditing = t.id === tabId;
            });
        }

        function commitRename(tabId: number, value: string) {
            const trimmed = value.trim();
            const tab = tabs.value.find((t) => t.id === tabId);
            if (tab) {
                if (trimmed) tab.title = trimmed;
                tab.isEditing = false;
            }
        }

        /* ─── Context menu ───────────────────────────────── */

        function closeContextMenu() {
            contextMenu.value = { ...contextMenu.value, visible: false };
        }

        function onDocClick() {
            if (contextMenu.value.visible) closeContextMenu();
        }
        onMounted(() => document.addEventListener('click', onDocClick));
        onBeforeUnmount(() =>
            document.removeEventListener('click', onDocClick),
        );

        /* ─── Panel resize ───────────────────────────────── */

        function onPanelResizeStart(e: MouseEvent) {
            if (!resizable.value) return;
            e.preventDefault();
            if (resolvedCollapsed.value) toggle();
            panelResizing.value = true;
            panelResizeState = {
                startY: e.clientY,
                startHeight: resolvedHeight.value,
                startX: e.clientX,
                startWidth: resolvedWidth.value,
            };
        }

        function onPanelResizeMove(e: MouseEvent) {
            if (!panelResizing.value) return;
            if (isHorizontal.value) {
                const deltaX = resolvedPosition.value === 'left'
                    ? e.clientX - panelResizeState.startX
                    : panelResizeState.startX - e.clientX;
                let next = Math.max(100, panelResizeState.startWidth + deltaX);
                if (next > window.innerWidth) next = window.innerWidth;
                updateWidth(next);
            } else {
                const deltaY = resolvedPosition.value === 'top'
                    ? e.clientY - panelResizeState.startY
                    : panelResizeState.startY - e.clientY;
                let next = Math.max(100, panelResizeState.startHeight + deltaY);
                if (next > window.innerHeight) next = window.innerHeight;
                updateHeight(next);
            }
        }

        function onPanelResizeEnd() {
            panelResizing.value = false;
        }

        onMounted(() => {
            document.addEventListener('mousemove', onPanelResizeMove);
            document.addEventListener('mouseup', onPanelResizeEnd);
        });
        onBeforeUnmount(() => {
            document.removeEventListener('mousemove', onPanelResizeMove);
            document.removeEventListener('mouseup', onPanelResizeEnd);
        });

        /* ─── Pane resize ────────────────────────────────── */

        function onPaneResizeStart(
            e: MouseEvent,
            tabId: number,
            dividerIndex: number,
        ) {
            e.preventDefault();
            const tab = tabs.value.find((t) => t.id === tabId);
            if (!tab) return;
            paneResizing.value = true;
            const container = (e.target as HTMLElement).closest(
                '.cli-panel-panes-container',
            );
            paneResizeState = {
                tabId,
                dividerIndex,
                startX: e.clientX,
                startWidths: tab.panes.map((p) => p.widthPercent),
                containerWidth: container ? container.clientWidth : 1,
            };
            document.body.classList.add('cli-pane-resizing');
        }

        function onPaneResizeMove(e: MouseEvent) {
            if (!paneResizing.value) return;
            const s = paneResizeState;
            const deltaPct = ((e.clientX - s.startX) / s.containerWidth) * 100;
            const i = s.dividerIndex;
            let leftW = s.startWidths[i] + deltaPct;
            let rightW = s.startWidths[i + 1] - deltaPct;
            if (leftW < MIN_PANE_WIDTH_PERCENT) {
                leftW = MIN_PANE_WIDTH_PERCENT;
                rightW =
                    s.startWidths[i] +
                    s.startWidths[i + 1] -
                    MIN_PANE_WIDTH_PERCENT;
            }
            if (rightW < MIN_PANE_WIDTH_PERCENT) {
                rightW = MIN_PANE_WIDTH_PERCENT;
                leftW =
                    s.startWidths[i] +
                    s.startWidths[i + 1] -
                    MIN_PANE_WIDTH_PERCENT;
            }
            const tab = tabs.value.find((t) => t.id === s.tabId);
            if (tab) {
                tab.panes[i].widthPercent = leftW;
                tab.panes[i + 1].widthPercent = rightW;
            }
        }

        function onPaneResizeEnd() {
            if (!paneResizing.value) return;
            paneResizing.value = false;
            document.body.classList.remove('cli-pane-resizing');
        }

        onMounted(() => {
            document.addEventListener('mousemove', onPaneResizeMove);
            document.addEventListener('mouseup', onPaneResizeEnd);
        });
        onBeforeUnmount(() => {
            document.removeEventListener('mousemove', onPaneResizeMove);
            document.removeEventListener('mouseup', onPaneResizeEnd);
            stopStatusPolling();
        });

        /* ─── Maximize ───────────────────────────────────── */

        function toggleMaximize() {
            if (!resolvedMaximized.value) {
                if (isHorizontal.value) {
                    prevWidth.value = resolvedWidth.value;
                    updateWidth(window.innerWidth);
                } else {
                    prevHeight.value = resolvedHeight.value;
                    updateHeight(window.innerHeight);
                }
            } else {
                if (isHorizontal.value) {
                    updateWidth(prevWidth.value);
                } else {
                    updateHeight(prevHeight.value);
                }
            }
            updateMaximized(!resolvedMaximized.value);
        }

        /* ─── Close handler ──────────────────────────────── */

        function handleClose() {
            visible.value = false;
            emit('close');
            props.onClose?.();
        }

        function handleHide() {
            preHideCollapsed = resolvedCollapsed.value;
            updateHidden(true);
        }

        function handleUnhide() {
            updateHidden(false);
            updateCollapsed(preHideCollapsed);
        }

        const positionDropdownOpen = ref(false);

        function closePositionDropdown() {
            positionDropdownOpen.value = false;
            servicesDropdownOpen.value = false;
            serversDropdownOpen.value = false;
        }

        function togglePositionDropdown(e: MouseEvent) {
            e.stopPropagation();
            positionDropdownOpen.value = !positionDropdownOpen.value;
        }

        function selectPosition(pos: CliPanelPosition) {
            positionDropdownOpen.value = false;
            updatePosition(pos);
        }

        /* ─── Engine access & state ──────────────────────── */

        function getEngine(paneId?: number): CliEngine | undefined {
            const targetId = paneId ?? activePaneId.value;
            return engineMap.get(targetId);
        }

        function getState(): CliPanelState {
            return {
                collapsed: resolvedCollapsed.value,
                hidden: resolvedHidden.value,
                maximized: resolvedMaximized.value,
                position: resolvedPosition.value,
                height: resolvedHeight.value,
                width: resolvedWidth.value,
                activeTabId: resolvedActiveTabId.value,
                activePaneId: activePaneId.value,
                tabs: tabs.value.map(t => ({
                    id: t.id, title: t.title,
                    panes: t.panes.map(p => ({ id: p.id, widthPercent: p.widthPercent })),
                })),
            };
        }

        /* ─── Expose programmatic API (ICliPanelRef) ──── */

        expose({
            open: () => {
                if (!visible.value) { visible.value = true; }
                if (resolvedHidden.value) { updateHidden(false); }
                if (resolvedCollapsed.value) {
                    updateCollapsed(false);
                    if (!initialized.value) {
                        initialized.value = true;
                        addTab();
                        setupThemeSync();
                    }
                }
            },
            collapse: () => { if (!resolvedCollapsed.value) updateCollapsed(true); },
            toggleCollapse: () => {
                if (resolvedCollapsed.value) {
                    updateCollapsed(false);
                    if (!initialized.value) { initialized.value = true; addTab(); setupThemeSync(); }
                } else { updateCollapsed(true); }
            },
            hide: () => { if (!resolvedHidden.value) updateHidden(true); },
            unhide: () => { if (resolvedHidden.value) updateHidden(false); },
            toggleHide: () => { updateHidden(!resolvedHidden.value); },
            close: handleClose,
            maximize: () => { if (!resolvedMaximized.value) updateMaximized(true); },
            restore: () => { if (resolvedMaximized.value) updateMaximized(false); },
            toggleMaximize: () => { updateMaximized(!resolvedMaximized.value); },
            resize: (dims: { height?: number; width?: number }) => {
                if (dims.height !== undefined) updateHeight(dims.height);
                if (dims.width !== undefined) updateWidth(dims.width);
            },
            setPosition: updatePosition,
            addTab, closeTab, selectTab, renameTab, splitPane, closePane, getEngine, getState,
        });

        /* ─── Render ─────────────────────────────────────── */

        return () => {
            if (!visible.value) return null;

            const wrapperClass = [
                'cli-panel-wrapper',
                resolvedCollapsed.value && 'collapsed',
                resolvedMaximized.value && 'maximized',
                panelResizing.value && 'resizing',
                props.class,
            ]
                .filter(Boolean)
                .join(' ');

            const wrapperStyle = {
                ...(isHorizontal.value ? { width: `${resolvedWidth.value}px` } : { height: `${resolvedHeight.value}px` }),
                ...(resolvedHidden.value ? { display: 'none' } : {}),
                ...themeStyles.value,
                ...props.style,
            };

            const headerEl = h('div', { class: 'cli-panel-header' }, [
                h(
                    'div',
                    {
                        class: 'cli-panel-resize-bar',
                        onMousedown: onPanelResizeStart,
                    },
                    [h('div', { class: 'cli-panel-resize-grip' })],
                ),
                h('div', { class: 'cli-panel-header-content' }, [
                    h('p', { class: 'cli-panel-title' }, [
                        h('span', { class: 'cli-panel-title-icon' }, [
                            terminalIcon(),
                        ]),
                        'CLI',
                    ]),
                    // Status indicators (bottom/top only)

                    (resolvedPosition.value === 'bottom' || resolvedPosition.value === 'top')
                        ? h('div', { class: 'cli-panel-status-indicators' }, [
                            // Execution state
                            h('span', { class: ['cli-panel-status-item', statusExecutionState.value === 'running' ? 'status-running' : ''].filter(Boolean).join(' ') }, [
                                h('span', { class: ['cli-panel-status-dot', statusExecutionState.value === 'running' ? 'dot-running' : 'dot-idle'].join(' ') }),
                                h('span', { class: 'cli-panel-status-label' }, statusExecutionState.value),
                            ]),
                            // Background services
                            statusServiceCount.value.total > 0
                                ? h('span', {
                                    class: 'cli-panel-status-item status-clickable',
                                    onClick: (e: MouseEvent) => {
                                        e.stopPropagation();
                                        servicesDropdownTriggerRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        servicesDropdownOpen.value = !servicesDropdownOpen.value;
                                        serversDropdownOpen.value = false;
                                    },
                                }, [
                                    h('span', { class: 'cli-panel-status-icon', innerHTML: '&#9881;' }),
                                    h('span', { class: 'cli-panel-status-label' }, `${statusServiceCount.value.running}/${statusServiceCount.value.total} services`),
                                ])
                                : null,
                            // Last command
                            statusLastCommand.value
                                ? h('span', { class: 'cli-panel-status-item' }, [
                                    h('span', { class: ['cli-panel-status-icon', statusLastCommand.value.success ? 'status-success' : 'status-error'].join(' '), innerHTML: statusLastCommand.value.success ? '&#10003;' : '&#10005;' }),
                                    h('span', { class: 'cli-panel-status-label' }, statusLastCommand.value.name),
                                ])
                                : null,
                            // Server connection
                            statusServerState.value !== 'none'
                                ? h('span', {
                                    class: 'cli-panel-status-item status-clickable',
                                    onClick: (e: MouseEvent) => {
                                        e.stopPropagation();
                                        serversDropdownTriggerRect.value = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                        serversDropdownOpen.value = !serversDropdownOpen.value;
                                        servicesDropdownOpen.value = false;
                                    },
                                }, [
                                    h('span', { class: ['cli-panel-status-dot', statusServerState.value === 'connected' ? 'dot-idle' : 'dot-error'].join(' ') }),
                                    h('span', { class: 'cli-panel-status-label' }, `${statusServerDetails.value.filter(s => s.connected).length}/${statusServerDetails.value.length} servers`),
                                ])
                                : null,
                            // Uptime
                            statusUptime.value > 0
                                ? h('span', { class: 'cli-panel-status-item status-muted' }, [
                                    h('span', { class: 'cli-panel-status-icon', innerHTML: '&uarr;' }),
                                    h('span', { class: 'cli-panel-status-label' }, formattedUptime.value),
                                ])
                                : null,
                            // Custom notification
                            notification.value
                                ? h('span', { class: `cli-panel-status-item status-text level-${notification.value.level}` }, [
                                    h('span', { class: 'cli-panel-status-label' }, notification.value.message),
                                ])
                                : null,
                        ].filter(Boolean))
                        : null,
                    h('div', { class: 'cli-panel-action-buttons' }, [
                        h('div', {
                            class: 'cli-panel-btn-position-wrapper',
                            onClick: (e: MouseEvent) => e.stopPropagation(),
                        }, [
                            h('button', {
                                class: 'cli-panel-btn cli-panel-btn-position',
                                title: 'Move panel',
                                onClick: togglePositionDropdown,
                            }, [positionIcon(resolvedPosition.value)]),
                            positionDropdownOpen.value
                                ? h('div', { class: 'cli-panel-position-dropdown' },
                                    (['bottom', 'top', 'left', 'right'] as CliPanelPosition[]).map(pos =>
                                        h('button', {
                                            class: ['cli-panel-position-dropdown-item', resolvedPosition.value === pos ? 'active' : ''].filter(Boolean).join(' '),
                                            onClick: () => selectPosition(pos),
                                        }, [
                                            positionIcon(pos, 16),
                                            pos.charAt(0).toUpperCase() + pos.slice(1),
                                        ]),
                                    ),
                                )
                                : null,
                        ]),
                        hideable.value
                            ? h('button', {
                                class: 'cli-panel-btn cli-panel-btn-hide',
                                title: 'Hide',
                                onClick: handleHide,
                            }, [hideIcon()])
                            : null,
                        h(
                            'button',
                            {
                                class: 'cli-panel-btn',
                                title: resolvedMaximized.value ? 'Restore' : 'Maximize',
                                disabled: resolvedCollapsed.value,
                                onClick: toggleMaximize,
                            },
                            [resolvedMaximized.value ? restoreIcon() : maximizeIcon()],
                        ),
                        h(
                            'button',
                            {
                                class: 'cli-panel-btn',
                                title: resolvedCollapsed.value ? 'Expand' : 'Collapse',
                                onClick: toggle,
                            },
                            [collapseChevron(resolvedPosition.value, resolvedCollapsed.value)],
                        ),
                        closable.value
                            ? h(
                                  'button',
                                  {
                                      class: 'cli-panel-btn cli-panel-btn-close',
                                      title: 'Close',
                                      onClick: handleClose,
                                  },
                                  [closeIcon()],
                              )
                            : null,
                    ]),
                ]),
                h('div', { class: ['cli-panel-glow-line', statusExecutionState.value === 'running' ? 'glow-active' : ''].filter(Boolean).join(' ') }),
            ]);

            const contentEl =
                initialized.value
                    ? h('div', { class: 'cli-panel-content', style: resolvedCollapsed.value ? { display: 'none' } : undefined }, [
                          // Tab bar
                          h('div', { class: 'cli-panel-tabs' }, [
                              h(
                                  'ul',
                                  { class: 'cli-panel-tab-list' },
                                  tabs.value.map((tab) =>
                                      h(
                                          'li',
                                          {
                                              key: tab.id,
                                              class: [
                                                  'cli-panel-tab',
                                                  tab.id ===
                                                      resolvedActiveTabId.value &&
                                                      'active',
                                              ]
                                                  .filter(Boolean)
                                                  .join(' '),
                                              onClick: () => selectTab(tab.id),
                                              onDblclick: () =>
                                                  startRename(tab.id),
                                              onContextmenu: (
                                                  e: MouseEvent,
                                              ) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  contextMenu.value = {
                                                      visible: true,
                                                      x: e.clientX,
                                                      y: e.clientY,
                                                      tabId: tab.id,
                                                  };
                                              },
                                          },
                                          tab.isEditing
                                              ? [
                                                    h('input', {
                                                        class: 'cli-panel-tab-rename-input',
                                                        type: 'text',
                                                        value: tab.title,
                                                        onKeydown: (
                                                            e: KeyboardEvent,
                                                        ) => {
                                                            if (
                                                                e.key ===
                                                                'Enter'
                                                            )
                                                                commitRename(
                                                                    tab.id,
                                                                    (
                                                                        e.target as HTMLInputElement
                                                                    ).value,
                                                                );
                                                            else if (
                                                                e.key ===
                                                                'Escape'
                                                            ) {
                                                                tab.isEditing = false;
                                                            }
                                                        },
                                                        onBlur: (
                                                            e: FocusEvent,
                                                        ) =>
                                                            commitRename(
                                                                tab.id,
                                                                (
                                                                    e.target as HTMLInputElement
                                                                ).value,
                                                            ),
                                                        onClick: (
                                                            e: MouseEvent,
                                                        ) =>
                                                            e.stopPropagation(),
                                                        onDblclick: (
                                                            e: MouseEvent,
                                                        ) =>
                                                            e.stopPropagation(),
                                                    }),
                                                ]
                                              : [
                                                    h('span', { class: ['cli-panel-tab-dot', (() => {
                                                        if (tab.id !== resolvedActiveTabId.value) return 'dot-idle';
                                                        if (statusExecutionState.value === 'running') return 'dot-running';
                                                        if (statusLastCommand.value && !statusLastCommand.value.success) return 'dot-error';
                                                        return 'dot-idle';
                                                    })()].join(' ') }),
                                                    h(
                                                        'span',
                                                        {
                                                            class: 'cli-panel-tab-title',
                                                        },
                                                        tab.title,
                                                    ),
                                                    h(
                                                        'button',
                                                        {
                                                            class: 'cli-panel-tab-close-btn',
                                                            title: 'Close tab',
                                                            onClick: (
                                                                e: MouseEvent,
                                                            ) => {
                                                                e.stopPropagation();
                                                                closeTab(
                                                                    tab.id,
                                                                );
                                                            },
                                                        },
                                                        '\u00d7',
                                                    ),
                                                ],
                                      ),
                                  ),
                              ),
                              h(
                                  'button',
                                  {
                                      class: 'cli-panel-add-tab',
                                      title: 'New terminal',
                                      onClick: () => addTab(),
                                  },
                                  '+',
                              ),
                          ]),
                          // Terminal instances
                          h(
                              'div',
                              { class: 'cli-panel-instances' },
                              tabs.value.map((tab) =>
                                  h(
                                      'div',
                                      {
                                          key: tab.id,
                                          class: 'cli-panel-instance',
                                          style: {
                                              display:
                                                  tab.id === resolvedActiveTabId.value
                                                      ? undefined
                                                      : 'none',
                                          },
                                      },
                                      [
                                          h(
                                              'div',
                                              {
                                                  class: [
                                                      'cli-panel-panes-container',
                                                      paneResizing.value &&
                                                          'resizing',
                                                  ]
                                                      .filter(Boolean)
                                                      .join(' '),
                                              },
                                              tab.panes.flatMap((pane, i) => {
                                                  const nodes: any[] = [];
                                                  if (i > 0) {
                                                      nodes.push(
                                                          h(
                                                              'div',
                                                              {
                                                                  class: 'cli-panel-pane-divider',
                                                                  onMousedown: (
                                                                      e: MouseEvent,
                                                                  ) =>
                                                                      onPaneResizeStart(
                                                                          e,
                                                                          tab.id,
                                                                          i - 1,
                                                                      ),
                                                              },
                                                              [
                                                                  h('div', {
                                                                      class: 'cli-panel-pane-divider-grip',
                                                                  }),
                                                              ],
                                                          ),
                                                      );
                                                  }
                                                  nodes.push(
                                                      h(
                                                          'div',
                                                          {
                                                              class: [
                                                                  'cli-panel-pane',
                                                                  pane.id ===
                                                                      activePaneId.value &&
                                                                      tab.id ===
                                                                          resolvedActiveTabId.value &&
                                                                      'active-pane',
                                                              ]
                                                                  .filter(
                                                                      Boolean,
                                                                  )
                                                                  .join(' '),
                                                              style: {
                                                                  flex: `${pane.widthPercent} 1 0`,
                                                              },
                                                              onClick: () => {
                                                                  activePaneId.value =
                                                                      pane.id;
                                                                  updateActiveTabId(tab.id);
                                                              },
                                                          },
                                                          [
                                                              tab.panes.length >
                                                              1
                                                                  ? h(
                                                                        'button',
                                                                        {
                                                                            class: 'cli-panel-pane-close-btn',
                                                                            title: 'Close pane',
                                                                            onClick:
                                                                                (
                                                                                    e: MouseEvent,
                                                                                ) => {
                                                                                    e.stopPropagation();
                                                                                    closePane(
                                                                                        pane.id,
                                                                                    );
                                                                                },
                                                                        },
                                                                        '\u00d7',
                                                                    )
                                                                  : null,
                                                              h(Cli, {
                                                                  options:
                                                                      mergedOptions.value,
                                                                  modules:
                                                                      mergedModules.value,
                                                                  processors:
                                                                      mergedProcessors.value,
                                                                  services:
                                                                      mergedServices.value,
                                                                  snapshot: pane.snapshot,
                                                                  style: {
                                                                      height: '100%',
                                                                  },
                                                                  onReady: (engine: CliEngine) => {
                                                                      engineMap.set(pane.id, engine);
                                                                  },
                                                              }),
                                                          ],
                                                      ),
                                                  );
                                                  return nodes;
                                              }),
                                          ),
                                      ],
                                  ),
                              ),
                          ),
                      ])
                    : null;

            const contextMenuEl = contextMenu.value.visible
                ? h(
                      'div',
                      {
                          class: 'cli-panel-context-menu',
                          style: {
                              left: `${contextMenu.value.x}px`,
                              top: `${contextMenu.value.y}px`,
                          },
                          onClick: (e: MouseEvent) => e.stopPropagation(),
                      },
                      [
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  onClick: () => {
                                      closeContextMenu();
                                      startRename(contextMenu.value.tabId);
                                  },
                              },
                              'Rename',
                          ),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  onClick: () => {
                                      const tab = tabs.value.find(
                                          (t) =>
                                              t.id === contextMenu.value.tabId,
                                      );
                                      closeContextMenu();
                                      if (!tab) return;

                                      const sourceEngine = engineMap.get(tab.panes[0]?.id);
                                      const snapshot = sourceEngine?.snapshot();

                                      const paneId = nextPaneId++;
                                      const tabId = nextTabId++;
                                      const idx = tabs.value.indexOf(tab);
                                      tabs.value.splice(idx + 1, 0, {
                                          id: tabId,
                                          title: `${tab.title} (copy)`,
                                          isEditing: false,
                                          panes: [
                                              { id: paneId, widthPercent: 100, snapshot },
                                          ],
                                      });
                                      updateActiveTabId(tabId);
                                      activePaneId.value = paneId;
                                  },
                              },
                              'Duplicate',
                          ),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  onClick: () => {
                                      closeContextMenu();
                                      splitPane(contextMenu.value.tabId);
                                  },
                              },
                              'Split Right',
                          ),
                          h('div', {
                              class: 'cli-panel-context-menu-separator',
                          }),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  onClick: () => {
                                      closeContextMenu();
                                      closeTab(contextMenu.value.tabId);
                                  },
                              },
                              'Close',
                          ),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  disabled: tabs.value.length <= 1,
                                  onClick: () => {
                                      const id = contextMenu.value.tabId;
                                      closeContextMenu();
                                      tabs.value = tabs.value.filter(
                                          (t) => t.id === id,
                                      );
                                      updateActiveTabId(id);
                                  },
                              },
                              'Close Others',
                          ),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item',
                                  onClick: () => {
                                      const id = contextMenu.value.tabId;
                                      closeContextMenu();
                                      const idx = tabs.value.findIndex(
                                          (t) => t.id === id,
                                      );
                                      if (idx !== -1)
                                          tabs.value = tabs.value.slice(
                                              0,
                                              idx + 1,
                                          );
                                  },
                              },
                              'Close to the Right',
                          ),
                          h('div', {
                              class: 'cli-panel-context-menu-separator',
                          }),
                          h(
                              'button',
                              {
                                  class: 'cli-panel-context-menu-item destructive',
                                  onClick: () => {
                                      closeContextMenu();
                                      tabs.value = [];
                                      initialized.value = false;
                                      updateCollapsed(true);
                                  },
                              },
                              'Close All',
                          ),
                      ],
                  )
                : null;

            const hideTabEl = resolvedHidden.value
                ? h('button', {
                    class: 'cli-panel-hide-tab',
                    'data-position': resolvedPosition.value,
                    'data-hide-align': hideAlignment.value,
                    style: themeStyles.value,
                    title: 'Show CLI',
                    onClick: handleUnhide,
                }, [
                    h('svg', { class: 'cli-panel-hide-tab-icon', ...svgAttrs, width: '16', height: '16', 'stroke-width': '2' }, [
                        h('polyline', { points: '4 17 10 11 4 5' }),
                        h('line', { x1: '12', y1: '19', x2: '20', y2: '19' }),
                    ]),
                    h('span', { class: 'cli-panel-hide-tab-label' }, 'CLI'),
                    hideTabChevron(resolvedPosition.value),
                ])
                : null;

            // Services dropdown
            const servicesDropdownEl = servicesDropdownOpen.value && statusServiceCount.value.total > 0
                ? h('div', {
                    class: 'cli-panel-services-dropdown',
                    style: (() => {
                        const rect = servicesDropdownTriggerRect.value;
                        if (!rect) return {};
                        return resolvedPosition.value === 'top'
                            ? { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 1100 }
                            : { position: 'fixed', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px`, zIndex: 1100 };
                    })(),
                    onClick: (e: MouseEvent) => e.stopPropagation(),
                }, [
                    h('div', { class: 'cli-panel-services-dropdown-header' }, 'Background Services'),
                    h('div', { class: 'cli-panel-services-dropdown-list' },
                        statusServiceDetails.value.map((svc, i) =>
                            h('div', { key: i, class: 'cli-panel-services-dropdown-item' }, [
                                h('span', { class: ['cli-panel-svc-dot', svc.status === 'running' ? 'svc-running' : 'svc-stopped'].join(' ') }),
                                h('div', { class: 'cli-panel-svc-info' }, [
                                    h('span', { class: 'cli-panel-svc-name' }, svc.name),
                                    svc.description ? h('span', { class: 'cli-panel-svc-desc' }, svc.description) : null,
                                ].filter(Boolean)),
                                h('span', { class: 'cli-panel-svc-status' }, svc.status),
                            ]),
                        ),
                    ),
                    statusServiceDetails.value.length === 0
                        ? h('div', { class: 'cli-panel-services-dropdown-empty' }, 'No services registered')
                        : null,
                ].filter(Boolean))
                : null;

            // Servers dropdown
            const serversDropdownEl = serversDropdownOpen.value && statusServerState.value !== 'none'
                ? h('div', {
                    class: 'cli-panel-services-dropdown',
                    style: (() => {
                        const rect = serversDropdownTriggerRect.value;
                        if (!rect) return {};
                        return resolvedPosition.value === 'top'
                            ? { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, zIndex: 1100 }
                            : { position: 'fixed', bottom: `${window.innerHeight - rect.top + 4}px`, left: `${rect.left}px`, zIndex: 1100 };
                    })(),
                    onClick: (e: MouseEvent) => e.stopPropagation(),
                }, [
                    h('div', { class: 'cli-panel-services-dropdown-header' }, 'Server Connections'),
                    h('div', { class: 'cli-panel-services-dropdown-list' },
                        statusServerDetails.value.map((srv, i) =>
                            h('div', { key: i, class: 'cli-panel-services-dropdown-item' }, [
                                h('span', { class: ['cli-panel-svc-dot', srv.connected ? 'svc-running' : 'svc-stopped'].join(' ') }),
                                h('div', { class: 'cli-panel-svc-info' }, [
                                    h('span', { class: 'cli-panel-svc-name' }, srv.name),
                                    srv.url ? h('span', { class: 'cli-panel-svc-desc' }, srv.url) : null,
                                ].filter(Boolean)),
                                h('div', { class: 'cli-panel-srv-meta' }, [
                                    h('span', { class: 'cli-panel-svc-status' }, srv.connected ? 'connected' : 'disconnected'),
                                    srv.apiVersion ? h('span', { class: 'cli-panel-svc-desc' }, `v${srv.apiVersion}`) : null,
                                    srv.commandCount ? h('span', { class: 'cli-panel-svc-desc' }, `${srv.commandCount} cmds`) : null,
                                ].filter(Boolean)),
                            ]),
                        ),
                    ),
                    statusServerDetails.value.length === 0
                        ? h('div', { class: 'cli-panel-services-dropdown-empty' }, 'No servers configured')
                        : null,
                ].filter(Boolean))
                : null;

            return h('div', {}, [
                hideTabEl,
                h(
                    'div',
                    {
                        class: wrapperClass,
                        style: wrapperStyle,
                        'data-position': resolvedPosition.value,
                        'data-resizable': String(resizable.value),
                        'data-closable': String(closable.value),
                        'data-hideable': String(hideable.value),
                    },
                    [headerEl, contentEl],
                ),
                contextMenuEl,
                servicesDropdownEl,
                serversDropdownEl,
            ]);
        };
    },
});
