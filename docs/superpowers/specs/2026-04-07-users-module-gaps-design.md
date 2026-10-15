# Users Module Gap Fixes — Design Spec

**Date:** 2026-04-07
**Scope:** `@qodalis/cli-core` (interfaces/tokens) + `@qodalis/cli-users` (implementation)

## Problem

The `@qodalis/cli-users` module has several gaps that limit its usefulness:
1. `sessionTimeout` config exists but is never enforced
2. No password policy — any password accepted, including empty
3. No brute force protection — unlimited login attempts
4. No audit/login history — no `last` command, no event log
5. No user lifecycle events — plugins can't react to login/logout/user changes
6. No user metadata — `ICliUser` has no extensible `data` field
7. No last-login tracking — no way to see when a user last logged in

Session kick/force-logout is **out of scope** (requires server-side session tracking).

## Changes

### 1. ICliUser Model Extensions (`@qodalis/cli-core`)

Add two fields to `ICliUser`:

```typescript
export interface ICliUser {
    // ... existing fields ...
    /** Extensible metadata (department, phone, preferences, etc.) */
    data?: Record<string, any>;
    /** Timestamp of last successful login */
    lastLoginAt?: number;
}
```

Both are optional, so this is fully backward-compatible.

### 2. User Lifecycle Events (`@qodalis/cli-core` + `@qodalis/cli-users`)

**Interface** (`@qodalis/cli-core`):

```typescript
export interface ICliUserEvent {
    type: 'login' | 'logout' | 'login_failed' | 'user_created' | 'user_deleted'
        | 'user_updated' | 'password_changed';
    user: ICliUser;
    timestamp: number;
    details?: string;
}

export interface ICliUserEventService {
    readonly events$: Observable<ICliUserEvent>;
    emit(event: ICliUserEvent): void;
}
```

**Token:** `ICliUserEventService_TOKEN = 'cli-user-event-service'`

**Implementation** (`@qodalis/cli-users`): `CliDefaultUserEventService` — wraps an RxJS Subject. Plugins subscribe to `events$` to react to user changes.

### 3. Audit Service (`@qodalis/cli-core` + `@qodalis/cli-users`)

**Interface** (`@qodalis/cli-core`):

```typescript
export interface ICliAuditEntry {
    timestamp: number;
    event: string;
    username: string;
    details?: string;
}

export interface ICliAuditService {
    log(entry: Omit<ICliAuditEntry, 'timestamp'>): Promise<void>;
    getEntries(options?: { limit?: number; event?: string; username?: string }): Promise<ICliAuditEntry[]>;
    clear(): Promise<void>;
}
```

**Token:** `ICliAuditService_TOKEN = 'cli-audit-service'`

**Implementation** (`@qodalis/cli-users`): `CliDefaultAuditService` — persists entries to IndexedDB via `ICliKeyValueStore`. Subscribes to `ICliUserEventService.events$` to auto-log all user events. Caps stored entries at 500 (FIFO).

**New command:** `last` — displays login/logout history (like Unix `last`).

### 4. Password Policy (`@qodalis/cli-users`)

**Config extension:**

```typescript
export interface CliUsersModuleConfig {
    // ... existing fields ...
    passwordPolicy?: {
        minLength?: number;           // default: 0 (no minimum)
        requireUppercase?: boolean;   // default: false
        requireDigit?: boolean;       // default: false
        requireSpecialChar?: boolean; // default: false
    };
}
```

**Auth service changes:** Add `validatePassword(password: string): string | null` to `ICliAuthService`. Returns error message or null. Called from `setPassword()` and `CliPasswdCommandProcessor`.

### 5. Brute Force Protection (`@qodalis/cli-users`)

**Config extension:**

```typescript
export interface CliUsersModuleConfig {
    // ... existing fields ...
    bruteForceProtection?: {
        maxAttempts?: number;     // default: 5
        lockoutSeconds?: number;  // default: 60
    };
}
```

**Auth service changes:** In-memory `Map<string, { count, lockedUntil }>`. Checked in `login()` before authentication. Reset on successful login. Not persisted (resets on page reload — appropriate for browser CLI).

### 6. Session Timeout Enforcement (`@qodalis/cli-users`)

**Session service changes:** Add `isExpired(timeout: number): boolean` method to `CliDefaultUserSessionService`. Checks `lastActivity + timeout < Date.now()`.

**Module changes in `onInit()`:**
- On `restoreSession()`: check if expired, clear if so
- Start an interval (every 60s) that checks expiry and calls `clearSession()` + emits logout event
- Clean up interval in `onDestroy()`

### 7. Last Login Tracking (`@qodalis/cli-users`)

**Auth service changes:** After successful `login()`, call `usersStore.updateUser(user.id, { lastLoginAt: Date.now() })`.

**Processor changes:**
- `CliWhoamiCommandProcessor` — show `Last login: <date>` if available
- `CliListUsersCommandProcessor` — include last login column

## Files Changed

### `@qodalis/cli-core`

| File | Change |
|------|--------|
| `models/users.ts` | Add `data?`, `lastLoginAt?` to `ICliUser` |
| `interfaces/users.ts` | Add `validatePassword()` to `ICliAuthService` |
| `interfaces/audit.ts` | New — `ICliAuditEntry`, `ICliAuditService` |
| `interfaces/user-events.ts` | New — `ICliUserEvent`, `ICliUserEventService` |
| `tokens.ts` | Add `ICliAuditService_TOKEN`, `ICliUserEventService_TOKEN` |
| `public-api.ts` / index | Export new files |

### `@qodalis/cli-users`

| File | Change |
|------|--------|
| `models/users-module-config.ts` | Add `passwordPolicy`, `bruteForceProtection` |
| `services/cli-default-auth.service.ts` | Password validation, brute force, lastLoginAt, event emission |
| `services/cli-default-user-session.service.ts` | Add `isExpired()` |
| `services/cli-default-audit.service.ts` | New — audit persistence |
| `services/cli-default-user-event.service.ts` | New — event bus |
| `services/index.ts` | Export new services |
| `processors/cli-last-command-processor.ts` | New — `last` command |
| `processors/cli-login-command-processor.ts` | Emit login event |
| `processors/cli-logout-command-processor.ts` | Emit logout event |
| `processors/cli-passwd-command-processor.ts` | Password validation, emit event |
| `processors/cli-add-user-command-processor.ts` | Emit user_created event |
| `processors/cli-userdel-command-processor.ts` | Emit user_deleted event |
| `processors/cli-usermod-command-processor.ts` | Emit user_updated event |
| `processors/cli-whoami-command-processor.ts` | Show lastLoginAt |
| `processors/cli-list-users-command-processor.ts` | Show lastLoginAt |
| `processors/index.ts` | Export new processor |
| `public-api.ts` | Register new services, session timeout interval, add last processor |
| `tests/` | New + updated test files |

## Backward Compatibility

All changes are additive:
- New `ICliUser` fields are optional
- New config options default to disabled (no policy, no brute force, no timeout)
- New `validatePassword()` on `ICliAuthService` returns `null` by default (no validation)
- Event and audit services are new — existing code doesn't depend on them
