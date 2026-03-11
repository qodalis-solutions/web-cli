# Design: Plugin Install/Setup Flow

## Status: Draft

## Summary

Add an optional `onSetup` lifecycle hook to `ICliModule`. The CLI engine checks a persisted flag in the key-value store on boot; if a module declares `onSetup` and hasn't been set up yet, it runs the interactive setup flow before registering processors.

The **users module** is the first adopter: on first boot it creates a `root` superuser automatically and prompts the user to create their own account.

---

## Motivation

Currently the users plugin hardcodes a `root` user with password `root` on first load. This is not configurable and doesn't give the user a chance to create their own identity. Other plugins may also benefit from a first-run configuration step (e.g., API keys, preferences).

---

## Lifecycle Order (per module)

```
1. Register services        -- DI tokens available
2. onInit()                  -- initialize stores, services, internal state
3. onSetup()  [NEW]          -- interactive first-run prompts (if declared & not yet installed)
4. Register processors       -- commands become available
5. Initialize processors     -- each processor's initialize() called
6. onAfterBoot()             -- post-boot logic (e.g., login prompt)
```

`onSetup` runs after `onInit` so all services (stores, auth) are initialized and available. It runs before processors so the terminal is clean for interactive prompts.

---

## Core Interface Change

**File:** `packages/core/src/lib/interfaces/index.ts`

Add to `ICliModule` (after `onInit`):

```typescript
/**
 * Optional first-run setup flow. Called during boot if the module
 * has not been set up yet (determined by a persisted flag in the
 * key-value store). Use context.reader to prompt the user for
 * initial configuration.
 *
 * @returns true to mark setup as complete; false/throw to abort
 * (module still loads, setup re-triggers next boot).
 */
onSetup?(context: ICliExecutionContext): Promise<boolean>;
```

No new interfaces or types needed beyond this single method.

---

## Engine Change

**File:** `packages/cli/src/lib/services/cli-boot.ts`

In the `bootModule` method, after `onInit` completes and before processor registration:

```
if module.onSetup exists:
    read KV key "cli-module-setup:<module.name>"
    if not installed:
        hide spinner
        result = await module.onSetup(context)
        if result === true:
            persist { installed: true, installedAt: Date.now() }
        show spinner
```

- Setup key convention: `cli-module-setup:<module.name>` (e.g., `cli-module-setup:@qodalis/cli-users`)
- Value: `{ installed: boolean; installedAt: number }`
- If `onSetup` returns `false` or throws, the flag is NOT set. The module still loads (graceful degradation) but setup re-triggers next boot.

---

## Users Module: `onSetup` Implementation

**File:** `packages/plugins/users/src/public-api.ts`

### Flow

#### Step 1: Intro Message

```
============================================
  Welcome to Qodalis CLI User Setup
============================================

This system requires initial user configuration.

A 'root' superuser will be created automatically.
You will now create your personal user account.

```

#### Step 2: Create `root` Superuser (silent, no prompts)

| Field    | Value           |
|----------|-----------------|
| name     | `root`          |
| email    | `root@localhost` |
| password | `root`          |
| groups   | `['admin']`     |
| homeDir  | `/home/root`    |

#### Step 3: Prompt for Custom User

All fields from `ICliUser` / `CliAddUser`:

| Field     | Prompt                          | Validation                               | Default             |
|-----------|---------------------------------|------------------------------------------|---------------------|
| username  | `Username: `                    | Linux-style: `/^[a-z_][a-z0-9_-]{0,31}$/` | required            |
| email     | `Email: `                       | Email regex                              | required            |
| password  | `Password: ` (masked)           | Non-empty                                | required            |
| confirm   | `Confirm password: ` (masked)   | Must match password                      | required            |
| homeDir   | `Home directory [/home/<user>]: `| Non-empty string                         | `/home/<username>`   |
| shell     | `Shell [/bin/bash]: `           | Non-empty string                         | `/bin/bash`          |
| groups    | `Groups (comma-separated) []: ` | Optional                                 | `[]`                |

