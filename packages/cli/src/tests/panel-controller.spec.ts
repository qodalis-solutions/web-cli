import { CliEngine } from '../lib/engine';
import {
    CliPanelCallbacks,
    CliPanelController,
    CliPanelSnapshot,
    computeGlobalStatus,
    computeTabStatus,
    contextMenuItems,
    openStatusDropdown,
    runContextMenuAction,
    statusIndicators,
    tabDotClass,
    EXEC_POLL_MS,
    GLOBAL_POLL_MS,
} from '../lib/panel';

interface FakeEngine {
    engine: CliEngine;
    context: any;
    destroy: jasmine.Spy;
    focus: jasmine.Spy;
}

function fakeEngine(overrides: Partial<{ context: any; startedAt: number; options: any }> = {}): FakeEngine {
    const context = {
        isExecuting: false,
        contextProcessor: undefined,
        lastCommandResult: undefined,
        notifier: { current: undefined, change$: undefined },
        backgroundServices: { list: () => [], on: () => () => undefined },
        services: { get: () => undefined },
        ...overrides.context,
    };
    const destroy = jasmine.createSpy('destroy');
    const focus = jasmine.createSpy('focus');
    const engine = {
        getContext: () => context,
        destroy,
        focus,
        snapshot: () => ({ lines: ['copied'] }),
        getTerminal: () => ({ options: { theme: { background: '#000000', foreground: '#ffffff' } } }),
        startedAt: overrides.startedAt,
        options: overrides.options,
    } as unknown as CliEngine;
    return { engine, context, destroy, focus };
}

function createController(callbacks: CliPanelCallbacks = {}, config = {}) {
    return new CliPanelController({
        config,
        callbacks,
        persistPosition: false,
        viewport: () => ({ width: 1000, height: 800 }),
    });
}

