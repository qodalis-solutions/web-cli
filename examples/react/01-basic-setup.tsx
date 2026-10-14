/**
 * 01 - Basic Setup
 *
 * Minimal examples showing how to render a CLI terminal in React.
 * Demonstrates both the provider pattern (shared config) and
 * standalone usage.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/
 */

import React from 'react';
import {
    Cli,
    CliConfigProvider,
    CliEngineOptions,
    CliEngine,
} from '@qodalis/react-cli';
import { CliLogLevel } from '@qodalis/cli-core';

// ---------------------------------------------------------------------------
// 1. Provider pattern - wrap the app (or a subtree) with CliConfigProvider
//    so every <Cli /> inherits the same modules, options, and services.
// ---------------------------------------------------------------------------

const globalOptions: CliEngineOptions = {
    logLevel: CliLogLevel.INFO,
    terminalOptions: {
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        cursorBlink: true,
        cursorStyle: 'bar',
        theme: {
            background: '#1e1e2e',
            foreground: '#cdd6f4',
            cursor: '#f5e0dc',
        },
    },
};

export function AppWithProvider() {
    const handleReady = (engine: CliEngine) => {
        console.log('CLI engine ready:', engine);
    };

    return (
        <CliConfigProvider options={globalOptions}>
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ margin: '0.5rem 1rem', color: '#cdd6f4' }}>
                    My App
                </h1>

                {/* The terminal fills the remaining space */}
                <Cli
                    onReady={handleReady}
                    style={{ flex: 1 }}
                />
            </div>
        </CliConfigProvider>
    );
}

// ---------------------------------------------------------------------------
// 2. Standalone usage - pass everything directly to <Cli />.
//    No provider needed.
// ---------------------------------------------------------------------------

export function StandaloneCli() {
    return (
        <div style={{ width: 800, height: 500 }}>
            <Cli
                modules={[]}
                options={{
                    logLevel: CliLogLevel.WARN,
                    terminalOptions: {
                        fontSize: 13,
                        cursorBlink: true,
                    },
                }}
                onReady={(engine) => {
                    // Execute a command programmatically once the engine starts
                    engine.execute('help');
                }}
            />
        </div>
    );
}
