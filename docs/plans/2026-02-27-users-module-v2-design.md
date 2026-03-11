# Users Module v2.0 Design

## Overview

Complete redesign of the users/session system for Qodalis CLI v2.0. Linux-like user management commands, full group entities, password authentication with Web Crypto, IndexedDB persistence via existing `ICliKeyValueStore`, and clean abstractions for future server-backed implementations.

Clean break from v1 — no migration, no backwards compatibility.

## Data Models (in `core`)

### ICliUser

```typescript
interface ICliUser {
    id: string;
    name: string;           // login name (unique)
    email: string;          // unique
    groups: string[];       // group IDs
    homeDir?: string;       // virtual home directory, e.g. /home/root
    shell?: string;         // prompt config
    createdAt: number;      // timestamp
    updatedAt: number;
    disabled?: boolean;     // account locked
}

type CliAddUser = Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>;
type CliUpdateUser = Partial<Omit<ICliUser, 'id' | 'createdAt'>>;
```

### ICliUserCredentials (shadow pattern)

```typescript
interface ICliUserCredentials {
    userId: string;
    passwordHash: string;   // SHA-256 via Web Crypto
    salt: string;           // random salt per user
    lastChanged: number;
}
```

Credentials stored separately from user objects — `ICliUser` can be shared freely without leaking hashes.

### ICliGroup

```typescript
interface ICliGroup {
    id: string;
    name: string;           // unique group name
    description?: string;
    createdAt: number;
}
```

Full entities, not just string tags. Users reference group IDs.

### ICliUserSession

```typescript
interface ICliUserSession {
    user: ICliUser;
    loginTime: number;
    lastActivity: number;
    data?: Record<string, any>;  // extensible (tokens, etc.)
}
```

## Service Interfaces (in `core`)

### ICliUsersStoreService

```typescript
interface ICliUsersStoreService {
    getUsers(options?: { query?: string; skip?: number; take?: number }): Observable<ICliUser[]>;
    getUser(id: string): Observable<ICliUser | undefined>;
    createUser(user: CliAddUser): Promise<ICliUser>;
    updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser>;
    deleteUser(id: string): Promise<void>;
}
```

### ICliGroupsStoreService (new)

```typescript
interface ICliGroupsStoreService {
    getGroups(): Observable<ICliGroup[]>;
    getGroup(id: string): Observable<ICliGroup | undefined>;
    createGroup(name: string, description?: string): Promise<ICliGroup>;
    deleteGroup(id: string): Promise<void>;
    getGroupMembers(groupId: string): Observable<ICliUser[]>;
}
```

### ICliAuthService (new)

```typescript
interface ICliAuthService {
    login(username: string, password: string): Promise<ICliUserSession>;
    logout(): Promise<void>;
    setPassword(userId: string, password: string): Promise<void>;
    verifyPassword(userId: string, password: string): Promise<boolean>;
    hashPassword(password: string, salt: string): Promise<string>;
}
```

Owns all password logic. Credentials storage is internal to the implementation.

### ICliUserSessionService

```typescript
interface ICliUserSessionService {
    getUserSession(): Observable<ICliUserSession | undefined>;
    setUserSession(session: ICliUserSession): Promise<void>;
    clearSession(): Promise<void>;
    persistSession(): Promise<void>;
    restoreSession(): Promise<ICliUserSession | undefined>;
}
```

## Commands

