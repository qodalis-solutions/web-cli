import { Cli, CliConfigProvider } from '@qodalis/react-cli';
import { electronModule } from '@qodalis/electron-cli';
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
import { usersModule } from '@qodalis/cli-users';
import { filesModule } from '@qodalis/cli-files';
import { snakeModule } from '@qodalis/cli-snake';
import { tetrisModule } from '@qodalis/cli-tetris';
import { game2048Module } from '@qodalis/cli-2048';
import { minesweeperModule } from '@qodalis/cli-minesweeper';
import { wordleModule } from '@qodalis/cli-wordle';
import { scpModule } from '@qodalis/cli-scp';
import { wgetModule } from '@qodalis/cli-wget';
import type { CliOptions, ICliModule } from '@qodalis/cli-core';

const modules: ICliModule[] = [
    // Electron integration — overrides file transfer, clipboard, and `open` command
    electronModule,

    // Plugins
    filesModule,
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
    snakeModule,
    tetrisModule,
    game2048Module,
    minesweeperModule,
    wordleModule,
    scpModule,
    wgetModule,
    usersModule,
];

const options: CliOptions = {
    servers: [
        { name: 'dotnet', url: 'http://localhost:8046' },
        { name: 'node', url: 'http://localhost:8047' },
        { name: 'python', url: 'http://localhost:8048' },
    ],
};

const services: Record<string, any> = {
    'cli-framework': 'Electron',
};

function App() {
    return (
        <CliConfigProvider modules={modules} options={options} services={services}>
            <Cli />
        </CliConfigProvider>
    );
}

export default App;
