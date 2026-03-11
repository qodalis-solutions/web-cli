/**
 * Qodalis CLI — Vanilla JS Demo
 *
 * This example shows how to use @qodalis/cli directly in a plain HTML page
 * without any framework (no Angular, React, or Vue).
 *
 * The CliEngine class is fully framework-agnostic. You just need:
 *   1. A container element
 *   2. CliEngine from @qodalis/cli
 *   3. (Optional) plugin modules and custom processors
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions, ICliModule } from '@qodalis/cli-core';
import { CliLogLevel } from '@qodalis/cli-core';

// Import plugin modules
import { guidModule } from '@qodalis/cli-guid';
import { stringModule } from '@qodalis/cli-string';
import { passwordGeneratorModule } from '@qodalis/cli-password-generator';
import { qrModule } from '@qodalis/cli-qr';
import { todoModule } from '@qodalis/cli-todo';

// Import a custom inline processor
import { GreetCommandProcessor } from './processors/greet-command-processor.ts';

// ---------- Configuration ----------

const options: CliOptions = {
    logLevel: CliLogLevel.DEBUG,
    servers: [
        { name: 'dotnet', url: 'http://localhost:8046' },
        { name: 'node', url: 'http://localhost:8047' },
        { name: 'python', url: 'http://localhost:8048' },
    ],
};

// ---------- Modules ----------

const customModule: ICliModule = {
    apiVersion: 2,
    name: 'custom-commands',
    description: 'Custom commands for the vanilla demo',
    processors: [new GreetCommandProcessor()],
};

const modules: ICliModule[] = [
    guidModule,
    stringModule,
    passwordGeneratorModule,
    qrModule,
    todoModule,
    customModule,
];

// ---------- Bootstrap ----------

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, {
    ...options,
    terminalOptions: {
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", Menlo, monospace',
        cursorBlink: true,
    },
});

// Register all modules before starting
engine.registerModules(modules);

// Start the engine
engine.start().then(() => {
    engine.focus();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    engine.destroy();
});
