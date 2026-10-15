/**
 * Example 17 — Runtime Plugins (Vanilla JS)
 *
 * Demonstrates dynamically loading CLI plugins at runtime using the
 * built-in `pkg` (package) command system. Plugins are fetched as UMD
 * bundles from CDN (unpkg, jsdelivr) or custom sources.
 *
 * Features:
 *   - Built-in pkg commands: add, remove, list, search, sources
 *   - Custom package sources (private registries, local files)
 *   - packageSources configuration in CliOptions
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/configuration
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions } from '@qodalis/cli-core';

// ── Package source configuration ──────────────────────────────

const options: CliOptions = {
    // Configure where the `pkg` command looks for plugins
    packageSources: {
        // Set the default source used by `pkg add <name>`
        primary: 'unpkg', // 'unpkg' | 'jsdelivr' | custom name

        // Add custom sources alongside the built-in ones
        sources: [
            // Private npm registry (same API as unpkg/jsdelivr)
            {
                name: 'company',
                url: 'https://npm.mycompany.com',
                kind: 'registry',
            },
            // Direct URL to a UMD bundle (e.g., from a CI artifact)
            {
                name: 'local-dev',
                url: 'http://localhost:3000/plugins',
                kind: 'file',
            },
        ],
    },

    terminalOptions: {
        fontSize: 14,
    },
};

// ── Bootstrap ─────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, options);

engine.start().then(() => {
    engine.focus();

    // After start, these built-in commands are available:
    //
    // ── Package management ──
    //   pkg add <name>              — Install a plugin from the primary source
    //   pkg add <name> --source jsdelivr  — Install from a specific source
    //   pkg remove <name>           — Uninstall a plugin
    //   pkg list                    — List installed packages
    //   pkg search <query>          — Search available packages
    //
    // ── Source management ──
    //   pkg sources                 — List configured sources
    //   pkg sources add <name> <url> [--kind registry|file]
    //   pkg sources remove <name>
    //   pkg sources set-primary <name>
    //
    // ── Examples ──
    //
    // Install the GUID plugin at runtime:
    //   pkg add @qodalis/cli-guid
    //
    // After installing, its commands become available immediately:
    //   guid generate
    //   guid validate <uuid>
    //
    // Install from jsdelivr instead of unpkg:
    //   pkg add @qodalis/cli-qr --source jsdelivr
    //
    // Install from your company registry:
    //   pkg add @mycompany/cli-internal --source company
    //
    // Remove a plugin:
    //   pkg remove @qodalis/cli-guid
});

window.addEventListener('beforeunload', () => engine.destroy());
