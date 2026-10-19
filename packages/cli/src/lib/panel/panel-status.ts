import { CliNotification } from '@qodalis/cli-core';
import { CliEngine } from '../engine';
import {
    CliPanelGlobalStatus,
    CliPanelServerDetail,
    CliPanelServiceDetail,
    CliPanelTabStatus,
    DEFAULT_GLOBAL_STATUS,
} from './panel-types';

/** Poll interval for execution state, last command and notifications. */
export const EXEC_POLL_MS = 300;
/** Poll interval for services, servers and uptime. */
export const GLOBAL_POLL_MS = 2000;

/** Status of a tab from all of its pane engines. */
export function computeTabStatus(engines: Iterable<CliEngine>): CliPanelTabStatus {
    let running = false;
    let lastResult: { command: string; success: boolean } | undefined;
    let notification: CliNotification | null = null;

    for (const engine of engines) {
        const context = engine.getContext() as any;
        if (!context) continue;
        // A command is executing, or a context processor (raw/full-screen mode, e.g. a game) is active.
        if (context.isExecuting || context.contextProcessor) {
            running = true;
        }
        if (context.lastCommandResult) {
            lastResult = context.lastCommandResult;
        }
        const current = context.notifier?.current;
        if (current) {
            notification = current;
        }
    }

    return {
        executionState: running ? 'running' : 'idle',
        lastCommand: lastResult ? { name: lastResult.command, success: lastResult.success } : null,
        notification,
    };
}

/** Services, servers and uptime of one engine. */
export function computeGlobalStatus(engine: CliEngine | undefined, now: number = Date.now()): CliPanelGlobalStatus {
    if (!engine) return DEFAULT_GLOBAL_STATUS;
    const context = engine.getContext() as any;
    if (!context) return DEFAULT_GLOBAL_STATUS;

    let serviceCount = { running: 0, total: 0 };
    let serviceDetails: CliPanelServiceDetail[] = [];
    try {
        const services: any[] = context.backgroundServices?.list() ?? [];
        serviceCount = {
            running: services.filter((s) => s.status === 'running').length,
            total: services.length,
        };
        serviceDetails = services.map((s) => ({ name: s.name, status: s.status, description: s.description }));
    } catch {
        /* not available */
    }

    let serverState: CliPanelGlobalStatus['serverState'] = 'none';
    const serverDetails: CliPanelServerDetail[] = [];
    try {
        let serverManager: any;
        try {
            serverManager = context.services?.get?.('cli-server-manager');
        } catch {
            /* token not registered yet */
        }
        if (serverManager?.connections?.size > 0) {
            let anyConnected = false;
            for (const [name, conn] of serverManager.connections as Map<string, any>) {
                if (conn.connected) anyConnected = true;
                serverDetails.push({
                    name,
                    url: conn.config?.url ?? '',
                    connected: !!conn.connected,
                    apiVersion: conn.connected ? conn.apiVersion : undefined,
                    commandCount: conn.connected ? conn.commands?.length : undefined,
                });
            }
            serverState = anyConnected ? 'connected' : 'disconnected';
        } else {
            // Servers configured in the engine options but not connected yet.
            const configured = (engine as any).options?.servers;
            if (Array.isArray(configured) && configured.length > 0) {
                for (const srv of configured) {
                    if (srv.enabled === false) continue;
                    serverDetails.push({ name: srv.name, url: srv.url ?? '', connected: false });
                }
                serverState = 'disconnected';
            }
        }
    } catch {
        /* not available */
    }

    const uptime = engine.startedAt ? now - engine.startedAt : 0;
    return { serviceCount, serviceDetails, serverState, serverDetails, uptime };
}

interface TabEntry {
    engines: Map<number, CliEngine>;
    status: CliPanelTabStatus;
    unsubscribes: Array<() => void>;
}

export interface CliPanelStatusTrackerListener {
    onTabStatus(tabId: number, status: CliPanelTabStatus): void;
    onGlobalStatus(status: CliPanelGlobalStatus): void;
}

