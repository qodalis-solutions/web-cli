# `@qodalis/cli-files` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new plugin library that simulates Linux file management commands with an in-memory filesystem persisted to IndexedDB.

**Architecture:** Multi-processor module registers 12 top-level command processors (ls, cd, pwd, mkdir, rmdir, touch, cat, echo, rm, cp, mv, tree). A shared `IFileSystemService` abstraction backed by `IndexedDbFileSystemService` manages the filesystem tree. All processors retrieve the service via `context.services.get()`.

**Tech Stack:** Angular 16, TypeScript, IndexedDB, xterm.js (via `@qodalis/cli-core`)

---

### Task 1: Scaffold project structure and config files

**Files:**
- Create: `projects/files/package.json`
- Create: `projects/files/ng-package.json`
- Create: `projects/files/rollup.config.mjs`
- Create: `projects/files/tsconfig.lib.json`
- Create: `projects/files/tsconfig.lib.prod.json`
- Create: `projects/files/tsconfig.spec.json`
- Create: `projects/files/tsconfig.browser.json`
- Create: `projects/files/src/lib/version.ts`
- Modify: `angular.json` — add `"files"` project entry
- Modify: `tsconfig.json` — add `"@qodalis/cli-files": ["dist/files"]` path alias

**Step 1: Create `projects/files/package.json`**

```json
{
  "name": "@qodalis/cli-files",
  "version": "2.0.1",
  "description": "@qodalis/cli extension for Linux file management commands with in-memory filesystem.",
  "author": "Nicolae Lupei, Qodalis Solutions",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/qodalis-solutions/angular-web-cli"
  },
  "homepage": "https://qodalis.com",
  "keywords": [
    "cli",
    "qodalis",
    "terminal",
    "filesystem",
    "files",
    "linux",
    "ls",
    "cd",
    "mkdir"
  ],
  "umd": "./umd/index.js",
  "unpkg": "./umd/index.js",
  "dependencies": {
    "tslib": "^2.3.0",
    "@qodalis/cli-core": "^2.0.1"
  },
  "sideEffects": false,
  "scripts": {
    "rollup-compile": "npx rollup -c"
  }
}
```

**Step 2: Create `projects/files/ng-package.json`**

```json
{
  "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../dist/files",
  "lib": {
    "entryFile": "src/public-api.ts"
  },
  "allowedNonPeerDependencies": ["@qodalis/cli-core"]
}
```

**Step 3: Create `projects/files/rollup.config.mjs`**

```javascript
import { baseConfig, buildLibraryOutputConfig } from "../../rollup.shared.mjs";

export default {
  ...baseConfig,
  input: "src/cli-entrypoint.ts",
  output: {
    ...buildLibraryOutputConfig("files"),
  },
};
```

**Step 4: Create `projects/files/tsconfig.lib.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/lib",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": []
  },
  "exclude": ["**/*.spec.ts"]
}
```

**Step 5: Create `projects/files/tsconfig.lib.prod.json`**

```json
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declarationMap": false
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  }
}
```

**Step 6: Create `projects/files/tsconfig.spec.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/spec",
    "types": [
      "jasmine"
    ]
  },
  "include": [
    "**/*.spec.ts",
    "**/*.d.ts"
  ]
}
```

**Step 7: Create `projects/files/tsconfig.browser.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "umd",
    "target": "es5",
    "outDir": "../../dist/files",
    "lib": ["dom", "es5"],
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "files": ["src/cli-entrypoint.ts"]
}
```

**Step 8: Create `projects/files/src/lib/version.ts`**

```typescript

// Automatically generated during build
export const LIBRARY_VERSION = '2.0.1';

```

**Step 9: Add `"files"` project to `angular.json`**

Add inside the `"projects"` object (after the last existing project entry):

```json
"files": {
  "projectType": "library",
  "root": "projects/files",
  "sourceRoot": "projects/files/src",
  "prefix": "lib",
  "architect": {
    "build": {
      "builder": "@angular-devkit/build-angular:ng-packagr",
      "options": {
        "project": "projects/files/ng-package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "projects/files/tsconfig.lib.prod.json"
        },
        "development": {
          "tsConfig": "projects/files/tsconfig.lib.json"
        }
      },
      "defaultConfiguration": "production"
    },
    "test": {
      "builder": "@angular-devkit/build-angular:karma",
      "options": {
        "tsConfig": "projects/files/tsconfig.spec.json",
        "polyfills": ["zone.js", "zone.js/testing"]
      }
    }
  }
}
```

**Step 10: Add path alias to root `tsconfig.json`**

In `compilerOptions.paths`, add:

```json
"@qodalis/cli-files": ["dist/files"]
```

**Step 11: Commit**

```bash
git add projects/files/package.json projects/files/ng-package.json projects/files/rollup.config.mjs projects/files/tsconfig.lib.json projects/files/tsconfig.lib.prod.json projects/files/tsconfig.spec.json projects/files/tsconfig.browser.json projects/files/src/lib/version.ts angular.json tsconfig.json
git commit -m "feat(files): scaffold @qodalis/cli-files plugin project structure"
```

---

### Task 2: Create interfaces (IFileNode, IFileSystemService)

**Files:**
- Create: `projects/files/src/lib/interfaces/i-file-node.ts`
- Create: `projects/files/src/lib/interfaces/i-file-system-service.ts`
- Create: `projects/files/src/lib/interfaces/index.ts`

**Step 1: Create `projects/files/src/lib/interfaces/i-file-node.ts`**

