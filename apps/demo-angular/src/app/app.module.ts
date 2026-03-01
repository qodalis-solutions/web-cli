import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import {
    CliModule,
    resolveCliProviders,
    resolveCliModuleProvider,
} from '@qodalis/angular-cli';
import { guidModule } from '@qodalis/cli-guid';
import { regexModule } from '@qodalis/cli-regex';
import { textToImageModule } from '@qodalis/cli-text-to-image';
import { speedTestModule } from '@qodalis/cli-speed-test';
import { browserStorageModule } from '@qodalis/cli-browser-storage';
import { stringModule } from '@qodalis/cli-string';
import { todoModule } from '@qodalis/cli-todo';
import { usersModule } from '@qodalis/cli-users';
import {
    ICliModule,
    ICliExecutionContext,
} from '@qodalis/cli-core';

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
        //    Angular's webpack doesn't support new URL() + import.meta.url for workers,
        //    so we use an inline Blob worker instead.
        context.backgroundServices.register({
            name: 'ticker',
            description: 'Worker daemon — ticks every 5s in a dedicated Web Worker',
            type: 'daemon',
            workerCompatible: true,
            workerFactory: () => {
                const code = `
                    let intervalId = null;
                    let count = 0;
                    self.onmessage = function(ev) {
                        switch (ev.data.type) {
                            case 'start':
                                count = 0;
                                self.postMessage({ type: 'status', status: 'running' });
                                self.postMessage({ type: 'log', level: 'info', message: 'Ticker worker started' });
                                intervalId = setInterval(function() {
                                    count++;
                                    self.postMessage({ type: 'log', level: 'info', message: 'Tick #' + count + ' from worker thread' });
                                    self.postMessage({ type: 'event', event: { source: 'ticker', type: 'tick', data: { count: count } } });
                                }, 5000);
                                break;
                            case 'stop':
                            case 'abort':
                                if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
                                self.postMessage({ type: 'log', level: 'info', message: 'Ticker worker stopped after ' + count + ' ticks' });
                                self.postMessage({ type: 'status', status: 'stopped' });
                                break;
                        }
                    };
                `;
                const blob = new Blob([code], { type: 'application/javascript' });
                return new Worker(URL.createObjectURL(blob));
            },
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

// Demonstrates registering CLI modules via Angular DI (NgModule providers).
// These modules are injected into CliComponent via CliModule_TOKEN automatically.
// Works with .configure() too — usersModule.configure() returns an ICliModule.
@NgModule({
    declarations: [AppComponent],
    imports: [BrowserModule, CliModule],
    providers: [
        resolveCliProviders(),
        resolveCliModuleProvider(guidModule),
        resolveCliModuleProvider(regexModule),
        resolveCliModuleProvider(textToImageModule),
        resolveCliModuleProvider(speedTestModule),
        resolveCliModuleProvider(browserStorageModule),
        resolveCliModuleProvider(stringModule),
        resolveCliModuleProvider(todoModule),
        resolveCliModuleProvider(
            usersModule.configure({
                seedUsers: [
                    {
                        name: 'root1',
                        email: 'root1@root.com',
                        groups: ['admin'],
                    },
                ],
                defaultPassword: 'root',
                requirePassword: true,
            }),
        ),
        resolveCliModuleProvider(backgroundServicesDemo),
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
