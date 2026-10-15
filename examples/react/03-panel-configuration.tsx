/**
 * 03 - Panel Configuration
 *
 * Demonstrates the <CliPanel> component with full configuration,
 * controlled state, programmatic ref methods, and event callbacks.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/
 */

import React, { useRef, useState, useCallback } from 'react';
import {
    CliPanel,
    CliPanelOptions,
} from '@qodalis/react-cli';
import { ICliPanelRef, CliPanelPosition, CliLogLevel } from '@qodalis/cli-core';
import { CliEngine } from '@qodalis/cli';

// Required CSS for panel chrome (header, tabs, resize handles, hide tab)
import '@qodalis/cli/assets/cli-panel.css';

// ---------------------------------------------------------------------------
// 1. Full panel options
// ---------------------------------------------------------------------------

const panelOptions: CliPanelOptions = {
    // Panel chrome
    position: 'bottom',
    isCollapsed: true,
    isHidden: false,
    closable: true,
    resizable: true,
    hideable: true,
    hideAlignment: 'center',
    syncTheme: true,

    // Terminal / engine options (inherited from CliEngineOptions)
    logLevel: CliLogLevel.INFO,
    terminalOptions: {
        fontSize: 13,
        cursorBlink: true,
    },
};

// ---------------------------------------------------------------------------
// 2. Controlled panel with ref
// ---------------------------------------------------------------------------

export function PanelDemo() {
    const panelRef = useRef<ICliPanelRef<CliEngine>>(null);

    // Controlled state
    const [collapsed, setCollapsed] = useState(true);
    const [hidden, setHidden] = useState(false);
    const [position, setPosition] = useState<CliPanelPosition>('bottom');

    // ── Event callbacks ──

    const handleTabAdded = useCallback((event: { tabId: number }) => {
        console.log('Tab added:', event.tabId);
    }, []);

    const handleTabClosed = useCallback((event: { tabId: number }) => {
        console.log('Tab closed:', event.tabId);
    }, []);

    const handlePaneSplit = useCallback(
        (event: { paneId: number; tabId: number }) => {
            console.log('Pane split:', event);
        },
        [],
    );

    const handleClose = useCallback(() => {
        console.log('Panel closed');
    }, []);

    // ── Programmatic controls ──

    const addNewTab = () => {
        const tabId = panelRef.current?.addTab('Custom Tab');
        console.log('Created tab:', tabId);
    };

    const splitCurrentPane = () => {
        const paneId = panelRef.current?.splitPane();
        console.log('Created pane:', paneId);
    };

    const toggleMaximize = () => {
        const state = panelRef.current?.getState();
        if (state?.maximized) {
            panelRef.current?.restore();
        } else {
            panelRef.current?.maximize();
        }
    };

    const cyclePosition = () => {
        const positions: CliPanelPosition[] = ['bottom', 'left', 'top', 'right'];
        const idx = positions.indexOf(position);
        const next = positions[(idx + 1) % positions.length];
        panelRef.current?.setPosition(next);
        setPosition(next);
    };

    const resizePanel = () => {
        panelRef.current?.resize({ height: 400, width: 500 });
    };

    return (
        <div style={{ height: '100vh', position: 'relative' }}>
            {/* Toolbar for programmatic controls */}
            <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={() => setCollapsed((c) => !c)}>
                    {collapsed ? 'Expand' : 'Collapse'}
                </button>
                <button onClick={() => setHidden((h) => !h)}>
                    {hidden ? 'Unhide' : 'Hide'}
                </button>
                <button onClick={addNewTab}>Add Tab</button>
                <button onClick={splitCurrentPane}>Split Pane</button>
                <button onClick={toggleMaximize}>Toggle Maximize</button>
                <button onClick={cyclePosition}>
                    Position: {position}
                </button>
                <button onClick={resizePanel}>Resize to 400x500</button>
            </div>

            {/* The panel */}
            <CliPanel
                ref={panelRef}
                options={panelOptions}
                collapsed={collapsed}
                onCollapsedChange={setCollapsed}
                hidden={hidden}
                onHiddenChange={setHidden}
                position={position}
                onPositionChange={setPosition}
                onTabAdded={handleTabAdded}
                onTabClosed={handleTabClosed}
                onPaneSplit={handlePaneSplit}
                onClose={handleClose}
            />
        </div>
    );
}
