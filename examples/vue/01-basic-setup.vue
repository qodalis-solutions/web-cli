<!--
  01 - Basic Setup
  Minimal Vue 3 setup with CliConfigProvider and Cli component.
  Docs: https://qodalis.com/docs/vue/getting-started
-->

<script setup lang="ts">
import { CliConfigProvider, Cli } from '@qodalis/vue-cli';
import type { CliEngineOptions } from '@qodalis/vue-cli';
import { CliEngine } from '@qodalis/cli';
import { CliLogLevel } from '@qodalis/cli-core';

// Configure engine options
const options: CliEngineOptions = {
    logLevel: CliLogLevel.Info,
    terminalOptions: {
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        theme: {
            background: '#1e1e2e',
            foreground: '#cdd6f4',
            cursor: '#f5e0dc',
        },
    },
};

// Called when the CLI engine has started and the terminal is interactive
function onReady(engine: CliEngine) {
    console.log('CLI engine is ready:', engine);
}
</script>

<template>
    <CliConfigProvider :options="options">
        <div style="height: 100vh; display: flex; flex-direction: column">
            <h1 style="margin: 0; padding: 16px; color: #cdd6f4">
                My App
            </h1>
            <Cli
                @ready="onReady"
                :style="{ flex: '1' }"
            />
        </div>
    </CliConfigProvider>
</template>
