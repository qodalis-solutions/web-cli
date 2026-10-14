<!--
  02 - Custom Commands
  Define custom ICliCommandProcessor instances, wrap them in an ICliModule,
  and register via CliConfigProvider.
  Docs: https://qodalis.com/docs/vue/custom-commands
-->

<script setup lang="ts">
import { CliConfigProvider, Cli } from '@qodalis/vue-cli';
import type {
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';
import { API_VERSION, CliForegroundColor } from '@qodalis/cli-core';

// --- Custom command processor with parameters ---

const greetProcessor: ICliCommandProcessor = {
    command: 'greet',
    description: 'Greet a user by name',
    // Accept raw text after the command name as its value
    valueRequired: true,
    parameters: [
        {
            name: 'uppercase',
            aliases: ['u'],
            description: 'Print the greeting in uppercase',
            type: 'boolean',
            required: false,
            defaultValue: false,
        },
        {
            name: 'repeat',
            aliases: ['r'],
            description: 'Number of times to repeat the greeting',
            type: 'number',
            required: false,
            defaultValue: 1,
        },
    ],
    async processCommand(command, context: ICliExecutionContext) {
        const name = command.value || 'World';
        const uppercase = command.args?.['uppercase'] === true;
        const repeat = Number(command.args?.['repeat'] ?? 1);

        for (let i = 0; i < repeat; i++) {
            let message = `Hello, ${name}!`;
            if (uppercase) {
                message = message.toUpperCase();
            }
            context.writer.writeln(message, CliForegroundColor.Green);
        }

        context.process.resolve();
    },
};

// --- Wrap processors in a module ---

const myModule: ICliModule = {
    apiVersion: API_VERSION,
    name: 'my-custom-commands',
    version: '1.0.0',
    description: 'Custom greeting commands for the CLI',
    processors: [greetProcessor],
};
</script>

<template>
    <CliConfigProvider :modules="[myModule]">
        <div style="height: 100vh">
            <Cli :style="{ height: '100%' }" />
        </div>
    </CliConfigProvider>
</template>
