/**
 * Demo helper: pick how users/auth are wired, from the URL.
 *
 *   ?users=none                 no users module (guards inactive, metadata informational)
 *   ?users=local                users module in local mode (IndexedDB)
 *   ?users=server&server=node   users module in server mode against a CLI server
 *                               (node | dotnet | python, see `options.servers`)
 *
 * Without a `users` parameter each demo keeps its original setup (see
 * `setDemoUsersDefault`): Angular uses server mode against node, React and
 * Vue use local mode with a seeded `root1` admin.
 *
 * The same file is used by the Angular, React and Vue demos.
 */
import type { ICliCommandGuard, ICliCommandProcessor, ICliModule } from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';

export type DemoUsersMode = 'none' | 'local' | 'server';

export interface DemoUsersSelection {
    mode: DemoUsersMode;
    server: string;
}

export const DEMO_SERVERS = [
    { name: 'dotnet', url: 'http://localhost:8046', login: 'root / root' },
    { name: 'node', url: 'http://localhost:8047', login: 'root / admin' },
    { name: 'python', url: 'http://localhost:8048', login: 'root / admin' },
];

let defaultSelection: DemoUsersSelection = { mode: 'local', server: 'node' };

/** The setup used when the URL has no `users` parameter (the demo's original wiring). */
export function setDemoUsersDefault(selection: DemoUsersSelection): void {
    defaultSelection = selection;
}

export function getDemoUsersSelection(): DemoUsersSelection {
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const raw = params.get('users');
    const mode: DemoUsersMode =
        raw === 'none' || raw === 'server' || raw === 'local' ? raw : defaultSelection.mode;
    const server = params.get('server') ?? defaultSelection.server;
    return { mode, server: DEMO_SERVERS.some((s) => s.name === server) ? server : 'node' };
}

/** The users module for the selected mode, or nothing when mode is `none`. */
export function demoUsersModules(selection = getDemoUsersSelection()): ICliModule[] {
    switch (selection.mode) {
        case 'none':
            return [];
        case 'server':
            return [usersModule.configure({ server: selection.server, requirePassword: true })];
        default:
            return [
                usersModule.configure({
                    // Demo accounts (password "root"): sign in with `login root1`
                    seedUsers: [
                        { name: 'root1', email: 'root1@root.com', groups: ['admin'] },
                        { name: 'alice', email: 'alice@example.com', groups: ['users'] },
                    ],
                    defaultPassword: 'root',
                }),
            ];
    }
}

// ── Access-control demo: works with or without the users module ─────────

const maintenance = new Set<string>();

/** A guard contributed by a plain module: resolves its state, not tied to users. */
const maintenanceGuard: ICliCommandGuard = {
    name: 'demo:maintenance',
    priority: -50,
    appliesTo: (processor) => maintenance.has(processor.command),
    canActivate: (_command, processor) => `${processor.command}: disabled for maintenance`,
};

const maintenanceProcessor: ICliCommandProcessor = {
    command: 'maintenance',
    description: 'Lock/unlock a command for everyone: maintenance on|off <command>',
    acceptsRawInput: true,
    async processCommand(command, context) {
        const [mode, target] = (command.value ?? '').trim().split(/\s+/);
        if (mode === 'on' && target) maintenance.add(target);
        if (mode === 'off' && target) maintenance.delete(target);
        context.writer.writeln(`Locked: ${[...maintenance].join(', ') || '(none)'}`);
    },
};

const deployProcessor: ICliCommandProcessor = {
    command: 'deploy',
    description: 'Demo: requires the deploy:run permission (enforced only when the users module is loaded)',
    metadata: { requiredPermissions: ['deploy:run'] },
    async processCommand(command, context) {
        context.writer.writeSuccess(`Deployed ${command.value || 'app'} as ${context.userSession?.user.name ?? 'anonymous'}`);
    },
};

const whoCanProcessor: ICliCommandProcessor = {
    command: 'demo-access',
    description: 'Show the current users/auth demo mode',
    async processCommand(_command, context) {
        const sel = getDemoUsersSelection();
        context.writer.writeln(`Users mode: ${sel.mode}${sel.mode === 'server' ? ` (${sel.server})` : ''}`);
        context.writer.writeln(`Signed in:  ${context.userSession?.user.name ?? '(nobody)'}`);
        context.writer.writeln('Try: deploy, maintenance on deploy, deploy, maintenance off deploy');
        context.writer.writeln('Roles: groupadd release --permissions=deploy:run ; groupmod release --add-member=alice');
    },
};

export const accessDemoModule: ICliModule = {
    apiVersion: 2,
    name: 'access-demo',
    description: 'Guards and access metadata demo',
    processors: [maintenanceProcessor, deployProcessor, whoCanProcessor],
    guards: [maintenanceGuard],
    permissions: [{ name: 'deploy:run', description: 'Run demo deployments' }],
};

/** Adds a small fixed bar to switch between users modes (reloads the page). */
export function mountUsersModeSwitcher(): void {
    if (typeof document === 'undefined' || document.getElementById('demo-users-mode')) return;
    const sel = getDemoUsersSelection();
    const bar = document.createElement('div');
    bar.id = 'demo-users-mode';
    bar.style.cssText =
        'position:fixed;top:6px;right:12px;z-index:10000;font:12px system-ui,sans-serif;' +
        'background:rgba(20,20,20,.85);color:#ddd;padding:4px 8px;border-radius:6px;display:flex;gap:6px;align-items:center';
    const link = (label: string, query: string, active: boolean, title?: string) => {
        const a = document.createElement('a');
        a.textContent = label;
        a.href = `?${query}`;
        if (title) a.title = title;
        a.style.cssText = `color:${active ? '#7fd1ff' : '#ddd'};text-decoration:${active ? 'underline' : 'none'}`;
        return a;
    };
    bar.append('users:');
    bar.append(link('none', 'users=none', sel.mode === 'none', 'No users module'));
    bar.append(link('local', 'users=local', sel.mode === 'local', 'Local mode: login root1 or alice (password root)'));
    for (const s of DEMO_SERVERS) {
        bar.append(
            link(s.name, `users=server&server=${s.name}`, sel.mode === 'server' && sel.server === s.name,
                `Server mode via ${s.url} (${s.login})`),
        );
    }
    document.body.appendChild(bar);
}
