/**
 * 04 - Engine API
 *
 * Shows multiple ways to access and interact with the CliEngine:
 * - useCliEngine hook (low-level, with a container ref)
 * - onReady callback on <Cli />
 * - useCli() hook for accessing the engine from a CliProvider context
 * - Programmatic command execution
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/
 */

import React, { useRef, useEffect, useState } from 'react';
import {
    Cli,
    CliConfigProvider,
    CliProvider,
    useCli,
    useCliEngine,
    CliEngine,
} from '@qodalis/react-cli';

// ---------------------------------------------------------------------------
// 1. useCliEngine - low-level hook
//    You supply the container element; the hook creates and manages the engine.
// ---------------------------------------------------------------------------

export function LowLevelEngineDemo() {
    const containerRef = useRef<HTMLDivElement>(null);
    const engine = useCliEngine(containerRef, {
        options: {
            logLevel: 'info',
            terminalOptions: {
                fontSize: 14,
                cursorBlink: true,
            },
        },
    });

    useEffect(() => {
        if (!engine) return;

        // Run a command once the engine is ready
        engine.execute('help');
    }, [engine]);

    return (
        <div>
            <p>Engine status: {engine ? 'running' : 'initializing...'}</p>
            <div ref={containerRef} style={{ height: 400 }} />
            <button
                disabled={!engine}
                onClick={() => engine?.execute('version')}
            >
                Run "version"
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 2. onReady callback - simplest way to get the engine reference
// ---------------------------------------------------------------------------

export function OnReadyDemo() {
    const [engine, setEngine] = useState<CliEngine | null>(null);

    return (
        <div>
            <div style={{ height: 400 }}>
                <Cli onReady={setEngine} />
            </div>

            <div style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                    disabled={!engine}
                    onClick={() => engine?.execute('help')}
                >
                    help
                </button>
                <button
                    disabled={!engine}
                    onClick={() => engine?.execute('clear')}
                >
                    clear
                </button>
                <button
                    disabled={!engine}
                    onClick={() => engine?.execute('version')}
                >
                    version
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 3. useCli() hook - access engine from a CliProvider context
//    Useful when sibling/child components need to interact with the terminal.
// ---------------------------------------------------------------------------

function CommandPalette() {
    const { engine } = useCli();
    const [command, setCommand] = useState('');

    const run = () => {
        if (engine && command.trim()) {
            engine.execute(command.trim());
            setCommand('');
        }
    };

    return (
        <div style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run()}
                placeholder="Type a command..."
                style={{ flex: 1, padding: '0.25rem 0.5rem' }}
            />
            <button onClick={run} disabled={!engine}>
                Execute
            </button>
        </div>
    );
}

export function ProviderContextDemo() {
    return (
        <CliConfigProvider
            options={{
                terminalOptions: { fontSize: 14 },
            }}
        >
            <CliProvider style={{ height: 400 }}>
                {/*
                 * CommandPalette is a sibling of the terminal DOM element
                 * (both live inside CliProvider). It uses useCli() to get
                 * the shared engine and execute commands programmatically.
                 */}
                <CommandPalette />
            </CliProvider>
        </CliConfigProvider>
    );
}
