<!--
  05 - Plugin Usage
  Import and configure multiple plugin modules, language packs,
  background services, and custom services.
  Docs: https://qodalis.com/docs/vue/plugins
-->

<script setup lang="ts">
import { CliConfigProvider, Cli } from '@qodalis/vue-cli';
import type { CliEngineOptions } from '@qodalis/vue-cli';
import type { ICliModule, ICliExecutionContext } from '@qodalis/cli-core';
import { API_VERSION, CliLogLevel } from '@qodalis/cli-core';

// --- Import plugin modules ---

import { guidModule } from '@qodalis/cli-guid';
import { regexModule } from '@qodalis/cli-regex';
import { stringModule } from '@qodalis/cli-string';
import { todoModule } from '@qodalis/cli-todo';
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';
import { usersModule } from '@qodalis/cli-users';

// --- Configure the users module ---
// usersModule.configure() returns a new module instance with
// the given config merged in, without mutating the original.

const configuredUsersModule = usersModule.configure({
    defaultPassword: 'changeme',
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
});

// --- Import language packs ---
// Each module can ship its own translations. The users module
// is configured separately above; others ship translations
// inside the module definition.

import '@qodalis/cli-guid/locales/es';
import '@qodalis/cli-guid/locales/fr';
import '@qodalis/cli-guid/locales/de';

// --- Background services module ---
// Modules can register services and lifecycle hooks without
// providing any command processors.

const analyticsModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-analytics',
    version: '1.0.0',
    description: 'Tracks CLI usage for analytics',
    processors: [],
    services: [
        {
            provide: 'analytics-service',
            useFactory: () => ({
                track(event: string, data?: Record<string, unknown>) {
                    console.log(`[analytics] ${event}`, data);
                },
            }),
        },
    ],
    async onInit(context: ICliExecutionContext) {
        console.log('Analytics module initialized');
    },
    async onAfterBoot(context: ICliExecutionContext) {
        // Access the registered service from the context
        const analytics = context.services.get<{
            track: (event: string, data?: Record<string, unknown>) => void;
        }>('analytics-service');
        analytics?.track('cli.boot', { timestamp: Date.now() });
    },
};

// --- Custom services ---
// Pass additional services that are registered into the engine's
// service container and accessible from any command processor.

const customServices: Record<string, any> = {
    'api-client': {
        baseUrl: 'https://api.example.com',
        async fetch(path: string) {
            const res = await globalThis.fetch(`${this.baseUrl}${path}`);
            return res.json();
        },
    },
    'feature-flags': {
        darkMode: true,
        betaFeatures: false,
    },
};

// --- Assemble all modules ---

const modules: ICliModule[] = [
    guidModule,
    regexModule,
    stringModule,
    todoModule,
    passwordGeneratorModule,
    configuredUsersModule,
    analyticsModule,
];

// --- Engine options ---

const options: CliEngineOptions = {
    logLevel: CliLogLevel.Info,
    terminalOptions: {
        fontSize: 14,
        cursorBlink: true,
    },
};
</script>

<template>
    <CliConfigProvider
        :modules="modules"
        :options="options"
        :services="customServices"
    >
        <div style="height: 100vh">
            <Cli :style="{ height: '100%' }" />
        </div>
    </CliConfigProvider>
</template>
