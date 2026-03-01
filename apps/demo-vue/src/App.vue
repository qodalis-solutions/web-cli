<script setup lang="ts">
import { Cli, CliPanel, CliConfigProvider, type CliPanelOptions } from '@qodalis/vue-cli';
import '@qodalis/cli/assets/cli-panel.css';
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
import { CliLogLevel, type CliOptions, type ICliModule } from '@qodalis/cli-core';
import { CliInputDemoCommandProcessor } from './processors/cli-input-demo-command-processor';

const modules: ICliModule[] = [
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
    usersModule.configure({
        seedUsers: [
            { name: 'root1', email: 'root1@root.com', groups: ['admin'] },
        ],
        defaultPassword: 'root',
        requirePassword: true,
    }),
    {
        apiVersion: 2,
        name: 'input-demo',
        processors: [new CliInputDemoCommandProcessor()],
    },
];

const options: CliOptions = {
    logLevel: CliLogLevel.DEBUG,
    packageSources: {
        primary: 'local',
        sources: [
            { name: 'local', url: 'http://localhost:3000/', kind: 'file' },
        ],
    },
    servers: [
        { name: 'local', url: '' },
    ],
};

const panelOptions: CliPanelOptions = {
  position: "bottom",
};
</script>

<template>
  <CliConfigProvider :modules="modules" :options="options">
    <Cli :style="{ width: '100vw', height: '100vh' }" />
    <CliPanel :options="panelOptions" />
  </CliConfigProvider>
</template>
