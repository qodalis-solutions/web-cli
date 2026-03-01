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
 * Example background services module demonstrating daemon services and background jobs.
 */
const backgroundServicesDemo: ICliModule = {
    apiVersion: 2,
    name: 'background-services-demo',
    description: 'Demonstrates background services and jobs',
    async onAfterBoot(context: ICliExecutionContext) {
        // Register a daemon service that ticks every 10 seconds
        context.backgroundServices.register({
            name: 'heartbeat',
            description: 'Logs a heartbeat every 10 seconds',
            type: 'daemon',
            async onStart(ctx) {
                ctx.log('Heartbeat service started');
                ctx.createInterval(() => {
                    ctx.log(`Heartbeat: ${new Date().toLocaleTimeString()}`);
                }, 10000);
            },
            async onStop(ctx) {
                ctx.log('Heartbeat service stopped');
            },
        });

        // Auto-start the heartbeat daemon
        await context.backgroundServices.start('heartbeat');
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