```typescript
/**
 * Represents a node in the virtual filesystem (file or directory).
 */
export interface IFileNode {
    /** Name of the file or directory */
    name: string;

    /** Node type */
    type: 'file' | 'directory';

    /** File content (text only, undefined for directories) */
    content?: string;

    /** Child nodes (only for directories) */
    children?: IFileNode[];

    /** Creation timestamp (ms since epoch) */
    createdAt: number;

    /** Last modification timestamp (ms since epoch) */
    modifiedAt: number;

    /** Size in bytes (content length for files, 0 for directories) */
    size: number;

    /** Unix-style permission string (display only, e.g. "rwxr-xr-x") */
    permissions?: string;
}
```

**Step 2: Create `projects/files/src/lib/interfaces/i-file-system-service.ts`**

```typescript
import { IFileNode } from './i-file-node';

export const IFileSystemService_TOKEN = 'cli-file-system-service';

/**
 * Abstraction for virtual filesystem operations.
 */
export interface IFileSystemService {
    // Navigation
    getCurrentDirectory(): string;
    setCurrentDirectory(path: string): void;
    resolvePath(path: string): string;

    // Read operations
    getNode(path: string): IFileNode | null;
    listDirectory(path: string): IFileNode[];
    readFile(path: string): string | null;
    exists(path: string): boolean;
    isDirectory(path: string): boolean;

    // Write operations
    createDirectory(path: string, recursive?: boolean): void;
    createFile(path: string, content?: string): void;
    writeFile(path: string, content: string, append?: boolean): void;
    remove(path: string, recursive?: boolean): void;
    copy(src: string, dest: string, recursive?: boolean): void;
    move(src: string, dest: string): void;

    // Persistence
    initialize(): Promise<void>;
    persist(): Promise<void>;
}
```

**Step 3: Create `projects/files/src/lib/interfaces/index.ts`**

```typescript
export * from './i-file-node';
export * from './i-file-system-service';
```

**Step 4: Commit**

```bash
git add projects/files/src/lib/interfaces/
git commit -m "feat(files): add IFileNode and IFileSystemService interfaces"
```

---

### Task 3: Implement IndexedDbFileSystemService

**Files:**
- Create: `projects/files/src/lib/services/indexed-db-file-system.service.ts`
- Create: `projects/files/src/lib/services/index.ts`

**Step 1: Create `projects/files/src/lib/services/indexed-db-file-system.service.ts`**

