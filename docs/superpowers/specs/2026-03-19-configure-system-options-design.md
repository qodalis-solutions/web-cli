# Configure Command: Expand System Options

**Date:** 2026-03-19
**Status:** Approved

## Problem

The `configure` command exposes only 3 system options (`logLevel`, `welcomeMessage`, `language`). Common terminal preferences like cursor style, scrollback depth, font size, and clipboard behavior are either hardcoded or scattered across separate commands with no unified configuration surface.

## Design

Add 7 new system configuration options to `SYSTEM_OPTIONS` in `cli-configure-command-processor.ts`. All options apply at boot via `applySystemSettings` and take effect immediately when changed interactively.

### New Options

| Key | Type | Default | Description | Validation |
|---|---|---|---|---|
| `cursorBlink` | boolean | `true` | Whether the terminal cursor blinks | — |
| `cursorStyle` | select | `block` | Cursor shape: block, underline, bar | — |
| `scrollback` | number | `1000` | Scrollback buffer lines | 0–100000 |
| `fontSize` | number | `20` | Font size in pixels | 8–40 |
| `fontFamily` | string | `monospace` | Terminal font family | — |
| `copyOnSelect` | boolean | `false` | Auto-copy selection to clipboard | — |
| `greeting` | boolean | `true` | Show animated time-based greeting | — |

### How Each Option Applies

All terminal options (`cursorBlink`, `cursorStyle`, `scrollback`, `fontSize`, `fontFamily`, `copyOnSelect`) are applied by setting properties on `context.terminal.options` in `applySystemSettings`.

The `greeting` option is read by `welcomeModule.onAfterBoot` from the configure state store, similar to how `welcomeMessage` is already read there.

### Coexistence with font-size Command

The `font-size` command has its own state store (`font-size`) and modifies `terminal.options.fontSize` directly. The new `system.fontSize` configure option uses the configure state store. Both write to the same terminal property. The last one applied wins. This is acceptable — they are two paths to the same setting, and `configure` provides the unified experience.

## Files to Modify

1. **`packages/cli/src/lib/processors/configure/cli-configure-command-processor.ts`**
   - Add 7 entries to `SYSTEM_OPTIONS` array
   - Extend `applySystemSettings` to apply `cursorBlink`, `cursorStyle`, `scrollback`, `fontSize`, `fontFamily`, `copyOnSelect` to `context.terminal.options`
   - `greeting` is persisted in state only (no runtime mutation needed, read at boot by welcome module)

2. **`packages/cli/src/lib/services/cli-welcome-message.ts`**
   - In `welcomeModule.onAfterBoot`, after reading `welcomeMessage`, also read `greeting` from `state.system`
   - If `greeting` is `false`, skip the `textAnimator?.showText(getGreetingBasedOnTime())` call but still show the welcome message and prompt

3. **`packages/cli/src/tests/configure-command-processor.spec.ts`**
   - Add tests verifying new options appear in state defaults
   - Add tests for validators (scrollback range, fontSize range)

## Non-Goals

- No new commands or sub-processors
- No changes to the `theme` command
- No sub-categories within the system menu (not enough options to justify)
