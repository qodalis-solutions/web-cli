import { Component, Input } from '@angular/core';
import { CliOptions } from '@qodalis/cli-core';
import { CliCanViewService } from '../services';
import { Subscription } from 'rxjs';
import { ContainerSize } from '../cli-terminal/cli-terminal.component';

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
export class CliPanelComponent {
    /**
     * The options for the CLI.
     */
    @Input() options?: CliPanelOptions;

    visible = false;

    protected terminalHeight: ContainerSize = `${450 - 8}px`;

    protected initialized: boolean = false;

    private subscriptions: Subscription = new Subscription();

    constructor(private readonly canView: CliCanViewService) {
        this.subscriptions.add(
            this.canView.canView().subscribe((canView) => {
                this.visible = canView;
            }),
        );
    }

    onToggle($event: boolean) {
        if (!$event && !this.initialized) {
            this.initialized = true;
        }
    }

    onContentSizeChange($event: number) {
        this.terminalHeight = `${$event}px`;
    }
}
