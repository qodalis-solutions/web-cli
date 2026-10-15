/**
 * Example 10 — Server Integration (Vanilla JS)
 *
 * Shows how to connect the CLI to one or more backend servers.
 * When connected, the CLI discovers server-side commands and registers
 * them as proxy processors. Users can execute server commands transparently.
 *
 * Features:
 *   - Multi-server support (each server gets a namespace)
 *   - Auto-discovery of server-side commands
 *   - Static and dynamic (JWT) auth headers
 *   - Request timeout configuration
 *   - WebSocket shell sessions
 *   - SSE streaming for long-running commands
 *
 * Compatible servers:
 *   - @qodalis/cli-server-node (Express)
 *   - @qodalis/cli-server-python (FastAPI)
 *   - Qodalis.Cli (.NET)
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/server-integration
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions, CliServerConfig, ICliModule, ICliServerAuthTokenProvider } from '@qodalis/cli-core';
import { CliLogLevel, ICliServerAuthTokenProvider_TOKEN } from '@qodalis/cli-core';

// ── Server configuration ───────────────────────────────────────

const servers: CliServerConfig[] = [
    // Basic server — just name and URL
    {
        name: 'node',
        url: 'http://localhost:8047',
    },

    // Server with static auth headers
    {
        name: 'dotnet',
        url: 'http://localhost:8046',
        headers: {
            'X-Api-Key': 'my-secret-key',
        },
        timeout: 10000, // 10s request timeout (default: 30s)
    },

    // Server with dynamic headers (e.g., JWT that refreshes)
    {
        name: 'python',
        url: 'http://localhost:8048',
        headers: () => ({
            'Authorization': `Bearer ${getAuthToken()}`,
        }),
    },

    // Disabled server (won't connect)
    {
        name: 'staging',
        url: 'http://staging.example.com:8047',
        enabled: false,
    },
];

// Helper to get auth token (replace with your auth logic)
function getAuthToken(): string {
    return localStorage.getItem('auth_token') || 'no-token';
}

// ── Auth Token Provider (advanced) ─────────────────────────────
// For more complex auth flows (OAuth2, per-server tokens, etc.),
// register an ICliServerAuthTokenProvider via a module.
// The auth service merges headers from all registered providers
// with the static/dynamic headers from CliServerConfig.

class OAuthTokenProvider implements ICliServerAuthTokenProvider {
    getHeaders(serverName: string): Record<string, string> {
        // Return different tokens per server
        if (serverName === 'python') {
            const token = sessionStorage.getItem('oauth_access_token') || '';
            return { Authorization: `Bearer ${token}` };
        }
        return {}; // No extra headers for other servers
    }
}

const authModule: ICliModule = {
    apiVersion: 2,
    name: 'my-auth',
    description: 'OAuth2 auth provider for server requests',
    processors: [],
    services: [
        {
            provide: ICliServerAuthTokenProvider_TOKEN,
            useValue: new OAuthTokenProvider(),
            multi: true, // Multiple providers are merged
        },
    ],
};

// ── Options ────────────────────────────────────────────────────

const options: CliOptions = {
    logLevel: CliLogLevel.INFO,
    servers,
    terminalOptions: {
        fontSize: 14,
    },
};

// ── Bootstrap ──────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, options);

// Register the auth module so its token provider is available
engine.registerModules([authModule]);

engine.start().then(() => {
    engine.focus();

    // Once started, you can use these built-in commands:
    //
    //   server status          — show connection status for all servers
    //   server <name> shell    — open interactive shell session (WebSocket PTY)
    //   server <name> <cmd>    — execute a server-side command
    //
    // Server commands are auto-discovered and appear in `help`.
    // For example, if the Node server has an "echo" command:
    //   node echo hello        — runs the echo command on the Node server
    //
    // Filesystem commands (if enabled on the server):
    //   node ls /tmp           — list directory on the server
    //   node cat /etc/hostname — read a file on the server
});

window.addEventListener('beforeunload', () => engine.destroy());
