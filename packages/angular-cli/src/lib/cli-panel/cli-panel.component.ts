import {
    Component,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import {
    CliEngineSnapshot,
    CliPanelConfig,
    CliPanelPosition,
    CliPanelState,
    ICliCommandProcessor,
    ICliModule,
    ICliPanelRef,
    derivePanelThemeStyles,
    loadPanelPosition,
    savePanelPosition,
} from '@qodalis/cli-core';
import { CliEngine, CliEngineOptions } from '@qodalis/cli';
import { CliComponent } from '../cli/cli.component';
import { CollapsableContentComponent } from '../collapsable-content/collapsable-content.component';

export interface TerminalPane {
    id: number;
    widthPercent: number;
    snapshot?: CliEngineSnapshot;
}

export interface TerminalTab {
    id: number;
    title: string;
    isEditing: boolean;
    panes: TerminalPane[];
}

export interface TabContextMenu {
    visible: boolean;
    x: number;
    y: number;
    tabId: number;
}

export type CliPanelOptions = CliEngineOptions & CliPanelConfig;

/**
 * A component that displays the CLI on the bottom of page.
 */
@Component({
    standalone: false,
    selector: 'cli-panel',
    templateUrl: './cli-panel.component.html',
    styleUrls: ['./cli-panel.component.sass'],
})
export class CliPanelComponent implements OnInit, OnDestroy, ICliPanelRef<CliEngine> {
    /**
     * The options for the CLI.
     */
    @Input() options?: CliPanelOptions;

    /**
     * Optional list of CLI modules to register with each terminal pane.
     */
    @Input() modules?: ICliModule[];

    /**
     * Optional list of command processors to register with each terminal pane.
     * This allows passing processors without Angular DI (framework-agnostic pattern).
     * @deprecated Use modules instead.
     */
    @Input() processors?: ICliCommandProcessor[];

    @Output() onClose = new EventEmitter<void>();

    // ── Bindable properties (hybrid controlled/uncontrolled) ──
    @Input() collapsed?: boolean;
    @Output() collapsedChange = new EventEmitter<boolean>();

    @Input() hidden?: boolean;
    @Output() hiddenChange = new EventEmitter<boolean>();

    @Input() maximized?: boolean;
    @Output() maximizedChange = new EventEmitter<boolean>();

    @Input() activeTabInput?: number;
    @Output() activeTabIdChange = new EventEmitter<number>();

    @Input() position?: CliPanelPosition;
    @Output() positionChange = new EventEmitter<CliPanelPosition>();

    @Input() height?: number;
    @Output() heightChange = new EventEmitter<number>();

    @Input() width?: number;
    @Output() widthChange = new EventEmitter<number>();

    // ── Structural events ──
    @Output() onTabAdded = new EventEmitter<{ tabId: number }>();
    @Output() onTabClosed = new EventEmitter<{ tabId: number }>();
    @Output() onPaneSplit = new EventEmitter<{ paneId: number; tabId: number }>();
    @Output() onPaneClosed = new EventEmitter<{ paneId: number }>();

    @ViewChild(CollapsableContentComponent)
    collapsableContent!: CollapsableContentComponent;
    @ViewChildren(CliComponent) cliComponents!: QueryList<CliComponent>;

    currentPosition: CliPanelPosition = 'bottom';

    themeStyles: Record<string, string> = {};

    visible = true;

    tabs: TerminalTab[] = [];
    activePaneId = 0;
    private _internalActiveTabId = 0;
    private _internalCollapsed = true;
    private _internalHidden = false;
    private _internalMaximized = false;
    private _internalHeight = 600;
    private _internalWidth = 400;
    private nextTabId = 1;
    private nextPaneId = 1;

    protected get resolvedCollapsed(): boolean {
        return this.collapsed !== undefined ? this.collapsed : this._internalCollapsed;
    }
    protected get resolvedHidden(): boolean {
        return this.hidden !== undefined ? this.hidden : this._internalHidden;
    }
    protected get resolvedMaximized(): boolean {
        return this.maximized !== undefined ? this.maximized : this._internalMaximized;
    }
    protected get resolvedActiveTabId(): number {
        return this.activeTabInput !== undefined ? this.activeTabInput : this._internalActiveTabId;
    }
    protected get resolvedHeight(): number {
        return this.height !== undefined ? this.height : this._internalHeight;
    }
    protected get resolvedWidth(): number {
        return this.width !== undefined ? this.width : this._internalWidth;
    }
    protected get resolvedPosition(): CliPanelPosition {
        return this.position !== undefined ? this.position : this.currentPosition;
    }

    contextMenu: TabContextMenu = {
        visible: false,
        x: 0,
        y: 0,
        tabId: 0,
    };

    paneResizing = false;
    private paneResizeTabId = 0;
    private paneResizeDividerIndex = 0;
    private paneResizeStartX = 0;
    private paneResizeStartWidths: number[] = [];
    private paneResizeContainerWidth = 0;

    private static readonly MIN_PANE_WIDTH_PERCENT = 10;

    protected terminalHeight: string = '100%';

    protected initialized: boolean = false;

    private themeObserver?: MutationObserver;

    constructor(private readonly elementRef: ElementRef) {}

    ngOnInit(): void {
        this.currentPosition = loadPanelPosition() ?? this.options?.position ?? 'bottom';
    }

    ngOnDestroy(): void {
        this.themeObserver?.disconnect();
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (this.contextMenu.visible) {
            this.closeContextMenu();
        }
    }

    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.contextMenu.visible) {
            this.closeContextMenu();
        }
        this.cancelAllEditing();
    }

    onPositionChange(position: CliPanelPosition): void {
        this.currentPosition = position;
        savePanelPosition(this.currentPosition);
        this.positionChange.emit(position);
    }

    onToggle($event: boolean): void {
        this._internalCollapsed = $event;
        this.collapsedChange.emit($event);
        if (!$event && !this.initialized) {
            this.initialized = true;
            this.addTab();
            this.setupThemeSync();
        }
    }

    onContentSizeChange(_event: number) {
        // Terminal height is handled via CSS flex layout
    }

    // --- Tab management ---

    addTab(title?: string): number {
        const pane: TerminalPane = { id: this.nextPaneId++, widthPercent: 100 };
        const tabId = this.nextTabId++;
        const tab: TerminalTab = {
            id: tabId,
            title: title ?? `Terminal ${tabId}`,
            isEditing: false,
            panes: [pane],
        };
        this.tabs.push(tab);
        this._internalActiveTabId = tabId;
        this.activeTabIdChange.emit(tabId);
        this.activePaneId = pane.id;
        this.onTabAdded.emit({ tabId });
        return tabId;
    }

    closeTab(id: number): void {
        const index = this.tabs.findIndex((t) => t.id === id);
        if (index === -1) return;

        this.tabs.splice(index, 1);
        this.onTabClosed.emit({ tabId: id });

        if (this.tabs.length === 0) {
            this.initialized = false;
            this.collapsableContent?.toggleTerminal();
            return;
        }

        if (this.resolvedActiveTabId === id) {
            const nextIndex = Math.min(index, this.tabs.length - 1);
            this.selectTab(this.tabs[nextIndex].id);
        }
    }

    selectTab(id: number): void {
        this._internalActiveTabId = id;
        this.activeTabIdChange.emit(id);
        const tab = this.findTab(id);
        if (tab && tab.panes.length > 0) {
            this.activePaneId = tab.panes[0].id;
        }
        setTimeout(() => {
            this.focusActiveTerminal();
        });
    }

    trackByTabId(_index: number, tab: TerminalTab): number {
        return tab.id;
    }

    trackByPaneId(_index: number, pane: TerminalPane): number {
        return pane.id;
    }

    // --- Inline rename ---

    startRename(tab: TerminalTab): void {
        this.cancelAllEditing();
        tab.isEditing = true;
        setTimeout(() => {
            const input = this.elementRef.nativeElement.querySelector(
                '.tab-rename-input',
            ) as HTMLInputElement | null;
            if (input) {
                input.focus();
                input.select();
            }
        });
    }

    onTabDoubleClick(tab: TerminalTab): void {
        this.startRename(tab);
    }

    commitRename(tab: TerminalTab, value: string): void {
        const trimmed = value.trim();
        if (trimmed) {
            tab.title = trimmed;
        }
        tab.isEditing = false;
    }

    onRenameKeydown(event: KeyboardEvent, tab: TerminalTab): void {
        if (event.key === 'Enter') {
            this.commitRename(tab, (event.target as HTMLInputElement).value);
        } else if (event.key === 'Escape') {
            tab.isEditing = false;
        }
    }

    onRenameBlur(event: FocusEvent, tab: TerminalTab): void {
        if (tab.isEditing) {
            this.commitRename(tab, (event.target as HTMLInputElement).value);
        }
    }

    // --- Context menu ---

    onTabContextMenu(event: MouseEvent, tab: TerminalTab): void {
        event.preventDefault();
        event.stopPropagation();

        this.contextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            tabId: tab.id,
        };
    }

    closeContextMenu(): void {
        this.contextMenu = { ...this.contextMenu, visible: false };
    }

    contextMenuRename(): void {
        const tab = this.findTab(this.contextMenu.tabId);
        this.closeContextMenu();
        if (tab) {
            this.startRename(tab);
        }
    }

    contextMenuDuplicate(): void {
        const sourceTab = this.findTab(this.contextMenu.tabId);
        this.closeContextMenu();
        if (sourceTab) {
            const snapshot = this.getEngineForTab(sourceTab)?.snapshot();

            const pane: TerminalPane = {
                id: this.nextPaneId++,
                widthPercent: 100,
                snapshot,
            };
            const tab: TerminalTab = {
                id: this.nextTabId++,
                title: `${sourceTab.title} (copy)`,
                isEditing: false,
                panes: [pane],
            };
            const sourceIndex = this.tabs.indexOf(sourceTab);
            this.tabs.splice(sourceIndex + 1, 0, tab);
            this._internalActiveTabId = tab.id;
            this.activeTabIdChange.emit(tab.id);
            this.activePaneId = pane.id;
        }
    }

    contextMenuClose(): void {
        const id = this.contextMenu.tabId;
        this.closeContextMenu();
        this.closeTab(id);
    }

    contextMenuCloseOthers(): void {
        const id = this.contextMenu.tabId;
        this.closeContextMenu();
        this.tabs = this.tabs.filter((t) => t.id === id);
        this._internalActiveTabId = id;
        this.activeTabIdChange.emit(id);
    }

    contextMenuCloseToTheRight(): void {
        const id = this.contextMenu.tabId;
        this.closeContextMenu();
        const index = this.tabs.findIndex((t) => t.id === id);
        if (index === -1) return;
        this.tabs = this.tabs.slice(0, index + 1);
        if (!this.tabs.find((t) => t.id === this.resolvedActiveTabId)) {
            this._internalActiveTabId = id;
            this.activeTabIdChange.emit(id);
        }
    }

    contextMenuCloseAll(): void {
        this.closeContextMenu();
        this.tabs = [];
        this.initialized = false;
        this.collapsableContent?.toggleTerminal();
    }

    // --- Split / close pane ---

    splitPane(tabId?: number): number {
        const targetTabId = tabId ?? this.resolvedActiveTabId;
        const tab = this.findTab(targetTabId);
        if (!tab) return -1;

        const paneId = this.nextPaneId++;
        const newPane: TerminalPane = { id: paneId, widthPercent: 0 };
        tab.panes.push(newPane);

        const evenWidth = 100 / tab.panes.length;
        tab.panes.forEach((p) => (p.widthPercent = evenWidth));
        this.normalizePaneWidths(tab.panes);

        this.activePaneId = paneId;
        this.onPaneSplit.emit({ paneId, tabId: targetTabId });
        return paneId;
    }

    closePane(paneId: number): void {
        for (const tab of this.tabs) {
            const idx = tab.panes.findIndex((p) => p.id === paneId);
            if (idx === -1) continue;

            if (tab.panes.length <= 1) {
                this.closeTab(tab.id);
                return;
            }

            // Destroy engine at the flat index
            let flatIndex = 0;
            for (const t of this.tabs) {
                for (const p of t.panes) {
                    if (p.id === paneId) {
                        const engine = this.cliComponents?.toArray()[flatIndex]?.getEngine();
                        if (engine) engine.destroy();
                    }
                    flatIndex++;
                }
            }

            tab.panes.splice(idx, 1);
            this.normalizePaneWidths(tab.panes);

            if (this.activePaneId === paneId) {
                this.activePaneId = tab.panes[Math.min(idx, tab.panes.length - 1)].id;
            }

            this.onPaneClosed.emit({ paneId });
            setTimeout(() => this.focusActiveTerminal());
            return;
        }
    }

    contextMenuSplitRight(): void {
        const tabId = this.contextMenu.tabId;
        this.closeContextMenu();
        this.splitPane(tabId);
    }

    // --- Pane resize ---

    onPaneResizeStart(
        event: MouseEvent,
        tabId: number,
        dividerIndex: number,
    ): void {
        event.preventDefault();
        const tab = this.findTab(tabId);
        if (!tab) return;

        this.paneResizing = true;
        this.paneResizeTabId = tabId;
        this.paneResizeDividerIndex = dividerIndex;
        this.paneResizeStartX = event.clientX;
        this.paneResizeStartWidths = tab.panes.map((p) => p.widthPercent);

        const container = (event.target as HTMLElement).closest(
            '.terminal-panes-container',
        );
        this.paneResizeContainerWidth = container ? container.clientWidth : 1;

        document.body.classList.add('cli-pane-resizing');
    }

    @HostListener('document:mousemove', ['$event'])
    onPaneResizeMove(event: MouseEvent): void {
        if (!this.paneResizing) return;

        const tab = this.findTab(this.paneResizeTabId);
        if (!tab) return;

        const deltaX = event.clientX - this.paneResizeStartX;
        const deltaPct = (deltaX / this.paneResizeContainerWidth) * 100;

        const i = this.paneResizeDividerIndex;
        const minW = CliPanelComponent.MIN_PANE_WIDTH_PERCENT;

        let leftWidth = this.paneResizeStartWidths[i] + deltaPct;
        let rightWidth = this.paneResizeStartWidths[i + 1] - deltaPct;

        if (leftWidth < minW) {
            leftWidth = minW;
            rightWidth =
                this.paneResizeStartWidths[i] +
                this.paneResizeStartWidths[i + 1] -
                minW;
        }
        if (rightWidth < minW) {
            rightWidth = minW;
            leftWidth =
                this.paneResizeStartWidths[i] +
                this.paneResizeStartWidths[i + 1] -
                minW;
        }

        tab.panes[i].widthPercent = leftWidth;
        tab.panes[i + 1].widthPercent = rightWidth;
    }

    @HostListener('document:mouseup')
    onPaneResizeEnd(): void {
        if (!this.paneResizing) return;
        this.paneResizing = false;
        document.body.classList.remove('cli-pane-resizing');
    }

    // --- Pane focus ---

    onPaneClick(tabId: number, paneId: number): void {
        this.activePaneId = paneId;
        if (this.resolvedActiveTabId !== tabId) {
            this._internalActiveTabId = tabId;
            this.activeTabIdChange.emit(tabId);
        }
        setTimeout(() => this.focusPane(tabId, paneId));
    }

    // --- ICliPanelRef methods ---

    open(): void {
        if (this.resolvedCollapsed) {
            this._internalCollapsed = false;
            this.collapsedChange.emit(false);
            this.collapsableContent?.setCollapsed(false);
            if (!this.initialized) {
                this.initialized = true;
                this.addTab();
                this.setupThemeSync();
            }
        }
    }

    collapse(): void {
        if (!this.resolvedCollapsed) {
            this._internalCollapsed = true;
            this.collapsedChange.emit(true);
            this.collapsableContent?.setCollapsed(true);
        }
    }

    toggleCollapse(): void {
        if (this.resolvedCollapsed) {
            this.open();
        } else {
            this.collapse();
        }
    }

    hide(): void {
        if (!this.resolvedHidden) {
            this._internalHidden = true;
            this.hiddenChange.emit(true);
            this.collapsableContent?.hideTerminal();
        }
    }

    unhide(): void {
        if (this.resolvedHidden) {
            this._internalHidden = false;
            this.hiddenChange.emit(false);
            this.collapsableContent?.unhideTerminal();
        }
    }

    toggleHide(): void {
        if (this.resolvedHidden) {
            this.unhide();
        } else {
            this.hide();
        }
    }

    close(): void {
        this.visible = false;
        this.onClose.emit();
    }

    maximize(): void {
        if (!this.resolvedMaximized) {
            this._internalMaximized = true;
            this.maximizedChange.emit(true);
            this.collapsableContent?.setMaximized(true);
        }
    }

    restore(): void {
        if (this.resolvedMaximized) {
            this._internalMaximized = false;
            this.maximizedChange.emit(false);
            this.collapsableContent?.setMaximized(false);
        }
    }

    toggleMaximize(): void {
        if (this.resolvedMaximized) {
            this.restore();
        } else {
            this.maximize();
        }
    }

    resize(dimensions: { height?: number; width?: number }): void {
        if (dimensions.height !== undefined) {
            this._internalHeight = dimensions.height;
            this.heightChange.emit(dimensions.height);
        }
        if (dimensions.width !== undefined) {
            this._internalWidth = dimensions.width;
            this.widthChange.emit(dimensions.width);
        }
        this.collapsableContent?.setDimensions(dimensions);
    }

    setPosition(pos: CliPanelPosition): void {
        this.currentPosition = pos;
        savePanelPosition(pos);
        this.positionChange.emit(pos);
    }

    renameTab(tabId: number, title: string): void {
        const tab = this.findTab(tabId);
        if (tab) {
            tab.title = title;
        }
    }

    getEngine(paneId?: number): CliEngine | undefined {
        const targetPaneId = paneId ?? this.activePaneId;
        let flatIndex = 0;
        for (const tab of this.tabs) {
            for (const pane of tab.panes) {
                if (pane.id === targetPaneId) {
                    const components = this.cliComponents?.toArray();
                    return components?.[flatIndex]?.getEngine();
                }
                flatIndex++;
            }
        }
        return undefined;
    }

    getState(): CliPanelState {
        return {
            collapsed: this.resolvedCollapsed,
            hidden: this.resolvedHidden,
            maximized: this.resolvedMaximized,
            position: this.resolvedPosition,
            height: this.resolvedHeight,
            width: this.resolvedWidth,
            activeTabId: this.resolvedActiveTabId,
            activePaneId: this.activePaneId,
            tabs: this.tabs.map((t) => ({
                id: t.id,
                title: t.title,
                panes: t.panes.map((p) => ({ id: p.id, widthPercent: p.widthPercent })),
            })),
        };
    }

    // --- Helpers ---

    private findTab(id: number): TerminalTab | undefined {
        return this.tabs.find((t) => t.id === id);
    }

    private getEngineForTab(tab: TerminalTab): CliEngine | undefined {
        if (!this.cliComponents) return undefined;

        let flatIndex = 0;
        for (const t of this.tabs) {
            for (const _pane of t.panes) {
                if (t.id === tab.id) {
                    const component = this.cliComponents.toArray()[flatIndex];
                    return component?.getEngine();
                }
                flatIndex++;
            }
        }
        return undefined;
    }

    private cancelAllEditing(): void {
        this.tabs.forEach((t) => (t.isEditing = false));
    }

    private focusActiveTerminal(): void {
        this.focusPane(this.resolvedActiveTabId, this.activePaneId);
    }

    private focusPane(tabId: number, paneId: number): void {
        if (!this.cliComponents) return;

        let flatIndex = 0;
        for (const tab of this.tabs) {
            for (const pane of tab.panes) {
                if (tab.id === tabId && pane.id === paneId) {
                    const component = this.cliComponents.toArray()[flatIndex];
                    component?.focus();
                    return;
                }
                flatIndex++;
            }
        }
    }

    private normalizePaneWidths(panes: TerminalPane[]): void {
        const total = panes.reduce((s, p) => s + p.widthPercent, 0);
        if (total === 0) return;
        const scale = 100 / total;
        panes.forEach((p) => (p.widthPercent = p.widthPercent * scale));
    }

    private setupThemeSync(): void {
        if (!this.options?.syncTheme) return;

        // Wait for the first terminal to render, then observe style changes
        setTimeout(() => {
            this.syncThemeFromEngine();

            const container = this.elementRef.nativeElement.querySelector(
                '.terminal-container',
            );
            if (!container) return;

            this.themeObserver?.disconnect();
            this.themeObserver = new MutationObserver(() => {
                this.syncThemeFromEngine();
            });
            this.themeObserver.observe(container, {
                attributes: true,
                attributeFilter: ['style'],
            });
        }, 200);
    }

    private syncThemeFromEngine(): void {
        if (!this.cliComponents) return;
        const first = this.cliComponents.first;
        if (!first) return;
        const engine = first.getEngine();
        if (!engine) return;
        const theme = engine.getTerminal().options.theme;
        if (!theme) return;
        this.themeStyles = derivePanelThemeStyles(theme);
    }
}
