import {
    Component,
    EventEmitter,
    Input,
    Output,
    HostListener,
} from '@angular/core';
import { CliPanelPosition, CliPanelHideAlignment } from '@qodalis/cli-core';

const HEADER_HEIGHT = 60;

@Component({
    selector: 'collapsable-content',
    templateUrl: './collapsable-content.component.html',
    styleUrls: ['./collapsable-content.component.sass'],
})
export class CollapsableContentComponent {
    previousPanelHeight = 600;
    panelHeight = 600;
    panelWidth = 400;
    previousPanelWidth = 400;

    isResizing = false;
    startY = 0;
    startX = 0;
    startHeight = 0;
    startWidth = 0;

    @Input() visible: boolean = true;
    @Input() isCollapsed: boolean = true;
    @Input() isMaximized: boolean = false;
    @Input() position: CliPanelPosition = 'bottom';
    @Input() closable: boolean = true;
    @Input() resizable: boolean = true;
    @Input() hideable: boolean = true;
    @Input() hideAlignment: CliPanelHideAlignment = 'center';
    @Input() themeStyles: Record<string, string> = {};

    @Output()
    public onToggle = new EventEmitter<boolean>();

    @Output()
    public onContentSizeChange = new EventEmitter<number>();

    @Output()
    public onClose = new EventEmitter<void>();

    @Output()
    public onHide = new EventEmitter<void>();

    @Output()
    public onPositionChange = new EventEmitter<CliPanelPosition>();

    isHidden = false;
    positionDropdownOpen = false;
    private preHideCollapsed = true;

    get isHorizontal(): boolean {
        return this.position === 'left' || this.position === 'right';
    }

    get wrapperStyle(): Record<string, string> {
        const size: Record<string, string> = this.isHorizontal
            ? { width: this.panelWidth + 'px' }
            : { height: this.panelHeight + 'px' };
        return { ...size, ...this.themeStyles };
    }

    toggleTerminal(): void {
        this.isCollapsed = !this.isCollapsed;

        this.onToggle.emit(this.isCollapsed);
    }

    closeTerminal(): void {
        this.visible = false;
        this.onClose.emit();
    }

    hideTerminal(): void {
        this.preHideCollapsed = this.isCollapsed;
        this.isHidden = true;
        this.onHide.emit();
    }

    unhideTerminal(): void {
        this.isHidden = false;
        this.isCollapsed = this.preHideCollapsed;
        this.onToggle.emit(this.isCollapsed);
    }

    togglePositionDropdown(event: MouseEvent): void {
        event.stopPropagation();
        this.positionDropdownOpen = !this.positionDropdownOpen;
    }

    selectPosition(pos: CliPanelPosition): void {
        this.positionDropdownOpen = false;
        this.onPositionChange.emit(pos);
    }

    @HostListener('document:click')
    closePositionDropdown(): void {
        this.positionDropdownOpen = false;
    }

    toggleMaximizationTerminal(): void {
        if (this.isHorizontal) {
            if (!this.isMaximized) {
                this.previousPanelWidth = this.panelWidth;
                this.panelWidth = window.innerWidth;
            } else {
                this.panelWidth = this.previousPanelWidth;
            }
        } else {
            if (!this.isMaximized) {
                this.previousPanelHeight = this.panelHeight;
                this.panelHeight = window.innerHeight;
            } else {
                this.panelHeight = this.previousPanelHeight;
            }
        }

        this.isMaximized = !this.isMaximized;
        this.updateTerminalSize();
    }

    onResizeStart(event: MouseEvent) {
        if (!this.resizable) return;

        this.isResizing = true;
        if (this.isCollapsed) {
            this.toggleTerminal();
        }

        if (this.isHorizontal) {
            this.startX = event.clientX;
            this.startWidth = this.panelWidth;
        } else {
            this.startY = event.clientY;
            this.startHeight = this.panelHeight;
        }
        event.preventDefault();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (!this.isResizing) return;

        if (this.isHorizontal) {
            const deltaX = this.position === 'left'
                ? event.clientX - this.startX
                : this.startX - event.clientX;
            let nextWidth = Math.max(100, this.startWidth + deltaX);

            if (nextWidth > window.innerWidth) {
                nextWidth = window.innerWidth;
            }

            this.panelWidth = nextWidth;
        } else {
            const deltaY = this.position === 'top'
                ? event.clientY - this.startY
                : this.startY - event.clientY;
            let nextHeight = Math.max(100, this.startHeight + deltaY);

            if (nextHeight > window.innerHeight) {
                nextHeight = window.innerHeight;
            }

            this.panelHeight = nextHeight;
        }
        this.updateTerminalSize();
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.isResizing = false;
    }

    private updateTerminalSize() {
        if (this.isHorizontal) {
            this.onContentSizeChange.emit(this.panelWidth - HEADER_HEIGHT);
        } else {
            this.onContentSizeChange.emit(this.panelHeight - HEADER_HEIGHT);
        }
    }
}
