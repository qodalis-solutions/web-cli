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
        context.backgroundServices.register({
            name: 'ticker',
            description: 'Worker daemon — ticks every 5s in a dedicated Web Worker',
            type: 'daemon',
            workerCompatible: true,
            workerFactory: () =>
                new Worker(new URL('./workers/ticker.worker', import.meta.url)),
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
