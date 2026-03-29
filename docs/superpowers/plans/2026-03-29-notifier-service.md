# Notifier Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `setStatusText`/`clearStatusText`/`getStatusText` on `ICliExecutionContext` with a unified `context.notifier` service supporting severity levels (info, success, warn, error).

**Architecture:** A new `ICliNotifier` interface in `@qodalis/cli-core` replaces the three status text methods and the `statusTextChange$` Subject. Each command gets a per-command notifier reference (same instance as root context). Framework panel components consume the notifier's `current` value and render messages with level-appropriate styling.

**Tech Stack:** TypeScript, RxJS (Subject/Observable), Angular 16, React, Vue 3, xterm.js

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/core/src/lib/models/notification.ts` | `CliNotificationLevel` type + `CliNotification` interface |
| Create | `packages/core/src/lib/interfaces/notifier.ts` | `ICliNotifier` interface |
| Modify | `packages/core/src/lib/models/index.ts` | Export notification model |
| Modify | `packages/core/src/lib/interfaces/index.ts` | Export notifier interface |
| Create | `packages/cli/src/lib/services/cli-notifier.ts` | `CliNotifier` implementation |
| Modify | `packages/cli/src/lib/services/index.ts` | Export `CliNotifier` |
| Modify | `packages/core/src/lib/interfaces/execution-context.ts` | Remove 3 status text methods, add `notifier: ICliNotifier` |
| Modify | `packages/cli/src/lib/context/cli-execution-context.ts` | Remove status text fields/methods, add `notifier` property |
| Modify | `packages/cli/src/lib/context/cli-command-execution-context.ts` | Remove status text proxy methods, add `notifier` delegation |
| Modify | `packages/cli/src/lib/executor/cli-command-executor.ts` | Replace `clearStatusText()` with `notifier.clear()` |
| Modify | `packages/cli/src/lib/testing/cli-test-harness.ts` | Replace no-op status text fns with `CliNotifier` instance |
| Modify | 13 command processor files | Replace `setStatusText(...)` with `notifier.info(...)` |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts` | Replace `statusTextChange$`/`getStatusText` with `notifier.change$`/`notifier.current` |
| Modify | `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html` | Replace `statusText` binding with `notification` binding |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts` | Replace `statusText` Input with `notification` Input |
| Modify | `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html` | Render notification with level-based CSS class |
| Modify | `packages/react-cli/src/CliPanel.tsx` | Replace `statusText` state with `notification` state, level-based CSS |
| Modify | `packages/vue-cli/src/CliPanel.ts` | Replace `statusText` ref with `notification` ref, level-based CSS |
| Modify | `packages/cli/src/assets/cli-panel.css` | Add `.status-text.level-*` color classes |

---

### Task 1: Create CliNotification Model and ICliNotifier Interface

**Files:**
- Create: `packages/core/src/lib/models/notification.ts`
- Create: `packages/core/src/lib/interfaces/notifier.ts`
- Modify: `packages/core/src/lib/models/index.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

- [ ] **Step 1: Create the notification model**

Create `packages/core/src/lib/models/notification.ts`:

```typescript
export type CliNotificationLevel = 'info' | 'success' | 'warn' | 'error';

export interface CliNotification {
    level: CliNotificationLevel;
    message: string;
    timestamp: number;
}
```

- [ ] **Step 2: Create the notifier interface**

Create `packages/core/src/lib/interfaces/notifier.ts`:

```typescript
import { Observable } from 'rxjs';
import { CliNotification } from '../models/notification';

export interface ICliNotifier {
    /** Set an info-level notification (progress, status updates). */
    info(message: string): void;

    /** Set a success-level notification. */
    success(message: string): void;

    /** Set a warn-level notification. */
    warn(message: string): void;

    /** Set an error-level notification. */
    error(message: string): void;

    /** Clear the current notification. */
    clear(): void;

    /** The current notification, or undefined if cleared. */
    readonly current: CliNotification | undefined;

    /** Observable that emits on every change (set or clear). */
    readonly change$: Observable<CliNotification | undefined>;
}
```

