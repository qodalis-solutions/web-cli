import {
    AfterViewInit,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    NgZone,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    QueryList,
    ViewChildren,
} from '@angular/core';
import { CliPanelConfig, CliPanelPosition, CliPanelState, ICliCommandProcessor, ICliModule, ICliPanelRef } from '@qodalis/cli-core';
import {
    CliEngine,
    CliEngineOptions,
    CliPanelController,
    CliPanelControlledState,
    CliPanelPane,
    CliPanelSnapshot,
    CliPanelTab,
    CLOSE_GLYPH,
    CLOSE_ICON,
    HIDE_ICON,
    HIDE_TAB_TERMINAL_ICON,
    MAXIMIZE_ICON,
    PANEL_LABELS,
    PanelContextMenuAction,
    PanelContextMenuItem,
    PanelPositionOption,
    PanelStatusDropdown,
    PanelStatusIndicator,
    RESTORE_ICON,
    SvgIcon,
    TERMINAL_ICON,
    collapseChevronIcon,
    contextMenuItems,
    contextMenuStyle,
    glowLineClass,
    handleRenameKey,
    hideTabChevronIcon,
    paneClass,
    panelTabClass,
    panelTabDotClass,
    panelWrapperClass,
    panelWrapperStyle,
    panesContainerClass,
    panesContainerWidth,
    openStatusDropdown,
    positionIcon,
    positionOptions,
    runContextMenuAction,
    statusIndicators,
} from '@qodalis/cli';
import { Subscription } from 'rxjs';

export type CliPanelOptions = CliEngineOptions & CliPanelConfig;

/** Everything the template renders, rebuilt once per controller change. */
interface PanelView {
    wrapperClass: string;
    wrapperStyle: Record<string, string>;
    indicators: PanelStatusIndicator[];
    positionOptions: Array<PanelPositionOption & { icon: SvgIcon }>;
    positionIcon: SvgIcon;
    collapseIcon: SvgIcon;
    hideTabArrowIcon: SvgIcon;
    maximizeIcon: SvgIcon;
    contextMenuItems: PanelContextMenuItem[];
    contextMenuStyle: Record<string, string>;
    glowLineClass: string;
    panesContainerClass: string;
    statusDropdown: PanelStatusDropdown | null;
}

const CONTROLLED_INPUTS: Array<keyof CliPanelControlledState> = [
    'collapsed', 'hidden', 'maximized', 'activeTabId', 'position', 'height', 'width',
];

/**
 * Collapsible, dockable panel with tabs and split panes of CLI terminals.
 * State and behaviour live in the framework-agnostic `CliPanelController`;
 * this component renders it.
 */
@Component({
    standalone: false,
    selector: 'cli-panel',
    templateUrl: './cli-panel.component.html',
})
export class CliPanelComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy, ICliPanelRef<CliEngine> {
    /** The options for the CLI. */
    @Input() options?: CliPanelOptions;

    /** Optional list of CLI modules to register with each terminal pane. */
    @Input() modules?: ICliModule[];

