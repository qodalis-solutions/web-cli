/**
 * Example 15 — Command Hooks (Vanilla JS)
 *
 * Demonstrates the ICliProcessorHook system for running logic
 * before and/or after a command executes. Hooks are defined on
 * individual processors via the `hooks` array.
 *
 * Use cases:
 *   - Logging / analytics
 *   - Permission checks
 *   - Pre-validation
 *   - Cleanup after execution
 *   - Timing / performance measurement
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-processors
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandProcessor,
    ICliProcessorHook,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';

// ── 1. Simple before/after hooks ──────────────────────────────

const greetProcessor: ICliCommandProcessor = {
    command: 'greet',
    description: 'Greet someone (with before/after hooks)',
    valueRequired: true,

    hooks: [
        {
            when: 'before',
            async execute(context: ICliExecutionContext) {
                context.writer.writeInfo('[hook] Running pre-flight checks...');
            },
        },
        {
            when: 'after',
            async execute(context: ICliExecutionContext) {
                context.writer.writeInfo('[hook] Command completed, logging...');
            },
        },
    ],

    async processCommand(command, context: ICliExecutionContext) {
        context.writer.writeln(`Hello, ${command.value}!`);
    },
};

// ── 2. Timing hook — measure command execution time ───────────

// Shared state between before and after hooks
const timingState = new Map<string, number>();

const timingBeforeHook: ICliProcessorHook = {
    when: 'before',
    async execute(_context: ICliExecutionContext) {
        timingState.set('start', performance.now());
    },
};

const timingAfterHook: ICliProcessorHook = {
    when: 'after',
    async execute(context: ICliExecutionContext) {
        const start = timingState.get('start');
        if (start !== undefined) {
            const elapsed = (performance.now() - start).toFixed(1);
            context.writer.writeln('');
            context.writer.writeInfo(`[timing] Executed in ${elapsed}ms`);
            timingState.delete('start');
        }
    },
};

const slowProcessor: ICliCommandProcessor = {
    command: 'slow-task',
    description: 'A slow command with timing hooks',
    hooks: [timingBeforeHook, timingAfterHook],

    async processCommand(_command, context: ICliExecutionContext) {
        context.writer.writeln('Working...');
        await new Promise((r) => setTimeout(r, 1500));
        context.writer.writeSuccess('Done!');
    },
};

// ── 3. Permission check hook ──────────────────────────────────

const adminOnlyHook: ICliProcessorHook = {
    when: 'before',
    async execute(context: ICliExecutionContext) {
        const session = context.userSession;
        const isAdmin = session?.user?.groups?.includes('admin');

        if (!isAdmin) {
            context.writer.writeWarning(
                '[auth] Admin privileges required. ' +
                'Log in with an admin account to use this command.',
            );
            // Note: hooks cannot abort execution directly.
            // For command-level authorization, use validateBeforeExecution()
            // on the processor instead (see example below).
        }
    },
};

// ── 4. validateBeforeExecution — abort if invalid ─────────────
//    Unlike hooks, it can block execution: it runs synchronously before
//    processCommand and returns { valid, message }. Interactive checks (a
//    confirmation prompt) belong in processCommand, which can simply return.

const dangerProcessor: ICliCommandProcessor = {
    command: 'danger-reset',
    description: 'Dangerous operation that requires --force and a confirmation',

    hooks: [timingBeforeHook, timingAfterHook],

    parameters: [
        { name: 'force', type: 'boolean', description: 'Required to run', required: false },
    ],

    validateBeforeExecution(command) {
        return command.args['force']
            ? { valid: true }
            : { valid: false, message: 'Refusing to reset without --force.' };
    },

    async processCommand(_command, context: ICliExecutionContext) {
        const confirmed = await context.reader.readConfirm(
            'This will reset all data. Are you sure?',
        );
        if (!confirmed) {
            context.writer.writeWarning('Operation cancelled.');
            return;
        }
        context.writer.writeln('Resetting all data...');
        await new Promise((r) => setTimeout(r, 1000));
        context.writer.writeSuccess('All data has been reset.');
    },
};

// ── 5. Reusable hook factories ────────────────────────────────

function createLoggingHook(label: string): ICliProcessorHook[] {
    return [
        {
            when: 'before',
            async execute(context: ICliExecutionContext) {
                context.writer.writeInfo(`[${label}] Starting...`);
            },
        },
        {
            when: 'after',
            async execute(context: ICliExecutionContext) {
                context.writer.writeInfo(`[${label}] Finished.`);
            },
        },
    ];
}

const loggedProcessor: ICliCommandProcessor = {
    command: 'logged-cmd',
    description: 'Command with factory-generated hooks',
    hooks: [...createLoggingHook('audit'), timingBeforeHook, timingAfterHook],

    async processCommand(_command, context: ICliExecutionContext) {
        context.writer.writeln('Doing important work...');
        await new Promise((r) => setTimeout(r, 500));
        context.writer.writeSuccess('Work complete.');
    },
};

// ── Module & Bootstrap ────────────────────────────────────────

const hooksModule: ICliModule = {
    apiVersion: 2,
    name: 'hooks-demo',
    description: 'Command hooks and validation demos',
    processors: [greetProcessor, slowProcessor, dangerProcessor, loggedProcessor],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

engine.registerModules([hooksModule]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
