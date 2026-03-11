# Engine Snapshot/Restore Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full snapshot/restore API to CliEngine so that duplicating a tab copies terminal buffer, command history, and state stores into the new tab.

**Architecture:** Add `snapshot()` and `restore()` methods to `CliEngine`. Use `@xterm/addon-serialize` for terminal buffer capture. Each framework wrapper (Angular, React, Vue) passes snapshot data through props/inputs to the engine via `CliEngineOptions.snapshot`. Panel components capture the snapshot from the source engine before creating the duplicate tab.

**Tech Stack:** TypeScript, xterm.js + @xterm/addon-serialize, Angular 16, React, Vue 3

---

### Task 1: Install @xterm/addon-serialize

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `package.json` (workspace root)

**Step 1: Add the dependency**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm add @xterm/addon-serialize -w`

Expected: Package added to workspace root dependencies.

**Step 2: Verify installation**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && ls node_modules/@xterm/addon-serialize`

Expected: Directory exists with package files.

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @xterm/addon-serialize dependency"
```

---

### Task 2: Add CliEngineSnapshot interface to @qodalis/cli-core

**Files:**
- Create: `packages/core/src/lib/interfaces/engine-snapshot.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

**Step 1: Create the snapshot interface**

Create `packages/core/src/lib/interfaces/engine-snapshot.ts`:

```typescript
/**
 * Represents a serialized snapshot of a CLI engine's state.
 * Used to duplicate terminal tabs with full state preservation.
 */
export interface CliEngineSnapshot {
    /** Schema version for forward compatibility */
    version: 1;
    /** Timestamp (ms since epoch) when the snapshot was taken */
    timestamp: number;
    /** Serialized terminal state */
    terminal: {
        /** Terminal buffer serialized via @xterm/addon-serialize */
        serializedBuffer: string;
        /** Terminal column count at time of snapshot */
        cols: number;
        /** Terminal row count at time of snapshot */
        rows: number;
    };
    /** Command history entries (most recent last) */
    commandHistory: string[];
    /** Named state store entries */
    stateStores: Array<{
        name: string;
        state: Record<string, any>;
    }>;
}
```

**Step 2: Export from interfaces barrel**

Add to `packages/core/src/lib/interfaces/index.ts`:

```typescript
export * from './engine-snapshot';
```

**Step 3: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add packages/core/src/lib/interfaces/engine-snapshot.ts packages/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add CliEngineSnapshot interface"
```

---

### Task 3: Add setHistory() method to CliCommandHistory

**Files:**
- Modify: `packages/cli/src/lib/services/cli-command-history.ts`
- Modify: `packages/cli/src/tests/command-history.spec.ts`

**Step 1: Write the failing test**

Add to `packages/cli/src/tests/command-history.spec.ts` inside the `describe('CliCommandHistory', ...)` block:

```typescript
    it('should set history from an array', async () => {
        await history.addCommand('existing');
        await history.setHistory(['alpha', 'beta', 'gamma']);
        expect(history.getHistory()).toEqual(['alpha', 'beta', 'gamma']);
        expect(history.getLastIndex()).toBe(3);
    });

    it('should persist after setHistory', async () => {
        await history.setHistory(['one', 'two']);
        const stored = await store.get<string[]>('cli-command-history');
        expect(stored).toEqual(['one', 'two']);
    });
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test cli --no-watch`

Expected: FAIL — `history.setHistory is not a function`

**Step 3: Write minimal implementation**

Add to `packages/cli/src/lib/services/cli-command-history.ts` after the `clearHistory()` method:

```typescript
    public async setHistory(commands: string[]): Promise<void> {
        this.commandHistory = [...commands];
        await this.saveHistory();
    }
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && npx nx test cli --no-watch`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/cli/src/lib/services/cli-command-history.ts packages/cli/src/tests/command-history.spec.ts
git commit -m "feat(cli): add setHistory() to CliCommandHistory"
```

---

### Task 4: Add snapshot() and restore() to CliEngine

**Files:**
- Modify: `packages/cli/src/lib/engine/cli-engine.ts`

**Step 1: Add SerializeAddon import and snapshot field to CliEngineOptions**

