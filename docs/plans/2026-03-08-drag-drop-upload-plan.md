# Drag & Drop File Upload Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to drag OS files onto the CLI terminal; dropped files are written to the current working directory of the virtual (IndexedDB-backed) filesystem.

**Architecture:** A new `ICliDragDropService` abstraction lives in `@qodalis/cli-core`. The default implementation `CliDragDropService` wires `dragover`/`drop` DOM listeners on the terminal container inside `CliEngine` and emits dropped `File[]` via an RxJS Subject. The `filesModule` in `@qodalis/cli-files` subscribes to this service in `onInit` and writes each file to the virtual FS at the current working directory.

**Tech Stack:** TypeScript, RxJS (`Subject`, `Observable`, `Subscription`), xterm.js container DOM, IndexedDB (via existing `IFileSystemService`), Jasmine/Karma tests.

---

## Task 1: Add `ICliDragDropService` interface to `@qodalis/cli-core`

**Files:**
- Create: `packages/core/src/lib/interfaces/drag-drop.ts`
- Modify: `packages/core/src/lib/interfaces/index.ts`

**Step 1: Create the interface file**

```ts
// packages/core/src/lib/interfaces/drag-drop.ts
import { Observable } from 'rxjs';

export const ICliDragDropService_TOKEN = 'cli-drag-drop-service';

export interface ICliDragDropService {
    /** Emits an array of dropped File objects each time files are dropped onto the terminal */
    readonly onFileDrop: Observable<File[]>;
}
```

**Step 2: Export from interfaces barrel**

Open `packages/core/src/lib/interfaces/index.ts`. At the bottom, add:

```ts
export * from './drag-drop';
```

**Step 3: Verify it compiles**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run build:core
```

Expected: build succeeds, no TypeScript errors.

**Step 4: Commit**

```bash
git add packages/core/src/lib/interfaces/drag-drop.ts packages/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add ICliDragDropService abstraction"
```

---

## Task 2: Implement `CliDragDropService` in `@qodalis/cli`

**Files:**
- Create: `packages/cli/src/lib/services/cli-drag-drop.service.ts`
- Modify: `packages/cli/src/lib/services/index.ts`

**Step 1: Write a failing test**

The test file already exists conceptually via the testing infrastructure. Since there is no dedicated unit test file for services in `@qodalis/cli`, check if `packages/cli/src/lib/input/cli-line-buffer.spec.ts` gives a pattern to follow. Create a spec alongside the service:

```ts
// packages/cli/src/lib/services/cli-drag-drop.service.spec.ts
import { CliDragDropService } from './cli-drag-drop.service';

describe('CliDragDropService', () => {
    let container: HTMLElement;
    let service: CliDragDropService;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        service = new CliDragDropService(container);
    });

    afterEach(() => {
        service.destroy();
        document.body.removeChild(container);
    });

    it('should emit dropped files via onFileDrop', (done) => {
        const fakeFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

        service.onFileDrop.subscribe((files) => {
            expect(files.length).toBe(1);
            expect(files[0].name).toBe('test.txt');
            done();
        });

        const dropEvent = new DragEvent('drop', {
            bubbles: true,
            dataTransfer: new DataTransfer(),
        });
        (dropEvent.dataTransfer as DataTransfer).items.add(fakeFile);
        container.dispatchEvent(dropEvent);
    });

    it('should not emit after destroy()', () => {
        let emitted = false;
        service.onFileDrop.subscribe(() => { emitted = true; });
        service.destroy();

        const dropEvent = new DragEvent('drop', { bubbles: true });
        container.dispatchEvent(dropEvent);
        expect(emitted).toBeFalse();
    });
});
```

**Step 2: Run the test to verify it fails**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
npx nx test cli --testFile=packages/cli/src/lib/services/cli-drag-drop.service.spec.ts
```

Expected: FAIL — `CliDragDropService` not found.

**Step 3: Implement `CliDragDropService`**

```ts
// packages/cli/src/lib/services/cli-drag-drop.service.ts
import { Observable, Subject } from 'rxjs';
import { ICliDragDropService } from '@qodalis/cli-core';

export class CliDragDropService implements ICliDragDropService {
    private readonly _subject = new Subject<File[]>();
    private readonly _dragOver: (e: DragEvent) => void;
    private readonly _drop: (e: DragEvent) => void;

    constructor(private readonly _container: HTMLElement) {
        this._dragOver = (e: DragEvent) => e.preventDefault();
        this._drop = (e: DragEvent) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer?.files ?? []);
            if (files.length > 0) {
                this._subject.next(files);
            }
        };

        this._container.addEventListener('dragover', this._dragOver);
        this._container.addEventListener('drop', this._drop);
    }

    get onFileDrop(): Observable<File[]> {
        return this._subject.asObservable();
    }

    destroy(): void {
        this._container.removeEventListener('dragover', this._dragOver);
        this._container.removeEventListener('drop', this._drop);
        this._subject.complete();
    }
}
```

**Step 4: Run tests to verify they pass**

```bash
npx nx test cli --testFile=packages/cli/src/lib/services/cli-drag-drop.service.spec.ts
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: PASS both tests.

**Step 5: Export from services barrel**

Open `packages/cli/src/lib/services/index.ts`. Add at the bottom:

```ts
export { CliDragDropService } from './cli-drag-drop.service';
```

**Step 6: Commit**

```bash
git add packages/cli/src/lib/services/cli-drag-drop.service.ts \
        packages/cli/src/lib/services/cli-drag-drop.service.spec.ts \
        packages/cli/src/lib/services/index.ts