/**
 * Watches the engines of every tab and reports status changes. Execution
 * state is polled quickly, services and servers slowly; engine events
 * (notifier, background services) trigger an immediate refresh.
 */
export class CliPanelStatusTracker {
    private tabs = new Map<number, TabEntry>();
    private activeTabId?: number;
    private globalStatus: CliPanelGlobalStatus = DEFAULT_GLOBAL_STATUS;
    private execTimer?: ReturnType<typeof setInterval>;
    private globalTimer?: ReturnType<typeof setInterval>;

    constructor(private readonly listener: CliPanelStatusTrackerListener) {}

    registerEngine(tabId: number, paneId: number, engine: CliEngine): void {
        let entry = this.tabs.get(tabId);
        if (entry?.engines.get(paneId) === engine) return;
        if (!entry) {
            entry = { engines: new Map(), status: computeTabStatus([]), unsubscribes: [] };
            this.tabs.set(tabId, entry);
        }
        entry.engines.set(paneId, engine);

        const context = engine.getContext() as any;
        const change$ = context?.notifier?.change$;
        if (change$?.subscribe) {
            const sub = change$.subscribe(() => this.refreshTab(tabId));
            entry.unsubscribes.push(() => sub.unsubscribe?.());
        }
        try {
            const off = context?.backgroundServices?.on?.(() => this.refreshGlobal());
            if (typeof off === 'function') entry.unsubscribes.push(off);
        } catch {
            /* not available */
        }

        this.ensurePolling();
        this.refreshTab(tabId);
        this.refreshGlobal();
    }

    unregisterPane(paneId: number): void {
        for (const [tabId, entry] of this.tabs) {
            if (entry.engines.delete(paneId)) {
                this.refreshTab(tabId);
                this.refreshGlobal();
                return;
            }
        }
    }

    unregisterTab(tabId: number): void {
        const entry = this.tabs.get(tabId);
        if (!entry) return;
        entry.unsubscribes.forEach((off) => off());
        this.tabs.delete(tabId);
        if (this.tabs.size === 0) this.stopPolling();
        this.refreshGlobal();
    }

    setActiveTab(tabId: number): void {
        if (this.activeTabId === tabId) return;
        this.activeTabId = tabId;
        this.refreshGlobal();
    }

    /** Recompute everything now. */
    refresh(): void {
        for (const tabId of this.tabs.keys()) this.refreshTab(tabId);
        this.refreshGlobal();
    }

    destroy(): void {
        this.stopPolling();
        for (const entry of this.tabs.values()) entry.unsubscribes.forEach((off) => off());
        this.tabs.clear();
    }

    private ensurePolling(): void {
        if (this.execTimer) return;
        this.execTimer = setInterval(() => {
            for (const tabId of this.tabs.keys()) this.refreshTab(tabId);
        }, EXEC_POLL_MS);
        this.globalTimer = setInterval(() => this.refreshGlobal(), GLOBAL_POLL_MS);
    }

    private stopPolling(): void {
        if (this.execTimer) clearInterval(this.execTimer);
        if (this.globalTimer) clearInterval(this.globalTimer);
        this.execTimer = undefined;
        this.globalTimer = undefined;
    }

    private refreshTab(tabId: number): void {
        const entry = this.tabs.get(tabId);
        if (!entry) return;
        const next = computeTabStatus(entry.engines.values());
        if (sameJson(next, entry.status)) return;
        entry.status = next;
        this.listener.onTabStatus(tabId, next);
    }

    private refreshGlobal(): void {
        const entry = this.activeTabId != null ? this.tabs.get(this.activeTabId) : undefined;
        const engine = entry?.engines.values().next().value as CliEngine | undefined;
        const next = computeGlobalStatus(engine);
        if (sameJson(next, this.globalStatus)) return;
        this.globalStatus = next;
        this.listener.onGlobalStatus(next);
    }
}

function sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}
