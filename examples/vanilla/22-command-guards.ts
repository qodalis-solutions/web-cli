/**
 * Example 22 — Global Command Guards (Vanilla JS)
 *
 * Guards are checks that run before EVERY command, across all modules,
 * and can block it. They are contributed by modules via `guards` and
 * receive the execution context, so they can resolve services to decide
 * what to guard and whether the command may run.
 *
 * This example:
 *   1. Defines a `maintenance` service plus a guard that reads it to lock
 *      selected commands (try `maintenance on deploy`, then `deploy`).
 *   2. Defines a confirmation guard for processors flagged `dangerous`.
 *   3. Declares `requireAuth` / `requiredGroups` on a processor. Without a
 *      users module these flags are informational and the command runs.
 *      Uncomment the users module to have them enforced.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/command-guards
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type {
    ICliCommandGuard,
    ICliCommandProcessor,
    ICliExecutionContext,
    ICliModule,
} from '@qodalis/cli-core';
// import { usersModule } from '@qodalis/cli-users';

// ── 1. A service that guards consult ──────────────────────────

const Maintenance_TOKEN = 'example-maintenance';

class MaintenanceService {
    private readonly locked = new Set<string>();
    lock(command: string) { this.locked.add(command); }
    unlock(command: string) { this.locked.delete(command); }
    isLocked(command: string) { return this.locked.has(command); }
    list() { return [...this.locked]; }
}

/** Uses the context to resolve the service and decide what is guarded. */
const maintenanceGuard: ICliCommandGuard = {
    name: 'example:maintenance',
    priority: -50,
    appliesTo: (processor, _command, context) =>
        context.services.get<MaintenanceService>(Maintenance_TOKEN)?.isLocked(processor.command) ?? false,
    canActivate: (_command, processor) =>
        `${processor.command}: temporarily disabled for maintenance`,
};

// ── 2. A guard that prompts the user ──────────────────────────

const confirmDangerousGuard: ICliCommandGuard = {
    name: 'example:confirm-dangerous',
    appliesTo: (processor) => processor.metadata?.['dangerous'] === true,
    canActivate: async (_command, processor, context) => {
        const ok = await context.reader.readConfirm(`Really run '${processor.command}'?`, false);
        return ok ? true : { allowed: false, message: `${processor.command}: cancelled` };
    },
};

// ── Processors ────────────────────────────────────────────────

const maintenanceProcessor: ICliCommandProcessor = {
    command: 'maintenance',
    description: 'Lock or unlock a command: maintenance on|off <command>',
    acceptsRawInput: true,
    async processCommand(command, context: ICliExecutionContext) {
        const service = context.services.getRequired<MaintenanceService>(Maintenance_TOKEN);
        const [mode, target] = (command.value ?? '').trim().split(/\s+/);
        if (mode === 'on' && target) service.lock(target);
        else if (mode === 'off' && target) service.unlock(target);
        context.writer.writeln(`Locked: ${service.list().join(', ') || '(none)'}`);
    },
};

const deployProcessor: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Pretend to deploy',
    metadata: { requireAuth: true, requiredGroups: ['admin'] },
    async processCommand(_command, context) {
        context.writer.writeSuccess('Deployed!');
    },
};

const wipeProcessor: ICliCommandProcessor = {
    command: 'wipe',
    description: 'Pretend to wipe all data (asks for confirmation)',
    metadata: { dangerous: true },
    async processCommand(_command, context) {
        context.writer.writeSuccess('Wiped.');
    },
};

// ── Module & Bootstrap ────────────────────────────────────────

const guardsModule: ICliModule = {
    apiVersion: 2,
    name: 'guards-demo',
    description: 'Global command guards demo',
    processors: [maintenanceProcessor, deployProcessor, wipeProcessor],
    services: [{ provide: Maintenance_TOKEN, useValue: new MaintenanceService() }],
    guards: [maintenanceGuard, confirmDangerousGuard],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container);

// Add `usersModule` to enforce deploy's requireAuth / requiredGroups metadata.
engine.registerModules([guardsModule /*, usersModule */]);
engine.start().then(() => engine.focus());

window.addEventListener('beforeunload', () => engine.destroy());