- [ ] **Step 3: Export the model from models/index.ts**

In `packages/core/src/lib/models/index.ts`, add after the last `export *` line (after `export * from './permissions';`):

```typescript
export * from './notification';
```

- [ ] **Step 4: Export the interface from interfaces/index.ts**

In `packages/core/src/lib/interfaces/index.ts`, add after the last `export *` line (after `export * from './http-client';`):

```typescript
export * from './notifier';
```

- [ ] **Step 5: Build core to verify**

Run: `npx nx build core`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/lib/models/notification.ts packages/core/src/lib/interfaces/notifier.ts packages/core/src/lib/models/index.ts packages/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add CliNotification model and ICliNotifier interface"
```

---

### Task 2: Implement CliNotifier Class

**Files:**
- Create: `packages/cli/src/lib/services/cli-notifier.ts`
- Modify: `packages/cli/src/lib/services/index.ts`

- [ ] **Step 1: Create the CliNotifier implementation**

Create `packages/cli/src/lib/services/cli-notifier.ts`:

```typescript
import { Subject } from 'rxjs';
import { ICliNotifier, CliNotification, CliNotificationLevel } from '@qodalis/cli-core';

export class CliNotifier implements ICliNotifier {
    private _current: CliNotification | undefined;
    private readonly _change$ = new Subject<CliNotification | undefined>();

    readonly change$ = this._change$.asObservable();

    get current(): CliNotification | undefined {
        return this._current;
    }

    info(message: string): void {
        this.set('info', message);
    }

    success(message: string): void {
        this.set('success', message);
    }

    warn(message: string): void {
        this.set('warn', message);
    }

    error(message: string): void {
        this.set('error', message);
    }

    clear(): void {
        this._current = undefined;
        this._change$.next(undefined);
    }

    private set(level: CliNotificationLevel, message: string): void {
        this._current = { level, message, timestamp: Date.now() };
        this._change$.next(this._current);
    }
}
```

- [ ] **Step 2: Export CliNotifier from services/index.ts**

In `packages/cli/src/lib/services/index.ts`, add after the `CliHttpClient` export line:

```typescript
export { CliNotifier } from './cli-notifier';
```

- [ ] **Step 3: Build cli to verify**

Run: `npx nx build cli`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/lib/services/cli-notifier.ts packages/cli/src/lib/services/index.ts
git commit -m "feat(cli): implement CliNotifier service"
```

---

### Task 3: Replace Status Text Methods with Notifier on Context Interfaces

**Files:**
- Modify: `packages/core/src/lib/interfaces/execution-context.ts:138-153`
- Modify: `packages/cli/src/lib/context/cli-execution-context.ts:120-135`
- Modify: `packages/cli/src/lib/context/cli-command-execution-context.ts:59-69`
- Modify: `packages/cli/src/lib/executor/cli-command-executor.ts:211`
- Modify: `packages/cli/src/lib/testing/cli-test-harness.ts:241-243`

- [ ] **Step 1: Update ICliExecutionContext interface**

In `packages/core/src/lib/interfaces/execution-context.ts`:

1. Add import for `ICliNotifier` — update the import from `.` (line 3-17) to include `ICliNotifier`:
```typescript
import {
    ICliClipboard,
    ICliCommandExecutorService,
    ICliCommandProcessor,
    ICliServiceProvider,
    ICliExecutionProcess,
    ICliLogger,
    ICliPercentageProgressBar,
    ICliSpinner,
    ICliStateStore,
    ICliTerminalWriter,
    ICliTextAnimator,
    ICliTranslationService,
    ICliHttpClient,
    ICliNotifier,
} from '.';
```

2. Remove the three status text methods (lines 138-153):
```typescript
    // REMOVE these three method declarations:
    setStatusText(text: string): void;
    clearStatusText(): void;
    getStatusText(): string | undefined;
```

3. Add the notifier property in their place:
```typescript
    /**
     * Notifier service for displaying status notifications in the panel header bar.
     * Supports severity levels: info, success, warn, error.
     * Cleared automatically when the command finishes.
     *
     * @example
     * ```ts
     * context.notifier.info('Downloading 45%...');
     * context.notifier.success('Connected to server');
     * context.notifier.warn('Rate limited, retrying...');
     * context.notifier.error('Connection failed');
     * context.notifier.clear();
     * ```
     */
    notifier: ICliNotifier;
```