git commit -m "feat(cli): implement CliDragDropService"
```

---

## Task 3: Wire `CliDragDropService` into `CliEngine`

**Files:**
- Modify: `packages/cli/src/lib/engine/cli-engine.ts`

**Step 1: Add a field for the service**

In `CliEngine`, add a private field after the existing listener fields (around line 75):

```ts
private dragDropService?: CliDragDropService;
```

Also add the import at the top:

```ts
import { CliDragDropService } from '../services/cli-drag-drop.service';
import { ICliDragDropService_TOKEN } from '@qodalis/cli-core';
```

**Step 2: Create and register the service in `initializeTerminal()`**

At the end of `initializeTerminal()` (after `this.handleResize()`), add:

```ts
this.dragDropService = new CliDragDropService(this.container);
```

Then in `start()`, after the service container is built (after the `pendingServices` block, around line 184), register the drag-drop service:

```ts
services.set([{
    provide: ICliDragDropService_TOKEN,
    useValue: this.dragDropService,
}]);
```

Note: `initializeTerminal()` is called at step 1 of `start()` (line 139), so `this.dragDropService` is guaranteed to be set before the service registration.

**Step 3: Destroy the service in `destroy()`**

In `CliEngine.destroy()`, before `this.terminal?.dispose()`, add:

```ts
this.dragDropService?.destroy();
```

**Step 4: Build to verify no errors**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run build:cli
```

Expected: build succeeds.

**Step 5: Commit**

```bash
git add packages/cli/src/lib/engine/cli-engine.ts
git commit -m "feat(cli): wire CliDragDropService into CliEngine"
```

---

## Task 4: Integrate drag-drop handling in `filesModule`

**Files:**
- Modify: `packages/plugins/files/src/public-api.ts`

**Step 1: Add a subscription holder**

The `filesModule` object needs to store the RxJS `Subscription` so it can be cleaned up in `onDestroy`. Add a module-level variable after the `fsService` declaration (around line 65):

```ts
import { Subscription } from 'rxjs';

// ...existing fsService declaration...
let _dragDropSubscription: Subscription | undefined;
```

**Step 2: Subscribe in `onInit`**

Inside `filesModule.onInit(context)`, after the existing prompt provider block, add:

```ts
let dragDrop: ICliDragDropService | undefined;
try {
    dragDrop = context.services.get<ICliDragDropService>(ICliDragDropService_TOKEN);
} catch {
    // service not registered (e.g. test environment) — skip
}

if (dragDrop) {
    _dragDropSubscription = dragDrop.onFileDrop.subscribe((files) => {
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = async () => {
                const content = reader.result as string;
                const dest = fs.resolvePath(
                    fs.getCurrentDirectory() + '/' + file.name,
                );
                await fs.writeFile(dest, content);
                await fs.persist();
                context.writer.writeSuccess(
                    `Uploaded: ${file.name} (${file.size} bytes) → ${dest}`,
                );
            };
            reader.onerror = () => {
                context.writer.writeError(`Failed to read dropped file: ${file.name}`);
            };
            reader.readAsText(file);
        });
    });
}
```

Add the necessary imports at the top of `public-api.ts`:

```ts
import { ICliDragDropService, ICliDragDropService_TOKEN } from '@qodalis/cli-core';
import { Subscription } from 'rxjs';
```

**Step 3: Unsubscribe in `onDestroy`**

Add `onDestroy` to the `filesModule` object (after the `onInit` method):

```ts
async onDestroy(_context: ICliExecutionContext): Promise<void> {
    _dragDropSubscription?.unsubscribe();
    _dragDropSubscription = undefined;
},
```

**Step 4: Build the files plugin**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run build:core && pnpm run build:cli
npx nx build files
```

Expected: all three build successfully.

**Step 5: Run the files plugin tests**

```bash
npx nx test files
pkill -f "karma|ChromeHeadless" 2>/dev/null || true
```

Expected: all existing tests pass (no regressions).

**Step 6: Commit**

```bash
git add packages/plugins/files/src/public-api.ts
git commit -m "feat(files): subscribe to ICliDragDropService for drag-drop uploads"
```

---

## Task 5: End-to-end smoke test in the Angular demo

**No code changes required** — the Angular demo (`apps/demo-angular`) already imports `filesModule`. This task is manual verification only.

**Step 1: Serve the Angular demo**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
pnpm run serve:angular-demo
```

**Step 2: Open the browser**

Navigate to `http://localhost:4303`.

**Step 3: Test drag-and-drop**

1. Create a plain text file on your desktop (e.g. `hello.txt` with content `hello world`)
2. Drag it onto the terminal area
3. In the terminal, run: `ls` — the file should appear in the current directory
4. Run: `cat hello.txt` — should output `hello world`

**Step 4: Kill the server**

```bash
pkill -f "ng serve" 2>/dev/null || true
```

---

## Summary of Files Changed

| Package | File | Change |
|---|---|---|
| `@qodalis/cli-core` | `packages/core/src/lib/interfaces/drag-drop.ts` | **Create** — interface + token |
| `@qodalis/cli-core` | `packages/core/src/lib/interfaces/index.ts` | **Modify** — add export |
| `@qodalis/cli` | `packages/cli/src/lib/services/cli-drag-drop.service.ts` | **Create** — implementation |
| `@qodalis/cli` | `packages/cli/src/lib/services/cli-drag-drop.service.spec.ts` | **Create** — tests |
| `@qodalis/cli` | `packages/cli/src/lib/services/index.ts` | **Modify** — add export |
| `@qodalis/cli` | `packages/cli/src/lib/engine/cli-engine.ts` | **Modify** — wire service |
| `@qodalis/cli-files` | `packages/plugins/files/src/public-api.ts` | **Modify** — onInit/onDestroy |
