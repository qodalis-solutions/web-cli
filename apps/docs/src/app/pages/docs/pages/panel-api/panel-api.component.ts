import { Component } from '@angular/core';
import { CliPanelComponent } from '@qodalis/angular-cli';
import { CliPanelPosition } from '@qodalis/cli-core';
import { PanelRefService } from '../../../../services/panel-ref.service';

@Component({
    standalone: false,
    selector: 'docs-panel-api',
    templateUrl: './panel-api.component.html',
})
export class PanelApiComponent {
    activeTab: 'angular' | 'react' | 'vue' = 'angular';

    stateLog: string[] = [];

    constructor(private panelRef: PanelRefService) {}

    private get panel(): CliPanelComponent | null {
        return this.panelRef.panel;
    }

    // ── Demo actions ──

    doOpen(): void {
        this.panel?.open();
        this.log('open()');
    }

    doCollapse(): void {
        this.panel?.collapse();
        this.log('collapse()');
    }

    doToggleCollapse(): void {
        this.panel?.toggleCollapse();
        this.log('toggleCollapse()');
    }

    doMaximize(): void {
        this.panel?.maximize();
        this.log('maximize()');
    }

    doRestore(): void {
        this.panel?.restore();
        this.log('restore()');
    }

    doHide(): void {
        this.panel?.hide();
        this.log('hide()');
    }

    doUnhide(): void {
        this.panel?.unhide();
        this.log('unhide()');
    }

    doClose(): void {
        this.panel?.close();
        this.log('close()');
    }

    doAddTab(): void {
        const id = this.panel?.addTab('Tab ' + Date.now().toString().slice(-4));
        this.log(`addTab() → ${id}`);
    }

    doCloseTab(): void {
        const state = this.panel?.getState();
        if (state) {
            this.panel?.closeTab(state.activeTabId);
            this.log(`closeTab(${state.activeTabId})`);
        }
    }

    doRenameTab(): void {
        const state = this.panel?.getState();
        if (state) {
            const name = 'Renamed-' + Date.now().toString().slice(-3);
            this.panel?.renameTab(state.activeTabId, name);
            this.log(`renameTab(${state.activeTabId}, "${name}")`);
        }
    }

    doSplitPane(): void {
        const id = this.panel?.splitPane();
        this.log(`splitPane() → ${id}`);
    }

    doSetPosition(pos: CliPanelPosition): void {
        this.panel?.setPosition(pos);
        this.log(`setPosition("${pos}")`);
    }

    doGetState(): void {
        const state = this.panel?.getState();
        this.log('getState() → ' + JSON.stringify(state, null, 2));
    }

    clearLog(): void {
        this.stateLog = [];
    }

    private log(msg: string): void {
        this.stateLog.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.stateLog.length > 50) {
            this.stateLog.length = 50;
        }
    }
}
