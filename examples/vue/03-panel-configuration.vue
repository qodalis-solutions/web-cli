<!--
  03 - Panel Configuration
  CliPanel with full options, v-model bindings, template ref for
  programmatic control, and event handlers.
  Docs: https://qodalis.com/docs/vue/cli-panel
-->

<script setup lang="ts">
import { ref } from 'vue';
import { CliConfigProvider, CliPanel } from '@qodalis/vue-cli';
import type { CliPanelOptions } from '@qodalis/vue-cli';
import type { CliPanelPosition, CliPanelState } from '@qodalis/cli-core';
import '@qodalis/vue-cli/dist/styles.css';

// --- Panel options ---

const panelOptions: CliPanelOptions = {
    // CliPanelConfig options
    // Note: isCollapsed/isHidden are omitted here because we use
    // v-model:collapsed and v-model:hidden for controlled state below.
    position: 'bottom',
    closable: true,
    resizable: true,
    hideable: true,
    hideAlignment: 'center',
    syncTheme: true,

    // CliEngineOptions (inherited)
    terminalOptions: {
        fontSize: 13,
        cursorBlink: true,
    },
};

// --- v-model bindings ---

const collapsed = ref(true);
const hidden = ref(false);

// --- Template ref for programmatic access ---

const panelRef = ref<InstanceType<typeof CliPanel> | null>(null);

// --- Programmatic methods ---

function openPanel() {
    panelRef.value?.open();
}

function togglePanel() {
    panelRef.value?.toggleCollapse();
}

function maximizePanel() {
    panelRef.value?.maximize();
}

function restorePanel() {
    panelRef.value?.restore();
}

function addNewTab() {
    panelRef.value?.addTab('New Tab');
}

function splitCurrentPane() {
    panelRef.value?.splitPane();
}

function resizePanel() {
    panelRef.value?.resize({ height: 500 });
}

function changePosition(position: CliPanelPosition) {
    panelRef.value?.setPosition(position);
}

function inspectState() {
    const state: CliPanelState | undefined = panelRef.value?.getState();
    if (state) {
        console.log('Panel state:', state);
    }
}

// --- Event handlers ---

function onClose() {
    console.log('Panel closed');
}

function onTabAdded(tab: { id: number; title: string }) {
    console.log('Tab added:', tab);
}

function onTabClosed(tabId: number) {
    console.log('Tab closed:', tabId);
}

function onPaneSplit(pane: { tabId: number; paneId: number }) {
    console.log('Pane split:', pane);
}
</script>

<template>
    <CliConfigProvider>
        <div style="height: 100vh; display: flex; flex-direction: column">
            <!-- Toolbar with panel controls -->
            <div style="padding: 12px; display: flex; gap: 8px; flex-wrap: wrap">
                <button @click="openPanel">Open</button>
                <button @click="togglePanel">Toggle</button>
                <button @click="maximizePanel">Maximize</button>
                <button @click="restorePanel">Restore</button>
                <button @click="addNewTab">Add Tab</button>
                <button @click="splitCurrentPane">Split Pane</button>
                <button @click="resizePanel">Resize (500px)</button>
                <button @click="changePosition('left')">Left</button>
                <button @click="changePosition('bottom')">Bottom</button>
                <button @click="changePosition('right')">Right</button>
                <button @click="inspectState">Log State</button>
            </div>

            <!-- Main content area -->
            <div style="flex: 1; padding: 16px">
                <p>collapsed: {{ collapsed }}, hidden: {{ hidden }}</p>
            </div>

            <!-- CLI Panel -->
            <CliPanel
                ref="panelRef"
                :options="panelOptions"
                v-model:collapsed="collapsed"
                v-model:hidden="hidden"
                @close="onClose"
                @tab-added="onTabAdded"
                @tab-closed="onTabClosed"
                @pane-split="onPaneSplit"
            />
        </div>
    </CliConfigProvider>
</template>
