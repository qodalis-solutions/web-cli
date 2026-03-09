import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CliOptions, ICliModule } from '@qodalis/cli-core';
import { PLUGINS, PluginData } from '../../../../data/plugins';

import { usersModule } from '@qodalis/cli-users';
import { guidModule } from '@qodalis/cli-guid';
import { regexModule } from '@qodalis/cli-regex';
import { textToImageModule } from '@qodalis/cli-text-to-image';
import { speedTestModule } from '@qodalis/cli-speed-test';
import { browserStorageModule } from '@qodalis/cli-browser-storage';
import { stringModule } from '@qodalis/cli-string';
import { todoModule } from '@qodalis/cli-todo';
import { curlModule } from '@qodalis/cli-curl';
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';
import { qrModule } from '@qodalis/cli-qr';
import { yesnoModule } from '@qodalis/cli-yesno';
import { serverLogsModule } from '@qodalis/cli-server-logs';
import { filesModule } from '@qodalis/cli-files';
import { snakeModule } from '@qodalis/cli-snake';
import { tetrisModule } from '@qodalis/cli-tetris';
import { game2048Module } from '@qodalis/cli-2048';
import { minesweeperModule } from '@qodalis/cli-minesweeper';
import { wordleModule } from '@qodalis/cli-wordle';
import { sudokuModule } from '@qodalis/cli-sudoku';
import { chartModule } from '@qodalis/cli-chart';
import { cronModule } from '@qodalis/cli-cron';
import { csvModule } from '@qodalis/cli-csv';
import { markdownModule } from '@qodalis/cli-markdown';
import { scpModule } from '@qodalis/cli-scp';
import { stopwatchModule } from '@qodalis/cli-stopwatch';
import { wgetModule } from '@qodalis/cli-wget';

const MODULE_MAP: Record<string, ICliModule> = {
    guidModule,
    regexModule,
    textToImageModule,
    speedTestModule,
    browserStorageModule,
    stringModule,
    todoModule,
    curlModule,
    passwordGeneratorModule,
    qrModule,
    yesnoModule,
    serverLogsModule,
    filesModule,
    usersModule,
    snakeModule,
    tetrisModule,
    game2048Module,
    minesweeperModule,
    wordleModule,
    sudokuModule,
    chartModule,
    cronModule,
    csvModule,
    markdownModule,
    scpModule,
    stopwatchModule,
    wgetModule,
};

@Component({
    selector: 'docs-plugin-detail',
    templateUrl: './plugin-detail.component.html',
})
export class PluginDetailComponent implements OnInit {
    plugin: PluginData | undefined;
    tryItModules: ICliModule[] = [];
    tryItOptions: CliOptions = {};

    constructor(private route: ActivatedRoute) {}

    ngOnInit(): void {
        this.route.params.subscribe((params) => {
            this.plugin = PLUGINS.find((p) => p.id === params['pluginId']);
            if (this.plugin) {
                const mod = MODULE_MAP[this.plugin.moduleExport];
                this.tryItModules = mod ? [mod] : [];
            }
        });
    }

    get installCommand(): string {
        return `npm install ${this.plugin?.npmPackage}`;
    }

    get usageSnippet(): string {
        if (!this.plugin) return '';
        return `import { ${this.plugin.moduleExport} } from '${this.plugin.moduleImport}';

// Angular: <cli [modules]="[${this.plugin.moduleExport}]" />
// React:   <Cli modules={[${this.plugin.moduleExport}]} />
// Vue:     <Cli :modules="[${this.plugin.moduleExport}]" />`;
    }

    get runtimeInstall(): string {
        return `pkg add ${this.plugin?.npmPackage}`;
    }

    get hasTryIt(): boolean {
        return (
            this.plugin?.category !== 'language' &&
            this.tryItModules.length > 0
        );
    }
}
