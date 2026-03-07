# Drag & Drop File Upload Design

**Date:** 2026-03-08
**Feature:** Drag-and-drop to upload files into the virtual filesystem
**Scope:** `@qodalis/cli-core`, `@qodalis/cli`, `@qodalis/cli-files`

---

## Goal

Allow users to drag files from the OS into the CLI terminal area. Dropped files are written to the current working directory in the virtual (IndexedDB-backed) filesystem.

---

## Architecture

### ICliDragDropService (core abstraction)

**File:** `packages/core/src/lib/interfaces/drag-drop.ts`

```ts
import { Observable } from 'rxjs';

export const ICliDragDropService_TOKEN = 'cli-drag-drop-service';

export interface ICliDragDropService {
    readonly onFileDrop: Observable<File[]>;
}
```

Exported from `packages/core/src/lib/interfaces/index.ts` and the core public API.

---

### CliDragDropService (default implementation)

**File:** `packages/cli/src/lib/services/cli-drag-drop.service.ts`

- Constructor accepts the terminal container `HTMLElement`
- Attaches `dragover` listener: calls `event.preventDefault()` to allow drop
- Attaches `drop` listener: extracts `event.dataTransfer.files`, emits via a `Subject<File[]>`
- `onFileDrop` returns `subject.asObservable()`
- `destroy()` removes both DOM event listeners

**Wired in `CliEngine`:**

- Created in `initializeTerminal()` after `this.container` is available
- Registered into the service container: `{ provide: ICliDragDropService_TOKEN, useValue: dragDropService }`
- `destroy()` called in `CliEngine.destroy()`

---

### filesModule integration

**File:** `packages/plugins/files/src/public-api.ts`

In `onInit(context)`:
1. Resolve `ICliDragDropService` from `context.services` (gracefully skip if not present)
2. Subscribe to `onFileDrop`
3. For each `File` in the drop event:
   - Read content via `FileReader.readAsText()`
   - Write to `fs.resolvePath(fs.getCurrentDirectory() + '/' + file.name)`
   - Call `fs.persist()`
   - Print: `context.writer.writeSuccess('Uploaded: <name> (<size> bytes)')`
4. Store the `Subscription` on the module for cleanup

In `onDestroy(context)`:
- Unsubscribe from the stored subscription

---

## Data Flow

```
User drops file(s) onto terminal
  → CliDragDropService DOM 'drop' handler
  → subject.next(files)
  → filesModule subscription
  → FileReader.readAsText()
  → IFileSystemService.writeFile(cwd/name, content)
  → fs.persist()
  → context.writer.writeSuccess(...)
```

---

## Non-goals

- No visual drag-over overlay (can be added later)
- No binary file support (text only, matching existing `uploadFromBrowser`)
- No destination path prompt (always writes to current working directory)
