import { BehaviorSubject, Observable, Subject, interval, map, distinctUntilChanged, takeUntil, startWith } from 'rxjs';
import { CliEngine } from '@qodalis/cli';

export interface TabStatus {
    executionState: 'idle' | 'running';
    lastCommandStatus: 'success' | 'error' | null;
    lastCommandName: string | null;
}

export interface GlobalStatus {
    runningServiceCount: number;
    totalServiceCount: number;
    serverConnectionState: 'connected' | 'disconnected' | 'none';
    uptime: number;
}

interface TabEntry {
    engines: Map<number, CliEngine>; // paneId -> engine
    status$: BehaviorSubject<TabStatus>;
    destroy$: Subject<void>;
}

const POLL_INTERVAL_MS = 500;

const DEFAULT_TAB_STATUS: TabStatus = {
    executionState: 'idle',
    lastCommandStatus: null,
    lastCommandName: null,
};

const DEFAULT_GLOBAL_STATUS: GlobalStatus = {
    runningServiceCount: 0,
    totalServiceCount: 0,
    serverConnectionState: 'none',
    uptime: 0,
};

export class CliPanelStatusService {
    private tabs = new Map<number, TabEntry>();
    private activeTabId: number | undefined;
    private globalStatus$ = new BehaviorSubject<GlobalStatus>(DEFAULT_GLOBAL_STATUS);
    private destroy$ = new Subject<void>();

    /**
     * Register an engine for a specific pane within a tab.
     */
    registerEngine(tabId: number, paneId: number, engine: CliEngine): void {
        let entry = this.tabs.get(tabId);
        if (!entry) {
            entry = {
                engines: new Map(),
                status$: new BehaviorSubject<TabStatus>(DEFAULT_TAB_STATUS),
                destroy$: new Subject<void>(),
            };
            this.tabs.set(tabId, entry);
            this.startPollingTab(tabId, entry);
        }
        entry.engines.set(paneId, engine);
    }

    /**
     * Unregister all engines for a tab (called on tab close).
     */
    unregisterTab(tabId: number): void {
        const entry = this.tabs.get(tabId);
        if (entry) {
            entry.destroy$.next();
            entry.destroy$.complete();
            this.tabs.delete(tabId);
        }
    }

    /**
     * Set the active tab for global status derivation.
     */
    setActiveTab(tabId: number): void {
        this.activeTabId = tabId;
    }

    /**
     * Observable of per-tab status.
     */
    getTabStatus$(tabId: number): Observable<TabStatus> {
        const entry = this.tabs.get(tabId);
        return entry ? entry.status$.asObservable() : new BehaviorSubject(DEFAULT_TAB_STATUS).asObservable();
    }

    /**
     * Observable of global status (from active tab).
     */
    getGlobalStatus$(): Observable<GlobalStatus> {
        return this.globalStatus$.asObservable();
    }

    /**
     * Clean up all subscriptions.
     */
    destroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        for (const entry of this.tabs.values()) {
            entry.destroy$.next();
            entry.destroy$.complete();
        }
        this.tabs.clear();
    }

    private startPollingTab(tabId: number, entry: TabEntry): void {
        interval(POLL_INTERVAL_MS).pipe(
            startWith(0),
            map(() => this.computeTabStatus(entry)),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(entry.destroy$),
            takeUntil(this.destroy$),
        ).subscribe(status => {
            entry.status$.next(status);
        });

        // Also poll global status from active tab
        interval(POLL_INTERVAL_MS).pipe(
            startWith(0),
            map(() => this.computeGlobalStatus()),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(this.destroy$),
        ).subscribe(status => {
            this.globalStatus$.next(status);
        });
    }

    private computeTabStatus(entry: TabEntry): TabStatus {
        let running = false;
        let latestResult: { command: string; success: boolean } | undefined;

        for (const engine of entry.engines.values()) {
            const context = engine.getContext();
            if (!context) continue;

            // Check if a command is currently executing
            if ((context as any).isExecuting) {
                running = true;
            }

            // Check last command result
            const result = (context as any).lastCommandResult;
            if (result) {
                // Use the most recent result across panes
                // (we don't have timestamps, so just take the last one encountered)
                latestResult = result;
            }
        }

        return {
            executionState: running ? 'running' : 'idle',
            lastCommandStatus: latestResult ? (latestResult.success ? 'success' : 'error') : null,
            lastCommandName: latestResult?.command ?? null,
        };
    }

    private computeGlobalStatus(): GlobalStatus {
        if (this.activeTabId == null) return DEFAULT_GLOBAL_STATUS;
        const entry = this.tabs.get(this.activeTabId);
        if (!entry) return DEFAULT_GLOBAL_STATUS;

        // Use the first engine in the active tab for global data
        const engine = entry.engines.values().next().value;
        if (!engine) return DEFAULT_GLOBAL_STATUS;

        const context = engine.getContext();
        if (!context) return DEFAULT_GLOBAL_STATUS;

        // Background services
        let runningServiceCount = 0;
        let totalServiceCount = 0;
        try {
            const services = context.backgroundServices?.list() ?? [];
            totalServiceCount = services.length;
            runningServiceCount = services.filter(
                (s: any) => s.status === 'running',
            ).length;
        } catch { /* not available */ }

        // Server connection
        let serverConnectionState: GlobalStatus['serverConnectionState'] = 'none';
        try {
            const serverManager = (context as any).services?.get?.('cli-server-manager');
            if (serverManager?.connections?.size > 0) {
                let anyConnected = false;
                for (const conn of serverManager.connections.values()) {
                    if (conn.connected) {
                        anyConnected = true;
                        break;
                    }
                }
                serverConnectionState = anyConnected ? 'connected' : 'disconnected';
            }
        } catch { /* not available */ }

        // Uptime
        const uptime = engine.startedAt ? Date.now() - engine.startedAt : 0;

        return { runningServiceCount, totalServiceCount, serverConnectionState, uptime };
    }
}
