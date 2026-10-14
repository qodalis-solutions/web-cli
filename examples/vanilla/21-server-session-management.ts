/**
 * Example 21 — Server-Side Session Management (Vanilla JS)
 *
 * Shows how to run the @qodalis/cli-users plugin in *server mode*.
 * When `server` is set in the module config, all user CRUD, login,
 * session tracking, groups and the audit log are delegated over HTTP
 * to a Qodalis CLI server that has the users plugin installed
 * (cli-server-node, cli-server-dotnet or cli-server-python).
 *
 * Features:
 *   - usersModule.configure({ server }) pointing at a CliServerConfig name
 *   - Bearer token persisted locally and attached to every request to
 *     that server (via ICliServerAuthTokenProvider)
 *   - Extra admin commands in server mode: `sessions`, `session-kick <id>`
 *   - `last` reads the server-side audit log
 *   - Automatic local logout when the token expires (401) or an admin
 *     kicks the session (`session-kicked` WebSocket event)
 *   - Reacting to user events (login/logout) from another plugin
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions, ICliModule, ICliUserEventService } from '@qodalis/cli-core';
import { ICliUserEventService_TOKEN } from '@qodalis/cli-core';
import { usersModule } from '@qodalis/cli-users';

// ── 1. Client-only mode (default) ─────────────────────────────
//
// Without `server`, users live in the browser (IndexedDB) and the
// module seeds a local `root` admin on first boot. Works offline.
//
//   engine.registerModule(usersModule);

// ── 2. Server-backed mode ─────────────────────────────────────
//
// `server` must match the `name` of an entry in `options.servers`.
// The module then:
//   - skips the local seed user and the setup wizard (server owns the data)
//   - stores the bearer token returned by POST /api/v1/qcli/sessions (login)
//   - restores the session on reload via GET /api/v1/qcli/sessions/current
//   - registers `sessions` and `session-kick` for admins
const serverUsersModule = usersModule.configure({
    server: 'node',
    requirePassword: true,
});

// ── 3. React to user events from another plugin ───────────────
//
// The event bus works the same in both modes.
const greeterModule: ICliModule = {
    name: 'greeter',
    processors: [],
    async onAfterBoot(context) {
        const events = context.services.get<ICliUserEventService>(
            ICliUserEventService_TOKEN,
        );
        events?.events$.subscribe((event) => {
            if (event.type === 'login') {
                context.writer.writeInfo(`Welcome back, ${event.user.name}!`);
            }
            if (event.type === 'logout' && event.details) {
                // details explains *why*: user action, token expired, kicked…
                context.writer.writeInfo(`Signed out: ${event.details}`);
            }
        });
    },
};

// ── 4. Boot ───────────────────────────────────────────────────
const options: CliOptions = {
    servers: [
        // Any Qodalis CLI server with the users plugin installed.
        // Demo server admin credentials: root / admin (node, python), root / root (.NET)
        { name: 'node', url: 'http://localhost:8047' },
    ],
};

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, options);

engine.registerModules([serverUsersModule, greeterModule]);

engine.start().then(() => {
    engine.focus();
    // Try in the terminal:
    //   login root            — prompts for password, stores the token
    //   whoami                — user info from the server session
    //   adduser bob           — POST /api/v1/qcli/users (admin)
    //   sessions              — list active sessions (admin)
    //   session-kick <id>     — force-logout a session; that client logs out itself
    //   last                  — server-side login/logout history
    //   logout                — DELETE /api/v1/qcli/sessions/current and clears the token
});