At the top of `packages/cli/src/lib/engine/cli-engine.ts`, add import:

```typescript
import { SerializeAddon } from '@xterm/addon-serialize';
```

And add the import for the snapshot type:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
```

Update the `CliEngineOptions` interface (line 45-47):

```typescript
export interface CliEngineOptions extends CliOptions {
    terminalOptions?: Partial<ITerminalOptions & ITerminalInitOnlyOptions>;
    /** Optional snapshot to restore on start(). When provided, the engine restores terminal buffer, command history, and state stores from the snapshot instead of showing the welcome message. */
    snapshot?: CliEngineSnapshot;
}
```

**Step 2: Add SerializeAddon as a private field**

Add to the class fields (around line 56):

```typescript
    private serializeAddon!: SerializeAddon;
```

**Step 3: Load SerializeAddon in initializeTerminal()**

In `initializeTerminal()` method, after `this.terminal.loadAddon(new Unicode11Addon());` (line 326), add:

```typescript
        this.serializeAddon = new SerializeAddon();
        this.terminal.loadAddon(this.serializeAddon);
```

**Step 4: Add snapshot() method**

Add after the `execute()` method (after line 305):

```typescript
    /**
     * Capture a snapshot of the current engine state.
     * Returns a serializable object containing terminal buffer, command history,
     * and all state store data. Can only be called after start().
     */
    snapshot(): CliEngineSnapshot {
        if (!this.executionContext) {
            throw new Error('Cannot snapshot before engine has started');
        }

        const stateStoreManager = this.executionContext.services.get<ICliStateStoreManager>(
            CliStateStoreManager_TOKEN,
        );

        return {
            version: 1,
            timestamp: Date.now(),
            terminal: {
                serializedBuffer: this.serializeAddon.serialize(),
                cols: this.terminal.cols,
                rows: this.terminal.rows,
            },
            commandHistory: this.executionContext.commandHistory.getHistory(),
            stateStores: stateStoreManager.getStoreEntries(),
        };
    }
```

Also add the import for `ICliStateStoreManager` at the top:

```typescript
import { ICliStateStoreManager } from '../state/cli-state-store-manager';
```

**Step 5: Modify start() to support snapshot restore**

In the `start()` method, replace the module boot section. After the onAfterBoot loop (line 247), add snapshot restore logic. The key change is: when a snapshot is provided, skip the welcome module and restore state after boot.

Replace line 205 (the `allModules` construction):

```typescript
        // 6.5. Prepend welcome module and server module
        // Skip welcome module when restoring from snapshot
        const serverModule = createServerModule();
        const allModules = this.options?.snapshot
            ? [serverModule, ...this.userModules]
            : [welcomeModule, serverModule, ...this.userModules];
```

After the onAfterBoot loop (after line 247), add the restore logic:

```typescript
        // 10. Restore from snapshot if provided
        if (this.options?.snapshot) {
            await this.restoreSnapshot(this.options.snapshot);
        }
```

**Step 6: Add private restoreSnapshot() method**

Add as a private method:

```typescript
    /**
     * Restore engine state from a snapshot.
     * Writes terminal buffer, sets command history, and hydrates state stores.
     */
    private async restoreSnapshot(snap: CliEngineSnapshot): Promise<void> {
        // Restore terminal buffer
        if (snap.terminal.serializedBuffer) {
            this.terminal.write(snap.terminal.serializedBuffer);
        }

        // Restore command history
        await this.executionContext.commandHistory.setHistory(snap.commandHistory);

        // Restore state stores
        const stateStoreManager = this.executionContext.services.get<ICliStateStoreManager>(
            CliStateStoreManager_TOKEN,
        );
        for (const entry of snap.stateStores) {
            const store = stateStoreManager.getStateStore(entry.name);
            store.updateState(entry.state);
        }

        // Show prompt after restore
        this.executionContext.showPrompt();
    }
```

**Step 7: Update engine exports**

Update `packages/cli/src/lib/engine/index.ts`:

```typescript
export { CliEngine, CliEngineOptions } from './cli-engine';
```

(No change needed — `CliEngineOptions` already re-exports, and `CliEngineSnapshot` comes from `@qodalis/cli-core`.)

**Step 8: Verify build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core && pnpm run build:cli`