#### Step 4: Create User & Auto-login

- Create the user via `usersStore.createUser()`
- Set password via `authService.setPassword()`
- Auto-login as the new user via `sessionService.setUserSession()`
- Print success message
- Return `true`

#### Abort Handling

If the user aborts at any prompt (returns `null`), return `false`. Setup will re-trigger next boot.

### Username Validation

Linux-style usernames only:

```
/^[a-z_][a-z0-9_-]{0,31}$/
```

- Lowercase letters, digits, underscore, hyphen
- Must start with lowercase letter or underscore
- Max 32 characters

On validation failure, show error and re-prompt.

---

## Users Module: Remove Hardcoded Root

### `cli-default-users-store.service.ts`

**Remove** the root user seeding in `initialize()`. When the store is empty, leave it empty. `onSetup` handles user creation.

```typescript
// BEFORE (remove this):
if (!stored || stored.length === 0) {
    const rootUser = { id: 'root', name: 'root', ... };
    this.usersSubject.next([rootUser]);
    await this.persist();
}

// AFTER:
this.usersSubject.next(stored || []);
```

### `cli-default-auth.service.ts`

**Remove** root password seeding in `initialize()`:

```typescript
// BEFORE (remove this):
if (this.credentials.length === 0) {
    const rootUser = await firstValueFrom(usersStore.getUser('root'));
    if (rootUser) await this.setPassword(rootUser.id, 'root');
}

// AFTER:
// No seeding — onSetup handles it
```

**Change** `logout()` fallback from `root` to first admin user:

```typescript
// BEFORE:
const rootUser = await firstValueFrom(this.usersStore.getUser('root'));

// AFTER:
const users = await firstValueFrom(this.usersStore.getUsers());
const adminUser = users.find(u => u.groups.includes('admin'));
```

---

## Users Module: Adjust Auto-login in `onInit`

**File:** `packages/plugins/users/src/public-api.ts`

In the `onInit` fallback (lines 149-161), change from looking up `root` to finding the first admin user:

```typescript
// BEFORE:
const rootUser = await firstValueFrom(usersStore.getUser('root'));

// AFTER:
const users = await firstValueFrom(usersStore.getUsers());
const adminUser = users.find(u => u.groups.includes('admin'));
```

This handles the case where `onSetup` has already run and the admin might not be named `root`.

---

## Files Changed Summary

| # | File | Change |
|---|------|--------|
| 1 | `packages/core/src/lib/interfaces/index.ts` | Add `onSetup?()` to `ICliModule` |
| 2 | `packages/cli/src/lib/services/cli-boot.ts` | Setup detection + execution after `onInit`, before processors |
| 3 | `packages/plugins/users/src/public-api.ts` | Implement `onSetup` (intro + root + user prompts); adjust `onInit` auto-login |
| 4 | `packages/plugins/users/src/lib/services/cli-default-users-store.service.ts` | Remove hardcoded root seeding |
| 5 | `packages/plugins/users/src/lib/services/cli-default-auth.service.ts` | Remove root password seeding; change logout fallback to first admin |

---

## Future Considerations (out of scope)

- `configure reset-setup <module>` command to clear setup flag and re-trigger
- Other plugins adopting `onSetup` for their own config (API keys, preferences)
- Setup wizard with progress indicator for multi-step setups

---

## Testing Strategy

- **Unit:** Verify empty store after `initialize()` (no root seeding)
- **Unit:** Verify `logout()` falls back to first admin, not `root` by name
- **Integration:** Mock `ICliInputReader` to simulate user input through the full `onSetup` flow; verify both users created, passwords set, session established, setup flag persisted
- **Update existing tests** in `users-store.spec.ts` and `auth-service.spec.ts` to reflect removal of root seeding