- [ ] **Step 2: Update CliExecutionContext implementation**

In `packages/cli/src/lib/context/cli-execution-context.ts`:

1. Add `CliNotifier` import — add to the import from `../services/...` area (after line 29):
```typescript
import { CliNotifier } from '../services/cli-notifier';
```

2. Add `ICliNotifier` to the `@qodalis/cli-core` import (line 26):
```typescript
import {
    // ... existing imports ...
    ICliNotifier,
} from '@qodalis/cli-core';
```

3. Remove the old status text fields and methods (lines 120-135):
```typescript
    // REMOVE all of these:
    private _statusText?: string;
    public readonly statusTextChange$ = new Subject<string | undefined>();

    setStatusText(text: string): void {
        this._statusText = text;
        this.statusTextChange$.next(text);
    }

    clearStatusText(): void {
        this._statusText = undefined;
        this.statusTextChange$.next(undefined);
    }

    getStatusText(): string | undefined {
        return this._statusText;
    }
```

4. Add the notifier property declaration (near the other public properties, around line 98):
```typescript
    public readonly notifier: ICliNotifier;
```

5. Initialize the notifier in the constructor (after `this.http = new CliHttpClient();` around line 200):
```typescript
        this.notifier = new CliNotifier();
```

- [ ] **Step 3: Update CliCommandExecutionContext**

In `packages/cli/src/lib/context/cli-command-execution-context.ts`:

1. Add `ICliNotifier` to the import from `@qodalis/cli-core` (line 1-24):
```typescript
import {
    // ... existing imports ...
    ICliNotifier,
} from '@qodalis/cli-core';
```

2. Remove the three proxy methods (lines 59-69):
```typescript
    // REMOVE all of these:
    setStatusText(text: string): void {
        this.context.setStatusText(text);
    }

    clearStatusText(): void {
        this.context.clearStatusText();
    }

    getStatusText(): string | undefined {
        return this.context.getStatusText();
    }
```

3. Add the notifier property declaration (near line 57, after `http: ICliHttpClient;`):
```typescript
    notifier: ICliNotifier;
```

4. In the constructor, copy notifier from context (after `this.http = context.http;` around line 140):
```typescript
        this.notifier = context.notifier;
```

- [ ] **Step 4: Update command executor**

In `packages/cli/src/lib/executor/cli-command-executor.ts`, find line 211:
```typescript
rootContext.clearStatusText?.();
```
Replace with:
```typescript
rootContext.notifier?.clear();
```

- [ ] **Step 5: Update test harness**

In `packages/cli/src/lib/testing/cli-test-harness.ts`:

1. Add import for `CliNotifier`:
```typescript
import { CliNotifier } from '../services/cli-notifier';
```

2. Replace the three no-op status text lines (lines 241-243):
```typescript
        // REMOVE these three lines:
        setStatusText: () => {},
        clearStatusText: () => {},
        getStatusText: () => undefined,
```

Replace with:
```typescript
        notifier: new CliNotifier(),
```

- [ ] **Step 6: Build cli to verify**

