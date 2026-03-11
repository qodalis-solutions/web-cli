# Engine API Gaps Discovered Building the Snake Game Plugin

**Date:** 2026-03-01
**Context:** Built `@qodalis/cli-snake` — the first plugin to use full-screen mode, `onData` raw input, and real-time rendering. These are the gaps encountered.

**Status:** Gaps 1-3 (High severity) have been **fixed** in this same changeset. Gaps 4-8 remain open.

---

## Gap 1: No `onResize` Hook in Processor Interface

**Severity:** High
**Where it hurts:** The game computes grid dimensions from `terminal.cols`/`terminal.rows` once at startup. If the user resizes their browser window during gameplay, the grid doesn't adapt and rendering breaks.

**Current workaround:** Ignore resizes. The game uses whatever size was available at launch.

**Suggested API:**
```typescript
interface ICliCommandProcessor {
    // ... existing methods ...

    /**
     * Called when the terminal is resized while this processor
     * is the active full-screen context processor.
     */
    onResize?(cols: number, rows: number, context: ICliExecutionContext): void;
}
```

The engine should subscribe to `terminal.onResize` when in full-screen mode and forward the event to the active processor.

---

## Gap 2: No Engine-Managed Timer / Game Loop API

**Severity:** High
**Where it hurts:** The game uses raw `setInterval` for the game loop. The engine has no awareness of these timers, so:
- If the user closes the tab, the interval keeps firing with no cleanup
- If `exitFullScreenMode()` is called externally (e.g., by another command), the timer is orphaned
- There's no way to auto-pause timers when the terminal loses focus

**Current workaround:** Manually manage `setInterval`/`clearInterval` and hope nothing interrupts us.

**Suggested API:**
```typescript
interface ICliExecutionContext {
    // ... existing methods ...

    /**
     * Creates a managed interval that is automatically cleared
     * when full-screen mode exits or the processor is disposed.
     */
    createInterval(callback: () => void, ms: number): { clear(): void; setDelay(ms: number): void };

    /**
     * Creates a managed timeout.
     */
    createTimeout(callback: () => void, ms: number): { clear(): void };
}
```

---

## Gap 3: No Lifecycle Cleanup Hook (`onDispose` / `onExitFullScreen`)

**Severity:** High
**Where it hurts:** When the user closes the browser tab, navigates away, or the terminal disconnects during full-screen mode, there is no way for the processor to clean up resources (timers, subscriptions, WebSocket connections, etc.).

**Current workaround:** None. Resources leak.

**Suggested API:**
```typescript
interface ICliCommandProcessor {
    // ... existing methods ...

    /**
     * Called when the processor is being disposed — either because
     * full-screen mode ended, the terminal disconnected, or the
     * CLI component is being destroyed.
     */
    onDispose?(context: ICliExecutionContext): void;
}
```

The engine should call this on:
- `exitFullScreenMode()`
- Angular `OnDestroy` lifecycle
- Terminal disconnect / browser close (via `beforeunload`)

---

## Gap 4: No Screen Buffer / Double-Buffering Abstraction

**Severity:** Medium
**Where it hurts:** The game builds an entire frame as a concatenated string of ANSI escape sequences and writes it all at once. There's no incremental update API — every frame is a full redraw. For a simple Snake game this is fine, but for more complex applications (text editors, dashboards), it would cause visible flicker.

**Current workaround:** Build the entire frame in a string array, then `terminal.write(buf.join(''))` for a single write call.

**Suggested API:**
```typescript
interface ICliScreenBuffer {
    /** Terminal dimensions */
    readonly cols: number;
    readonly rows: number;

    /** Set a character with optional styling at (row, col) */
    set(row: number, col: number, char: string, style?: CellStyle): void;

    /** Fill a rectangular region */
    fill(row: number, col: number, width: number, height: number, char: string, style?: CellStyle): void;

    /** Write a string starting at (row, col) */
    writeAt(row: number, col: number, text: string, style?: CellStyle): void;

    /** Compute the diff from the previous frame and write only changes */
    flush(): void;

    /** Clear the entire buffer */
    clear(): void;
}

interface ICliExecutionContext {
    /**
     * Creates a screen buffer for efficient full-screen rendering.
     * The buffer tracks changes and only writes diffs on flush().
     */
    createScreenBuffer(): ICliScreenBuffer;
}
```

