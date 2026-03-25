import { Component, ViewChild } from '@angular/core';
import { CliComponent } from '@qodalis/angular-cli';
import { CliEngine } from '@qodalis/cli';
import { CliOptions, ICliModule } from '@qodalis/cli-core';
import { guidModule } from '@qodalis/cli-guid';
import { todoModule } from '@qodalis/cli-todo';
import { stringModule } from '@qodalis/cli-string';

@Component({
    standalone: false,
    selector: 'docs-engine-api',
    templateUrl: './engine-api.component.html',
})
export class EngineApiComponent {
    activeTab: 'angular' | 'react' | 'vue' | 'vanilla' = 'angular';

    commandText = 'help';
    stateLog: string[] = [];

    demoModules: ICliModule[] = [guidModule, todoModule, stringModule];
    demoOptions: CliOptions = {};

    @ViewChild('demoCli') demoCli!: CliComponent;

    private engine?: CliEngine;

    onEngineReady(engine: CliEngine): void {
        this.engine = engine;
        this.log('Engine ready');
    }

    async doExecuteCommand(): Promise<void> {
        const cmd = this.commandText.trim();
        if (!cmd) return;
        if (this.engine) {
            await this.engine.execute(cmd);
            this.log(`execute("${cmd}")`);
        } else {
            this.log('Engine not ready yet');
        }
    }

    doGetEngine(): void {
        const engine = this.demoCli?.getEngine();
        this.log(engine ? 'getEngine() → CliEngine instance' : 'getEngine() → undefined');
    }

    doFocus(): void {
        this.engine?.focus();
        this.log('focus()');
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