```typescript
import { IFileNode } from '../interfaces/i-file-node';
import { IFileSystemService } from '../interfaces/i-file-system-service';

const DB_NAME = 'qodalis-cli-filesystem';
const STORE_NAME = 'filesystem';
const ROOT_KEY = 'root';
const CWD_KEY = 'cwd';
const DEFAULT_CWD = '/home/user';

function createSeedFileSystem(): IFileNode {
    const now = Date.now();
    return {
        name: '',
        type: 'directory',
        children: [
            {
                name: 'home',
                type: 'directory',
                children: [
                    {
                        name: 'user',
                        type: 'directory',
                        children: [
                            {
                                name: 'welcome.txt',
                                type: 'file',
                                content: 'Welcome to Qodalis CLI filesystem!\n',
                                createdAt: now,
                                modifiedAt: now,
                                size: 36,
                                permissions: 'rw-r--r--',
                            },
                        ],
                        createdAt: now,
                        modifiedAt: now,
                        size: 0,
                        permissions: 'rwxr-xr-x',
                    },
                ],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
            },
            {
                name: 'tmp',
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxrwxrwx',
            },
            {
                name: 'etc',
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
            },
        ],
        createdAt: now,
        modifiedAt: now,
        size: 0,
        permissions: 'rwxr-xr-x',
    };
}

export class IndexedDbFileSystemService implements IFileSystemService {
    private root: IFileNode = createSeedFileSystem();
    private cwd: string = DEFAULT_CWD;

    // --- Navigation ---

    getCurrentDirectory(): string {
        return this.cwd;
    }

    setCurrentDirectory(path: string): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);
        if (!node) {
            throw new Error(`cd: ${path}: No such file or directory`);
        }
        if (node.type !== 'directory') {
            throw new Error(`cd: ${path}: Not a directory`);
        }
        this.cwd = resolved;
    }

    resolvePath(path: string): string {
        if (path === '~' || path === '') {
            return DEFAULT_CWD;
        }
        if (path.startsWith('~/')) {
            path = DEFAULT_CWD + path.substring(1);
        }

        // Absolute or relative
        const parts = path.startsWith('/')
            ? path.split('/')
            : (this.cwd + '/' + path).split('/');

        const resolved: string[] = [];
        for (const part of parts) {
            if (part === '' || part === '.') {
                continue;
            } else if (part === '..') {
                resolved.pop();
            } else {
                resolved.push(part);
            }
        }

        return '/' + resolved.join('/');
    }

    // --- Read operations ---

    getNode(path: string): IFileNode | null {
        const resolved = path === '/' ? '/' : this.resolvePath(path);
        if (resolved === '/') {
            return this.root;
        }

        const parts = resolved.split('/').filter(Boolean);
        let current = this.root;

        for (const part of parts) {
            if (current.type !== 'directory' || !current.children) {
                return null;
            }
            const child = current.children.find((c) => c.name === part);
            if (!child) {
                return null;
            }
            current = child;
        }

        return current;
    }

    listDirectory(path: string): IFileNode[] {
        const node = this.getNode(path);
        if (!node) {
            throw new Error(`ls: ${path}: No such file or directory`);
        }
        if (node.type !== 'directory') {
            throw new Error(`ls: ${path}: Not a directory`);
        }
        return node.children || [];
    }

    readFile(path: string): string | null {
        const node = this.getNode(path);
        if (!node) {
            throw new Error(`cat: ${path}: No such file or directory`);
        }
        if (node.type === 'directory') {
            throw new Error(`cat: ${path}: Is a directory`);
        }
        return node.content ?? '';
    }

    exists(path: string): boolean {
        return this.getNode(path) !== null;
    }

    isDirectory(path: string): boolean {
        const node = this.getNode(path);
        return node !== null && node.type === 'directory';
    }

    // --- Write operations ---

    createDirectory(path: string, recursive = false): void {
        const resolved = this.resolvePath(path);
        const parts = resolved.split('/').filter(Boolean);

        if (parts.length === 0) {
            throw new Error(`mkdir: cannot create directory '/': File exists`);
        }

        if (recursive) {
            let current = this.root;
            for (const part of parts) {
                if (!current.children) {
                    current.children = [];
                }
                let child = current.children.find((c) => c.name === part);
                if (!child) {
                    const now = Date.now();
                    child = {
                        name: part,
                        type: 'directory',
                        children: [],
                        createdAt: now,
                        modifiedAt: now,
                        size: 0,
                        permissions: 'rwxr-xr-x',
                    };
                    current.children.push(child);
                    current.modifiedAt = now;
                } else if (child.type !== 'directory') {
                    throw new Error(`mkdir: ${part}: Not a directory`);
                }
                current = child;
            }
        } else {
            const parentPath = '/' + parts.slice(0, -1).join('/');
            const dirName = parts[parts.length - 1];
            const parent = this.getNode(parentPath);

            if (!parent) {
                throw new Error(
                    `mkdir: ${parentPath}: No such file or directory`,
                );
            }
            if (parent.type !== 'directory') {
                throw new Error(`mkdir: ${parentPath}: Not a directory`);
            }
            if (parent.children?.find((c) => c.name === dirName)) {
                throw new Error(`mkdir: ${path}: File exists`);
            }

            const now = Date.now();
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push({
                name: dirName,
                type: 'directory',
                children: [],
                createdAt: now,
                modifiedAt: now,
                size: 0,
                permissions: 'rwxr-xr-x',
            });
            parent.modifiedAt = now;
        }
    }

    createFile(path: string, content = ''): void {
        const resolved = this.resolvePath(path);
        const parts = resolved.split('/').filter(Boolean);

        if (parts.length === 0) {
            throw new Error(`touch: cannot create file at root`);
        }

        const parentPath = '/' + parts.slice(0, -1).join('/');
        const fileName = parts[parts.length - 1];
        const parent = this.getNode(parentPath);

        if (!parent) {
            throw new Error(
                `touch: ${parentPath}: No such file or directory`,
            );
        }
        if (parent.type !== 'directory') {
            throw new Error(`touch: ${parentPath}: Not a directory`);
        }

        const existing = parent.children?.find((c) => c.name === fileName);
        const now = Date.now();

        if (existing) {
            // touch updates timestamp
            existing.modifiedAt = now;
        } else {
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push({
                name: fileName,
                type: 'file',
                content,
                createdAt: now,
                modifiedAt: now,
                size: new Blob([content]).size,
                permissions: 'rw-r--r--',
            });
            parent.modifiedAt = now;
        }
    }

    writeFile(path: string, content: string, append = false): void {
        const resolved = this.resolvePath(path);
        const node = this.getNode(resolved);

        if (node) {
            if (node.type === 'directory') {
                throw new Error(`write: ${path}: Is a directory`);
            }
            const now = Date.now();
            node.content = append ? (node.content ?? '') + content : content;
            node.size = new Blob([node.content]).size;
            node.modifiedAt = now;
        } else {
            // Create the file if it doesn't exist
            this.createFile(resolved, content);
        }
    }

    remove(path: string, recursive = false): void {
        const resolved = this.resolvePath(path);
        if (resolved === '/') {
            throw new Error(`rm: cannot remove root directory`);
        }

        const parts = resolved.split('/').filter(Boolean);
        const parentPath = '/' + parts.slice(0, -1).join('/');
        const name = parts[parts.length - 1];
        const parent = this.getNode(parentPath);

        if (!parent || !parent.children) {
            throw new Error(`rm: ${path}: No such file or directory`);
        }

        const index = parent.children.findIndex((c) => c.name === name);
        if (index === -1) {
            throw new Error(`rm: ${path}: No such file or directory`);
        }

        const target = parent.children[index];
        if (target.type === 'directory') {
            if (!recursive) {
                throw new Error(`rm: ${path}: Is a directory`);
            }
        }

        parent.children.splice(index, 1);
        parent.modifiedAt = Date.now();
    }

    copy(src: string, dest: string, recursive = false): void {
        const srcResolved = this.resolvePath(src);
        const srcNode = this.getNode(srcResolved);

        if (!srcNode) {
            throw new Error(`cp: ${src}: No such file or directory`);
        }
        if (srcNode.type === 'directory' && !recursive) {
            throw new Error(`cp: -r not specified; omitting directory '${src}'`);
        }

        const destResolved = this.resolvePath(dest);
        const destNode = this.getNode(destResolved);

        // If dest is an existing directory, copy into it
        if (destNode && destNode.type === 'directory') {
            const clone = this.cloneNode(srcNode);
            if (!destNode.children) {
                destNode.children = [];
            }
            // Remove existing child with same name
            const existingIdx = destNode.children.findIndex(
                (c) => c.name === clone.name,
            );
            if (existingIdx !== -1) {
                destNode.children.splice(existingIdx, 1);
            }
            destNode.children.push(clone);
            destNode.modifiedAt = Date.now();
        } else {
            // Copy to new name
            const parts = destResolved.split('/').filter(Boolean);
            const parentPath = '/' + parts.slice(0, -1).join('/');
            const newName = parts[parts.length - 1];
            const parent = this.getNode(parentPath);

            if (!parent || parent.type !== 'directory') {
                throw new Error(
                    `cp: ${parentPath}: No such file or directory`,
                );
            }

            const clone = this.cloneNode(srcNode);
            clone.name = newName;
            if (!parent.children) {
                parent.children = [];
            }
            // Remove existing child with same name
            const existingIdx = parent.children.findIndex(
                (c) => c.name === newName,
            );
            if (existingIdx !== -1) {
                parent.children.splice(existingIdx, 1);
            }
            parent.children.push(clone);
            parent.modifiedAt = Date.now();
        }
    }

    move(src: string, dest: string): void {
        const srcResolved = this.resolvePath(src);
        if (srcResolved === '/') {
            throw new Error(`mv: cannot move root directory`);
        }

        const srcNode = this.getNode(srcResolved);
        if (!srcNode) {
            throw new Error(`mv: ${src}: No such file or directory`);
        }

        const destResolved = this.resolvePath(dest);
        const destNode = this.getNode(destResolved);

        // Remove from source
        const srcParts = srcResolved.split('/').filter(Boolean);
        const srcParentPath = '/' + srcParts.slice(0, -1).join('/');
        const srcParent = this.getNode(srcParentPath);

        if (!srcParent || !srcParent.children) {
            throw new Error(`mv: ${src}: No such file or directory`);
        }

        const srcIndex = srcParent.children.findIndex(
            (c) => c.name === srcNode.name,
        );

        if (destNode && destNode.type === 'directory') {
            // Move into directory
            if (!destNode.children) {
                destNode.children = [];
            }
            const existingIdx = destNode.children.findIndex(
                (c) => c.name === srcNode.name,
            );
            if (existingIdx !== -1) {
                destNode.children.splice(existingIdx, 1);
            }
            srcParent.children.splice(srcIndex, 1);
            destNode.children.push(srcNode);
            destNode.modifiedAt = Date.now();
        } else {
            // Rename / move to new path
            const destParts = destResolved.split('/').filter(Boolean);
            const destParentPath = '/' + destParts.slice(0, -1).join('/');
            const newName = destParts[destParts.length - 1];
            const destParent = this.getNode(destParentPath);

            if (!destParent || destParent.type !== 'directory') {
                throw new Error(
                    `mv: ${destParentPath}: No such file or directory`,
                );
            }

            srcParent.children.splice(srcIndex, 1);
            srcNode.name = newName;
            if (!destParent.children) {
                destParent.children = [];
            }
            const existingIdx = destParent.children.findIndex(
                (c) => c.name === newName,
            );
            if (existingIdx !== -1) {
                destParent.children.splice(existingIdx, 1);
            }
            destParent.children.push(srcNode);
            destParent.modifiedAt = Date.now();
        }

        srcParent.modifiedAt = Date.now();
    }

    // --- Persistence ---

    async initialize(): Promise<void> {
        const db = await this.openDb();
        try {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);

            const rootData = await this.idbGet<IFileNode>(store, ROOT_KEY);
            const cwdData = await this.idbGet<string>(store, CWD_KEY);

            if (rootData) {
                this.root = rootData;
            }
            if (cwdData) {
                this.cwd = cwdData;
            }
        } finally {
            db.close();
        }
    }

    async persist(): Promise<void> {
        const db = await this.openDb();
        try {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            store.put(this.root, ROOT_KEY);
            store.put(this.cwd, CWD_KEY);

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    }

    // --- Private helpers ---

    private cloneNode(node: IFileNode): IFileNode {
        const now = Date.now();
        const clone: IFileNode = {
            name: node.name,
            type: node.type,
            createdAt: now,
            modifiedAt: now,
            size: node.size,
            permissions: node.permissions,
        };

        if (node.type === 'file') {
            clone.content = node.content;
        } else {
            clone.children = (node.children || []).map((c) =>
                this.cloneNode(c),
            );
        }

        return clone;
    }

    private openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private idbGet<T>(store: IDBObjectStore, key: string): Promise<T | null> {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    }
}
```

