# Permissions Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Linux-style rwx permissions with owner/group/other, abstract and replaceable, enforced on files and optionally on commands.

**Architecture:** Abstract `ICliPermissionService` interface in `cli-core` with a default implementation in `cli-users`. `IFileNode` extended with ownership + permission bits. The filesystem service enforces permissions when a user context is available, gracefully skipping when no users module is installed.

**Tech Stack:** TypeScript, Jasmine/Karma tests, tsup builds

---

### Task 1: Core permission interfaces

**Files:**
- Create: `packages/core/src/lib/models/permissions.ts`
- Modify: `packages/core/src/lib/models/index.ts` (re-export)
- Modify: `packages/core/src/lib/interfaces/index.ts` (add ICliPermissionService + TOKEN)

Add to `packages/core/src/lib/models/permissions.ts`:

```typescript
/** Permission bits for a single scope (owner, group, other) */
export interface ICliPermissionBits {
    read: boolean;
    write: boolean;
    execute: boolean;
}

/** Full permission set (like rwxr-xr-x) */
export interface ICliPermissions {
    owner: ICliPermissionBits;
    group: ICliPermissionBits;
    other: ICliPermissionBits;
}

/** Ownership metadata */
export interface ICliOwnership {
    /** User ID of the owner */
    uid: string;
    /** Primary group name */
    gid: string;
}

/** Default file permissions: rw-r--r-- (644) */
export const DEFAULT_FILE_PERMISSIONS: ICliPermissions = {
    owner: { read: true, write: true, execute: false },
    group: { read: true, write: false, execute: false },
    other: { read: true, write: false, execute: false },
};

/** Default directory permissions: rwxr-xr-x (755) */
export const DEFAULT_DIR_PERMISSIONS: ICliPermissions = {
    owner: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    other: { read: true, write: false, execute: true },
};
```

Add `ICliPermissionService` to interfaces:

```typescript
export const ICliPermissionService_TOKEN = 'cli-permission-service';

export interface ICliPermissionService {
    check(
        user: ICliUser,
        action: 'read' | 'write' | 'execute',
        ownership: ICliOwnership,
        permissions: ICliPermissions,
    ): boolean;

    parseOctal(octal: string): ICliPermissions;
    toOctal(permissions: ICliPermissions): string;
    formatString(permissions: ICliPermissions): string;
}
```

Re-export from `packages/core/src/lib/models/index.ts`.

**Step 1:** Create `permissions.ts` with models + constants.
**Step 2:** Add `ICliPermissionService` interface + TOKEN to `packages/core/src/lib/interfaces/index.ts`.
**Step 3:** Re-export from models index.
**Step 4:** Build core: `npx nx build core`. Verify no errors.
**Step 5:** Commit: `git commit -am "feat(core): add permission interfaces and models"`

---

### Task 2: Extend IFileNode with ownership and permissions

**Files:**
- Modify: `packages/plugins/files/src/lib/interfaces/i-file-node.ts`

Replace the cosmetic `permissions?: string` field with structured fields:

```typescript
export interface IFileNode {
    // ... existing fields ...
    /** Owner/group metadata */
    ownership?: ICliOwnership;
    /** Structured permission bits (rwx for owner/group/other) */
    permissionBits?: ICliPermissions;
}
```

Remove the old `permissions?: string` field. Search for any code referencing `node.permissions` and update to use the new fields.

**Step 1:** Update `IFileNode` — remove `permissions?: string`, add `ownership?` and `permissionBits?` imports.
**Step 2:** Search codebase for `.permissions` references on file nodes and update (likely `ls` command display code).
**Step 3:** Build files plugin: `npx nx build files`. Verify no errors.
**Step 4:** Commit: `git commit -am "feat(files): extend IFileNode with ownership and permission bits"`

---

### Task 3: Default CliDefaultPermissionService implementation

**Files:**
- Create: `packages/plugins/users/src/lib/services/cli-default-permission.service.ts`
- Modify: `packages/plugins/users/src/lib/services/index.ts` (re-export)
- Create: `packages/plugins/users/src/tests/permission-service.spec.ts`

