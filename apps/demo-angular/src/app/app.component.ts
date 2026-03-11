import { Component } from '@angular/core';
import { ICliModule, CliOptions, CliLogLevel } from '@qodalis/cli-core';
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
import { scpModule } from '@qodalis/cli-scp';
import { wgetModule } from '@qodalis/cli-wget';
import { sudokuModule } from '@qodalis/cli-sudoku';
import { CliInputDemoCommandProcessor } from './processors/cli-input-demo-command-processor';
import { CliPanelOptions } from '@qodalis/angular-cli';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: [],
})
export class AppComponent {
    // Demonstrates registering CLI modules via [modules] input prop.
    // guid, regex, text-to-image, speed-test, browser-storage, string,
    // todo, and users modules are registered via Angular DI in AppModule instead.
    modules: ICliModule[] = [
        filesModule,
        curlModule,
        passwordGeneratorModule,
        qrModule,
        yesnoModule,
        serverLogsModule,
        snakeModule,
        tetrisModule,
        game2048Module,
        minesweeperModule,
        wordleModule,
        scpModule,
        wgetModule,
        sudokuModule,
        {
            apiVersion: 2,
            name: 'input-demo',
            processors: [new CliInputDemoCommandProcessor()],
        },
    ];

    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
        packageSources: {
            primary: 'local',
            sources: [
                { name: 'local', url: 'http://localhost:3000/', kind: 'file' },
            ],
        },
        servers: [
            { name: 'dotnet', url: 'http://localhost:8046' },
            { name: 'node', url: 'http://localhost:8047' },
            { name: 'python', url: 'http://localhost:8048' },
        ],
    };

    panelOptions: CliPanelOptions = {
        position: 'bottom',
        syncTheme: true,
    };
}