Run: `npx nx build cli`
Expected: Build succeeds. There will be build errors in downstream packages (plugins, framework wrappers) — that is expected and will be fixed in subsequent tasks.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/lib/interfaces/execution-context.ts packages/cli/src/lib/context/cli-execution-context.ts packages/cli/src/lib/context/cli-command-execution-context.ts packages/cli/src/lib/executor/cli-command-executor.ts packages/cli/src/lib/testing/cli-test-harness.ts
git commit -m "feat(cli): replace setStatusText/clearStatusText/getStatusText with context.notifier"
```

---

### Task 4: Migrate All Command Processor Call Sites

**Files (13 files, 34 call sites):**
- Modify: `packages/plugins/speed-test/src/lib/processors/cli-speed-test-command-processor.ts` (5 calls)
- Modify: `packages/plugins/scp/src/lib/processors/cli-scp-command-processor.ts` (5 calls)
- Modify: `packages/plugins/wget/src/lib/processors/cli-wget-command-processor.ts` (4 calls)
- Modify: `packages/plugins/scp/src/lib/processors/cli-scp-download-processor.ts` (3 calls)
- Modify: `packages/cli/src/lib/processors/system/cli-packages-command-processor.ts` (4 calls)
- Modify: `packages/plugins/server-logs/src/lib/processors/cli-logs-command-processor.ts` (3 calls)
- Modify: `packages/plugins/curl/src/lib/processors/cli-curl-command-processor.ts` (2 calls)
- Modify: `packages/cli/src/lib/processors/cli-ping-command-processor.ts` (2 calls)
- Modify: `packages/cli/src/lib/server/cli-server-command-processor.ts` (2 calls)
- Modify: `packages/plugins/files/src/lib/processors/cli-upload-command-processor.ts` (2 calls)
- Modify: `packages/cli/src/lib/server/cli-server-proxy-processor.ts` (1 call)
- Modify: `packages/plugins/qr/src/lib/processors/cli-qr-command-processor.ts` (1 call)
- Modify: `packages/plugins/scp/src/lib/processors/cli-scp-upload-processor.ts` (1 call)

- [ ] **Step 1: Replace all `context.setStatusText(...)` with `context.notifier.info(...)`**

In every file listed above, perform a find-and-replace:

**Find:** `context.setStatusText(`
**Replace:** `context.notifier.info(`

This is a mechanical replacement. Every existing status update is info-level — no behavioral change.

Exact replacements per file:

**`cli-speed-test-command-processor.ts`** (lines 143, 154, 231, 236, 308):
```typescript
// Before:
context.setStatusText('Speed test: download');
// After:
context.notifier.info('Speed test: download');
```
(Same pattern for all 5 calls in this file.)

**`cli-scp-command-processor.ts`** (lines 117, 135, 140, 200, 214):
```typescript
// Before:
context.setStatusText(`scp: downloading from ${server.name}`);
// After:
context.notifier.info(`scp: downloading from ${server.name}`);
```
(Same pattern for all 5 calls in this file.)

**`cli-wget-command-processor.ts`** (lines 106, 123, 160, 163):
```typescript
// Before:
context.setStatusText(`Connecting to ${parsedUrl.hostname}`);
// After:
context.notifier.info(`Connecting to ${parsedUrl.hostname}`);
```
(Same pattern for all 4 calls in this file.)

**`cli-scp-download-processor.ts`** (lines 102, 123, 128):
```typescript
// Before:
context.setStatusText(`scp: downloading from ${server.name}`);
// After:
context.notifier.info(`scp: downloading from ${server.name}`);
```
(Same pattern for all 3 calls in this file.)

**`cli-packages-command-processor.ts`** (lines 132, 383, 427, 469):
```typescript
// Before:
context.setStatusText('Browsing packages');
// After:
context.notifier.info('Browsing packages');
```
(Same pattern for all 4 calls in this file.)

**`cli-logs-command-processor.ts`** (lines 190, 196, 264):
```typescript
// Before:
context.setStatusText('Connecting to log stream');
// After:
context.notifier.info('Connecting to log stream');
```
(Same pattern for all 3 calls in this file.)

**`cli-curl-command-processor.ts`** (lines 210, 213):
```typescript
// Before:
context.setStatusText(`${method} ${hostname}`);
// After:
context.notifier.info(`${method} ${hostname}`);
```

**`cli-ping-command-processor.ts`** (lines 70, 103):
```typescript
// Before:
context.setStatusText(`ping ${host}`);
// After:
context.notifier.info(`ping ${host}`);
```

**`cli-server-command-processor.ts`** (lines 107, 155):
```typescript
// Before:
context.setStatusText(`Pinging ${serverName}`);
// After:
context.notifier.info(`Pinging ${serverName}`);
```

**`cli-upload-command-processor.ts`** (lines 50, 67):
```typescript
// Before:
context.setStatusText('Waiting for file selection');
// After:
context.notifier.info('Waiting for file selection');
```

**`cli-server-proxy-processor.ts`** (line 101):
```typescript
// Before:
context.setStatusText(`executing command: ${cmdLabel} on server ${serverName}`);
// After:
context.notifier.info(`executing command: ${cmdLabel} on server ${serverName}`);
```

**`cli-qr-command-processor.ts`** (line 91):
```typescript
// Before:
context.setStatusText('Generating QR code');
// After:
context.notifier.info('Generating QR code');
```

**`cli-scp-upload-processor.ts`** (line 147):
```typescript
// Before:
context.setStatusText(`scp: uploading to ${server.name}`);
// After:
context.notifier.info(`scp: uploading to ${server.name}`);
```

- [ ] **Step 2: Build all affected packages**

Run: `npx nx run-many -t build --projects=cli,speed-test,scp,wget,server-logs,curl,files,qr`
Expected: Build succeeds for all packages.

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/speed-test/src/lib/processors/cli-speed-test-command-processor.ts \
  packages/plugins/scp/src/lib/processors/cli-scp-command-processor.ts \
  packages/plugins/scp/src/lib/processors/cli-scp-download-processor.ts \
  packages/plugins/scp/src/lib/processors/cli-scp-upload-processor.ts \
  packages/plugins/wget/src/lib/processors/cli-wget-command-processor.ts \
  packages/plugins/server-logs/src/lib/processors/cli-logs-command-processor.ts \
  packages/plugins/curl/src/lib/processors/cli-curl-command-processor.ts \
  packages/plugins/files/src/lib/processors/cli-upload-command-processor.ts \
  packages/plugins/qr/src/lib/processors/cli-qr-command-processor.ts \
  packages/cli/src/lib/processors/cli-ping-command-processor.ts \
  packages/cli/src/lib/processors/system/cli-packages-command-processor.ts \
  packages/cli/src/lib/server/cli-server-command-processor.ts \
  packages/cli/src/lib/server/cli-server-proxy-processor.ts
git commit -m "refactor: migrate all setStatusText calls to context.notifier.info"
```

---

### Task 5: Add Level-Based CSS Styling

**Files:**
- Modify: `packages/cli/src/assets/cli-panel.css:875-878`

- [ ] **Step 1: Add notification level CSS classes**

In `packages/cli/src/assets/cli-panel.css`, find the existing `.cli-panel-status-item.status-text` rule (lines 875-878):

```css
.cli-panel-status-item.status-text {
  color: var(--cli-panel-accent, #818cf8);
  max-width: 200px;
}
```

Replace it with level-specific variants:

```css
.cli-panel-status-item.status-text {
  max-width: 200px;
}

.cli-panel-status-item.status-text.level-info {
  color: var(--cli-panel-accent, #818cf8);
}

.cli-panel-status-item.status-text.level-success {
  color: var(--cli-status-idle, #3fb950);
}

.cli-panel-status-item.status-text.level-warn {
  color: var(--cli-status-running, #f0883e);
}

.cli-panel-status-item.status-text.level-error {
  color: var(--cli-status-error, #f85149);
}
```

Note: The color variables already exist in the CSS for status dots/icons, so the notification colors will be consistent with the existing status indicators.

- [ ] **Step 2: Commit**

```bash
git add packages/cli/src/assets/cli-panel.css
git commit -m "style: add notification level-based CSS classes for panel status bar"
```

---

### Task 6: Update Angular Panel Components

**Files:**
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts:4-51,94-102,231-242`
- Modify: `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html:18`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts:66`
- Modify: `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html:118-121`

- [ ] **Step 1: Update TabStatus interface and defaults in cli-panel-status.service.ts**

In `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts`:

1. Add import at the top (line 2, after the rxjs import):
```typescript
import { CliNotification } from '@qodalis/cli-core';
```

2. Replace `statusText` in the `TabStatus` interface (line 8):
```typescript
// Before:
    statusText: string | null;

// After:
    notification: CliNotification | null;
```

3. Replace `statusText` in `DEFAULT_TAB_STATUS` (line 51):
```typescript
// Before:
    statusText: null,

// After:
    notification: null,
```

- [ ] **Step 2: Update statusTextChange$ subscription to use notifier.change$**

In `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts`, replace lines 94-102:

```typescript
// Before:
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

// After:
        // Listen to notifier changes for immediate tab refresh
        const context = engine.getContext();
        if (context?.notifier?.change$) {
            context.notifier.change$.pipe(
                takeUntil(entry.destroy$),
                takeUntil(this.destroy$),
            ).subscribe(() => {
                entry!.refresh$.next();
            });
        }
```

- [ ] **Step 3: Update computeTabStatus to use notifier.current**

In `packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts`, update `computeTabStatus` (lines 210-243):

Replace the `statusText` variable and its usage:

```typescript
// Before (lines 213, 231-235, 242):
        let statusText: string | null = null;
        // ...
            // Pick up custom status text from processors
            const text = context.getStatusText?.();
            if (text) {
                statusText = text;
            }
        // ...
            statusText,

// After:
        let notification: CliNotification | null = null;
        // ...
            // Pick up notification from processors
            const notif = context.notifier?.current;
            if (notif) {
                notification = notif;
            }
        // ...
            notification,
```

The full updated `computeTabStatus` method:

```typescript
    private computeTabStatus(entry: TabEntry): TabStatus {
        let running = false;
        let latestResult: { command: string; success: boolean } | undefined;
        let notification: CliNotification | null = null;

        for (const engine of entry.engines.values()) {
            const context = engine.getContext();
            if (!context) continue;

            if ((context as any).isExecuting || (context as any).contextProcessor) {
                running = true;
            }

            const result = (context as any).lastCommandResult;
            if (result) {
                latestResult = result;
            }

            // Pick up notification from processors
            const notif = context.notifier?.current;
            if (notif) {
                notification = notif;
            }
        }

        return {
            executionState: running ? 'running' : 'idle',
            lastCommandStatus: latestResult ? (latestResult.success ? 'success' : 'error') : null,
            lastCommandName: latestResult?.command ?? null,
            notification,
        };
    }
```

- [ ] **Step 4: Update cli-panel.component.html**

In `packages/angular-cli/src/lib/cli-panel/cli-panel.component.html`, replace line 18:

```html
<!-- Before: -->
  [statusText]="tabStatuses[resolvedActiveTabId]?.statusText || null"

<!-- After: -->
  [notification]="tabStatuses[resolvedActiveTabId]?.notification || null"
```

- [ ] **Step 5: Update collapsable-content.component.ts**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts`:

1. Add import for `CliNotification`:
```typescript
import { CliNotification } from '@qodalis/cli-core';
```

2. Replace the `statusText` Input (line 66):
```typescript
// Before:
    @Input() statusText: string | null = null;

// After:
    @Input() notification: CliNotification | null = null;
```

- [ ] **Step 6: Update collapsable-content.component.html**

In `packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html`, replace lines 118-121:

```html
<!-- Before: -->
          <!-- Custom processor status text -->
          <span class="status-item status-text" *ngIf="statusText">
              <span class="status-label">{{ statusText }}</span>
          </span>

<!-- After: -->
          <!-- Custom processor notification -->
          <span class="status-item status-text" [ngClass]="'level-' + notification?.level" *ngIf="notification">
              <span class="status-label">{{ notification.message }}</span>
          </span>
```

Note: The outer class `status-text` is kept for the shared `max-width: 200px` rule. The `level-*` class is added dynamically for color styling.

- [ ] **Step 7: Build angular-cli to verify**

Run: `npx nx build angular-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/angular-cli/src/lib/cli-panel/cli-panel-status.service.ts \
  packages/angular-cli/src/lib/cli-panel/cli-panel.component.html \
  packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.ts \
  packages/angular-cli/src/lib/collapsable-content/collapsable-content.component.html
git commit -m "feat(angular-cli): update panel to render notifications with level-based styling"
```

---

### Task 7: Update React Panel

**Files:**
- Modify: `packages/react-cli/src/CliPanel.tsx:282,588-591,881-886`

- [ ] **Step 1: Update state declaration**

In `packages/react-cli/src/CliPanel.tsx`:

1. Add import for `CliNotification` at the top (in the `@qodalis/cli-core` import block):
```typescript
import { CliNotification } from '@qodalis/cli-core';
```

2. Replace `statusText` state (line 282):
```typescript
// Before:
const [statusText, setStatusText] = useState<string | null>(null);

// After:
const [notification, setNotification] = useState<CliNotification | null>(null);
```

- [ ] **Step 2: Update polling logic**

Replace the polling code (lines 588-591):

```typescript
// Before:
            // Status text
            const text = context.getStatusText?.();
            setStatusText(text || null);

// After:
            // Notification
            const notif = context.notifier?.current;
            setNotification(notif || null);
```

- [ ] **Step 3: Update render**

Replace the status text render block (lines 881-886):

```tsx
// Before:
                                    {/* Custom status text */}
                                    {statusText && (
                                        <span className="cli-panel-status-item status-text">
                                            <span className="cli-panel-status-label">{statusText}</span>
                                        </span>
                                    )}

// After:
                                    {/* Custom notification */}
                                    {notification && (
                                        <span className={`cli-panel-status-item status-text level-${notification.level}`}>
                                            <span className="cli-panel-status-label">{notification.message}</span>
                                        </span>
                                    )}
```

- [ ] **Step 4: Build react-cli to verify**

Run: `npx nx build react-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/react-cli/src/CliPanel.tsx
git commit -m "feat(react-cli): update panel to render notifications with level-based styling"
```

---

### Task 8: Update Vue Panel

**Files:**
- Modify: `packages/vue-cli/src/CliPanel.ts:305,337-339,886-891`

- [ ] **Step 1: Update ref declaration**

In `packages/vue-cli/src/CliPanel.ts`:

1. Add import for `CliNotification` at the top (in the `@qodalis/cli-core` import block):
```typescript
import { CliNotification } from '@qodalis/cli-core';
```

2. Replace `statusText` ref (line 305):
```typescript
// Before:
const statusText = ref<string | null>(null);

// After:
const notification = ref<CliNotification | null>(null);
```

- [ ] **Step 2: Update polling logic**

Replace the polling code (lines 337-339):

```typescript
// Before:
                const text = context.getStatusText?.();
                statusText.value = text || null;

// After:
                const notif = context.notifier?.current;
                notification.value = notif || null;
```

- [ ] **Step 3: Update render**

Replace the status text render block (lines 886-891):

```typescript
// Before:
                            // Custom status text
                            statusText.value
                                ? h('span', { class: 'cli-panel-status-item status-text' }, [
                                    h('span', { class: 'cli-panel-status-label' }, statusText.value),
                                ])
                                : null,

// After:
                            // Custom notification
                            notification.value
                                ? h('span', { class: `cli-panel-status-item status-text level-${notification.value.level}` }, [
                                    h('span', { class: 'cli-panel-status-label' }, notification.value.message),
                                ])
                                : null,
```

- [ ] **Step 4: Build vue-cli to verify**

Run: `npx nx build vue-cli`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/vue-cli/src/CliPanel.ts
git commit -m "feat(vue-cli): update panel to render notifications with level-based styling"
```

---

### Task 9: Full Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Build all projects**

Run: `pnpm run build`
Expected: All 31 projects build successfully.

- [ ] **Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass. Kill any lingering Karma/Chrome processes after:
```bash
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

- [ ] **Step 3: Verify no remaining references to old API**

Run:
```bash
grep -r "setStatusText\|clearStatusText\|getStatusText\|statusTextChange" packages/ --include="*.ts" --include="*.html" | grep -v node_modules | grep -v dist
```

Expected: No matches. If any remain, fix them.

- [ ] **Step 4: Visual verification**

Run `pnpm run serve:angular-demo` and verify:
1. Run a command that sets status text (e.g., `ping google.com`) — should show info-level (purple/accent) notification in the panel header bar
2. When command completes, notification should clear
3. Kill the dev server after verification:
```bash
pkill -f "nx.js" 2>/dev/null || true
```