Expected: Both builds succeed.

**Step 9: Commit**

```bash
git add packages/cli/src/lib/engine/cli-engine.ts
git commit -m "feat(cli): add snapshot() and restore() to CliEngine"
```

---

### Task 5: Add snapshot support to Angular CliComponent

**Files:**
- Modify: `packages/angular-cli/src/lib/cli/cli.component.ts`

**Step 1: Add snapshot Input and engineReady Output**

Add imports at the top:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
```

Add `Output` and `EventEmitter` to Angular imports (already imported in the panel but not in cli.component.ts — check and add if needed).

Add to the component class (after `@Input() height?` on line 38):

```typescript
    @Input() snapshot?: CliEngineSnapshot;

    @Output() engineReady = new EventEmitter<CliEngine>();
```

**Step 2: Pass snapshot into engine options**

In `ngAfterViewInit()`, update the engine options construction (lines 57-59):

```typescript
        const engineOptions: CliEngineOptions = {
            ...(this.options ?? {}),
            ...(this.snapshot ? { snapshot: this.snapshot } : {}),
        };
```

**Step 3: Emit engineReady after start**

Change `this.engine.start();` (line 97) to:

```typescript
        this.engine.start().then(() => {
            this.engineReady.emit(this.engine!);
        });
```

**Step 4: Expose engine via public getter**

Add a public method to the class:

```typescript
    public getEngine(): CliEngine | undefined {
        return this.engine;
    }
```

**Step 5: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core && pnpm run build:cli && pnpm run build:angular-cli`

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/angular-cli/src/lib/cli/cli.component.ts
git commit -m "feat(angular-cli): add snapshot input and engineReady output to CliComponent"
```

---

### Task 6: Update Angular CliPanelComponent to capture and pass snapshots

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`

**Step 1: Add snapshot field to TerminalPane**

In `cli-panel.component.ts`, update the `TerminalPane` interface (lines 21-24):

```typescript
export interface TerminalPane {
    id: number;
    widthPercent: number;
    snapshot?: CliEngineSnapshot;
}
```

Add the import:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
```

**Step 2: Update contextMenuDuplicate() to capture snapshot**

Replace the `contextMenuDuplicate()` method (lines 250-269):

```typescript
    contextMenuDuplicate(): void {
        const sourceTab = this.findTab(this.contextMenu.tabId);
        this.closeContextMenu();
        if (sourceTab) {
            // Capture snapshot from the first pane's engine
            const snapshot = this.getEngineForTab(sourceTab)?.snapshot();

            const pane: TerminalPane = {
                id: this.nextPaneId++,
                widthPercent: 100,
                snapshot,
            };
            const tab: TerminalTab = {
                id: this.nextTabId++,
                title: `${sourceTab.title} (copy)`,
                isEditing: false,
                panes: [pane],
            };
            const sourceIndex = this.tabs.indexOf(sourceTab);
            this.tabs.splice(sourceIndex + 1, 0, tab);
            this.activeTabId = tab.id;
            this.activePaneId = pane.id;
        }
    }
```

**Step 3: Add getEngineForTab() helper**

Add a private method:

```typescript
    private getEngineForTab(tab: TerminalTab): CliEngine | undefined {
        if (!this.cliComponents) return undefined;

        let flatIndex = 0;
        for (const t of this.tabs) {
            for (const _pane of t.panes) {
                if (t.id === tab.id) {
                    const component = this.cliComponents.toArray()[flatIndex];
                    return component?.getEngine();
                }
                flatIndex++;
            }
        }
        return undefined;
    }
```

Add the import for `CliEngine`:

```typescript
import { CliEngine } from '@qodalis/cli';
```

(Note: `CliEngineOptions` is already imported from `@qodalis/cli` on line 17 — just add `CliEngine` to that import.)

**Step 4: Update template to pass snapshot**

In `cli-panel.component.html`, update the `<cli>` element (lines 87-92) to pass the snapshot:

```html
              <cli
                [options]="options"
                [height]="terminalHeight"
                [modules]="modules"
                [processors]="processors"
                [snapshot]="pane.snapshot"
              />
