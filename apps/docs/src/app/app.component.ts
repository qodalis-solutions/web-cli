import { Component } from '@angular/core';
import { CliLogLevel, ICliModule } from '@qodalis/cli-core';
import { CliPanelOptions } from '@qodalis/angular-cli';
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
import { langEsModule } from '@qodalis/cli-lang-es';
import { langFrModule } from '@qodalis/cli-lang-fr';
import { langDeModule } from '@qodalis/cli-lang-de';
import { langPtModule } from '@qodalis/cli-lang-pt';
import { langItModule } from '@qodalis/cli-lang-it';
import { langJaModule } from '@qodalis/cli-lang-ja';
import { langKoModule } from '@qodalis/cli-lang-ko';
import { langZhModule } from '@qodalis/cli-lang-zh';
import { langRuModule } from '@qodalis/cli-lang-ru';
import { langRoModule } from '@qodalis/cli-lang-ro';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.sass'],
})
export class AppComponent {
    title = 'Qodalis CLI';

    modules: ICliModule[] = [
        usersModule,
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
        langEsModule,
        langFrModule,
        langDeModule,
        langPtModule,
        langItModule,
        langJaModule,
        langKoModule,
        langZhModule,
        langRuModule,
        langRoModule,
    ];

    options: CliPanelOptions = {
        logLevel: CliLogLevel.DEBUG,
        position: 'right',
        isHidden: true,
    };
}
