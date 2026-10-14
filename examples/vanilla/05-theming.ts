/**
 * Example 05 — Theming (Vanilla JS)
 *
 * Shows how to set a theme via options, list built-in themes,
 * and apply custom themes at runtime.
 *
 * Built-in themes (29):
 *   Dark:  default, classic, dracula, monokai, solarizedDark, nord, oneDark,
 *          material, tokyoNight, catppuccinMocha, catppuccinFrappe, rosePine,
 *          kanagawa, everforestDark, ayuDark, cyberpunk, retroGreen,
 *          retroAmber, matrix, synthwave, highContrastDark
 *   Light: solarizedLight, gruvboxLight, catppuccinLatte, rosePineDawn,
 *          everforestLight, githubLight, highContrastLight
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/theming
 */

import '@xterm/xterm/css/xterm.css';
import { CliEngine } from '@qodalis/cli';
import type { CliOptions } from '@qodalis/cli-core';

// ── Set theme via options ──────────────────────────────────────

const options: CliOptions = {
    terminalOptions: {
        fontSize: 14,
        fontFamily: '"Fira Code", monospace',

        // Set a theme by name — this applies at startup.
        // Use any built-in theme name or provide a custom ITheme object.
        // To set by name, use the `theme` xterm option:
        theme: {
            background: '#1a1b26',  // tokyoNight-inspired background
            foreground: '#c0caf5',
            cursor: '#f7768e',
            selectionBackground: '#33467c',

            // Standard ANSI colors
            black: '#15161e',
            red: '#f7768e',
            green: '#9ece6a',
            yellow: '#e0af68',
            blue: '#7aa2f7',
            magenta: '#bb9af7',
            cyan: '#7dcfff',
            white: '#a9b1d6',

            // Bright variants
            brightBlack: '#414868',
            brightRed: '#f7768e',
            brightGreen: '#9ece6a',
            brightYellow: '#e0af68',
            brightBlue: '#7aa2f7',
            brightMagenta: '#bb9af7',
            brightCyan: '#7dcfff',
            brightWhite: '#c0caf5',
        },
    },
};

// ── Bootstrap ──────────────────────────────────────────────────

const container = document.getElementById('terminal')!;
const engine = new CliEngine(container, options);

engine.start().then(() => {
    engine.focus();

    // Theme can also be changed at runtime via built-in commands:
    //   theme list          — show all available themes
    //   theme set dracula   — switch to dracula theme
    //   theme get           — show current theme name
});

window.addEventListener('beforeunload', () => engine.destroy());
