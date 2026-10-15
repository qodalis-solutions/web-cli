<!--
  04 - Engine API
  Low-level engine access using useCliEngine and useCli composables
  for programmatic command execution.
  Docs: https://qodalis.com/docs/vue/engine-api
-->

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
    CliConfigProvider,
    Cli,
    useCliEngine,
} from '@qodalis/vue-cli';
import type { CliEngineOptions } from '@qodalis/vue-cli';
import { CliEngine } from '@qodalis/cli';

// -------------------------------------------------------
// Approach 1: useCliEngine composable (standalone usage)
// -------------------------------------------------------
// Gives full control over the engine lifecycle without
// needing CliConfigProvider. Useful for embedding a CLI
// in an arbitrary part of the page.

const containerRef = ref<HTMLElement | null>(null);

const engineOptions: CliEngineOptions = {
    terminalOptions: {
        fontSize: 14,
        cursorBlink: true,
    },
};

const engine = useCliEngine(containerRef, {
    options: engineOptions,
});

// Watch for the engine to become available
watch(engine, (eng) => {
    if (eng) {
        console.log('Engine started (useCliEngine):', eng);
    }
});

// Execute a command programmatically
async function runCommand(command: string) {
    if (engine.value) {
        await engine.value.execute(command);
    }
}

// -------------------------------------------------------
// Approach 2: @ready event on Cli component
// -------------------------------------------------------
// The Cli component emits a 'ready' event with the engine
// instance once it has started. Store it for later use.

const readyEngine = ref<CliEngine | null>(null);

function onReady(eng: CliEngine) {
    readyEngine.value = eng;
    console.log('Engine ready (via @ready event):', eng);
}

async function executeViaReady() {
    if (readyEngine.value) {
        await readyEngine.value.execute('help');
    }
}
</script>

<template>
    <div style="height: 100vh; display: flex; flex-direction: column">
        <!-- Section 1: useCliEngine with a raw container ref -->
        <section style="flex: 1; display: flex; flex-direction: column">
            <div style="padding: 8px; display: flex; gap: 8px">
                <button @click="runCommand('help')">Run "help"</button>
                <button @click="runCommand('clear')">Run "clear"</button>
            </div>
            <div ref="containerRef" style="flex: 1" />
        </section>

        <!-- Section 2: Cli component with @ready event -->
        <section style="flex: 1; display: flex; flex-direction: column">
            <div style="padding: 8px; display: flex; gap: 8px">
                <button @click="executeViaReady">Run "help" (@ready)</button>
            </div>
            <Cli @ready="onReady" :style="{ flex: '1' }" />
        </section>
    </div>
</template>

<!--
  -------------------------------------------------------
  Approach 3: useCli composable (inside CliConfigProvider)
  -------------------------------------------------------
  Use this in child components that need access to the
  shared engine provided by CliConfigProvider/CliProvider.
  Must be called inside a <CliProvider> subtree.

  Example child component:

  <script setup lang="ts">
  import { watch } from 'vue';
  import { useCli } from '@qodalis/vue-cli';

  const { engine } = useCli();

  watch(engine, async (eng) => {
      if (eng) {
          // Execute a command once the engine is available
          await eng.execute('echo "Hello from child component"');
      }
  });
  </script>
-->