    /**
     * Optional list of command processors to register with each terminal pane.
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

    @Input() activeTabId?: number;
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

    @ViewChildren('renameInput') renameInputs!: QueryList<ElementRef<HTMLInputElement>>;

    readonly labels = PANEL_LABELS;
    readonly closeGlyph = CLOSE_GLYPH;
    readonly terminalIcon = TERMINAL_ICON;
    readonly hideTabIcon = HIDE_TAB_TERMINAL_ICON;
    readonly hideIcon = HIDE_ICON;
    readonly closeIcon = CLOSE_ICON;

    controller!: CliPanelController;
    s!: CliPanelSnapshot;
    view!: PanelView;

    private unsubscribe?: () => void;
    private renameInputsSub?: Subscription;

    constructor(
        private readonly elementRef: ElementRef<HTMLElement>,
        private readonly zone: NgZone,
        private readonly changeDetector: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.controller = new CliPanelController({
            config: this.options,
            controlled: this.controlledValues(),
            callbacks: {
                onCollapsedChange: (v) => this.collapsedChange.emit(v),
                onHiddenChange: (v) => this.hiddenChange.emit(v),
                onMaximizedChange: (v) => this.maximizedChange.emit(v),
                onActiveTabIdChange: (v) => this.activeTabIdChange.emit(v),
                onPositionChange: (v) => this.positionChange.emit(v),
                onHeightChange: (v) => this.heightChange.emit(v),
                onWidthChange: (v) => this.widthChange.emit(v),
                onClose: () => this.onClose.emit(),
                onTabAdded: (e) => this.onTabAdded.emit(e),
                onTabClosed: (e) => this.onTabClosed.emit(e),
                onPaneSplit: (e) => this.onPaneSplit.emit(e),
                onPaneClosed: (e) => this.onPaneClosed.emit(e),
            },
        });
        this.render(this.controller.getSnapshot());
        // Status polling runs outside Angular; only real changes re-enter the zone.
        // markForCheck also schedules change detection in zoneless apps.
        this.unsubscribe = this.controller.subscribe(() =>
            this.zone.run(() => {
                this.render(this.controller.getSnapshot());
                this.changeDetector.markForCheck();
            }),
        );
    }

    ngOnChanges(): void {
        if (!this.controller) return;
        this.controller.setControlled(this.controlledValues());
        this.controller.setOptions(this.options);
    }

    ngAfterViewInit(): void {
        this.controller.setRootElement(this.elementRef.nativeElement);
        this.renameInputsSub = this.renameInputs.changes.subscribe((inputs: QueryList<ElementRef<HTMLInputElement>>) => {
            const input = inputs.first?.nativeElement;
            input?.focus();
            input?.select();
        });
    }

    ngOnDestroy(): void {
        this.renameInputsSub?.unsubscribe();
        this.unsubscribe?.();
        this.controller?.destroy();
    }

    // ── Template handlers ──

    onPaneEngineReady(tabId: number, paneId: number, engine: CliEngine): void {
        this.zone.runOutsideAngular(() => this.controller.registerEngine(tabId, paneId, engine));
    }

    onTabContextMenu(event: MouseEvent, tab: CliPanelTab): void {
        event.preventDefault();
        event.stopPropagation();
        this.controller.openContextMenu(tab.id, event.clientX, event.clientY);
    }

    onRenameKeydown(event: KeyboardEvent, tab: CliPanelTab): void {
        handleRenameKey(this.controller, tab.id, event.key, (event.target as HTMLInputElement).value);
    }

    onRenameBlur(event: FocusEvent, tab: CliPanelTab): void {
        if (tab.isEditing) this.controller.commitRename(tab.id, (event.target as HTMLInputElement).value);
    }

    onPanelResizeStart(event: MouseEvent): void {
        if (!this.s.resizable) return;
        event.preventDefault();
        this.controller.startPanelResize(event.clientX, event.clientY);
    }

    onPaneResizeStart(event: MouseEvent, tabId: number, dividerIndex: number): void {
        event.preventDefault();
        this.controller.startPaneResize(tabId, dividerIndex, event.clientX, panesContainerWidth(event.target));
    }

    onIndicatorClick(event: MouseEvent, item: PanelStatusIndicator): void {
        if (!item.dropdown) return;
        event.stopPropagation();
        const anchor = event.currentTarget as Element;
        if (item.dropdown === 'services') this.controller.toggleServicesDropdown(anchor);
        else this.controller.toggleServersDropdown(anchor);
    }

    onContextMenuAction(action: PanelContextMenuAction): void {
        runContextMenuAction(this.controller, action);
    }

    tabClass(tab: CliPanelTab): string {
        return panelTabClass(this.s, tab);
    }

    tabDotClass(tab: CliPanelTab): string {
        return panelTabDotClass(this.s, tab);
    }

    paneClass(tabId: number, paneId: number): string {
        return paneClass(this.s, tabId, paneId);
    }

    trackByTabId(_index: number, tab: CliPanelTab): number {
        return tab.id;
    }

    trackByPaneId(_index: number, pane: CliPanelPane): number {
        return pane.id;
    }

    trackByKey(_index: number, item: { key?: string; action?: string; position?: string }): string | undefined {
        return item.key ?? item.action ?? item.position;
    }

    // ── ICliPanelRef ──

    open(): void {
        this.controller.open();
    }
    collapse(): void {
        this.controller.collapse();
    }
    toggleCollapse(): void {
        this.controller.toggleCollapse();
    }
    hide(): void {
        this.controller.hide();
    }
    unhide(): void {
        this.controller.unhide();
    }
    toggleHide(): void {
        this.controller.toggleHide();
    }
    close(): void {
        this.controller.close();
    }
    maximize(): void {
        this.controller.maximize();
    }
    restore(): void {
        this.controller.restore();
    }
    toggleMaximize(): void {
        this.controller.toggleMaximize();
    }
    resize(dimensions: { height?: number; width?: number }): void {
        this.controller.resize(dimensions);
    }
    setPosition(position: CliPanelPosition): void {
        this.controller.setPosition(position);
    }
    addTab(title?: string): number {
        return this.controller.addTab(title);
    }
    closeTab(tabId: number): void {
        this.controller.closeTab(tabId);
    }
    selectTab(tabId: number): void {
        this.controller.selectTab(tabId);
    }
    renameTab(tabId: number, title: string): void {
        this.controller.renameTab(tabId, title);
    }
    splitPane(tabId?: number): number {
        return this.controller.splitPane(tabId);
    }
    closePane(paneId: number): void {
        this.controller.closePane(paneId);
    }
    getEngine(paneId?: number): CliEngine | undefined {
        return this.controller.getEngine(paneId);
    }
    getState(): CliPanelState {
        return this.controller.getState();
    }

    // ── Internals ──

    private controlledValues(): CliPanelControlledState {
        const values: CliPanelControlledState = {};
        for (const key of CONTROLLED_INPUTS) {
            (values as Record<string, unknown>)[key] = this[key];
        }
        return values;
    }

    private render(s: CliPanelSnapshot): void {
        this.s = s;
        this.view = {
            wrapperClass: panelWrapperClass(s),
            wrapperStyle: panelWrapperStyle(s),
            indicators: statusIndicators(s),
            positionOptions: positionOptions(s).map((opt) => ({ ...opt, icon: positionIcon(opt.position, 16) })),
            positionIcon: positionIcon(s.position),
            collapseIcon: collapseChevronIcon(s.position, s.collapsed),
            hideTabArrowIcon: hideTabChevronIcon(s.position),
            maximizeIcon: s.maximized ? RESTORE_ICON : MAXIMIZE_ICON,
            contextMenuItems: contextMenuItems(s),
            contextMenuStyle: contextMenuStyle(s),
            glowLineClass: glowLineClass(s),
            panesContainerClass: panesContainerClass(s),
            statusDropdown: openStatusDropdown(s),
        };
    }
}