---

## Gap 5: No Terminal Write Batching / Transaction API

**Severity:** Low
**Where it hurts:** Related to Gap 4. When writing many ANSI sequences, there's no guarantee they'll be rendered atomically. On slow connections or under heavy load, partial frames could be visible.

**Current workaround:** Concatenate everything into one string before writing.

**Suggested API:**
```typescript
interface Terminal {
    beginBatch(): void;   // Buffer all writes
    endBatch(): void;     // Flush buffered writes atomically
}
```

Note: xterm.js may already buffer writes internally, making this less critical. But having an explicit API would make intent clear.

---

## Gap 6: No Key-Down/Key-Up Events or Key Repeat Control

**Severity:** Medium
**Where it hurts:** `onData` provides raw terminal data strings, which conflate key-down, key-up, and key-repeat into a single stream. The game can't distinguish between:
- A single key press (change direction once)
- A held key (continuous key-repeat)

This means rapid key-repeat from holding an arrow key queues up many direction changes, causing the snake to turn erratically.

**Current workaround:** Only allow direction changes that don't reverse (can't go from Right to Left), which mitigates but doesn't solve the issue.

**Suggested API:**
```typescript
interface ICliKeyEvent {
    key: string;            // Normalized key name: 'ArrowUp', 'a', 'Enter', etc.
    code: string;           // Physical key code
    type: 'keydown' | 'keyup' | 'keypress';
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    repeat: boolean;        // True if this is a key-repeat event
}

interface ICliCommandProcessor {
    /**
     * Structured key event handler (alternative to raw onData).
     * When implemented, the engine parses raw terminal data into
     * structured events before forwarding.
     */
    onKeyEvent?(event: ICliKeyEvent, context: ICliExecutionContext): Promise<void>;
}
```

---

## Gap 7: No Sound / Audio Feedback API

**Severity:** Low
**Where it hurts:** Can't play a sound when the snake eats food or dies. Terminal bell (`\x07`) exists but is often disabled and limited to a single tone.

**Current workaround:** No audio feedback. Visual-only game.

**Suggested API:**
```typescript
interface ICliAudio {
    /** Play the terminal bell */
    bell(): void;

    /** Play a short sound effect */
    play(sound: 'success' | 'error' | 'notification' | 'eat' | 'die'): void;

    /** Play a frequency for a duration (Web Audio API) */
    tone(frequency: number, durationMs: number): void;
}

interface ICliExecutionContext {
    audio: ICliAudio;
}
```

---

## Gap 8: No Focus/Blur Events for the Terminal

**Severity:** Low
**Where it hurts:** Can't auto-pause the game when the user switches tabs or clicks outside the terminal. The game loop keeps running and the snake keeps moving while the user isn't looking.

**Current workaround:** Manual pause with Space bar.

**Suggested API:**
```typescript
interface ICliCommandProcessor {
    onFocus?(context: ICliExecutionContext): void;
    onBlur?(context: ICliExecutionContext): void;
}
```

---

## Summary Table

| # | Gap | Severity | Category | Status |
|---|-----|----------|----------|--------|
| 1 | No `onResize` hook | High | Processor Lifecycle | **FIXED** |
| 2 | No managed timer API | High | Resource Management | **FIXED** |
| 3 | No `onDispose` cleanup hook | High | Processor Lifecycle | **FIXED** |
| 4 | No screen buffer abstraction | Medium | Rendering | Open |
| 5 | No write batching | Low | Rendering | Open |
| 6 | No structured key events | Medium | Input | Open |
| 7 | No audio API | Low | Multimedia | Open |
| 8 | No focus/blur events | Low | Terminal Events | Open |

### Priority Recommendation

**Phase 1 (Critical for any full-screen plugin):** Gaps 1, 2, 3
**Phase 2 (Quality of life for interactive apps):** Gaps 4, 6
**Phase 3 (Nice to have):** Gaps 5, 7, 8
