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

// ── 1. Server mode: the CLI is the front end of a system ─────
//
// `server` must match the `name` of an entry in `options.servers`. The server
// users plugin is the authority (permissions, sessions, audit); the CLI:
//   - signs in with POST /api/v1/qcli/sessions and keeps the bearer token
//     (set `persistToken: false` to keep it in memory only)
//   - restores the session on reload via GET /api/v1/qcli/sessions/current
//   - sends the token with every request to that server (exec, files, ...)
//   - signs out automatically on 401 or when an admin kicks the session
const serverUsersModule = usersModule.configure({
    server: 'node',
    requirePassword: true,
});

// ── 2. Embedded in an app whose users are already signed in ──
//
// With `hostAuth`, the CLI reuses the host application's token: no second
// login. `login` / `logout` defer to the host.
export const embeddedUsersModule = usersModule.configure({
    server: 'node',
    hostAuth: {
        getToken: () => sessionStorage.getItem('app-access-token') ?? undefined,
        loginHint: 'Sign in to the application first',
        logout: () => {
            window.location.href = '/logout';
        },
    },
});

// ── 3. React to user events from another plugin ───────────────
//
// The event bus works the same in both modes.
const greeterModule: ICliModule = {
    apiVersion: 2,
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
    //   adduser bob --email=bob@x.io   — POST /api/v1/qcli/users (users:create)
    //   groupadd ops --permissions=sessions:*  — a role, enforced by the server
    //   sessions              — list active sessions (sessions:read)
    //   session-kick <id>     — force-logout a session; that client logs out itself
    //   last                  — server-side login/logout history
    //   logout                — DELETE /api/v1/qcli/sessions/current and clears the token
});