describe('CliPanelController', () => {
    let controller: CliPanelController;
    let changes: number;

    beforeEach(() => {
        jasmine.clock().install();
        changes = 0;
        controller = createController();
        controller.subscribe(() => changes++);
    });

    afterEach(() => {
        controller.destroy();
        jasmine.clock().uninstall();
    });

    const snap = (): CliPanelSnapshot => controller.getSnapshot();

    describe('initial state', () => {
        it('starts collapsed, visible, without tabs', () => {
            expect(snap().collapsed).toBeTrue();
            expect(snap().hidden).toBeFalse();
            expect(snap().visible).toBeTrue();
            expect(snap().initialized).toBeFalse();
            expect(snap().tabs).toEqual([]);
            expect(snap().position).toBe('bottom');
            expect(snap().height).toBe(600);
            expect(snap().width).toBe(400);
        });

        it('honours the config', () => {
            const c = createController({}, { isCollapsed: false, isHidden: true, position: 'left', closable: false, hideable: false });
            expect(c.getSnapshot().collapsed).toBeFalse();
            expect(c.getSnapshot().hidden).toBeTrue();
            expect(c.getSnapshot().position).toBe('left');
            expect(c.getSnapshot().isHorizontal).toBeTrue();
            expect(c.getSnapshot().showStatusIndicators).toBeFalse();
            expect(c.getSnapshot().closable).toBeFalse();
            expect(c.getSnapshot().hideable).toBeFalse();
            c.destroy();
        });
    });

    describe('collapse / open', () => {
        it('creates the first tab when expanded for the first time', () => {
            const onCollapsedChange = jasmine.createSpy('onCollapsedChange');
            const onTabAdded = jasmine.createSpy('onTabAdded');
            controller.callbacks = { onCollapsedChange, onTabAdded };

            controller.toggle();

            expect(snap().collapsed).toBeFalse();
            expect(snap().initialized).toBeTrue();
            expect(snap().tabs.length).toBe(1);
            expect(snap().tabs[0].title).toBe('Terminal 1');
            expect(snap().activeTabId).toBe(1);
            expect(snap().activePaneId).toBe(1);
            expect(onCollapsedChange).toHaveBeenCalledWith(false);
            expect(onTabAdded).toHaveBeenCalledWith({ tabId: 1 });
        });

        it('collapses without touching the tabs', () => {
            controller.toggle();
            controller.toggle();
            expect(snap().collapsed).toBeTrue();
            expect(snap().tabs.length).toBe(1);
            controller.toggle();
            expect(snap().tabs.length).toBe(1);
        });

        it('open() makes the panel visible, unhidden and expanded', () => {
            controller.close();
            controller.hide();
            controller.open();
            expect(snap().visible).toBeTrue();
            expect(snap().hidden).toBeFalse();
            expect(snap().collapsed).toBeFalse();
            expect(snap().tabs.length).toBe(1);
        });

        it('produces a new snapshot object on every change', () => {
            const before = snap();
            controller.toggle();
            expect(snap()).not.toBe(before);
            expect(changes).toBeGreaterThan(0);
        });
    });

    describe('hide / unhide', () => {
        it('restores the pre-hide collapsed state', () => {
            const onHiddenChange = jasmine.createSpy('onHiddenChange');
            controller.callbacks = { onHiddenChange };
            controller.toggle();
            controller.hide();
            expect(snap().hidden).toBeTrue();
            expect(onHiddenChange).toHaveBeenCalledWith(true);
            controller.unhide();
            expect(snap().hidden).toBeFalse();
            expect(snap().collapsed).toBeFalse();
        });

        it('toggleHide flips the state', () => {
            controller.toggleHide();
            expect(snap().hidden).toBeTrue();
            controller.toggleHide();
            expect(snap().hidden).toBeFalse();
        });
    });

    describe('maximize', () => {
        it('fills the viewport and restores the previous size', () => {
            const onHeightChange = jasmine.createSpy('onHeightChange');
            const onMaximizedChange = jasmine.createSpy('onMaximizedChange');
            controller.callbacks = { onHeightChange, onMaximizedChange };
            controller.toggle();
            controller.resize({ height: 300 });
            controller.toggleMaximize();
            expect(snap().maximized).toBeTrue();
            expect(snap().height).toBe(800);
            expect(onMaximizedChange).toHaveBeenCalledWith(true);
            controller.toggleMaximize();
            expect(snap().maximized).toBeFalse();
            expect(snap().height).toBe(300);
            expect(onHeightChange).toHaveBeenCalledWith(300);
        });

        it('uses the width for side positions', () => {
            controller.setPosition('right');
            controller.maximize();
            expect(snap().width).toBe(1000);
            controller.restore();
            expect(snap().width).toBe(400);
        });
    });

    describe('position', () => {
        it('notifies and closes the dropdown', () => {
            const onPositionChange = jasmine.createSpy('onPositionChange');
            controller.callbacks = { onPositionChange };
            controller.togglePositionDropdown();
            expect(snap().positionDropdownOpen).toBeTrue();
            controller.setPosition('top');
            expect(snap().position).toBe('top');
            expect(snap().positionDropdownOpen).toBeFalse();
            expect(onPositionChange).toHaveBeenCalledWith('top');
        });
    });

    describe('controlled values', () => {
        it('lets the host override state while still reporting changes', () => {
            const onCollapsedChange = jasmine.createSpy('onCollapsedChange');
            controller.callbacks = { onCollapsedChange };
            controller.setControlled({ collapsed: true });
            controller.toggle();
            expect(onCollapsedChange).toHaveBeenCalledWith(false);
            // Host has not updated its value yet: still collapsed.
            expect(snap().collapsed).toBeTrue();
            controller.setControlled({ collapsed: false });
            expect(snap().collapsed).toBeFalse();
        });

        it('ignores unchanged controlled values', () => {
            controller.setControlled({ height: 500 });
            const before = snap();
            const count = changes;
            controller.setControlled({ height: 500 });
            expect(snap()).toBe(before);
            expect(changes).toBe(count);
        });

        it('falls back to internal state when control is released', () => {
            controller.setControlled({ position: 'left' });
            expect(snap().position).toBe('left');
            controller.setControlled({ position: undefined });
            expect(snap().position).toBe('bottom');
        });
    });

    describe('tabs', () => {
        beforeEach(() => controller.toggle());

        it('adds, selects and closes tabs', () => {
            const onTabClosed = jasmine.createSpy('onTabClosed');
            const onActiveTabIdChange = jasmine.createSpy('onActiveTabIdChange');
            controller.callbacks = { onTabClosed, onActiveTabIdChange };

            const second = controller.addTab('Build');
            expect(snap().tabs.map((t) => t.title)).toEqual(['Terminal 1', 'Build']);
            expect(snap().activeTabId).toBe(second);

            controller.selectTab(1);
            expect(snap().activeTabId).toBe(1);
            expect(onActiveTabIdChange).toHaveBeenCalledWith(1);

            controller.closeTab(1);
            expect(snap().tabs.length).toBe(1);
            expect(snap().activeTabId).toBe(second);
            expect(onTabClosed).toHaveBeenCalledWith({ tabId: 1 });
        });

        it('selects the neighbour when the active tab closes', () => {
            const t2 = controller.addTab();
            const t3 = controller.addTab();
            controller.selectTab(t2);
            controller.closeTab(t2);
            expect(snap().activeTabId).toBe(t3);
            controller.closeTab(t3);
            expect(snap().activeTabId).toBe(1);
        });

        it('collapses again when the last tab closes', () => {
            controller.closeTab(1);
            expect(snap().tabs).toEqual([]);
            expect(snap().initialized).toBeFalse();
            expect(snap().collapsed).toBeTrue();
            controller.toggle();
            expect(snap().tabs.length).toBe(1);
            expect(snap().tabs[0].id).toBe(2);
        });

        it('ignores unknown ids', () => {
            const before = snap();
            controller.closeTab(99);
            controller.selectTab(99);
            controller.renameTab(99, 'x');
            expect(snap().tabs).toEqual(before.tabs);
        });

        it('renames inline, keeping the old title for an empty value', () => {
            controller.startRename(1);
            expect(snap().tabs[0].isEditing).toBeTrue();
            controller.commitRename(1, '   ');
            expect(snap().tabs[0].title).toBe('Terminal 1');
            expect(snap().tabs[0].isEditing).toBeFalse();
            controller.startRename(1);
            controller.commitRename(1, ' Logs ');
            expect(snap().tabs[0].title).toBe('Logs');
            controller.renameTab(1, 'API');
            expect(snap().tabs[0].title).toBe('API');
        });

        it('cancels a rename on Escape', () => {
            controller.startRename(1);
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(snap().tabs[0].isEditing).toBeFalse();
        });

        it('duplicates a tab with a snapshot of its terminal', () => {
            const fake = fakeEngine();
            controller.registerEngine(1, 1, fake.engine);
            const copy = controller.duplicateTab(1);
            expect(snap().tabs.map((t) => t.title)).toEqual(['Terminal 1', 'Terminal 1 (copy)']);
            expect(snap().tabs[1].panes[0].snapshot).toEqual({ lines: ['copied'] } as any);
            expect(snap().activeTabId).toBe(copy);
        });

        it('closes others and to the right, destroying their engines', () => {
            const onTabClosed = jasmine.createSpy('onTabClosed');
            controller.callbacks = { onTabClosed };
            const t2 = controller.addTab();
            const t3 = controller.addTab();
            const t4 = controller.addTab();
            const e4 = fakeEngine();
            controller.registerEngine(t4, snap().tabs[3].panes[0].id, e4.engine);

            controller.closeTabsToTheRight(t3);
            expect(snap().tabs.map((t) => t.id)).toEqual([1, t2, t3]);
            expect(e4.destroy).toHaveBeenCalled();
            expect(snap().activeTabId).toBe(t3);
            expect(onTabClosed).toHaveBeenCalledWith({ tabId: t4 });

            controller.closeOtherTabs(t2);
            expect(snap().tabs.map((t) => t.id)).toEqual([t2]);
            expect(snap().activeTabId).toBe(t2);
        });

        it('close all resets the panel', () => {
            controller.addTab();
            controller.closeAllTabs();
            expect(snap().tabs).toEqual([]);
            expect(snap().initialized).toBeFalse();
            expect(snap().collapsed).toBeTrue();
        });

        it('exposes the state through getState()', () => {
            controller.addTab('Two');
            const state = controller.getState();
            expect(state.tabs.map((t) => t.title)).toEqual(['Terminal 1', 'Two']);
            expect(state.activeTabId).toBe(2);
            expect(state.tabs[0].panes[0].widthPercent).toBe(100);
        });
    });

    describe('panes', () => {
        beforeEach(() => controller.toggle());

        it('splits the active tab evenly', () => {
            const onPaneSplit = jasmine.createSpy('onPaneSplit');
            controller.callbacks = { onPaneSplit };
            const paneId = controller.splitPane();
            expect(snap().tabs[0].panes.map((p) => p.widthPercent)).toEqual([50, 50]);
            expect(snap().activePaneId).toBe(paneId);
            expect(onPaneSplit).toHaveBeenCalledWith({ paneId, tabId: 1 });
            expect(controller.splitPane(99)).toBe(-1);
        });

        it('closes a pane and renormalizes widths', () => {
            const onPaneClosed = jasmine.createSpy('onPaneClosed');
            controller.callbacks = { onPaneClosed };
            const second = controller.splitPane();
            const third = controller.splitPane();
            const fake = fakeEngine();
            controller.registerEngine(1, third, fake.engine);

            controller.closePane(third);
            expect(fake.destroy).toHaveBeenCalled();
            expect(snap().tabs[0].panes.map((p) => p.id)).toEqual([1, second]);
            expect(snap().tabs[0].panes.map((p) => Math.round(p.widthPercent))).toEqual([50, 50]);
            expect(snap().activePaneId).toBe(second);
            expect(onPaneClosed).toHaveBeenCalledWith({ paneId: third });
        });

        it('closing the only pane closes the tab', () => {
            controller.addTab();
            controller.closePane(1);
            expect(snap().tabs.length).toBe(1);
        });

        it('activatePane switches tab and focuses the terminal', () => {
            const t2 = controller.addTab();
            const fake = fakeEngine();
            controller.registerEngine(1, 1, fake.engine);
            controller.activatePane(1, 1);
            expect(snap().activeTabId).toBe(1);
            expect(snap().activePaneId).toBe(1);
            jasmine.clock().tick(1);
            expect(fake.focus).toHaveBeenCalled();
            expect(t2).toBe(2);
        });

        it('returns the engine of the active pane', () => {
            const fake = fakeEngine();
            controller.registerEngine(1, 1, fake.engine);
            expect(controller.getEngine()).toBe(fake.engine);
            expect(controller.getEngine(42)).toBeUndefined();
        });
    });

    describe('context menu and dropdowns', () => {
        beforeEach(() => controller.toggle());

        it('opens on a tab and closes on an outside click', () => {
            controller.openContextMenu(1, 10, 20);
            expect(snap().contextMenu).toEqual({ visible: true, x: 10, y: 20, tabId: 1 });
            document.dispatchEvent(new MouseEvent('click'));
            expect(snap().contextMenu.visible).toBeFalse();
        });

        it('runs context-menu actions against the menu tab', () => {
            controller.addTab();
            controller.openContextMenu(1, 0, 0);
            runContextMenuAction(controller, 'split-right');
            expect(snap().tabs[0].panes.length).toBe(2);
            expect(snap().contextMenu.visible).toBeFalse();

            controller.openContextMenu(1, 0, 0);
            runContextMenuAction(controller, 'close');
            expect(snap().tabs.map((t) => t.id)).toEqual([2]);

            expect(contextMenuItems(snap()).find((i) => i.action === 'close-others')?.disabled).toBeTrue();
        });

        it('only one dropdown is open at a time', () => {
            controller.toggleServicesDropdown();
            expect(snap().servicesDropdownOpen).toBeTrue();
            controller.toggleServersDropdown();
            expect(snap().servicesDropdownOpen).toBeFalse();
            expect(snap().serversDropdownOpen).toBeTrue();
            controller.togglePositionDropdown();
            expect(snap().serversDropdownOpen).toBeFalse();
            expect(snap().positionDropdownOpen).toBeTrue();
            controller.closeMenus();
            expect(snap().positionDropdownOpen).toBeFalse();
        });

        it('positions a dropdown next to its anchor', () => {
            const anchor = document.createElement('span');
            spyOn(anchor, 'getBoundingClientRect').and.returnValue({ top: 700, bottom: 720, left: 50, right: 90 } as DOMRect);
            controller.toggleServicesDropdown(anchor);
            expect(snap().servicesDropdownStyle).toEqual(jasmine.objectContaining({ bottom: '104px', left: '50px' }));
        });
    });

    describe('drag resizing', () => {
        it('resizes the panel from the resize bar', () => {
            const onHeightChange = jasmine.createSpy('onHeightChange');
            controller.callbacks = { onHeightChange };
            controller.startPanelResize(0, 500);
            expect(snap().collapsed).toBeFalse();
            expect(snap().panelResizing).toBeTrue();
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 450 }));
            expect(snap().height).toBe(650);
            expect(onHeightChange).toHaveBeenCalledWith(650);
            document.dispatchEvent(new MouseEvent('mouseup'));
            expect(snap().panelResizing).toBeFalse();
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 0 }));
            expect(snap().height).toBe(650);
        });

        it('does nothing when not resizable', () => {
            const c = createController({}, { resizable: false });
            c.startPanelResize(0, 0);
            expect(c.getSnapshot().panelResizing).toBeFalse();
            c.destroy();
        });

        it('resizes panes from a divider', () => {
            controller.toggle();
            controller.splitPane();
            controller.startPaneResize(1, 0, 100, 1000);
            expect(document.body.classList.contains('cli-pane-resizing')).toBeTrue();
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
            expect(snap().tabs[0].panes.map((p) => p.widthPercent)).toEqual([60, 40]);
            document.dispatchEvent(new MouseEvent('mouseup'));
            expect(snap().paneResizing).toBeFalse();
            expect(document.body.classList.contains('cli-pane-resizing')).toBeFalse();
        });
    });

    describe('status', () => {
        beforeEach(() => controller.toggle());

        it('polls execution state and notifications', () => {
            const fake = fakeEngine();
            controller.registerEngine(1, 1, fake.engine);
            expect(snap().status.executionState).toBe('idle');

            fake.context.isExecuting = true;
            jasmine.clock().tick(EXEC_POLL_MS);
            expect(snap().status.executionState).toBe('running');
            expect(statusIndicators(snap())[0].dotClass).toBe('dot-running');
            expect(tabDotClass(snap().tabStatuses[1])).toBe('dot-running');

            fake.context.isExecuting = false;
            fake.context.lastCommandResult = { command: 'ls', success: false };
            fake.context.notifier.current = { message: 'hello', level: 'info' };
            jasmine.clock().tick(EXEC_POLL_MS);
            expect(snap().status.lastCommand).toEqual({ name: 'ls', success: false });
            expect(snap().status.notification?.message).toBe('hello');
            expect(tabDotClass(snap().tabStatuses[1])).toBe('dot-error');
            expect(statusIndicators(snap()).map((i) => i.key)).toEqual(['execution', 'lastCommand', 'notification']);
        });

        it('reports services, servers and uptime of the active tab', () => {
            const fake = fakeEngine({
                startedAt: Date.now() - 3 * 60000,
                options: { servers: [{ name: 'api', url: 'http://x' }, { name: 'off', enabled: false }] },
                context: {
                    backgroundServices: {
                        list: () => [
                            { name: 'clock', status: 'running' },
                            { name: 'sync', status: 'stopped', description: 'd' },
                        ],
                        on: () => () => undefined,
                    },
                },
            });
            controller.registerEngine(1, 1, fake.engine);
            const g = snap().global;
            expect(g.serviceCount).toEqual({ running: 1, total: 2 });
            expect(g.serverState).toBe('disconnected');
            expect(g.serverDetails).toEqual([{ name: 'api', url: 'http://x', connected: false }]);
            expect(g.uptime).toBeGreaterThanOrEqual(3 * 60000);
            expect(snap().formattedUptime).toBe('3m');
            expect(statusIndicators(snap()).map((i) => i.key)).toEqual(['execution', 'services', 'servers', 'uptime']);
        });

        it('uses connected servers from the server manager', () => {
            const connections = new Map([
                ['a', { connected: true, config: { url: 'u' }, apiVersion: '2', commands: [1, 2] }],
                ['b', { connected: false, config: { url: 'v' } }],
            ]);
            const fake = fakeEngine({ context: { services: { get: () => ({ connections }) } } });
            const g = computeGlobalStatus(fake.engine);
            expect(g.serverState).toBe('connected');
            expect(g.serverDetails[0]).toEqual({ name: 'a', url: 'u', connected: true, apiVersion: '2', commandCount: 2 });
            expect(g.serverDetails[1].apiVersion).toBeUndefined();
        });

        it('describes the open dropdown for the views', () => {
            const connections = new Map([['a', { connected: true, config: { url: 'u' }, apiVersion: '2', commands: [1, 2] }]]);
            const fake = fakeEngine({
                context: {
                    services: { get: () => ({ connections }) },
                    backgroundServices: { list: () => [{ name: 'clock', status: 'stopped' }], on: () => () => undefined },
                },
            });
            controller.registerEngine(1, 1, fake.engine);
            expect(openStatusDropdown(snap())).toBeNull();

            controller.toggleServicesDropdown();
            const services = openStatusDropdown(snap())!;
            expect(services.kind).toBe('services');
            expect(services.rows[0]).toEqual(jasmine.objectContaining({ name: 'clock', status: 'stopped', dotClass: 'cli-panel-svc-dot svc-stopped' }));

            controller.toggleServersDropdown();
            const servers = openStatusDropdown(snap())!;
            expect(servers.kind).toBe('servers');
            expect(servers.rows[0]).toEqual(jasmine.objectContaining({ status: 'connected', description: 'u', meta: ['v2', '2 cmds'] }));
        });

        it('treats a context processor as running', () => {
            const fake = fakeEngine({ context: { contextProcessor: {} } });
            expect(computeTabStatus([fake.engine]).executionState).toBe('running');
        });

        it('stops polling after destroy', () => {
            const fake = fakeEngine();
            controller.registerEngine(1, 1, fake.engine);
            controller.destroy();
            fake.context.isExecuting = true;
            jasmine.clock().tick(GLOBAL_POLL_MS);
            expect(snap().status.executionState).toBe('idle');
        });

        it('drops the status of a closed tab', () => {
            const fake = fakeEngine({ context: { isExecuting: true } });
            controller.registerEngine(1, 1, fake.engine);
            controller.addTab();
            expect(snap().tabStatuses[1]).toBeDefined();
            controller.closeTab(1);
            expect(snap().tabStatuses[1]).toBeUndefined();
        });
    });

    describe('theme sync', () => {
        it('derives panel colours from the terminal theme', () => {
            const c = createController({}, { syncTheme: true });
            c.toggle();
            c.registerEngine(1, 1, fakeEngine().engine);
            expect(c.getSnapshot().themeStyles['--cli-panel-bg']).toBe('#000000');
            c.destroy();
        });

        it('follows terminal style changes and re-attaches when that pane closes', () => {
            const root = document.createElement('div');
            const first = document.createElement('div');
            first.className = 'terminal-container';
            root.appendChild(first);
            const c = createController({}, { syncTheme: true });
            c.setRootElement(root);
            c.toggle();
            const fake = fakeEngine();
            c.registerEngine(1, 1, fake.engine);
            expect((c as any).themeObserver).toBeDefined();

            const second = c.splitPane();
            c.registerEngine(1, second, fakeEngine().engine);
            first.remove();
            const next = document.createElement('div');
            next.className = 'terminal-container';
            root.appendChild(next);
            c.closePane(1);
            expect((c as any).themeObserver).toBeUndefined();
            jasmine.clock().tick(1);
            expect((c as any).themeObserver).toBeDefined();
            c.destroy();
        });
    });
});
