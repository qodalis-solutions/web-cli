/**
 * 03 - Panel Configuration
 *
 * Shows the CliPanelComponent with full configuration:
 *   - CliPanelOptions (engine options + panel chrome config)
 *   - Two-way bindings for collapsed, hidden, position, height, width
 *   - Structural events (onClose, onTabAdded, onTabClosed, onPaneSplit, onPaneClosed)
 *   - ViewChild access for programmatic control
 *
 * Remember to add the panel stylesheet to your angular.json styles array:
 *   "node_modules/@qodalis/cli/assets/cli-panel.css"
 *
 * @see https://qodalis-solutions.github.io/web-cli/
 */
import { Component, ViewChild } from '@angular/core';
import { CliModule, CliPanelComponent, CliPanelOptions } from '@qodalis/angular-cli';
import { CliPanelPosition } from '@qodalis/cli-core';

@Component({
    selector: 'app-panel-demo',
    standalone: true,
    imports: [CliModule],
    template: `
        <div class="app-content">
            <h1>Application Content</h1>

            <button (click)="toggleCollapsed()">
                {{ collapsed ? 'Expand' : 'Collapse' }} Panel
            </button>

            <button (click)="toggleHidden()">
                {{ hidden ? 'Show' : 'Hide' }} Panel
            </button>

            <button (click)="cyclePosition()">
                Position: {{ position }}
            </button>
        </div>

        <cli-panel
            [options]="panelOptions"
            [(collapsed)]="collapsed"
            [(hidden)]="hidden"
            [(position)]="position"
            [(height)]="height"
            [(width)]="width"
            (onClose)="onPanelClose()"
            (onTabAdded)="onTabAdded($event)"
            (onTabClosed)="onTabClosed($event)"
            (onPaneSplit)="onPaneSplit($event)"
            (onPaneClosed)="onPaneClosed($event)"
        />
    `,
    styles: [
        `
            .app-content {
                padding: 24px;
            }
            button {
                margin-right: 8px;
            }
        `,
    ],
})
export class PanelDemoComponent {
    @ViewChild(CliPanelComponent) panel!: CliPanelComponent;

    // CliPanelOptions = CliEngineOptions & CliPanelConfig
    panelOptions: CliPanelOptions = {
        // Panel chrome configuration
        position: 'bottom',
        isCollapsed: false,
        isHidden: false,
        closable: true,
        resizable: true,
        hideable: true,
        hideAlignment: 'center',
        syncTheme: true,

        // Engine / terminal options (inherited from CliEngineOptions)
        terminalOptions: {
            fontSize: 13,
            cursorBlink: true,
        },
    };

    // Controlled state -- two-way bound to the panel
    collapsed = false;
    hidden = false;
    position: CliPanelPosition = 'bottom';
    height = 300;
    width = 500;

    // ── Helpers ──

    toggleCollapsed(): void {
        this.collapsed = !this.collapsed;
    }

    toggleHidden(): void {
        this.hidden = !this.hidden;
    }

    cyclePosition(): void {
        const positions: CliPanelPosition[] = ['bottom', 'top', 'left', 'right'];
        const idx = positions.indexOf(this.position);
        this.position = positions[(idx + 1) % positions.length];
    }

    // ── Event handlers ──

    onPanelClose(): void {
        console.log('Panel closed by user');
    }

    onTabAdded(event: { tabId: number }): void {
        console.log('Tab added:', event.tabId);
    }

    onTabClosed(event: { tabId: number }): void {
        console.log('Tab closed:', event.tabId);
    }

    onPaneSplit(event: { paneId: number; tabId: number }): void {
        console.log('Pane split:', event);
    }

    onPaneClosed(event: { paneId: number }): void {
        console.log('Pane closed:', event.paneId);
    }
}
