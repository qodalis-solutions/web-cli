# Nano-Style Terminal Editor — Design

## Goal

Add a built-in `nano` command to the CLI that provides a full-screen text editor in xterm.js, with optional file I/O via the virtual filesystem.

## Architecture

A `CliNanoCommandProcessor` in the `cli` package uses `setContextProcessor()` to take over terminal input. It maintains an in-memory text buffer and renders using xterm.js escape codes. File I/O is optional — if the files plugin is loaded, `nano file.txt` reads/writes via `IFileSystemService`. Without the files plugin, it works as a scratch editor.

## Command

- **Name:** `nano`
- **Alias:** `edit`
- **Module:** `system`
- **Usage:** `nano [file]` — opens file for editing, or empty scratch buffer if no file given

## Screen Layout

```
┌─────────────────────────────────┐
│ CLI Nano 1.0  file.txt          │  ← Title bar (inverted colors)
│                                 │
│ Hello world                     │  ← Editable content area
│ This is line 2                  │
│ |                               │  ← Cursor
│                                 │
│                                 │
│ ^S Save  ^Q Quit  ^K Cut Line  │  ← Status bar (inverted colors)
└─────────────────────────────────┘
```

- **Title bar:** inverted colors, shows editor name + filename (or "New Buffer")
- **Content area:** editable text, occupies terminal height minus 2 rows
- **Status bar:** inverted colors, shows available hotkeys

## Input Handling

| Key | Action |
|-----|--------|
| Arrow keys | Move cursor |
| Home / End | Jump to line start / end |
| Printable chars | Insert at cursor |
| Backspace | Delete char before cursor |
| Delete | Delete char at cursor |
| Enter | Insert newline |
| Ctrl+S | Save file (prompt for name if none) |
| Ctrl+Q | Quit (prompt if unsaved changes) |
| Ctrl+K | Cut current line |

## Components

### CliNanoCommandProcessor

Command processor in `projects/cli/src/lib/processors/system/`. Manages lifecycle:
1. On `processCommand`: enter alternate screen buffer, initialize editor state, render
2. Intercepts all input via context processor pattern
3. On quit: leave alternate screen buffer, restore normal CLI

### NanoEditorBuffer

Text buffer model (`projects/cli/src/lib/editor/nano-editor-buffer.ts`):
- `lines: string[]` — text content as array of lines
- `cursorRow`, `cursorCol` — cursor position
- `dirty: boolean` — tracks unsaved changes
- `scrollOffset` — viewport scroll position
- Methods: `insertChar`, `deleteChar`, `insertNewline`, `deleteLine`, `moveCursor`

### NanoEditorRenderer

Renders buffer to terminal (`projects/cli/src/lib/editor/nano-editor-renderer.ts`):
- Uses alternate screen buffer (`\x1b[?1049h` / `\x1b[?1049l`)
- Renders title bar, content area, status bar
- Handles viewport scrolling (only renders visible lines)
- Redraws on every keystroke (full redraw is fast for terminal text)

## File Integration

- Uses `context.services.get(IFileSystemService_TOKEN)` with try/catch
- If files plugin loaded: read file on open, write file on save, call `persist()`
- If files plugin not loaded: scratch-only mode, Ctrl+S shows "No filesystem available"
- On Ctrl+S with no file path: prompt for filename using status bar input

## Terminal Considerations

- Uses **alternate screen buffer** to preserve terminal scroll history
- Cursor visibility managed via `\x1b[?25h` (show) and `\x1b[?25l` (hide)
- Content area height = `terminal.rows - 2` (title + status bars)
- Handles terminal resize via `terminal.onResize` — re-render on resize