Implement `ICliPermissionService`:

```typescript
export class CliDefaultPermissionService implements ICliPermissionService {
    check(user, action, ownership, permissions): boolean {
        // Admin/root always allowed
        if (user.groups.includes('admin')) return true;

        // Determine scope
        let bits: ICliPermissionBits;
        if (user.id === ownership.uid) {
            bits = permissions.owner;
        } else if (user.groups.includes(ownership.gid)) {
            bits = permissions.group;
        } else {
            bits = permissions.other;
        }

        switch (action) {
            case 'read': return bits.read;
            case 'write': return bits.write;
            case 'execute': return bits.execute;
        }
    }

    parseOctal(octal: string): ICliPermissions { ... }
    toOctal(permissions: ICliPermissions): string { ... }
    formatString(permissions: ICliPermissions): string { ... }
}
```

Tests should cover:
- Admin bypasses all checks
- Owner permissions applied correctly
- Group permissions applied correctly
- Other permissions applied correctly
- Octal parsing: "755" -> rwxr-xr-x, "644" -> rw-r--r--, "000", "777"
- Octal formatting: reverse of parsing
- Format string: "rwxr-xr-x", "rw-r--r--"

**Step 1:** Write tests in `permission-service.spec.ts`.
**Step 2:** Implement `CliDefaultPermissionService`.
**Step 3:** Re-export from services index.
**Step 4:** Run tests: `npx nx test users`. Verify pass.
**Step 5:** Commit: `git commit -am "feat(users): add default permission service with octal/rwx support"`

---

### Task 4: Register permission service in users module

**Files:**
- Modify: `packages/plugins/users/src/public-api.ts`

In `onInit`, register the permission service:

```typescript
import { CliDefaultPermissionService } from './lib/services/cli-default-permission.service';
import { ICliPermissionService_TOKEN } from '@qodalis/cli-core';

// In onInit:
context.services.set([
    { provide: ICliPermissionService_TOKEN, useValue: new CliDefaultPermissionService() },
]);
```

**Step 1:** Add import and register in onInit.
**Step 2:** Build: `npx nx build users`. Verify no errors.
**Step 3:** Commit: `git commit -am "feat(users): register permission service on module init"`

---

### Task 5: Add ownership/permissions to filesystem operations

**Files:**
- Modify: `packages/plugins/files/src/lib/interfaces/i-file-system-service.ts` (add setCurrentUser, chmod, chown)
- Modify: `packages/plugins/files/src/lib/services/indexed-db-file-system.service.ts` (implement)

Extend `IFileSystemService`:

```typescript
interface IFileSystemService {
    // ... existing ...

    /** Set the current user context for permission checks */
    setCurrentUser(uid: string, groups: string[]): void;

    /** Change permission bits on a node */
    chmod(path: string, permissions: ICliPermissions): void;

    /** Change ownership of a node */
    chown(path: string, uid: string, gid: string): void;
}
```

In `IndexedDbFileSystemService`:
- Store `currentUid` and `currentGroups` (set via `setCurrentUser`)
- `createFile` / `createDirectory` — set `ownership` to `{ uid: currentUid, gid: currentGroups[0] || 'users' }` and default permissions (644/755)
- `chmod(path, permissions)` — set `permissionBits` on the node
- `chown(path, uid, gid)` — set `ownership` on the node
- Permission enforcement: add a private `checkPermission(node, action)` method. Call it in `readFile`, `writeFile`, `remove`, `listDirectory`. If no currentUser is set OR no permissionBits on node, skip check (backwards compatible).

**Step 1:** Update interface.
**Step 2:** Implement in IndexedDbFileSystemService.
**Step 3:** Build: `npx nx build files`. Verify.
**Step 4:** Commit: `git commit -am "feat(files): add permission enforcement to filesystem service"`

---

### Task 6: Wire up current user to filesystem on session change

**Files:**
- Modify: `packages/plugins/users/src/public-api.ts`

