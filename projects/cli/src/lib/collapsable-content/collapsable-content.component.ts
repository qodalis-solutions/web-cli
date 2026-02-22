import {
    Component,
    EventEmitter,
    Input,
    Output,
    HostListener,
} from '@angular/core';

const HEADER_HEIGHT = 60;

@Component({
    selector: 'collapsable-content',
    templateUrl: './collapsable-content.component.html',
    styleUrls: ['./collapsable-content.component.sass'],
})
export class CollapsableContentComponent {
    previousPanelHeight = 600;
    panelHeight = 600;

    isResizing = false;
    startY = 0;
    startHeight = 0;

    @Input() visible: boolean = true;
    @Input() isCollapsed: boolean = true;
    @Input() isMaximized: boolean = false;

    @Output()
    public onToggle = new EventEmitter<boolean>();

    @Output()
    public onContentSizeChange = new EventEmitter<number>();

    toggleTerminal(): void {
        this.isCollapsed = !this.isCollapsed;

        this.onToggle.emit(this.isCollapsed);
    }

    closeTerminal(): void {
        this.visible = false;
    }

    toggleMaximizationTerminal(): void {
        if (!this.isMaximized) {
            this.previousPanelHeight = this.panelHeight;
            this.panelHeight = window.innerHeight;
        } else {
            this.panelHeight = this.previousPanelHeight;
        }

        this.isMaximized = !this.isMaximized;
        this.updateTerminalSize();
    }

    onResizeStart(event: MouseEvent) {
        this.isResizing = true;
        if (this.isCollapsed) {
            this.toggleTerminal();
        }

        this.startY = event.clientY;
        this.startHeight = this.panelHeight;
        event.preventDefault();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        if (this.isResizing) {
            const deltaY = this.startY - event.clientY;
            let nextHeight = Math.max(100, this.startHeight + deltaY);

            if (nextHeight > window.innerHeight) {
                nextHeight = window.innerHeight;
            }

            this.panelHeight = nextHeight;
            this.updateTerminalSize();
        }
    }

    @HostListener('document:mouseup')
    onMouseUp() {
        this.isResizing = false;
    }

    private updateTerminalSize() {
        this.onContentSizeChange.emit(
            this.panelHeight - HEADER_HEIGHT,
        );
    }
}
