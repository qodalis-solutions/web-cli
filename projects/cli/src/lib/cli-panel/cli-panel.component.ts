import { Component, Input } from '@angular/core';
import { CliOptions } from '@qodalis/cli-core';
import { CliCanViewService } from '../services';
import { Subscription } from 'rxjs';

export type CliPanelOptions = CliOptions & {
    /**
     * Whether the CLI should be collapsed by default. Defaults to `true`.
     */
    isCollapsed?: boolean;
};

export type TerminalTab = {
    id: number;
    title: string;
};

/**
 * A component that displays the CLI on the bottom of page.
 */
@Component({
    selector: 'cli-panel',
    templateUrl: './cli-panel.component.html',
    styleUrls: ['./cli-panel.component.sass'],
})
export class CliPanelComponent {
    /**
     * The options for the CLI.
     */
    @Input() options?: CliPanelOptions;

    tabs: TerminalTab[] = []; // Array to hold all terminal tabs
    activeTabId: number | null = null; // ID of the currently active tab

    private nextTabId = 1; // To generate unique IDs for tabs

    visible = false;

    private subscriptions: Subscription = new Subscription();

    constructor(private readonly canView: CliCanViewService) {
        this.subscriptions.add(
            this.canView.canView().subscribe((canView) => {
                this.visible = canView;
            }),
        );
    }

    addTab(): void {
        const newTab: TerminalTab = {
            id: this.nextTabId++,
            title: `Terminal ${this.tabs.length + 1}`,
        };
        this.tabs.push(newTab);
        this.activeTabId = newTab.id;
    }

    closeTab(tabId: number): void {
        this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
        if (this.activeTabId === tabId) {
            // Switch to another tab or none if all are closed
            this.activeTabId = this.tabs.length > 0 ? this.tabs[0].id : null;
        }
    }

    setActiveTab(tabId: number): void {
        this.activeTabId = tabId;
    }
}
