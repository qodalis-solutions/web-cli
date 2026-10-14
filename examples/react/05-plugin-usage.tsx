/**
 * 05 - Plugin Usage
 *
 * Shows how to import and configure first-party plugin modules,
 * language packs, background services, and custom service injection.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/
 */

import React from 'react';
import { ICliModule, ICliBackgroundService, API_VERSION } from '@qodalis/cli-core';
import { Cli, CliConfigProvider } from '@qodalis/react-cli';

// ---------------------------------------------------------------------------
// 1. Import plugin modules
// ---------------------------------------------------------------------------

import { guidModule } from '@qodalis/cli-guid';
import { regexModule } from '@qodalis/cli-regex';
import { todoModule } from '@qodalis/cli-todo';
import { curlModule } from '@qodalis/cli-curl';
import { qrModule } from '@qodalis/cli-qr';
import { markdownModule } from '@qodalis/cli-markdown';
import { browserStorageModule } from '@qodalis/cli-browser-storage';

// ---------------------------------------------------------------------------
// 2. Users module with configuration
// ---------------------------------------------------------------------------

import { usersModule } from '@qodalis/cli-users';

const configuredUsersModule = usersModule.configure({
    requirePassword: true,
    requirePasswordOnBoot: false,
    defaultPassword: 'admin',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    seedUsers: [
        { name: 'alice', groups: ['developers'] },
        { name: 'bob', groups: ['developers', 'admins'] },
    ],
    userDisplayFormatter: (user) => `${user.name}@myapp`,
});

// ---------------------------------------------------------------------------
// 3. Language packs
// ---------------------------------------------------------------------------

import { langDeModule } from '@qodalis/cli-lang-de';
import { langJaModule } from '@qodalis/cli-lang-ja';

// ---------------------------------------------------------------------------
// 4. Background services module
//    Registers daemon and worker services that run alongside the terminal.
// ---------------------------------------------------------------------------

const heartbeatService: ICliBackgroundService = {
    name: 'heartbeat',
    description: 'Sends periodic health checks',
    type: 'daemon',
    workerCompatible: false,

    async onStart(context) {
        const interval = setInterval(() => {
            context.log('heartbeat: alive', 'info');
        }, 10_000);

        // Store handle so onStop can clean up
        (this as any)._interval = interval;
    },

    async onStop() {
        clearInterval((this as any)._interval);
    },

    onError(error, context) {
        context.log(`heartbeat failed: ${error.message}`, 'error');
    },
};

const analyticsService: ICliBackgroundService = {
    name: 'analytics-sync',
    description: 'Flushes analytics events to the server',
    type: 'daemon',
    workerCompatible: true,
    workerFactory: () => new Worker(
        new URL('./analytics-worker.ts', import.meta.url),
    ),

    async onStart(context) {
        context.log('analytics-sync started', 'info');
    },

    async onStop(context) {
        context.log('analytics-sync stopped, flushing...', 'info');
    },
};

const backgroundServicesModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-background-services',
    version: '1.0.0',
    description: 'Registers background daemons and workers',

    async onInit(context) {
        // Register services so they appear in `services list`
        context.backgroundServices.register(heartbeatService);
        context.backgroundServices.register(analyticsService);

        // Start the daemon immediately
        await context.backgroundServices.start('heartbeat');
    },
};

// ---------------------------------------------------------------------------
// 5. Custom services injection
//    Services are registered in the engine's DI container and can be
//    resolved by any command processor via context.services.resolve(token).
// ---------------------------------------------------------------------------

interface INotificationService {
    notify(message: string): void;
}

const notificationService: INotificationService = {
    notify(message: string) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('CLI', { body: message });
        } else {
            console.log(`[notification] ${message}`);
        }
    },
};

interface IApiClient {
    baseUrl: string;
    get(path: string): Promise<Response>;
}

const apiClient: IApiClient = {
    baseUrl: '/api',
    get(path: string) {
        return fetch(`${this.baseUrl}${path}`);
    },
};

// ---------------------------------------------------------------------------
// 6. Assemble everything
// ---------------------------------------------------------------------------

const allModules: ICliModule[] = [
    // Plugins
    guidModule,
    regexModule,
    todoModule,
    curlModule,
    qrModule,
    markdownModule,
    browserStorageModule,

    // Users (configured)
    configuredUsersModule,

    // Language packs
    langDeModule,
    langJaModule,

    // Background services
    backgroundServicesModule,
];

const customServices: Record<string, any> = {
    'notification-service': notificationService,
    'api-client': apiClient,
};

export function FullPluginDemo() {
    return (
        <CliConfigProvider
            modules={allModules}
            services={customServices}
            options={{
                logLevel: 'info',
                terminalOptions: {
                    fontSize: 14,
                    cursorBlink: true,
                },
            }}
        >
            <div style={{ height: '100vh' }}>
                <Cli
                    onReady={(engine) => {
                        console.log('All plugins loaded:', allModules.map((m) => m.name));
                    }}
                />
            </div>
        </CliConfigProvider>
    );
}