```

**Step 5: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core && pnpm run build:cli && pnpm run build:angular-cli`

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/cli-panel.component.ts packages/angular-cli/src/lib/cli-panel/cli-panel.component.html
git commit -m "feat(angular-cli): capture and pass snapshot on tab duplicate"
```

---

### Task 7: Add snapshot support to React wrapper

**Files:**
- Modify: `packages/react-cli/src/Cli.tsx`
- Modify: `packages/react-cli/src/useCliEngine.ts`
- Modify: `packages/react-cli/src/CliPanel.tsx`

**Step 1: Add snapshot to CliProps and UseCliEngineConfig**

In `packages/react-cli/src/Cli.tsx`, update `CliProps`:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';

export interface CliProps {
    modules?: ICliModule[];
    processors?: ICliCommandProcessor[];
    options?: CliEngineOptions;
    services?: Record<string, any>;
    snapshot?: CliEngineSnapshot;
    onReady?: (engine: CliEngine) => void;
    style?: React.CSSProperties;
    className?: string;
}
```

Pass `snapshot` to the hook. In the function body, merge snapshot into options:

```typescript
    const mergedOptions = options ?? config.options;
    const optionsWithSnapshot = snapshot
        ? { ...mergedOptions, snapshot }
        : mergedOptions;
```

Update `useCliEngine` call to use `optionsWithSnapshot`:

```typescript
    const standaloneEngine = useCliEngine(containerRef, {
        modules: mergedModules,
        processors: mergedProcessors,
        options: optionsWithSnapshot,
        services: mergedServices,
        disabled: hasProvider,
    });
```

And destructure `snapshot` from props:

```typescript
export function Cli({
    modules,
    processors,
    options,
    services,
    snapshot,
    onReady,
    style,
    className,
}: CliProps): React.JSX.Element {
```

**Step 2: Add snapshot to TerminalPane in CliPanel**

In `packages/react-cli/src/CliPanel.tsx`, update the `TerminalPane` interface:

```typescript
interface TerminalPane {
    id: number;
    widthPercent: number;
    snapshot?: CliEngineSnapshot;
}
```

Add import:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
import { CliEngine } from '@qodalis/cli';
```

**Step 3: Add engine tracking Map to CliPanel**

Add a ref to track engines by pane ID:

```typescript
    const engineMapRef = useRef<Map<number, CliEngine>>(new Map());
```

In the `<Cli>` render, pass `snapshot` and `onReady`:

```typescript
<Cli
    options={options}
    modules={modules}
    processors={processors}
    services={services}
    snapshot={pane.snapshot}
    onReady={(engine) => engineMapRef.current.set(pane.id, engine)}
/>
```

**Step 4: Update Duplicate button handler**

Replace the Duplicate click handler (lines 561-573):

```typescript
                    <button className="cli-panel-context-menu-item" onClick={() => {
                        closeContextMenu();
                        const tab = tabs.find(t => t.id === contextMenu.tabId);
                        if (!tab) return;

                        // Capture snapshot from source tab's first pane engine
                        const sourceEngine = engineMapRef.current.get(tab.panes[0]?.id);
                        const snapshot = sourceEngine?.snapshot();

                        const paneId = nextIdRef.current.pane++;
                        const tabId = nextIdRef.current.tab++;
                        const pane: TerminalPane = { id: paneId, widthPercent: 100, snapshot };
                        const newTab: TerminalTab = { id: tabId, title: `${tab.title} (copy)`, isEditing: false, panes: [pane] };
                        const idx = tabs.indexOf(tab);
                        setTabs(prev => { const next = [...prev]; next.splice(idx + 1, 0, newTab); return next; });
                        setActiveTabId(tabId);
                        setActivePaneId(paneId);
                    }}>Duplicate</button>
