/**
 * Example 14 — Engine Snapshots (Vanilla JS)
 *
 * Demonstrates saving and restoring CLI engine state using CliEngineSnapshot.
 * Snapshots capture terminal buffer, command history, and state stores —
 * useful for duplicating tabs, persisting sessions, or undo/redo.
 *
 * Features:
 *   - engine.snapshot() — serialize current state
 *   - Restoring from snapshot via CliEngineOptions.snapshot
 *   - Persisting snapshots to localStorage
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliEngineOptions } from '@qodalis/cli';
import type {
    CliEngineSnapshot,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

const SNAPSHOT_KEY = 'cli-snapshot';

// ── 1. Save a snapshot ────────────────────────────────────────

const saveCommand: ICliCommandProcessor = {
    command: 'session-save',
    description: 'Save the current terminal state to localStorage',

    async processCommand(_command, context: ICliExecutionContext) {
        // engine is available on the context's executor
        const engine = (context as any).engine as CliEngine | undefined;
        if (!engine) {
            context.writer.writeError('Engine not accessible');
            return;
        }

        const snap: CliEngineSnapshot = engine.snapshot();

        // Snapshot shape:
        // {
        //   version: 1,
        //   timestamp: 1712500000000,
        //   terminal: { serializedBuffer: '...', cols: 120, rows: 30 },
        //   commandHistory: ['help', 'version', ...],
        //   stateStores: [{ name: 'counter', state: { count: 5 } }, ...]
        // }

        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));

        context.writer.writeSuccess('Session saved!');
        context.writer.writeKeyValue({
            'History entries': String(snap.commandHistory.length),
            'State stores': String(snap.stateStores.length),
            'Terminal size': `${snap.terminal.cols}x${snap.terminal.rows}`,
            'Saved at': new Date(snap.timestamp).toLocaleString(),
        });
    },
};

// ── 2. Restore command (for info — actual restore happens at boot)

const restoreCommand: ICliCommandProcessor = {
    command: 'session-restore',
    description: 'Show info about the saved session (restoring happens at startup)',

    async processCommand(_command, context: ICliExecutionContext) {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (!raw) {
            context.writer.writeWarning('No saved session found');
            context.writer.writeInfo('Run "session-save" first, then reload the page');
            return;
        }

        const snap: CliEngineSnapshot = JSON.parse(raw);
        context.writer.writeln('Saved session details:');
        context.writer.writeKeyValue({
            'Schema version': String(snap.version),
            'History entries': String(snap.commandHistory.length),
            'State stores': snap.stateStores.map((s) => s.name).join(', ') || '(none)',
            'Terminal size': `${snap.terminal.cols}x${snap.terminal.rows}`,
            'Saved at': new Date(snap.timestamp).toLocaleString(),
        });
        context.writer.writeln('');
        context.writer.writeInfo('Reload the page to restore this session.');
    },
};

// ── 3. Clear saved session ────────────────────────────────────

const clearCommand: ICliCommandProcessor = {
    command: 'session-clear',
    description: 'Delete the saved session from localStorage',

    async processCommand(_command, context: ICliExecutionContext) {
        localStorage.removeItem(SNAPSHOT_KEY);
        context.writer.writeSuccess('Saved session cleared');
    },
};

// ── Module ────────────────────────────────────────────────────

const sessionModule: ICliModule = {
    apiVersion: 2,
    name: 'session-demo',
    description: 'Save and restore CLI sessions',
    processors: [saveCommand, restoreCommand, clearCommand],
};

// ── Bootstrap with snapshot restore ───────────────────────────

// Check localStorage for a saved snapshot
const savedSnapshot = localStorage.getItem(SNAPSHOT_KEY);
let snapshot: CliEngineSnapshot | undefined;

if (savedSnapshot) {
    try {
        snapshot = JSON.parse(savedSnapshot);
    } catch {
        // Ignore corrupt data
    }
}

const options: CliEngineOptions = {
    // Pass the snapshot to restore terminal buffer, history, and state
    snapshot,
    terminalOptions: {
        fontSize: 14,
    },
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, options);

engine.registerModules([sessionModule]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