| Command | Aliases | Description | Key Parameters |
|---|---|---|---|
| `whoami` | `me` | Show current user | `--info/-i` detailed |
| `id` | — | Show user ID, groups, GIDs | `[username]` |
| `adduser` | `useradd` | Create user | `--email`, `--groups`, `--home`, `--disabled` |
| `userdel` | `deluser` | Delete user | `[username]`, `--force/-f` |
| `usermod` | — | Modify user | `[username]`, `--email`, `--groups`, `--add-groups`, `--remove-groups`, `--home`, `--disable`, `--enable` |
| `passwd` | — | Change password | `[username]` (defaults to current) |
| `su` | `switch-user` | Switch user | `[username]`, `--login/-l` |
| `login` | — | Login with credentials | `[username]` |
| `logout` | `exit-session` | End session | — |
| `groups` | — | Show user's groups | `[username]` |
| `groupadd` | `addgroup` | Create group | `[name]`, `--description` |
| `groupdel` | `delgroup` | Delete group | `[name]`, `--force/-f` |
| `w` | `who` | Show session info | — |

## Default Implementations (in `users` project)

### File structure

```
users/src/lib/services/
├── cli-default-users-store.service.ts      # ICliKeyValueStore-backed
├── cli-default-groups-store.service.ts     # ICliKeyValueStore-backed
├── cli-default-auth.service.ts             # Web Crypto hashing, credentials in ICliKeyValueStore
├── cli-default-user-session.service.ts     # persist/restore via ICliKeyValueStore
```

### IndexedDB storage keys

| Key | Data |
|---|---|
| `cli-users` | `ICliUser[]` |
| `cli-groups` | `ICliGroup[]` |
| `cli-credentials` | `ICliUserCredentials[]` |
| `cli-session` | `ICliUserSession` |

All services receive `ICliKeyValueStore` through DI (`services.get('cli-key-value-store')`).

### Initialization flow (module `onInit`)

1. KeyValueStore already initialized by CLI framework
2. Users store loads from `cli-users`, seeds default root user + admin group if empty
3. Credentials store loads from `cli-credentials`
4. Session service calls `restoreSession()` — restore if valid, otherwise anonymous
5. Subscribe session to execution context

### Password hashing

```typescript
async hashPassword(password: string, salt: string): Promise<string> {
    const data = new TextEncoder().encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

Salt generated per-user via `crypto.getRandomValues()`. Root gets default password `root`.

### Module registration

```typescript
export const usersModule: ICliModule = {
    name: '@qodalis/cli-users',
    processors: [/* all 13 commands */],
    services: [
        { provide: ICliUsersStoreService_TOKEN, useFactory: () => new CliDefaultUsersStoreService() },
        { provide: ICliGroupsStoreService_TOKEN, useFactory: () => new CliDefaultGroupsStoreService() },
        { provide: ICliAuthService_TOKEN, useFactory: () => new CliDefaultAuthService() },
    ],
    async onInit(context) {
        const kvStore = context.services.get<ICliKeyValueStore>('cli-key-value-store');
        // Initialize all stores with kvStore, setup session, subscribe to context
    }
};
```

## Permission Model

- **admin group**: `adduser`, `userdel`, `usermod`, `groupadd`, `groupdel`, `passwd [other-user]`
- **regular users**: `passwd` (own only), `whoami`, `id`, `groups`, `su` (with password), `login`, `logout`, `w`
- Root is always in `admin` group
- `su` from admin skips password prompt (like Linux root)

## Interactive Input

Uses existing `ICliInputReader.readPassword()` for masked input in `passwd`, `login`, `su`.
Uses `readConfirm()` for destructive operations like `userdel` without `--force`.

## Error Messages (Linux conventions)

- `adduser: user 'bob' already exists`
- `userdel: user 'bob' does not exist`
- `su: Authentication failure`
- `passwd: permission denied`

## Default Seeding

On fresh install with empty IndexedDB:
- Create `admin` group
- Create `root` user (name: root, email: root@localhost, groups: [admin], password: root)
- First login hint: "Run 'passwd' to change the default password."

## Swappability

Any service can be replaced independently:

```typescript
// Server-backed auth:
services: [
    { provide: ICliAuthService_TOKEN, useValue: new MyServerAuthService(httpClient) }
]

// Server-backed users:
services: [
    { provide: ICliUsersStoreService_TOKEN, useValue: new MyApiUsersStore(httpClient) }
]
```
