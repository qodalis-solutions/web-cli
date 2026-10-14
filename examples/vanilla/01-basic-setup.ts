/**
 * Example 01 — Basic Setup (Vanilla JS)
 *
 * The simplest way to use @qodalis/cli without any framework.
 * Just create a container element, instantiate CliEngine, and start it.
 *
 * Prerequisites:
 *   npm install @qodalis/cli @qodalis/cli-core @xterm/xterm
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/engine-api
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions } from '@qodalis/cli-core';
import { CliLogLevel } from '@qodalis/cli-core';

// ── Configuration ──────────────────────────────────────────────

const options: CliOptions = {
    // Minimum log level displayed in the terminal (None, DEBUG, LOG, INFO, WARN, ERROR)
    logLevel: CliLogLevel.INFO,

    // xterm.js terminal options
    terminalOptions: {
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", Menlo, monospace',
        cursorBlink: true,
        scrollback: 1000,       // number of lines kept in scrollback buffer
        convertEol: true,       // convert \n to \r\n
    },

    // Enable eval/js/calc commands (disabled by default for security)
    allowEval: false,
};

// ── Bootstrap ──────────────────────────────────────────────────

const container = document.getElementById('terminal')!;

// Create the engine with options
const engine = new CliEngine(container, options);

// Start the engine — this initializes xterm.js and prints the welcome message
engine.start().then(() => {
    engine.focus();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    engine.destroy();
});
