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
import { scpModule } from '@qodalis/cli-scp';
import { wgetModule } from '@qodalis/cli-wget';
import { sudokuModule } from '@qodalis/cli-sudoku';
import { jobsModule } from '@qodalis/cli-server-jobs';
import { encodeModule } from '@qodalis/cli-encode';
import { dataExplorerModule } from '@qodalis/cli-data-explorer';
import {
    CliLogLevel,
    type CliOptions,
    type ICliModule,
    type ICliExecutionContext,
} from '@qodalis/cli-core';
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
import { CliInputDemoCommandProcessor } from './processors/cli-input-demo-command-processor';

/**
 * Example background services module demonstrating both execution modes:
 *   - "heartbeat" runs on the main thread (uses ctx.createInterval)
 *   - "ticker" runs in a Web Worker (uses workerFactory)
 */
const backgroundServicesDemo: ICliModule = {
    apiVersion: 2,
    name: 'background-services-demo',
    description: 'Demonstrates background services on main thread and in a Web Worker',
    async onAfterBoot(context: ICliExecutionContext) {
        // 1. Main-thread daemon: heartbeat (logs every 10s)
        context.backgroundServices.register({
            name: 'heartbeat',
            description: 'Main-thread daemon — logs a heartbeat every 10s',
            type: 'daemon',
            async onStart(ctx) {
                ctx.log('Heartbeat service started (main thread)');
                ctx.createInterval(() => {
                    ctx.log(`Heartbeat: ${new Date().toLocaleTimeString()}`);
                }, 10000);
            },
            async onStop(ctx) {
                ctx.log('Heartbeat service stopped');
            },
        });

        // 2. Worker daemon: ticker (ticks every 5s in a Web Worker)
        context.backgroundServices.register({
            name: 'ticker',
            description: 'Worker daemon — ticks every 5s in a dedicated Web Worker',
            type: 'daemon',
            workerCompatible: true,
            workerFactory: () =>
                new Worker(new URL('./workers/ticker.worker.ts', import.meta.url), {
                    type: 'module',
                }),
            // Main-thread fallback if Workers are unavailable
            async onStart(ctx) {
                let count = 0;
                ctx.log('Ticker started (main-thread fallback)');
                ctx.createInterval(() => {
                    count++;
                    ctx.log(`Tick #${count} from main thread (fallback)`);
                }, 5000);
            },
            async onStop(ctx) {
                ctx.log('Ticker stopped');
            },
        });

        // Auto-start both
        await context.backgroundServices.start('heartbeat');
        await context.backgroundServices.start('ticker');
    },
};

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
    scpModule,
    wgetModule,
    sudokuModule,
    jobsModule,
    encodeModule,
    dataExplorerModule,
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
    backgroundServicesDemo,
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

const options: CliOptions = {
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

const panelOptions: CliPanelOptions = {
  position: "right",
  isHidden: true,
};
</script>

<template>
  <CliConfigProvider :modules="modules" :options="options">
    <Cli :style="{ width: '100vw', height: '100vh' }" />
    <CliPanel :options="panelOptions" />
  </CliConfigProvider>
</template>
