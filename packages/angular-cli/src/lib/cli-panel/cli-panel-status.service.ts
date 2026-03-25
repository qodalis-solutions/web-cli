import { BehaviorSubject, Observable, Subject, interval, map, distinctUntilChanged, takeUntil, startWith, merge } from 'rxjs';
import { CliEngine } from '@qodalis/cli';

export interface TabStatus {
    executionState: 'idle' | 'running';
    lastCommandStatus: 'success' | 'error' | null;
    lastCommandName: string | null;
    statusText: string | null;
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
    refresh$: Subject<void>;
}

/** Slow poll for uptime display only. */
const UPTIME_POLL_MS = 2000;

/** Fast poll to catch execution state changes. */
const EXEC_POLL_MS = 300;

const DEFAULT_TAB_STATUS: TabStatus = {
    executionState: 'idle',
    lastCommandStatus: null,
    lastCommandName: null,
    statusText: null,
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

    /** Push to trigger an immediate global status recalculation. */
    private globalRefresh$ = new Subject<void>();

    /** Cleanup functions for background-service event listeners. */
    private bgUnsubscribes: Array<() => void> = [];

    private globalPollingStarted = false;

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
                refresh$: new Subject<void>(),
            };
            this.tabs.set(tabId, entry);
            this.startPollingTab(entry);
        }
        entry.engines.set(paneId, engine);

        // Listen to statusText changes for immediate tab refresh
        const context = engine.getContext();
        if (context && (context as any).statusTextChange$) {
            (context as any).statusTextChange$.pipe(
                takeUntil(entry.destroy$),
                takeUntil(this.destroy$),
            ).subscribe(() => {
                entry!.refresh$.next();
            });
        }

        // Listen to background service events for immediate global refresh
        this.listenToBackgroundServices(engine);

        if (!this.globalPollingStarted) {
            this.globalPollingStarted = true;
            this.startGlobalPolling();
        }
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
        this.globalRefresh$.next();
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
        for (const unsub of this.bgUnsubscribes) {
            unsub();
        }
        this.bgUnsubscribes.length = 0;
    }

    /**
     * Hook into an engine's background service events so that
     * service start/stop/status-change triggers an immediate refresh.
     */
    private listenToBackgroundServices(engine: CliEngine): void {
        const context = engine.getContext();
        if (!context?.backgroundServices) return;

        try {
            const unsub = context.backgroundServices.on(() => {
                this.globalRefresh$.next();
            });
            this.bgUnsubscribes.push(unsub);
        } catch { /* not available */ }
    }

    private startPollingTab(entry: TabEntry): void {
        merge(
            interval(EXEC_POLL_MS).pipe(startWith(0)),
            entry.refresh$,
        ).pipe(
            map(() => this.computeTabStatus(entry)),
            distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
            takeUntil(entry.destroy$),
            takeUntil(this.destroy$),
        ).subscribe(status => {
            entry.status$.next(status);
        });
    }

    private startGlobalPolling(): void {
        // Merge: slow timer for uptime ticking + immediate refresh signals
        merge(
            interval(UPTIME_POLL_MS).pipe(startWith(0)),
            this.globalRefresh$,
        ).pipe(
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
        let statusText: string | null = null;

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
                latestResult = result;
            }

            // Pick up custom status text from processors
            const text = context.getStatusText?.();
            if (text) {
                statusText = text;
            }
        }

        return {
            executionState: running ? 'running' : 'idle',
            lastCommandStatus: latestResult ? (latestResult.success ? 'success' : 'error') : null,
            lastCommandName: latestResult?.command ?? null,
            statusText,
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
