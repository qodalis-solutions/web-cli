# `htop` Command Design Spec

## Goal

Full-screen, live-updating interactive process and service monitor for the Qodalis web CLI. Combines data from the process registry and background service registry into a unified view with keyboard-driven actions.

## Architecture

A single `ICliCommandProcessor` in the `cli` package (not a plugin), registered alongside existing system commands (`ps`, `kill`, `services`). Uses the established full-screen mode pattern:

1. `enterFullScreenMode(this)` — take over the terminal
2. `onData()` — handle all keyboard input
3. `createInterval()` — 1-second refresh loop
4. ANSI escape code rendering to `context.terminal.write()`
5. `exitFullScreenMode()` on quit

## Data Sources

**Process registry** (`ICliProcessRegistry` via `CliProcessRegistry_TOKEN`):
- Accessed via `context.services.get<ICliProcessRegistry>(CliProcessRegistry_TOKEN)` with try/catch (follows `ps`/`kill` pattern)
- `list()` returns `ICliProcessEntry[]` with: `pid`, `name`, `type` (`command`|`daemon`|`job`|`service`), `command`, `startTime`, `status` (`running`|`completed`|`failed`|`killed`), `exitCode`

**Background service registry** (`context.backgroundServices`):
- `list()` returns `ICliBackgroundServiceInfo[]` with: `pid`, `name`, `type` (`daemon`|`job`), `status` (`pending`|`running`|`stopped`|`failed`|`done`), `executionMode`, `startedAt`, `uptime`, `error`
- `getLogs(name, limit)` returns `ICliServiceLogEntry[]`

### Data Merging

Background services that have a PID also appear in the process registry. To avoid duplicates:

1. Read process registry entries into a map keyed by PID
2. Read background service entries
3. For each service with a `pid`, remove the matching process registry entry from the map
4. Build the unified list: all remaining process entries + all service entries
5. Each unified row tracks its `source` (`'process'` or `'service'`) and the original entry, so actions can dispatch to the correct registry

### Unified Status Type

The display handles the union of both status sets: `running`, `completed`, `done`, `pending`, `stopped`, `failed`, `killed`. These are rendered as-is from the source data.

## Display

### Layout

```
 htop — 3 running / 5 total                          Refresh: 1s
─────────────────────────────────────────────────────────────────
 PID  NAME              TYPE     STATUS       TIME
> 5   htop              command  running        0s
  3   uptime-tracker    daemon   running    12m 30s
  4   backup-job        job      done           8s
  2   curl              command  completed      3s
  1   help              command  completed      0s



─────────────────────────────────────────────────────────────────
 k:Kill  s:Start  t:Stop  r:Restart  l:Logs  q:Quit  ↑↓:Navigate
```

### Columns

| Column | Source | Description |
|--------|--------|-------------|
| PID | `pid` field | Numeric PID |
| NAME | `name` field | Truncated with ellipsis if exceeds column width |
| TYPE | `type` field | `command`, `daemon`, `job`, `service` |
| STATUS | `status` field | Color-coded (see below) |
| TIME | Computed | Elapsed since start |

**Column widths:** PID (5), NAME (dynamic — fills remaining space, min 10), TYPE (8), STATUS (10), TIME (8). NAME is truncated with `…` if it exceeds the available width.

### TIME Column Computation

- **Process entries:** `Date.now() - startTime` (startTime is epoch ms)
- **Running services:** `Date.now() - startedAt.getTime()` (startedAt is a Date)
- **Stopped/done/failed services:** show `-` (no elapsed time for terminated services)

### Sort Order

1. Running processes first
2. Then by PID descending (newest first)

### Status Colors

| Status | Color |
|--------|-------|
| running | Green |
| completed | Cyan |
| done | Cyan |
| pending | Yellow |
| stopped | White |
| failed | Red |
| killed | Red |

### Cursor

- Highlighted row (inverse/background color) showing `>` prefix
- Arrow Up/Down to navigate
- Wraps around at top/bottom

### Header

- Title: `htop`
- Running count: `N running / M total`
- Refresh indicator: `Refresh: 1s`

### Footer

- Context-sensitive keybindings based on selected row's source and status
- Only shows applicable actions (e.g., `l:Logs` only for service rows, `s:Start` only for stopped services)
- Gray/dim color

### Scrolling

- Maintain a `scrollOffset` integer
- Visible rows = `terminalRows - 4` (header line + separator + footer separator + footer)
- When cursor moves below visible area: `scrollOffset = selectedIndex - visibleRows + 1`
- When cursor moves above visible area: `scrollOffset = selectedIndex`
- Scroll indicator: show `↑` / `↓` arrows at top/bottom of list when content extends beyond viewport

## Keyboard Actions

| Key | Action | Condition |
|-----|--------|-----------|
| `↑` | Move selection up | Always |
| `↓` | Move selection down | Always |
| `k` | Kill selected process/service | Selected is running |
| `s` | Start selected service | Selected is a service with status stopped/pending/failed |
| `t` | Stop selected service | Selected is a running service |
| `r` | Restart selected service | Selected is a service (daemon or job) |
| `l` | Show logs overlay | Selected is a service |
| `q` / `Esc` | Quit htop | Always |

Arrow keys only for navigation (no vim bindings — `k` is kill).

Actions that don't apply to the selected row are silently ignored.

## Logs Overlay

When pressing `l` on a service row:

```
┌─ Logs: uptime-tracker ──────────────────────────┐
│ [12:00:01] INF Uptime tracking started           │
│ [12:45:30] INF Health check passed               │
│                                                   │
│                                                   │
│              Press any key to close               │
└──────────────────────────────────────────────────┘
```

- Shows last 15 log entries via `context.backgroundServices.getLogs(name, 15)`
- Centered overlay box with border characters
- Press any key to dismiss and return to main view
- If no logs, show "No log entries"

## Error Handling

- **Failed actions** (kill/start/stop/restart throws): Show a temporary error message in the header area (replacing the running count) for 3 seconds, then auto-clear on next refresh
- **Process registry unavailable:** Show error message and exit full-screen mode (same pattern as `ps` command)

## Refresh Loop

- 1-second interval via `context.createInterval()`
- Each tick: read process registry + service registry, merge (deduplicate by PID), sort, redraw
- Auto-cleaned on `exitFullScreenMode()`

## Resize Handling

- `onResize(cols, rows)` — recalculate visible rows and column widths, redraw
- Clamp `scrollOffset` and `selectedIndex` to new bounds

## File Location

- **Processor:** `packages/cli/src/lib/processors/system/cli-htop-command-processor.ts`
- **Registration:** Added to the existing system processor list in the CLI engine

## Metadata

```typescript
command = 'htop';
description = 'Interactive process and service monitor';
metadata = { icon: '📊', sealed: true, module: 'system' };
```

## Help Output

```typescript
writeDescription(context: ICliExecutionContext): void {
    writer.writeln('Interactive process and service monitor');
    writer.writeln();
    writer.writeln('Usage:');
    writer.writeln('  htop');
}
```

## Edge Cases

- **Empty list:** Show "No processes" centered message
- **Selected row disappears:** If the selected process completes between refreshes, clamp selection index to `Math.min(selectedIndex, list.length - 1)`
- **Kill self:** The htop command itself appears in the process list — killing it should exit gracefully (same as pressing `q`)
- **Action on wrong type:** Silently ignored — footer only shows applicable actions
- **Very long names:** Truncated with `…` to fit column width
