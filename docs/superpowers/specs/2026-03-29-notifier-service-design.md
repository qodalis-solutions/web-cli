# Notifier Service Design

## Goal

Replace `setStatusText` / `clearStatusText` / `getStatusText` / `statusTextChange$` on `ICliExecutionContext` with a unified `context.notifier` service that supports severity levels (info, success, warn, error).

## Architecture

A new `ICliNotifier` interface in `@qodalis/cli-core` replaces the three status text methods and the `statusTextChange$` Subject. Each command gets a per-command notifier instance (same lifecycle as `context.http`). Framework panel components consume the notifier's `current` value and render the message with level-appropriate styling.

## Types and Interface

```typescript
// packages/core/src/lib/models/notification.ts

export type CliNotificationLevel = 'info' | 'success' | 'warn' | 'error';

export interface CliNotification {
    level: CliNotificationLevel;
    message: string;
    timestamp: number;
}
```

```typescript
// packages/core/src/lib/interfaces/notifier.ts

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

## Implementation

```typescript
// packages/cli/src/lib/services/cli-notifier.ts

import { Subject } from 'rxjs';
import { ICliNotifier, CliNotification, CliNotificationLevel } from '@qodalis/cli-core';

export class CliNotifier implements ICliNotifier {
    private _current: CliNotification | undefined;
    private readonly _change$ = new Subject<CliNotification | undefined>();

    readonly change$ = this._change$.asObservable();

    get current(): CliNotification | undefined {
        return this._current;
    }

    info(message: string): void { this.set('info', message); }
    success(message: string): void { this.set('success', message); }
    warn(message: string): void { this.set('warn', message); }
    error(message: string): void { this.set('error', message); }

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

## Context Changes

### ICliExecutionContext (core interface)

Remove:
- `setStatusText(text: string): void`
- `clearStatusText(): void`
- `getStatusText(): string | undefined`

Add:
- `notifier: ICliNotifier`

### CliExecutionContext (cli implementation)

Remove:
- `private _statusText?: string`
- `public readonly statusTextChange$`
- `setStatusText()`, `clearStatusText()`, `getStatusText()` methods

Add:
- `public notifier: ICliNotifier` initialized as `new CliNotifier()` in the constructor

### CliCommandExecutionContext (per-command wrapper)

Remove the three proxy methods (`setStatusText`, `clearStatusText`, `getStatusText`).

Add:
- `notifier: ICliNotifier` — copied from `context.notifier` in the constructor (same as `http`)

### Command Executor

No special per-command notifier instantiation needed — unlike `http` which needs a per-command signal, the notifier is stateless between commands (cleared automatically by the executor after command completes, same as today's `clearStatusText`).

After command execution completes, call `commandContext.notifier.clear()` (replacing the existing implicit status text clearing).

## Migration: All 24 Call Sites

Every existing `context.setStatusText(text)` becomes `context.notifier.info(text)`.
Every existing `context.clearStatusText()` becomes `context.notifier.clear()`.
Every existing `context.getStatusText()` becomes `context.notifier.current?.message`.

No behavioral change — all existing status updates are info-level.

### Call sites by file:

| File | Count | Current | After |
|------|-------|---------|-------|
| `cli-speed-test-command-processor.ts` | 5 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-scp-command-processor.ts` | 5 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-wget-command-processor.ts` | 4 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-scp-download-processor.ts` | 3 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-curl-command-processor.ts` | 2 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-ping-command-processor.ts` | 2 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-packages-command-processor.ts` | 4 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-logs-command-processor.ts` | 3 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-server-command-processor.ts` | 2 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-server-proxy-processor.ts` | 1 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-qr-command-processor.ts` | 1 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-upload-command-processor.ts` | 2 | `setStatusText(...)` | `notifier.info(...)` |
| `cli-scp-upload-processor.ts` | 1 | `setStatusText(...)` | `notifier.info(...)` |

## Framework Panel Changes

### Angular (`cli-panel-status.service.ts`)

Replace `statusTextChange$` subscription with `notifier.change$` subscription.

Replace `getStatusText()` polling with reading `notifier.current`.

Update `TabStatus` interface:
```typescript
// Before:
statusText: string | null;

// After:
notification: CliNotification | null;
```

Update the status bar template to render with level-based styling:
- `info` → default color (current behavior)
- `success` → green
- `warn` → yellow/orange
- `error` → red

### React (`CliPanel.tsx`)

Replace:
```typescript
const [statusText, setStatusText] = useState<string | null>(null);
// polling:
const text = context.getStatusText?.();
setStatusText(text || null);
```

With:
```typescript
const [notification, setNotification] = useState<CliNotification | null>(null);
// polling:
const notif = context.notifier?.current;
setNotification(notif || null);
```

Update render to apply CSS class based on `notification.level`.

### Vue (`CliPanel.ts`)

Same pattern as React — replace `statusText` ref with `notification` ref, update polling, apply level-based CSS class.

### CSS

Add level-specific classes to the shared panel styles:
```css
.cli-panel-status-notification.level-info { /* default — no change */ }
.cli-panel-status-notification.level-success { color: #4caf50; }
.cli-panel-status-notification.level-warn { color: #ff9800; }
.cli-panel-status-notification.level-error { color: #f44336; }
```

## Test Harness

Update `CliTestHarness.createContext()` to provide a `CliNotifier` instance on the context object (replacing the no-op `setStatusText`/`clearStatusText`/`getStatusText` functions).

## Exports

### `@qodalis/cli-core`
- Export `CliNotificationLevel`, `CliNotification` from models
- Export `ICliNotifier` from interfaces

### `@qodalis/cli`
- Export `CliNotifier` from services

## Backward Compatibility

This is a breaking change to the `ICliExecutionContext` interface. Any third-party plugin using `context.setStatusText()` will need to update to `context.notifier.info()`. Since the package is pre-1.0 (beta), this is acceptable.