In the `onInit` session subscription (where `setHomePath` is called), also call `setCurrentUser`:

```typescript
sessionService.getUserSession().subscribe((session) => {
    if (session) {
        // ... existing code ...
        try {
            const fs = context.services.get<any>('cli-file-system-service');
            if (fs) {
                fs.setHomePath(session.user.homeDir);
                fs.setCurrentUser(session.user.id, session.user.groups);
            }
        } catch { /* Files module not installed */ }
    }
});
```

**Step 1:** Add `setCurrentUser` call in session subscriber.
**Step 2:** Build: `npx nx build users`. Verify.
**Step 3:** Commit: `git commit -am "feat(users): sync current user to filesystem on session change"`

---

### Task 7: chmod command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-chmod-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts` (add to exports + module processors)
- Create: `packages/plugins/files/src/tests/chmod-command.spec.ts`

Usage: `chmod 755 /path/to/file`, `chmod 644 /path/to/file`

The processor:
1. Parses octal mode from first positional arg
2. Gets the permission service from context (optional — can also just use a local parseOctal)
3. Calls `fs.chmod(path, parsedPermissions)`
4. Supports `-R` for recursive

Tests:
- `chmod 755 file` sets correct bits
- `chmod 644 file` sets correct bits
- Error on missing args
- Error on invalid octal
- Error on nonexistent path

**Step 1:** Write tests.
**Step 2:** Implement processor.
**Step 3:** Register in module.
**Step 4:** Run tests: `npx nx test files`. Verify.
**Step 5:** Commit: `git commit -am "feat(files): add chmod command"`

---

### Task 8: chown command

**Files:**
- Create: `packages/plugins/files/src/lib/processors/cli-chown-command-processor.ts`
- Modify: `packages/plugins/files/src/lib/processors/index.ts`
- Create: `packages/plugins/files/src/tests/chown-command.spec.ts`

Usage: `chown user:group /path/to/file`, `chown user /path/to/file`

The processor:
1. Parses `user:group` or `user` from first positional arg
2. Calls `fs.chown(path, uid, gid)`
3. Supports `-R` for recursive

Tests:
- `chown alice:dev file` sets uid=alice, gid=dev
- `chown alice file` sets uid=alice, keeps existing gid
- Error on missing args
- Error on nonexistent path

**Step 1:** Write tests.
**Step 2:** Implement processor.
**Step 3:** Register in module.
**Step 4:** Run tests: `npx nx test files`. Verify.
**Step 5:** Commit: `git commit -am "feat(files): add chown command"`

---

### Task 9: Update ls -l to show permissions and ownership

**Files:**
- Modify: `packages/plugins/files/src/lib/processors/cli-ls-command-processor.ts`
- Modify: existing ls tests if any

When `ls -l` is used, show permissions string and ownership columns:

```
drwxr-xr-x  root  admin  4096  Jan 01 12:00  Documents
-rw-r--r--  alice dev     1234  Jan 01 12:00  file.txt
```

If no permissions/ownership on node, show defaults (`rw-r--r--` for files, `rwxr-xr-x` for dirs, and `-` for owner/group).

**Step 1:** Find the ls -l formatting code.
**Step 2:** Add permissions string + ownership columns.
**Step 3:** Build and test.
**Step 4:** Commit: `git commit -am "feat(files): show permissions and ownership in ls -l"`

---

### Task 10: Integration tests and final build

**Files:**
- Create: `packages/plugins/files/src/tests/permissions.spec.ts`

Integration tests:
- File created by user has correct default ownership (uid matches creator)
- File created by user has correct default permissions (644 for files, 755 for dirs)
- chmod changes permissions on node
- chown changes ownership on node
- Permission denied when user lacks read/write access (if permission service available)

**Step 1:** Write integration tests.
**Step 2:** Full build: `pnpm run build`. Verify all 33+ projects pass.
**Step 3:** Full test: `pnpm test`. Verify all pass.
**Step 4:** Commit: `git commit -am "test(files): add permission integration tests"`
