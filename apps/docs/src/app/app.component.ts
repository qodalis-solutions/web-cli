import { Component } from '@angular/core';
import { CliLogLevel, CliOptions, ICliModule } from '@qodalis/cli-core';
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
    ];

    options: CliOptions = {
        logLevel: CliLogLevel.DEBUG,
    };
}
