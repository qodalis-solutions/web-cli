/**
 * Example 12 — Tabs & Panes (Vanilla JS)
 *
 * Demonstrates programmatic control of the CLI panel's tabs and panes
 * via ICliPanelRef. This example shows the Vanilla JS pattern using
 * CliEngine directly — for framework-specific panel usage, see the
 * Angular/React/Vue panel configuration examples.
 *
 * Note: Tabs and panes are features of the <cli-panel> component.
 * The standalone <cli> / CliEngine component is a single terminal.
 * To use tabs/panes programmatically, use the framework panel component
 * and obtain a ref (ViewChild in Angular, useRef in React, template ref in Vue).
 *
 * This example shows the ICliPanelRef API available from the panel ref.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/core-concepts/tabs-and-panes
 */

import type { ICliPanelRef, CliPanelState, CliPanelPosition } from '@qodalis/cli-core';
import type { CliEngine } from '@qodalis/cli';

// ── ICliPanelRef API Reference ────────────────────────────────
//
// All methods below are available on the panel ref obtained from
// your framework's component (ViewChild, useRef, template ref).

function demonstratePanelApi(panel: ICliPanelRef<CliEngine>) {
    // ── Panel chrome ──

    panel.open();             // Expand the panel (initializes first tab)
    panel.collapse();         // Collapse panel body
    panel.toggleCollapse();   // Toggle between open/collapsed
    panel.hide();             // Minimize to a small viewport-edge tab
    panel.unhide();           // Restore from hidden state
    panel.maximize();         // Fill the entire viewport
    panel.restore();          // Return to normal size from maximized
    panel.toggleMaximize();   // Toggle maximize/restore

    // Resize — set explicit dimensions
    panel.resize({ height: 400, width: 600 });

    // Change position — 'bottom' | 'top' | 'left' | 'right'
    panel.setPosition('right');

    // ── Tab management ──

    // Create a new tab (returns the tab ID)
    const tabId = panel.addTab('My Custom Tab');

    // Rename an existing tab
    panel.renameTab(tabId, 'Renamed Tab');

    // Switch to a tab
    panel.selectTab(tabId);

    // Close a tab
    panel.closeTab(tabId);

    // ── Pane splitting ──

    // Split the active pane horizontally (returns the new pane ID)
    const paneId = panel.splitPane();

    // Split a pane within a specific tab
    const paneId2 = panel.splitPane(1); // tab ID 1

    // Close a pane
    panel.closePane(paneId);
    panel.closePane(paneId2);

    // ── Engine access ──

    // Get the engine for the active pane
    const activeEngine = panel.getEngine();
    if (activeEngine) {
        activeEngine.execute('help');
    }

    // Get the engine for a specific pane
    const specificEngine = panel.getEngine(paneId);

    // ── State inspection ──

    const state: CliPanelState = panel.getState();
    console.log('Panel state:', {
        collapsed: state.collapsed,
        hidden: state.hidden,
        maximized: state.maximized,
        position: state.position,  // 'bottom' | 'top' | 'left' | 'right'
        height: state.height,
        width: state.width,
        activeTabId: state.activeTabId,
        activePaneId: state.activePaneId,
        tabs: state.tabs.map((tab) => ({
            id: tab.id,
            title: tab.title,
            panes: tab.panes.map((pane) => ({
                id: pane.id,
                widthPercent: pane.widthPercent,
            })),
        })),
    });
}

// ── Practical example: Multi-tab workspace ────────────────────

function setupWorkspace(panel: ICliPanelRef<CliEngine>) {
    panel.open();

    // Rename the default tab
    panel.renameTab(1, 'Main');

    // Add a logs tab
    const logsTab = panel.addTab('Logs');

    // Add a shell tab with split panes
    const shellTab = panel.addTab('Shell');
    panel.selectTab(shellTab);
    const rightPane = panel.splitPane(shellTab);

    // Execute commands in different panes
    const leftEngine = panel.getEngine();
    leftEngine?.execute('help');

    const rightEngine = panel.getEngine(rightPane);
    rightEngine?.execute('version');

    // Switch back to main tab
    panel.selectTab(1);
}

// ── Position cycling helper ───────────────────────────────────

function cyclePosition(panel: ICliPanelRef<CliEngine>) {
    const positions: CliPanelPosition[] = ['bottom', 'top', 'left', 'right'];
    const current = panel.getState().position;
    const next = positions[(positions.indexOf(current) + 1) % positions.length];
    panel.setPosition(next);
}
