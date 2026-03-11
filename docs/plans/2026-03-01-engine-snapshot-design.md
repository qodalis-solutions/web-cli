# Engine Snapshot/Restore Design

**Date**: 2026-03-01
**Status**: Approved

## Problem

The CLI panel's "Duplicate" option creates a new tab with a fresh, independent engine. No state carries over — command history, state stores, and terminal output are lost. Users expect a duplicate to be a copy of the original.

## Solution

Add a first-class snapshot/restore API to `CliEngine` that captures and restores:

- Terminal buffer content (scrollback + visible area)
- Command history
- All state store data

## Data Model

```typescript
interface CliEngineSnapshot {
    version: 1;
    timestamp: number;
    terminal: {
        serializedBuffer: string;  // From @xterm/addon-serialize
        cols: number;
        rows: number;
    };
    commandHistory: string[];
    stateStores: Array<{
        name: string;
        state: Record<string, any>;
    }>;
}
```

Plain serializable object — no class instances, observables, or DOM references.

## Engine API

### New Methods on `CliEngine`

- **`snapshot(): CliEngineSnapshot`** — Captures current terminal buffer (via SerializeAddon), command history, and all state store entries. Can be called anytime after `start()`.
- **`restore(snapshot: CliEngineSnapshot): Promise<void>`** — Called internally during `start()` when a snapshot is provided via options. Writes the serialized buffer to the terminal, populates command history, and hydrates state stores. Runs after terminal init but before welcome message/prompt.

### Options Extension

```typescript
interface CliEngineOptions extends CliOptions {
    snapshot?: CliEngineSnapshot;  // new
    // ... existing fields
}
```

### Modified `start()` Flow

1. Initialize terminal (as before)
2. Load SerializeAddon (new)
3. Initialize services, registry, state stores (as before)
4. **If snapshot exists**: restore terminal buffer, history, state stores — skip welcome message
5. **If no snapshot**: show welcome message (as before)
6. Show prompt

## Framework Integration

### Shared (in `@qodalis/cli-core`)

`CliEngineSnapshot` interface exported from core so all wrappers can reference it.

### Angular (`@qodalis/angular-cli`)

- `CliComponent`: new `[snapshot]` input, new `(engineReady)` output event
- `CliPanelComponent`: `contextMenuDuplicate()` captures snapshot from source engine, passes to new pane
- `TerminalPane` interface: optional `snapshot` field

### React (`@qodalis/react-cli`)

- `snapshot` prop on CLI component
- `onEngineReady` callback prop

### Vue (`@qodalis/vue-cli`)

- `:snapshot` prop on CLI component
- `engine-ready` emit

## Dependencies

- **New**: `@xterm/addon-serialize` (compatible with existing `@xterm/xterm@^5.5.0`)

## Changes by Package

| Package | Changes |
|---|---|
| `@qodalis/cli-core` | Add `CliEngineSnapshot` interface |
| `@qodalis/cli` | Add `snapshot()`, `restore()` to `CliEngine`. Load SerializeAddon. Modify `start()`. Export snapshot types. |
| `@qodalis/angular-cli` | Add `[snapshot]` input, `(engineReady)` output to `CliComponent`. Update panel duplicate logic. |
| `@qodalis/react-cli` | Add `snapshot` prop, `onEngineReady` callback |
| `@qodalis/vue-cli` | Add `:snapshot` prop, `engine-ready` emit |
| Root `package.json` | Add `@xterm/addon-serialize` |

## Out of Scope

- Persisting snapshots to IndexedDB for session restore (future feature)
- Snapshot compression or size limits
- Snapshot versioning/migration beyond the `version` field