**Step 2: Create `projects/files/src/lib/services/index.ts`**

```typescript
export * from './indexed-db-file-system.service';
```

**Step 3: Commit**

```bash
git add projects/files/src/lib/services/
git commit -m "feat(files): implement IndexedDbFileSystemService with full CRUD and persistence"
```

---

### Task 4: Implement command processors — pwd, cd, ls

These three form the basic navigation set. Each processor retrieves the shared `IFileSystemService` from `context.services`.

**Files:**
- Create: `projects/files/src/lib/processors/cli-pwd-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-cd-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-ls-command-processor.ts`

**Step 1: Create `projects/files/src/lib/processors/cli-pwd-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliPwdCommandProcessor implements ICliCommandProcessor {
    command = 'pwd';
    description = 'Print the current working directory';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    metadata = { icon: '📂' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        context.writer.writeln(fs.getCurrentDirectory());
    }
}
```

**Step 2: Create `projects/files/src/lib/processors/cli-cd-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliCdCommandProcessor implements ICliCommandProcessor {
    command = 'cd';
    description = 'Change the current working directory';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '📁' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const target = command.value || '~';

        try {
            fs.setCurrentDirectory(target);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 3: Create `projects/files/src/lib/processors/cli-ls-command-processor.ts`**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { IFileNode } from '../interfaces/i-file-node';
import { LIBRARY_VERSION } from '../version';

export class CliLsCommandProcessor implements ICliCommandProcessor {
    command = 'ls';
    description = 'List directory contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '📋' };

    parameters = [
        {
            name: 'all',
            aliases: ['a'],
            description: 'Show hidden files (starting with .)',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'long',
            aliases: ['l'],
            description: 'Use long listing format',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const targetPath = command.value || fs.getCurrentDirectory();
        const showAll = command.args['all'] || command.args['a'];
        const longFormat = command.args['long'] || command.args['l'];

        try {
            const entries = fs.listDirectory(targetPath);
            const filtered = showAll
                ? entries
                : entries.filter((e) => !e.name.startsWith('.'));

            if (filtered.length === 0) {
                return;
            }

            // Sort: directories first, then alphabetically
            filtered.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            if (longFormat) {
                this.writeLongFormat(filtered, context);
            } else {
                this.writeShortFormat(filtered, context);
            }
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln(this.description!);
        writer.writeln();
        writer.writeln('Usage: ls [path] [--all] [--long]');
    }

    private writeLongFormat(
        entries: IFileNode[],
        context: ICliExecutionContext,
    ): void {
        const { writer } = context;
        for (const entry of entries) {
            const typeChar = entry.type === 'directory' ? 'd' : '-';
            const perms = entry.permissions || (entry.type === 'directory' ? 'rwxr-xr-x' : 'rw-r--r--');
            const size = entry.type === 'file' ? entry.size.toString() : '-';
            const date = new Date(entry.modifiedAt);
            const dateStr = date.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
            const name =
                entry.type === 'directory'
                    ? writer.wrapInColor(entry.name, CliForegroundColor.Cyan)
                    : entry.name;

            writer.writeln(
                `${typeChar}${perms}  ${size.padStart(6)}  ${dateStr}  ${name}`,
            );
        }
    }

    private writeShortFormat(
        entries: IFileNode[],
        context: ICliExecutionContext,
    ): void {
        const { writer } = context;
        const names = entries.map((e) =>
            e.type === 'directory'
                ? writer.wrapInColor(e.name, CliForegroundColor.Cyan)
                : e.name,
        );
        writer.writeln(names.join('  '));
    }
}
```

