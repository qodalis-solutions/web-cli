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

export interface TerminalTab {
    id: number;
    title: string;
    isEditing: boolean;
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
    private nextTabId = 1;

    contextMenu: TabContextMenu = {
        visible: false,
        x: 0,
        y: 0,
        tabId: 0,
    };

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
        const tab: TerminalTab = {
            id: this.nextTabId++,
            title: `Terminal ${this.nextTabId - 1}`,
            isEditing: false,
        };
        this.tabs.push(tab);
        this.activeTabId = tab.id;
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
        setTimeout(() => {
            this.focusActiveTerminal();
        });
    }

    trackByTabId(_index: number, tab: TerminalTab): number {
        return tab.id;
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
            const tab: TerminalTab = {
                id: this.nextTabId++,
                title: `${sourceTab.title} (copy)`,
                isEditing: false,
            };
            const sourceIndex = this.tabs.indexOf(sourceTab);
            this.tabs.splice(sourceIndex + 1, 0, tab);
            this.activeTabId = tab.id;
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

    // --- Helpers ---

    private findTab(id: number): TerminalTab | undefined {
        return this.tabs.find((t) => t.id === id);
    }

    private cancelAllEditing(): void {
        this.tabs.forEach((t) => (t.isEditing = false));
    }

    private focusActiveTerminal(): void {
        if (!this.cliComponents) return;
        const activeIndex = this.tabs.findIndex(
            (t) => t.id === this.activeTabId,
        );
        if (activeIndex === -1) return;
        const component = this.cliComponents.toArray()[activeIndex];
        component?.focus();
    }
}