```

**Step 5: Clean up engine refs on tab close**

In the `closeTab` and `closePane` callbacks, remove stale engine refs. Add cleanup in `closeTab`:

```typescript
    const closeTab = useCallback((id: number) => {
        setTabs(prev => {
            const tab = prev.find(t => t.id === id);
            if (tab) {
                tab.panes.forEach(p => engineMapRef.current.delete(p.id));
            }
            const next = prev.filter(t => t.id !== id);
            // ... rest unchanged
```

**Step 6: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core && pnpm run build:cli && pnpm run build:react-cli`

Expected: Build succeeds.

**Step 7: Commit**

```bash
git add packages/react-cli/src/Cli.tsx packages/react-cli/src/useCliEngine.ts packages/react-cli/src/CliPanel.tsx
git commit -m "feat(react-cli): add snapshot support for tab duplication"
```

---

### Task 8: Add snapshot support to Vue wrapper

**Files:**
- Modify: `packages/vue-cli/src/Cli.ts`
- Modify: `packages/vue-cli/src/CliPanel.ts`

**Step 1: Add snapshot prop to Cli component**

In `packages/vue-cli/src/Cli.ts`, add the snapshot prop:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
```

Add to props:

```typescript
        snapshot: {
            type: Object as PropType<CliEngineSnapshot>,
            default: undefined,
        },
```

Update the engine creation in `onMounted` to include snapshot:

```typescript
            const engineOptions = props.snapshot
                ? { ...options, snapshot: props.snapshot }
                : options;
            engine = new CliEngine(containerRef.value, engineOptions);
```

**Step 2: Add engine tracking and snapshot to CliPanel**

In `packages/vue-cli/src/CliPanel.ts`:

Add imports:

```typescript
import { CliEngineSnapshot } from '@qodalis/cli-core';
import { CliEngine } from '@qodalis/cli';
```

Update `TerminalPane`:

```typescript
interface TerminalPane {
    id: number;
    widthPercent: number;
    snapshot?: CliEngineSnapshot;
}
```

Add engine tracking map:

```typescript
        const engineMap = new Map<number, CliEngine>();
```

**Step 3: Update Cli render in CliPanel to pass snapshot and capture engine**

In the render function where `h(Cli, { ... })` is used (around line 737-748), update:

```typescript
                                              h(Cli, {
                                                  options: mergedOptions.value,
                                                  modules: mergedModules.value,
                                                  processors: mergedProcessors.value,
                                                  services: mergedServices.value,
                                                  snapshot: pane.snapshot,
                                                  style: { height: '100%' },
                                                  onReady: (engine: CliEngine) => {
                                                      engineMap.set(pane.id, engine);
                                                  },
                                              }),
```

**Step 4: Update Duplicate handler**

In the Duplicate button handler (around line 790-809), capture snapshot:

```typescript
                                      const sourceEngine = engineMap.get(tab.panes[0]?.id);
                                      const snapshot = sourceEngine?.snapshot();
                                      const paneId = nextPaneId++;
                                      const tabId = nextTabId++;
                                      const idx = tabs.value.indexOf(tab);
                                      tabs.value.splice(idx + 1, 0, {
                                          id: tabId,
                                          title: `${tab.title} (copy)`,
                                          isEditing: false,
                                          panes: [
                                              { id: paneId, widthPercent: 100, snapshot },
                                          ],
                                      });
                                      activeTabId.value = tabId;
                                      activePaneId.value = paneId;
```

**Step 5: Build and verify**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build:core && pnpm run build:cli && pnpm run build:vue-cli`

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/vue-cli/src/Cli.ts packages/vue-cli/src/CliPanel.ts
git commit -m "feat(vue-cli): add snapshot support for tab duplication"
```

---

### Task 9: Full build and manual verification

**Files:** None (verification only)

**Step 1: Full workspace build**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run build`

Expected: All 23 projects build successfully.

**Step 2: Run all tests**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm test`

Expected: All tests pass.

**Step 3: Serve Angular demo for manual testing**

Run: `cd /Users/nicolaelupei/Documents/Personal/web-cli && pnpm run serve:angular-demo`

Manual test:
1. Open CLI panel (click terminal icon)
2. Run a few commands (e.g., `help`, `guid`, `echo hello`)
3. Right-click the tab -> Duplicate
4. Verify the new tab has: terminal scrollback showing previous commands/output, command history (press up arrow), and state preserved (e.g., run `todo list` if you added items)

**Step 4: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
