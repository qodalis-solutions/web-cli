/**
 * Example 06 — Background Services (Vanilla JS)
 *
 * Demonstrates background service lifecycle:
 *   - Daemon: long-running service (polling, WebSocket, etc.)
 *   - Job: run-to-completion task
 *   - Web Worker integration
 *   - Event system and logging
 *
 * Built-in commands to manage services:
 *   services             — list all registered services with status
 *   services start <name> — start a service
 *   services stop <name>  — stop a service
 *   services logs <name>  — view service log buffer
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/background-services
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliModule,
    ICliExecutionContext,
    ICliBackgroundService,
} from '@qodalis/cli-core';

// ── 1. Daemon — long-running polling service ───────────────────

const pollingDaemon: ICliBackgroundService = {
    name: 'poller',
    description: 'Polls for updates every 10 seconds',
    type: 'daemon', // keeps running until stopped

    async onStart(ctx) {
        ctx.log('Poller started');

        // Use managed interval — auto-cleared when service stops
        ctx.createInterval(() => {
            ctx.log('Polling for updates...');

            // Emit an event (other parts of the app can listen)
            ctx.emit({
                source: 'poller',
                type: 'poll',
                data: { timestamp: Date.now() },
            });
        }, 10000);

        // For daemons, onStart should block until the abort signal fires.
        // The managed interval keeps the service alive.
        // When stop() is called, the signal fires and timers are cleaned up.
    },

    async onStop(ctx) {
        ctx.log('Poller stopped gracefully');
    },

    onError(error, ctx) {
        ctx.log(`Poller error: ${error.message}`, 'error');
    },
};

// ── 2. Job — one-shot task ─────────────────────────────────────

// Jobs are registered inline via startJob() — see module.onAfterBoot below.

// ── 3. Worker-compatible daemon ────────────────────────────────

const workerDaemon: ICliBackgroundService = {
    name: 'ticker',
    description: 'Ticks every 5s (runs in Web Worker when available)',
    type: 'daemon',
    workerCompatible: true,

    // Factory that creates the Worker instance.
    // The Worker file must use the WorkerServiceContext protocol.
    workerFactory: () =>
        new Worker(new URL('./workers/ticker.worker.ts', import.meta.url), {
            type: 'module',
        }),

    // Main-thread fallback if Workers are unavailable
    async onStart(ctx) {
        let count = 0;
        ctx.log('Ticker started (main-thread fallback)');
        ctx.createInterval(() => {
            count++;
            ctx.log(`Tick #${count}`);
            ctx.emit({ source: 'ticker', type: 'tick', data: { count } });
        }, 5000);
    },

    async onStop(ctx) {
        ctx.log('Ticker stopped');
    },
};

// ── Module with lifecycle hooks ────────────────────────────────

const backgroundServicesModule: ICliModule = {
    apiVersion: 2,
    name: 'background-services-demo',
    description: 'Demonstrates background service patterns',

    async onAfterBoot(context: ICliExecutionContext) {
        // Register services
        context.backgroundServices.register(pollingDaemon);
        context.backgroundServices.register(workerDaemon);

        // Listen to events from any service
        const unsubscribe = context.backgroundServices.on(
            (event) => {
                context.logger.debug(
                    `[${event.source}] ${event.type}: ${JSON.stringify(event.data)}`,
                );
            },
            // Optional filter: only listen to 'poller' events
            // { source: 'poller' },
        );

        // Auto-start daemons
        await context.backgroundServices.start('poller');
        await context.backgroundServices.start('ticker');

        // Run a one-shot job
        await context.backgroundServices.startJob(
            'init-data',
            async (ctx) => {
                ctx.log('Initializing data...');
                // Simulate async work
                await new Promise((r) => setTimeout(r, 1000));
                ctx.log('Data initialized!');
                ctx.emit({ source: 'init-data', type: 'done' });
            },
        );

        // Check service status
        const pollerInfo = context.backgroundServices.getStatus('poller');
        if (pollerInfo) {
            context.logger.debug(`Poller status: ${pollerInfo.status}`);
        }

        // List all services
        const allServices = context.backgroundServices.list();
        context.logger.debug(`Registered services: ${allServices.map(s => s.name).join(', ')}`);

        // Read logs for a specific service
        const logs = context.backgroundServices.getLogs('poller', 10);
        context.logger.debug(`Poller has ${logs.length} log entries`);
    },
};

// ── Bootstrap ──────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);
engine.registerModules([backgroundServicesModule]);
engine.start().then(() => engine.focus());
window.addEventListener('beforeunload', () => engine.destroy());