**Step 4: Commit**

```bash
git add projects/files/src/lib/processors/cli-pwd-command-processor.ts projects/files/src/lib/processors/cli-cd-command-processor.ts projects/files/src/lib/processors/cli-ls-command-processor.ts
git commit -m "feat(files): add pwd, cd, ls command processors"
```

---

### Task 5: Implement command processors — mkdir, rmdir, touch

**Files:**
- Create: `projects/files/src/lib/processors/cli-mkdir-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-rmdir-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-touch-command-processor.ts`

**Step 1: Create `projects/files/src/lib/processors/cli-mkdir-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliMkdirCommandProcessor implements ICliCommandProcessor {
    command = 'mkdir';
    description = 'Create directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata = { icon: '📁' };

    parameters = [
        {
            name: 'parents',
            aliases: ['p'],
            description: 'Create parent directories as needed',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const path = command.value;
        const recursive = command.args['parents'] || command.args['p'];

        if (!path) {
            context.writer.writeError('mkdir: missing operand');
            return;
        }

        try {
            fs.createDirectory(path, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 2: Create `projects/files/src/lib/processors/cli-rmdir-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliRmdirCommandProcessor implements ICliCommandProcessor {
    command = 'rmdir';
    description = 'Remove empty directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata = { icon: '🗑' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const path = command.value;

        if (!path) {
            context.writer.writeError('rmdir: missing operand');
            return;
        }

        try {
            const node = fs.getNode(path);
            if (!node) {
                context.writer.writeError(
                    `rmdir: ${path}: No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(`rmdir: ${path}: Not a directory`);
                return;
            }
            if (node.children && node.children.length > 0) {
                context.writer.writeError(
                    `rmdir: ${path}: Directory not empty`,
                );
                return;
            }
            fs.remove(path);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 3: Create `projects/files/src/lib/processors/cli-touch-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliTouchCommandProcessor implements ICliCommandProcessor {
    command = 'touch';
    description = 'Create an empty file or update its timestamp';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata = { icon: '📄' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const path = command.value;

        if (!path) {
            context.writer.writeError('touch: missing file operand');
            return;
        }

        try {
            fs.createFile(path);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 4: Commit**

```bash
git add projects/files/src/lib/processors/cli-mkdir-command-processor.ts projects/files/src/lib/processors/cli-rmdir-command-processor.ts projects/files/src/lib/processors/cli-touch-command-processor.ts
git commit -m "feat(files): add mkdir, rmdir, touch command processors"
```

---

### Task 6: Implement command processors — cat, echo

**Files:**
- Create: `projects/files/src/lib/processors/cli-cat-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-echo-command-processor.ts`

**Step 1: Create `projects/files/src/lib/processors/cli-cat-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliCatCommandProcessor implements ICliCommandProcessor {
    command = 'cat';
    description = 'Display file contents';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata = { icon: '📖' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const path = command.value;

        if (!path) {
            context.writer.writeError('cat: missing file operand');
            return;
        }

        try {
            const content = fs.readFile(path);
            if (content !== null) {
                context.writer.writeln(content);
            }
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 2: Create `projects/files/src/lib/processors/cli-echo-command-processor.ts`**

The `echo` command needs special parsing for `>` (overwrite) and `>>` (append) redirection operators. The raw command string is parsed to detect these operators.

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliEchoCommandProcessor implements ICliCommandProcessor {
    command = 'echo';
    description = 'Display text or redirect output to a file';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '💬' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const raw = command.rawCommand;

        // Strip "echo " prefix
        const afterEcho = raw.substring(raw.indexOf('echo') + 5).trim();

        // Parse redirection: >> (append) or > (overwrite)
        let text: string;
        let filePath: string | null = null;
        let append = false;

        const appendMatch = afterEcho.match(/^(.*?)\s*>>\s*(.+)$/);
        const overwriteMatch = afterEcho.match(/^(.*?)\s*>\s*(.+)$/);

        if (appendMatch) {
            text = appendMatch[1].trim();
            filePath = appendMatch[2].trim();
            append = true;
        } else if (overwriteMatch) {
            text = overwriteMatch[1].trim();
            filePath = overwriteMatch[2].trim();
            append = false;
        } else {
            text = afterEcho;
        }

        // Remove surrounding quotes from text
        if (
            (text.startsWith('"') && text.endsWith('"')) ||
            (text.startsWith("'") && text.endsWith("'"))
        ) {
            text = text.slice(1, -1);
        }

        if (filePath) {
            try {
                fs.writeFile(filePath, text + '\n', append);
                await fs.persist();
            } catch (e: any) {
                context.writer.writeError(e.message);
            }
        } else {
            context.writer.writeln(text);
        }
    }
}
```

**Step 3: Commit**

```bash
git add projects/files/src/lib/processors/cli-cat-command-processor.ts projects/files/src/lib/processors/cli-echo-command-processor.ts
git commit -m "feat(files): add cat and echo command processors with file redirection"
```

---

### Task 7: Implement command processors — rm, cp, mv

**Files:**
- Create: `projects/files/src/lib/processors/cli-rm-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-cp-command-processor.ts`
- Create: `projects/files/src/lib/processors/cli-mv-command-processor.ts`

**Step 1: Create `projects/files/src/lib/processors/cli-rm-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliRmCommandProcessor implements ICliCommandProcessor {
    command = 'rm';
    description = 'Remove files or directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata = { icon: '🗑' };

    parameters = [
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Remove directories and their contents recursively',
            required: false,
            type: 'boolean' as const,
        },
        {
            name: 'force',
            aliases: ['f'],
            description: 'Ignore nonexistent files, never prompt',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const path = command.value;
        const recursive =
            command.args['recursive'] ||
            command.args['r'] ||
            command.args['R'];
        const force = command.args['force'] || command.args['f'];

        if (!path) {
            context.writer.writeError('rm: missing operand');
            return;
        }

        try {
            if (!fs.exists(path)) {
                if (!force) {
                    context.writer.writeError(
                        `rm: ${path}: No such file or directory`,
                    );
                }
                return;
            }

            if (fs.isDirectory(path) && !recursive) {
                context.writer.writeError(`rm: ${path}: Is a directory`);
                return;
            }

            fs.remove(path, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }
}
```

**Step 2: Create `projects/files/src/lib/processors/cli-cp-command-processor.ts`**

The `cp` command needs to parse two arguments from the raw command: `cp <src> <dest>`.

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliCpCommandProcessor implements ICliCommandProcessor {
    command = 'cp';
    description = 'Copy files and directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '📋' };

    parameters = [
        {
            name: 'recursive',
            aliases: ['r', 'R'],
            description: 'Copy directories recursively',
            required: false,
            type: 'boolean' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const recursive =
            command.args['recursive'] ||
            command.args['r'] ||
            command.args['R'];

        // Parse src and dest from the value (remaining args after flags)
        const parts = this.parseArgs(command);

        if (parts.length < 2) {
            context.writer.writeError(
                'cp: missing destination file operand',
            );
            context.writer.writeln('Usage: cp [--recursive] <source> <destination>');
            return;
        }

        const src = parts[0];
        const dest = parts[1];

        try {
            fs.copy(src, dest, recursive);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    private parseArgs(command: CliProcessCommand): string[] {
        const raw = command.rawCommand;
        // Remove "cp" prefix and known flags
        const afterCmd = raw.substring(raw.indexOf('cp') + 2).trim();
        const tokens = afterCmd.split(/\s+/).filter(
            (t) =>
                t &&
                !t.startsWith('--') &&
                !t.startsWith('-'),
        );
        return tokens;
    }
}
```

**Step 3: Create `projects/files/src/lib/processors/cli-mv-command-processor.ts`**

```typescript
import {
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import { IFileSystemService, IFileSystemService_TOKEN } from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliMvCommandProcessor implements ICliCommandProcessor {
    command = 'mv';
    description = 'Move or rename files and directories';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '📦' };

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);

        // Parse src and dest from the raw command
        const parts = this.parseArgs(command);

        if (parts.length < 2) {
            context.writer.writeError(
                'mv: missing destination file operand',
            );
            context.writer.writeln('Usage: mv <source> <destination>');
            return;
        }

        const src = parts[0];
        const dest = parts[1];

        try {
            fs.move(src, dest);
            await fs.persist();
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    private parseArgs(command: CliProcessCommand): string[] {
        const raw = command.rawCommand;
        const afterCmd = raw.substring(raw.indexOf('mv') + 2).trim();
        const tokens = afterCmd.split(/\s+/).filter(
            (t) => t && !t.startsWith('--') && !t.startsWith('-'),
        );
        return tokens;
    }
}
```

**Step 4: Commit**

```bash
git add projects/files/src/lib/processors/cli-rm-command-processor.ts projects/files/src/lib/processors/cli-cp-command-processor.ts projects/files/src/lib/processors/cli-mv-command-processor.ts
git commit -m "feat(files): add rm, cp, mv command processors"
```

---

### Task 8: Implement tree command processor

**Files:**
- Create: `projects/files/src/lib/processors/cli-tree-command-processor.ts`

**Step 1: Create `projects/files/src/lib/processors/cli-tree-command-processor.ts`**

```typescript
import {
    CliForegroundColor,
    CliProcessCommand,
    DefaultLibraryAuthor,
    ICliCommandProcessor,
    ICliExecutionContext,
} from '@qodalis/cli-core';
import {
    IFileSystemService,
    IFileSystemService_TOKEN,
    IFileNode,
} from '../interfaces';
import { LIBRARY_VERSION } from '../version';

export class CliTreeCommandProcessor implements ICliCommandProcessor {
    command = 'tree';
    description = 'Display directory tree structure';
    author = DefaultLibraryAuthor;
    version = LIBRARY_VERSION;
    allowUnlistedCommands = true;
    metadata = { icon: '🌳' };

    parameters = [
        {
            name: 'depth',
            aliases: ['L'],
            description: 'Max display depth of the directory tree',
            required: false,
            type: 'number' as const,
        },
    ];

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        const targetPath = command.value || fs.getCurrentDirectory();
        const maxDepth = command.args['depth']
            ? parseInt(command.args['depth'])
            : command.args['L']
              ? parseInt(command.args['L'])
              : Infinity;

        try {
            const node = fs.getNode(targetPath);
            if (!node) {
                context.writer.writeError(
                    `tree: ${targetPath}: No such file or directory`,
                );
                return;
            }
            if (node.type !== 'directory') {
                context.writer.writeError(
                    `tree: ${targetPath}: Not a directory`,
                );
                return;
            }

            const resolvedPath = fs.resolvePath(targetPath);
            context.writer.writeln(
                context.writer.wrapInColor(resolvedPath, CliForegroundColor.Cyan),
            );

            const counts = { dirs: 0, files: 0 };
            this.printTree(node, '', true, 0, maxDepth, context, counts);

            context.writer.writeln();
            context.writer.writeln(
                `${counts.dirs} directories, ${counts.files} files`,
            );
        } catch (e: any) {
            context.writer.writeError(e.message);
        }
    }

    private printTree(
        node: IFileNode,
        prefix: string,
        isRoot: boolean,
        depth: number,
        maxDepth: number,
        context: ICliExecutionContext,
        counts: { dirs: number; files: number },
    ): void {
        if (!node.children || depth >= maxDepth) {
            return;
        }

        const children = [...node.children].sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const isLast = i === children.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            const displayName =
                child.type === 'directory'
                    ? context.writer.wrapInColor(
                          child.name,
                          CliForegroundColor.Cyan,
                      )
                    : child.name;

            context.writer.writeln(`${prefix}${connector}${displayName}`);

            if (child.type === 'directory') {
                counts.dirs++;
                this.printTree(
                    child,
                    prefix + childPrefix,
                    false,
                    depth + 1,
                    maxDepth,
                    context,
                    counts,
                );
            } else {
                counts.files++;
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add projects/files/src/lib/processors/cli-tree-command-processor.ts
git commit -m "feat(files): add tree command processor with ASCII art display"
```

---

### Task 9: Wire up module, public API, and exports

**Files:**
- Create: `projects/files/src/lib/processors/index.ts`
- Create: `projects/files/src/lib/index.ts`
- Create: `projects/files/src/public-api.ts`
- Create: `projects/files/src/cli-entrypoint.ts`

**Step 1: Create `projects/files/src/lib/processors/index.ts`**

```typescript
export * from './cli-ls-command-processor';
export * from './cli-cd-command-processor';
export * from './cli-pwd-command-processor';
export * from './cli-mkdir-command-processor';
export * from './cli-rmdir-command-processor';
export * from './cli-touch-command-processor';
export * from './cli-cat-command-processor';
export * from './cli-echo-command-processor';
export * from './cli-rm-command-processor';
export * from './cli-cp-command-processor';
export * from './cli-mv-command-processor';
export * from './cli-tree-command-processor';
```

**Step 2: Create `projects/files/src/lib/index.ts`**

```typescript
export * from './interfaces';
export * from './processors';
export * from './services';
```

**Step 3: Create `projects/files/src/public-api.ts`**

```typescript
/*
 * Public API Surface of files
 */

export * from './lib/index';

import { ICliModule } from '@qodalis/cli-core';
import { IFileSystemService_TOKEN } from './lib/interfaces';
import { IndexedDbFileSystemService } from './lib/services';
import { IFileSystemService } from './lib/interfaces';
import { CliLsCommandProcessor } from './lib/processors/cli-ls-command-processor';
import { CliCdCommandProcessor } from './lib/processors/cli-cd-command-processor';
import { CliPwdCommandProcessor } from './lib/processors/cli-pwd-command-processor';
import { CliMkdirCommandProcessor } from './lib/processors/cli-mkdir-command-processor';
import { CliRmdirCommandProcessor } from './lib/processors/cli-rmdir-command-processor';
import { CliTouchCommandProcessor } from './lib/processors/cli-touch-command-processor';
import { CliCatCommandProcessor } from './lib/processors/cli-cat-command-processor';
import { CliEchoCommandProcessor } from './lib/processors/cli-echo-command-processor';
import { CliRmCommandProcessor } from './lib/processors/cli-rm-command-processor';
import { CliCpCommandProcessor } from './lib/processors/cli-cp-command-processor';
import { CliMvCommandProcessor } from './lib/processors/cli-mv-command-processor';
import { CliTreeCommandProcessor } from './lib/processors/cli-tree-command-processor';

export const filesModule: ICliModule = {
    name: '@qodalis/cli-files',
    processors: [
        new CliLsCommandProcessor(),
        new CliCdCommandProcessor(),
        new CliPwdCommandProcessor(),
        new CliMkdirCommandProcessor(),
        new CliRmdirCommandProcessor(),
        new CliTouchCommandProcessor(),
        new CliCatCommandProcessor(),
        new CliEchoCommandProcessor(),
        new CliRmCommandProcessor(),
        new CliCpCommandProcessor(),
        new CliMvCommandProcessor(),
        new CliTreeCommandProcessor(),
    ],
    services: [
        {
            provide: IFileSystemService_TOKEN,
            useValue: new IndexedDbFileSystemService(),
        },
    ],
    async onInit(context) {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        await fs.initialize();
    },
};
```

**Step 4: Create `projects/files/src/cli-entrypoint.ts`**

```typescript
import { bootCliModule, ICliModule } from '@qodalis/cli-core';
import { IFileSystemService_TOKEN } from './lib/interfaces';
import { IFileSystemService } from './lib/interfaces';
import { IndexedDbFileSystemService } from './lib/services';
import { CliLsCommandProcessor } from './lib/processors/cli-ls-command-processor';
import { CliCdCommandProcessor } from './lib/processors/cli-cd-command-processor';
import { CliPwdCommandProcessor } from './lib/processors/cli-pwd-command-processor';
import { CliMkdirCommandProcessor } from './lib/processors/cli-mkdir-command-processor';
import { CliRmdirCommandProcessor } from './lib/processors/cli-rmdir-command-processor';
import { CliTouchCommandProcessor } from './lib/processors/cli-touch-command-processor';
import { CliCatCommandProcessor } from './lib/processors/cli-cat-command-processor';
import { CliEchoCommandProcessor } from './lib/processors/cli-echo-command-processor';
import { CliRmCommandProcessor } from './lib/processors/cli-rm-command-processor';
import { CliCpCommandProcessor } from './lib/processors/cli-cp-command-processor';
import { CliMvCommandProcessor } from './lib/processors/cli-mv-command-processor';
import { CliTreeCommandProcessor } from './lib/processors/cli-tree-command-processor';

const module: ICliModule = {
    name: '@qodalis/cli-files',
    processors: [
        new CliLsCommandProcessor(),
        new CliCdCommandProcessor(),
        new CliPwdCommandProcessor(),
        new CliMkdirCommandProcessor(),
        new CliRmdirCommandProcessor(),
        new CliTouchCommandProcessor(),
        new CliCatCommandProcessor(),
        new CliEchoCommandProcessor(),
        new CliRmCommandProcessor(),
        new CliCpCommandProcessor(),
        new CliMvCommandProcessor(),
        new CliTreeCommandProcessor(),
    ],
    services: [
        {
            provide: IFileSystemService_TOKEN,
            useValue: new IndexedDbFileSystemService(),
        },
    ],
    async onInit(context) {
        const fs = context.services.get<IFileSystemService>(
            IFileSystemService_TOKEN,
        );
        await fs.initialize();
    },
};

bootCliModule(module);
```

**Step 5: Commit**

```bash
git add projects/files/src/lib/processors/index.ts projects/files/src/lib/index.ts projects/files/src/public-api.ts projects/files/src/cli-entrypoint.ts
git commit -m "feat(files): wire up filesModule, public API, and UMD entrypoint"
```

---

### Task 10: Register in demo app

**Files:**
- Modify: `projects/demo-angular/src/app/app.component.ts`

**Step 1: Add import and register the module**

Add import at top:

```typescript
import { filesModule } from '@qodalis/cli-files';
```

Add `filesModule` to the `modules` array:

```typescript
modules: ICliModule[] = [
    filesModule,
    guidModule,
    // ... rest of existing modules
];
```

**Step 2: Commit**

```bash
git add projects/demo-angular/src/app/app.component.ts
git commit -m "feat(demo): register filesModule in demo app"
```

---

### Task 11: Build and verify

**Step 1: Build core first (dependency)**

Run: `cd /Users/nicolaelupei/Documents/Personal/angular-web-cli && ng build core`

Expected: BUILD SUCCESS

**Step 2: Build cli (dependency)**

Run: `ng build cli`

Expected: BUILD SUCCESS

**Step 3: Build files plugin**

Run: `ng build files`

Expected: BUILD SUCCESS — output in `dist/files/`

**Step 4: Build demo app**

Run: `ng build demo-angular`

Expected: BUILD SUCCESS

**Step 5: Run demo to smoke test**

Run: `npm run "start demo"`

Open browser at `localhost:4300`, test these commands in the terminal:
- `pwd` → should show `/home/user`
- `ls` → should show `welcome.txt`
- `cat welcome.txt` → should show welcome message
- `mkdir test` → should create directory
- `cd test` → should change directory
- `pwd` → should show `/home/user/test`
- `touch hello.txt` → should create file
- `echo "hello world" > hello.txt` → should write to file
- `cat hello.txt` → should show "hello world"
- `cd ..` → should go back
- `tree` → should show tree structure
- `cp welcome.txt welcome-copy.txt` → should copy
- `mv welcome-copy.txt renamed.txt` → should rename
- `rm renamed.txt` → should remove
- `rm -r test` → should remove directory recursively

**Step 6: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix(files): address build/smoke-test issues"
```
