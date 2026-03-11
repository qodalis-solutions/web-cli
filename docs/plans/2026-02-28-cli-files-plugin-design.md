# Design: `@qodalis/cli-files` — Linux File Management Plugin

**Date:** 2026-02-28
**Status:** Approved

## Overview

A new plugin library for the Qodalis CLI ecosystem that simulates Linux file management commands with an in-memory filesystem persisted to IndexedDB. All abstractions (interfaces, service, implementation) live within the plugin package.

## Commands

12 top-level processors registered via multi-processor module pattern (like `browser-storage`):

| Command | Usage | Notes |
|---------|-------|-------|
| `ls` | `ls [path] [--all] [--long]` | List directory. `-a` shows dotfiles, `-l` shows details |
| `cd` | `cd [path]` | Change directory. Supports `.`, `..`, `~`, absolute |
| `pwd` | `pwd` | Print working directory |
| `mkdir` | `mkdir <path> [--parents]` | Create directory. `-p` creates intermediate dirs |
| `rmdir` | `rmdir <path>` | Remove empty directory |
| `touch` | `touch <filename>` | Create empty file or update timestamp |
| `cat` | `cat <file>` | Print file contents |
| `echo` | `echo <text> [> file] [>> file]` | Print text or redirect to file |
| `rm` | `rm <path> [--recursive] [--force]` | Remove file/dir. `-r` for dirs, `-f` skip confirm |
| `cp` | `cp <src> <dest> [--recursive]` | Copy file/dir |
| `mv` | `mv <src> <dest>` | Move/rename file or directory |
| `tree` | `tree [path] [--depth N]` | Display directory tree with ASCII art |

## Data Model

```typescript
interface IFileNode {
    name: string;
    type: 'file' | 'directory';
    content?: string;          // file content (text only)
    children?: IFileNode[];    // directory entries
    createdAt: number;
    modifiedAt: number;
    size: number;              // byte count for files, 0 for dirs
    permissions?: string;      // e.g. "rwxr-xr-x" (display only, not enforced)
}
```

The filesystem is a single JSON tree rooted at `/`, persisted as one IndexedDB record. Current working directory is tracked as a path string.

## Abstraction: IFileSystemService

```typescript
interface IFileSystemService {
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

`IndexedDbFileSystemService` implements this interface. Loads the tree from IndexedDB on `initialize()`, operates on the in-memory tree, and writes back on `persist()`.

## Module Registration

```typescript
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
    services: [{ provide: IFileSystemService_TOKEN, useClass: IndexedDbFileSystemService }],
    async onInit(context) {
        const fs = context.services.get<IFileSystemService>(IFileSystemService_TOKEN);
        await fs.initialize();
    },
};
```

## Seed Data

On first initialization (no existing IndexedDB data):

```
/
├── home/
│   └── user/
│       └── welcome.txt    ("Welcome to Qodalis CLI filesystem!")
├── tmp/
└── etc/
```

Default working directory: `/home/user`

## IndexedDB Storage

- **Database:** `qodalis-cli-filesystem`
- **Object store:** `filesystem`
- **Key `root`:** serialized filesystem tree (JSON)
- **Key `cwd`:** current working directory path string
- Loaded entirely into memory on init, persisted after each mutation

## Directory Structure

```
projects/files/
├── package.json
├── ng-package.json
├── rollup.config.mjs
├── tsconfig.lib.json
├── src/
│   ├── public-api.ts
│   ├── cli-entrypoint.ts
│   └── lib/
│       ├── index.ts
│       ├── version.ts
│       ├── interfaces/
│       │   ├── i-file-node.ts
│       │   └── i-file-system-service.ts
│       ├── services/
│       │   └── indexed-db-file-system.service.ts
│       └── processors/
│           ├── cli-ls-command-processor.ts
│           ├── cli-cd-command-processor.ts
│           ├── cli-pwd-command-processor.ts
│           ├── cli-mkdir-command-processor.ts
│           ├── cli-rmdir-command-processor.ts
│           ├── cli-touch-command-processor.ts
│           ├── cli-cat-command-processor.ts
│           ├── cli-echo-command-processor.ts
│           ├── cli-rm-command-processor.ts
│           ├── cli-cp-command-processor.ts
│           ├── cli-mv-command-processor.ts
│           └── cli-tree-command-processor.ts
└── src/tests/
    └── index.spec.ts
```

## Design Decisions

1. **All abstractions in plugin** — keeps the plugin self-contained. Other plugins can import from `@qodalis/cli-files` if they need filesystem access.
2. **Multi-processor module** — each command is a top-level processor for natural Linux-like UX.
3. **Single IndexedDB record for tree** — simple persistence model. The filesystem is small enough (text files only) that serializing the whole tree is efficient.
4. **In-memory operation** — all reads/writes operate on the in-memory tree for speed. IndexedDB is only touched on init and persist.
5. **Shared service via module services** — all processors access the same `IFileSystemService` instance through `context.services`.
