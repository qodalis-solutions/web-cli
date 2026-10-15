/**
 * Example 08 — State Management (Vanilla JS)
 *
 * Demonstrates the ICliStateStore API for persistent, reactive state.
 * State is scoped per-processor and persisted to localStorage.
 *
 * Key methods:
 *   getState()       — get a snapshot (shallow copy)
 *   updateState()    — shallow-merge new values
 *   select()         — reactive observable slice
 *   subscribe()      — listen to all state changes
 *   reset()          — restore to initialState
 *   persist()        — manually flush to storage
 *   initialize()     — load from storage
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/state-management
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliCommandChildProcessor,
    ICliModule,
    CliProcessCommand,
    ICliExecutionContext,
} from '@qodalis/cli-core';

// ── State-aware counter command ────────────────────────────────

interface CounterState {
    count: number;
    lastAction: string;
    history: string[];
}

const counterIncrementSubCommand: ICliCommandChildProcessor = {
    command: 'increment',
    aliases: ['inc', '+'],
    description: 'Increment the counter',
    parameters: [
        { name: 'by', description: 'Amount to increment', required: false, type: 'number', defaultValue: 1 },
    ],

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext) {
        const by = (command.args['by'] as number) || 1;
        const state = context.state.getState<CounterState>();

        context.state.updateState({
            count: state.count + by,
            lastAction: `+${by}`,
            history: [...state.history, `+${by}`],
        });

        const newState = context.state.getState<CounterState>();
        context.writer.writeSuccess(`Counter: ${newState.count}`);
    },
};

const counterDecrementSubCommand: ICliCommandChildProcessor = {
    command: 'decrement',
    aliases: ['dec', '-'],
    description: 'Decrement the counter',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const state = context.state.getState<CounterState>();

        context.state.updateState({
            count: state.count - 1,
            lastAction: '-1',
            history: [...state.history, '-1'],
        });

        const newState = context.state.getState<CounterState>();
        context.writer.writeSuccess(`Counter: ${newState.count}`);
    },
};

const counterResetSubCommand: ICliCommandChildProcessor = {
    command: 'reset',
    description: 'Reset the counter to 0',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        context.state.reset(); // restores initialState
        context.writer.writeSuccess('Counter reset to 0.');
    },
};

const counterHistorySubCommand: ICliCommandChildProcessor = {
    command: 'history',
    description: 'Show action history',

    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const state = context.state.getState<CounterState>();
        if (state.history.length === 0) {
            context.writer.writeInfo('No history yet.');
            return;
        }
        context.writer.writeList(state.history);
    },
};

const counterProcessor: ICliCommandProcessor = {
    command: 'counter',
    description: 'Persistent counter with state management',

    // Define initial state and storage key
    stateConfiguration: {
        initialState: {
            count: 0,
            lastAction: 'none',
            history: [],
        } as CounterState,
        storeName: 'demo-counter', // optional custom storage key
    },

    // Sub-commands
    processors: [
        counterIncrementSubCommand,
        counterDecrementSubCommand,
        counterResetSubCommand,
        counterHistorySubCommand,
    ],

    // Called during module boot — set up reactive subscriptions
    async initialize(context: ICliExecutionContext) {
        // Load persisted state from localStorage
        await context.state.initialize();

        // Reactive subscription: watch a specific state slice
        context.state.select((state) => (state as CounterState).count).subscribe(
            (count) => {
                context.logger.debug(`Counter changed to: ${count}`);
            },
        );

        // Or subscribe to all state changes
        context.state.subscribe((state) => {
            context.logger.debug(`State updated: ${JSON.stringify(state)}`);
        });
    },

    // Default action (just `counter` without sub-command) — show current value
    async processCommand(_command: CliProcessCommand, context: ICliExecutionContext) {
        const state = context.state.getState<CounterState>();
        context.writer.writeKeyValue({
            'Count': String(state.count),
            'Last Action': state.lastAction,
            'Total Actions': String(state.history.length),
        });
    },
};

// ── Module & Bootstrap ─────────────────────────────────────────

const stateDemoModule: ICliModule = {
    apiVersion: 2,
    name: 'state-demo',
    processors: [counterProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([stateDemoModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
