import {
    Component,
    ElementRef,
    HostListener,
    Input,
    OnDestroy,
    QueryList,
    ViewChild,
    ViewChildren,
} from '@angular/core';
import { CliOptions } from '@qodalis/cli-core';
import { CliCanViewService } from '../services';
import { Subscription } from 'rxjs';
import { ContainerSize } from '../cli-terminal/cli-terminal.component';
import { CliComponent } from '../cli/cli.component';
import { CollapsableContentComponent } from '../collapsable-content/collapsable-content.component';

export interface TerminalPane {
    id: number;
    widthPercent: number;
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

export type CliPanelOptions = CliOptions & {
    /**
     * Whether the CLI should be collapsed by default. Defaults to `true`.
     */
    isCollapsed?: boolean;
};

/**
 * A component that displays the CLI on the bottom of page.
 */
@Component({
    selector: 'cli-panel',
    templateUrl: './cli-panel.component.html',
    styleUrls: ['./cli-panel.component.sass'],
})
export class CliPanelComponent implements OnDestroy {
    /**
     * The options for the CLI.
     */
    @Input() options?: CliPanelOptions;

    @ViewChild(CollapsableContentComponent) collapsableContent!: CollapsableContentComponent;
    @ViewChildren(CliComponent) cliComponents!: QueryList<CliComponent>;

    visible = false;

    tabs: TerminalTab[] = [];
    activeTabId = 0;
    activePaneId = 0;
    private nextTabId = 1;
    private nextPaneId = 1;

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

    protected terminalHeight: ContainerSize = `${450 - 8}px`;

    protected initialized: boolean = false;

    private subscriptions: Subscription = new Subscription();

    private static readonly TAB_BAR_HEIGHT = 38;

    constructor(
        private readonly canView: CliCanViewService,
        private readonly elementRef: ElementRef,
    ) {
        this.subscriptions.add(
            this.canView.canView().subscribe((canView) => {
                this.visible = canView;
            }),
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
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

    onToggle($event: boolean) {
        if (!$event && !this.initialized) {
            this.initialized = true;
            this.addTab();
        }
    }

    onContentSizeChange($event: number) {
        const available = $event - CliPanelComponent.TAB_BAR_HEIGHT;
        this.terminalHeight = `${available}px`;
    }

    // --- Tab management ---

    addTab(): void {
        const pane: TerminalPane = { id: this.nextPaneId++, widthPercent: 100 };
        const tab: TerminalTab = {
            id: this.nextTabId++,
            title: `Terminal ${this.nextTabId - 1}`,
            isEditing: false,
            panes: [pane],
        };
        this.tabs.push(tab);
        this.activeTabId = tab.id;
        this.activePaneId = pane.id;
    }

    closeTab(id: number): void {
        const index = this.tabs.findIndex((t) => t.id === id);
        if (index === -1) return;

        this.tabs.splice(index, 1);

        if (this.tabs.length === 0) {
            this.initialized = false;
            this.collapsableContent?.toggleTerminal();
            return;
        }

        if (this.activeTabId === id) {
            const nextIndex = Math.min(index, this.tabs.length - 1);
            this.selectTab(this.tabs[nextIndex].id);
        }
    }

    selectTab(id: number): void {
        this.activeTabId = id;
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
            const pane: TerminalPane = { id: this.nextPaneId++, widthPercent: 100 };
            const tab: TerminalTab = {
                id: this.nextTabId++,
                title: `${sourceTab.title} (copy)`,
                isEditing: false,
                panes: [pane],
            };
            const sourceIndex = this.tabs.indexOf(sourceTab);
            this.tabs.splice(sourceIndex + 1, 0, tab);
            this.activeTabId = tab.id;
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
        this.activeTabId = id;
    }

    contextMenuCloseToTheRight(): void {
        const id = this.contextMenu.tabId;
        this.closeContextMenu();
        const index = this.tabs.findIndex((t) => t.id === id);
        if (index === -1) return;
        this.tabs = this.tabs.slice(0, index + 1);
        if (!this.tabs.find((t) => t.id === this.activeTabId)) {
            this.activeTabId = id;
        }
    }

    contextMenuCloseAll(): void {
        this.closeContextMenu();
        this.tabs = [];
        this.initialized = false;
        this.collapsableContent?.toggleTerminal();
    }

    // --- Split / close pane ---

    splitRight(tabId?: number, afterPaneId?: number): void {
        const tab = this.findTab(tabId ?? this.activeTabId);
        if (!tab) return;

        const targetPaneId = afterPaneId ?? this.activePaneId;
        const paneIndex = tab.panes.findIndex((p) => p.id === targetPaneId);
        const insertIndex = paneIndex === -1 ? tab.panes.length : paneIndex + 1;

        const newPane: TerminalPane = { id: this.nextPaneId++, widthPercent: 0 };
        tab.panes.splice(insertIndex, 0, newPane);

        const evenWidth = 100 / tab.panes.length;
        tab.panes.forEach((p) => (p.widthPercent = evenWidth));
        this.normalizePaneWidths(tab.panes);

        this.activePaneId = newPane.id;
    }

    closePane(tabId: number, paneId: number): void {
        const tab = this.findTab(tabId);
        if (!tab) return;

        if (tab.panes.length <= 1) {
            this.closeTab(tabId);
            return;
        }

        const index = tab.panes.findIndex((p) => p.id === paneId);
        if (index === -1) return;

        tab.panes.splice(index, 1);

        const totalRemaining = tab.panes.reduce((s, p) => s + p.widthPercent, 0);
        if (totalRemaining > 0) {
            tab.panes.forEach((p) => {
                p.widthPercent = (p.widthPercent / totalRemaining) * 100;
            });
        }
        this.normalizePaneWidths(tab.panes);

        if (this.activePaneId === paneId) {
            const newIndex = Math.min(index, tab.panes.length - 1);
            this.activePaneId = tab.panes[newIndex].id;
        }

        setTimeout(() => this.focusActiveTerminal());
    }

    contextMenuSplitRight(): void {
        const tabId = this.contextMenu.tabId;
        this.closeContextMenu();
        this.splitRight(tabId);
    }

    // --- Pane resize ---

    onPaneResizeStart(event: MouseEvent, tabId: number, dividerIndex: number): void {
        event.preventDefault();
        const tab = this.findTab(tabId);
        if (!tab) return;

        this.paneResizing = true;
        this.paneResizeTabId = tabId;
        this.paneResizeDividerIndex = dividerIndex;
        this.paneResizeStartX = event.clientX;
        this.paneResizeStartWidths = tab.panes.map((p) => p.widthPercent);

        const container = (event.target as HTMLElement).closest('.terminal-panes-container');
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
            rightWidth = this.paneResizeStartWidths[i] + this.paneResizeStartWidths[i + 1] - minW;
        }
        if (rightWidth < minW) {
            rightWidth = minW;
            leftWidth = this.paneResizeStartWidths[i] + this.paneResizeStartWidths[i + 1] - minW;
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
        if (this.activeTabId !== tabId) {
            this.activeTabId = tabId;
        }
        setTimeout(() => this.focusPane(tabId, paneId));
    }

    // --- Helpers ---

    private findTab(id: number): TerminalTab | undefined {
        return this.tabs.find((t) => t.id === id);
    }

    private cancelAllEditing(): void {
        this.tabs.forEach((t) => (t.isEditing = false));
    }

    private focusActiveTerminal(): void {
        this.focusPane(this.activeTabId, this.activePaneId);
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
}
