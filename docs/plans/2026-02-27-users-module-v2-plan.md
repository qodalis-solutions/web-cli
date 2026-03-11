# Users Module v2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the users/session system with Linux-like commands, full group entities, password auth via Web Crypto, IndexedDB persistence, and clean abstractions — all as an optional module.

**Architecture:** Expand core with new interfaces/models (ICliGroup, ICliUserCredentials, ICliAuthService, ICliGroupsStoreService). Default implementations in the `users` project use the existing `ICliKeyValueStore` (IndexedDB) instead of localStorage. The CLI framework never depends on the users module — it remains fully optional.

**Tech Stack:** Angular 16, TypeScript, Web Crypto API (SHA-256), IndexedDB via existing ICliKeyValueStore, RxJS

**Design doc:** `docs/plans/2026-02-27-users-module-v2-design.md`

---

## Task 0: Add Module Configuration Support to Core

This is a cross-cutting concern: add a `configure()` method pattern to `ICliModule` so any module can accept typed configuration.

**Files:**
- Modify: `projects/core/src/lib/interfaces/index.ts` (ICliModule definition)

**Step 1: Add config support to ICliModule**

Add a `config` property and document the `configure()` pattern. The interface change:

```typescript
export interface ICliModule {
    // ... existing fields (name, version, description, dependencies, processors, services, onInit, onDestroy)

    /** Module configuration, set via configure() */
    config?: Record<string, any>;

    /**
     * Returns a configured copy of this module.
     * Usage: usersModule.configure({ defaultPassword: 'admin', seedUsers: [...] })
     */
    configure?(config: Record<string, any>): ICliModule;
}
```

**Step 2: Verify core builds**

Run: `npm run "build core"`
Expected: Build succeeds. Additive change, no breakage.

**Step 3: Commit**

```bash
git add projects/core/src/lib/interfaces/index.ts
git commit -m "feat(core): add config and configure() to ICliModule for per-module configuration"
```

---

## Task 1: Update Core Models

**Files:**
- Modify: `projects/core/src/lib/models/users.ts`

**Step 1: Replace the models file with the v2 types**

```typescript
import { Observable } from 'rxjs';

/**
 * Represents a user in the CLI
 */
export interface ICliUser {
    /** Unique user identifier */
    id: string;
    /** Login name (unique) */
    name: string;
    /** Email address (unique) */
    email: string;
    /** Group IDs this user belongs to */
    groups: string[];
    /** Virtual home directory path, e.g. /home/root */
    homeDir?: string;
    /** Default shell/prompt configuration */
    shell?: string;
    /** Account creation timestamp */
    createdAt: number;
    /** Last modification timestamp */
    updatedAt: number;
    /** Whether the account is locked */
    disabled?: boolean;
}

/**
 * Represents user credentials (shadow pattern — stored separately from ICliUser)
 */
export interface ICliUserCredentials {
    /** The user ID this credential belongs to */
    userId: string;
    /** SHA-256 hash of salt + password */
    passwordHash: string;
    /** Random salt for this user */
    salt: string;
    /** Timestamp of last password change */
    lastChanged: number;
}

/**
 * Represents a group in the CLI
 */
export interface ICliGroup {
    /** Unique group identifier */
    id: string;
    /** Group name (unique) */
    name: string;
    /** Optional group description */
    description?: string;
    /** Group creation timestamp */
    createdAt: number;
}

/**
 * Represents an active user session
 */
export interface ICliUserSession {
    /** The user associated with this session */
    user: ICliUser;
    /** Timestamp when the session started */
    loginTime: number;
    /** Timestamp of last activity */
    lastActivity: number;
    /** Extensible data (tokens, metadata, etc.) */
    data?: Record<string, any>;
}

/** Fields required to create a new user */
export type CliAddUser = Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>;

/** Fields that can be updated on a user */
export type CliUpdateUser = Partial<Omit<ICliUser, 'id' | 'createdAt'>>;
```

**Step 2: Verify core builds**

Run: `npm run "build core"` from the `angular-web-cli` directory.
Expected: Build succeeds. There will be compilation errors in downstream projects (`users`, `cli`, `demo`) — that's expected since they reference the old types. We'll fix those in subsequent tasks.

**Step 3: Commit**

```bash
git add projects/core/src/lib/models/users.ts
git commit -m "feat(core): update user models for v2 — add ICliGroup, ICliUserCredentials, timestamps"
```

---

## Task 2: Update Core Interfaces

**Files:**
- Modify: `projects/core/src/lib/interfaces/users.ts`
- Modify: `projects/core/src/lib/tokens.ts`

**Step 1: Replace the interfaces file with v2 service interfaces**

```typescript
import { ICliUserSession, ICliUser, ICliGroup, CliAddUser, CliUpdateUser } from '../models';
import { Observable } from 'rxjs';

/**
 * Represents a service that manages user sessions in the CLI
 */
export interface ICliUserSessionService {
    /** Gets the current user session as a reactive stream */
    getUserSession(): Observable<ICliUserSession | undefined>;

    /** Sets the current user session */
    setUserSession(session: ICliUserSession): Promise<void>;

    /** Clears the current session (logout) */
    clearSession(): Promise<void>;

    /** Persists the current session to storage */
    persistSession(): Promise<void>;

    /** Restores a session from storage (called on boot) */
    restoreSession(): Promise<ICliUserSession | undefined>;
}

/**
 * Represents a service that manages users in the CLI
 */
export interface ICliUsersStoreService {
    /** Gets users with optional filtering and pagination */
    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]>;

    /** Creates a new user */
    createUser(user: CliAddUser): Promise<ICliUser>;

    /** Gets a user by id, name, or email */
    getUser(id: string): Observable<ICliUser | undefined>;

    /** Updates an existing user */
    updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser>;

    /** Deletes a user by id */
    deleteUser(id: string): Promise<void>;
}

/**
 * Represents a service that manages groups in the CLI
 */
export interface ICliGroupsStoreService {
    /** Gets all groups */
    getGroups(): Observable<ICliGroup[]>;

    /** Gets a group by id or name */
    getGroup(id: string): Observable<ICliGroup | undefined>;

    /** Creates a new group */
    createGroup(name: string, description?: string): Promise<ICliGroup>;

    /** Deletes a group by id */
    deleteGroup(id: string): Promise<void>;

    /** Gets all users that belong to a group */
    getGroupMembers(groupId: string): Observable<ICliUser[]>;
}

/**
 * Represents a service that handles authentication in the CLI
 */
export interface ICliAuthService {
    /** Authenticates a user and returns a session */
    login(username: string, password: string): Promise<ICliUserSession>;

    /** Ends the current session */
    logout(): Promise<void>;

    /** Sets or updates a user's password */
    setPassword(userId: string, password: string): Promise<void>;

    /** Verifies a password against stored credentials */
    verifyPassword(userId: string, password: string): Promise<boolean>;

    /** Hashes a password with a salt using Web Crypto SHA-256 */
    hashPassword(password: string, salt: string): Promise<string>;
}
```

**Step 2: Add new DI tokens to `tokens.ts`**

Add these two new tokens after the existing ones:

```typescript
/**
 * Framework-agnostic token for the CLI groups store service.
 */
export const ICliGroupsStoreService_TOKEN = 'cli-groups-store-service';

/**
 * Framework-agnostic token for the CLI auth service.
 */
export const ICliAuthService_TOKEN = 'cli-auth-service';
```

**Step 3: Make sure the new types and tokens are exported from core's public API**

Check `projects/core/src/lib/models/index.ts` — it should already re-export `./users`. Same for `projects/core/src/lib/interfaces/index.ts` re-exporting `./users`, and `projects/core/src/public-api.ts` re-exporting models and tokens. If `ICliGroupsStoreService`, `ICliAuthService`, `ICliGroup`, `ICliUserCredentials`, and the new tokens aren't accessible via `@qodalis/cli-core`, add the exports.

**Step 4: Verify core builds**

Run: `npm run "build core"`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add projects/core/src/lib/interfaces/users.ts projects/core/src/lib/tokens.ts
# Also add any export files if modified
git commit -m "feat(core): add ICliGroupsStoreService, ICliAuthService interfaces and DI tokens"
```

---

## Task 3: Implement Default Groups Store Service

**Files:**
- Create: `projects/users/src/lib/services/cli-default-groups-store.service.ts`

**Step 1: Write the groups store implementation**

```typescript
import {
    ICliGroupsStoreService,
    ICliGroup,
    ICliUser,
    ICliUsersStoreService,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable, map } from 'rxjs';

const STORAGE_KEY = 'cli-groups';

export class CliDefaultGroupsStoreService implements ICliGroupsStoreService {
    private groupsSubject = new BehaviorSubject<ICliGroup[]>([]);
    private kvStore!: ICliKeyValueStore;
    private usersStore!: ICliUsersStoreService;

    async initialize(kvStore: ICliKeyValueStore, usersStore: ICliUsersStoreService): Promise<void> {
        this.kvStore = kvStore;
        this.usersStore = usersStore;

        const stored = await kvStore.get<ICliGroup[]>(STORAGE_KEY);
        if (stored && stored.length > 0) {
            this.groupsSubject.next(stored);
        } else {
            // Seed default admin group
            const adminGroup: ICliGroup = {
                id: 'admin',
                name: 'admin',
                description: 'System administrators',
                createdAt: Date.now(),
            };
            this.groupsSubject.next([adminGroup]);
            await this.persist();
        }
    }

    getGroups(): Observable<ICliGroup[]> {
        return this.groupsSubject.asObservable();
    }

    getGroup(id: string): Observable<ICliGroup | undefined> {
        return this.groupsSubject.asObservable().pipe(
            map(groups => groups.find(g => g.id === id || g.name === id)),
        );
    }

    async createGroup(name: string, description?: string): Promise<ICliGroup> {
        const groups = this.groupsSubject.getValue();

        if (groups.some(g => g.name === name)) {
            throw new Error(`groupadd: group '${name}' already exists`);
        }

        const group: ICliGroup = {
            id: name,
            name,
            description,
            createdAt: Date.now(),
        };

        const updated = [...groups, group];
        this.groupsSubject.next(updated);
        await this.persist();
        return group;
    }

    async deleteGroup(id: string): Promise<void> {
        const groups = this.groupsSubject.getValue();
        const group = groups.find(g => g.id === id || g.name === id);

        if (!group) {
            throw new Error(`groupdel: group '${id}' does not exist`);
        }

        if (group.name === 'admin') {
            throw new Error(`groupdel: cannot delete the admin group`);
        }

        const updated = groups.filter(g => g.id !== group.id);
        this.groupsSubject.next(updated);
        await this.persist();
    }

    getGroupMembers(groupId: string): Observable<ICliUser[]> {
        return this.usersStore.getUsers().pipe(
            map(users => users.filter(u => u.groups.includes(groupId))),
        );
    }

    private async persist(): Promise<void> {
        await this.kvStore.set(STORAGE_KEY, this.groupsSubject.getValue());
    }
}
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/services/cli-default-groups-store.service.ts
git commit -m "feat(users): add default IndexedDB-backed groups store service"
```

---

## Task 4: Rewrite Default Users Store Service

**Files:**
- Modify: `projects/users/src/lib/services/cli-default-users-store.service.ts`

**Step 1: Replace with IndexedDB-backed implementation**

```typescript
import {
    ICliUser,
    ICliUsersStoreService,
    ICliKeyValueStore,
    CliAddUser,
    CliUpdateUser,
} from '@qodalis/cli-core';
import { BehaviorSubject, map, Observable } from 'rxjs';

const STORAGE_KEY = 'cli-users';

export class CliDefaultUsersStoreService implements ICliUsersStoreService {
    private usersSubject = new BehaviorSubject<ICliUser[]>([]);
    private kvStore!: ICliKeyValueStore;

    async initialize(kvStore: ICliKeyValueStore): Promise<void> {
        this.kvStore = kvStore;

        const stored = await kvStore.get<ICliUser[]>(STORAGE_KEY);
        if (stored && stored.length > 0) {
            this.usersSubject.next(stored);
        } else {
            // Seed default root user
            const now = Date.now();
            const rootUser: ICliUser = {
                id: 'root',
                name: 'root',
                email: 'root@localhost',
                groups: ['admin'],
                homeDir: '/home/root',
                createdAt: now,
                updatedAt: now,
            };
            this.usersSubject.next([rootUser]);
            await this.persist();
        }
    }

    async createUser(user: CliAddUser): Promise<ICliUser> {
        const users = this.usersSubject.getValue();

        if (users.some(u => u.email === user.email || u.name === user.name)) {
            throw new Error(`adduser: user '${user.name}' already exists`);
        }

        const now = Date.now();
        const newUser: ICliUser = {
            ...user,
            id: crypto.randomUUID(),
            groups: user.groups || [],
            createdAt: now,
            updatedAt: now,
        };

        const updated = [...users, newUser];
        this.usersSubject.next(updated);
        await this.persist();
        return newUser;
    }

    async updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser> {
        const users = this.usersSubject.getValue();
        const index = users.findIndex(u => u.id === id || u.name === id || u.email === id);

        if (index === -1) {
            throw new Error(`usermod: user '${id}' does not exist`);
        }

        // Check uniqueness if name or email is being changed
        if (updates.name && updates.name !== users[index].name) {
            if (users.some(u => u.name === updates.name)) {
                throw new Error(`usermod: name '${updates.name}' is already taken`);
            }
        }
        if (updates.email && updates.email !== users[index].email) {
            if (users.some(u => u.email === updates.email)) {
                throw new Error(`usermod: email '${updates.email}' is already taken`);
            }
        }

        const updatedUser: ICliUser = {
            ...users[index],
            ...updates,
            updatedAt: Date.now(),
        };

        const updated = [...users];
        updated[index] = updatedUser;
        this.usersSubject.next(updated);
        await this.persist();
        return updatedUser;
    }

    async deleteUser(id: string): Promise<void> {
        const users = this.usersSubject.getValue();
        const user = users.find(u => u.id === id || u.name === id || u.email === id);

        if (!user) {
            throw new Error(`userdel: user '${id}' does not exist`);
        }

        const updated = users.filter(u => u.id !== user.id);
        this.usersSubject.next(updated);
        await this.persist();
    }

    getUsers(options?: {
        query?: string;
        skip?: number;
        take?: number;
    }): Observable<ICliUser[]> {
        const { query, skip, take } = options || {};

        return this.usersSubject.asObservable().pipe(
            map(users => {
                if (query) {
                    const q = query.toLowerCase();
                    users = users.filter(
                        u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
                    );
                }
                if (skip) {
                    users = users.slice(skip);
                }
                if (take) {
                    users = users.slice(0, take);
                }
                return users;
            }),
        );
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return this.usersSubject.asObservable().pipe(
            map(users => users.find(u => u.id === id || u.name === id || u.email === id)),
        );
    }

    private async persist(): Promise<void> {
        await this.kvStore.set(STORAGE_KEY, this.usersSubject.getValue());
    }
}
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/services/cli-default-users-store.service.ts
git commit -m "feat(users): rewrite users store with IndexedDB via ICliKeyValueStore"
```

---

## Task 5: Implement Default Auth Service

**Files:**
- Create: `projects/users/src/lib/services/cli-default-auth.service.ts`

**Step 1: Write the auth service**

```typescript
import {
    ICliAuthService,
    ICliUserSession,
    ICliUserCredentials,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

const CREDENTIALS_KEY = 'cli-credentials';

export class CliDefaultAuthService implements ICliAuthService {
    private credentials: ICliUserCredentials[] = [];
    private kvStore!: ICliKeyValueStore;
    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;

    async initialize(
        kvStore: ICliKeyValueStore,
        usersStore: ICliUsersStoreService,
        sessionService: ICliUserSessionService,
    ): Promise<void> {
        this.kvStore = kvStore;
        this.usersStore = usersStore;
        this.sessionService = sessionService;

        const stored = await kvStore.get<ICliUserCredentials[]>(CREDENTIALS_KEY);
        this.credentials = stored || [];

        // Seed default root password if no credentials exist
        if (this.credentials.length === 0) {
            const rootUser = await firstValueFrom(usersStore.getUser('root'));
            if (rootUser) {
                await this.setPassword(rootUser.id, 'root');
            }
        }
    }

    async login(username: string, password: string): Promise<ICliUserSession> {
        const user = await firstValueFrom(this.usersStore.getUser(username));

        if (!user) {
            throw new Error('login: Authentication failure');
        }

        if (user.disabled) {
            throw new Error('login: Account is disabled');
        }

        const valid = await this.verifyPassword(user.id, password);
        if (!valid) {
            throw new Error('login: Authentication failure');
        }

        const session: ICliUserSession = {
            user,
            loginTime: Date.now(),
            lastActivity: Date.now(),
        };

        await this.sessionService.setUserSession(session);
        await this.sessionService.persistSession();

        return session;
    }

    async logout(): Promise<void> {
        await this.sessionService.clearSession();
    }

    async setPassword(userId: string, password: string): Promise<void> {
        const salt = this.generateSalt();
        const passwordHash = await this.hashPassword(password, salt);

        const existing = this.credentials.findIndex(c => c.userId === userId);
        const cred: ICliUserCredentials = {
            userId,
            passwordHash,
            salt,
            lastChanged: Date.now(),
        };

        if (existing >= 0) {
            this.credentials[existing] = cred;
        } else {
            this.credentials.push(cred);
        }

        await this.persistCredentials();
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const cred = this.credentials.find(c => c.userId === userId);
        if (!cred) {
            return false;
        }

        const hash = await this.hashPassword(password, cred.salt);
        return hash === cred.passwordHash;
    }

    async hashPassword(password: string, salt: string): Promise<string> {
        const data = new TextEncoder().encode(salt + password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private generateSalt(): string {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private async persistCredentials(): Promise<void> {
        await this.kvStore.set(CREDENTIALS_KEY, this.credentials);
    }
}
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/services/cli-default-auth.service.ts
git commit -m "feat(users): add default auth service with Web Crypto password hashing"
```

---

## Task 6: Rewrite Default User Session Service

**Files:**
- Modify: `projects/users/src/lib/services/cli-default-user-session.service.ts`

**Step 1: Replace with IndexedDB-persistent session service**

```typescript
import {
    ICliUserSessionService,
    ICliUserSession,
    ICliKeyValueStore,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';

const SESSION_KEY = 'cli-session';

export class CliDefaultUserSessionService implements ICliUserSessionService {
    private sessionSubject = new BehaviorSubject<ICliUserSession | undefined>(undefined);
    private kvStore!: ICliKeyValueStore;

    async initialize(kvStore: ICliKeyValueStore): Promise<void> {
        this.kvStore = kvStore;
    }

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.sessionSubject.asObservable();
    }

    async setUserSession(session: ICliUserSession): Promise<void> {
        this.sessionSubject.next(session);
        await this.persistSession();
    }

    async clearSession(): Promise<void> {
        this.sessionSubject.next(undefined);
        await this.kvStore.remove(SESSION_KEY);
    }

    async persistSession(): Promise<void> {
        const session = this.sessionSubject.getValue();
        if (session) {
            await this.kvStore.set(SESSION_KEY, session);
        }
    }

    async restoreSession(): Promise<ICliUserSession | undefined> {
        const stored = await this.kvStore.get<ICliUserSession>(SESSION_KEY);
        if (stored) {
            this.sessionSubject.next(stored);
        }
        return stored;
    }
}
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/services/cli-default-user-session.service.ts
git commit -m "feat(users): rewrite session service with IndexedDB persistence and restore"
```

---

## Task 7: Update Service Exports

**Files:**
- Modify: `projects/users/src/lib/services/index.ts`

**Step 1: Export all services**

```typescript
export { CliDefaultUsersStoreService } from './cli-default-users-store.service';
export { CliDefaultUserSessionService } from './cli-default-user-session.service';
export { CliDefaultGroupsStoreService } from './cli-default-groups-store.service';
export { CliDefaultAuthService } from './cli-default-auth.service';
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/services/index.ts
git commit -m "feat(users): export new groups and auth services"
```

---

## Task 8: Rewrite Existing Command Processors

The four existing processors need updating for the v2 models and conventions.

**Files:**
- Modify: `projects/users/src/lib/processors/cli-whoami-command-processor.ts`
- Modify: `projects/users/src/lib/processors/cli-add-user-command-processor.ts`
- Modify: `projects/users/src/lib/processors/cli-list-users-command-processor.ts`
- Modify: `projects/users/src/lib/processors/cli-switch-user-command-processor.ts`

**Step 1: Update `whoami` — add `id` display, use updated session types**

Key changes:
- `--info` should now show groups, homeDir, createdAt, loginTime
- Session now has `loginTime` and `lastActivity`

**Step 2: Update `adduser` — prompt for password after creation**

Key changes:
- After creating the user, call `authService.setPassword()` with an interactively entered password via `context.reader.readPassword()`
- Check that current user is in `admin` group before allowing
- Add `--home` and `--disabled` parameters

**Step 3: Update `listusers` — display new fields**

Key changes:
- Table should show id, name, email, groups, disabled status
- Alias stays `users`

**Step 4: Update `su` — prompt for password**

Key changes:
- Use `context.reader.readPassword('Password: ')` to prompt
- Use `authService.verifyPassword()` to check
- Skip password if current user is in `admin` group
- Create a proper `ICliUserSession` with `loginTime`
- Remove the `--reload` parameter (v1 artifact)

**Step 5: Commit**

```bash
git add projects/users/src/lib/processors/
git commit -m "feat(users): update existing processors for v2 models and auth"
```

---

## Task 9: Implement New Command Processors — `userdel`, `usermod`, `passwd`

**Files:**
- Create: `projects/users/src/lib/processors/cli-userdel-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-usermod-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-passwd-command-processor.ts`

**Step 1: `userdel` command**

```typescript
import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';
import { requireAdmin } from '../utils/permissions';

export class CliUserdelCommandProcessor implements ICliCommandProcessor {
    command = 'userdel';
    aliases = ['deluser'];
    description = 'Delete a user';
    author = DefaultLibraryAuthor;
    allowUnlistedCommands = true;
    valueRequired = true;
    metadata: CliProcessorMetadata = { sealed: true, module: 'users', icon: CliIcon.User };
    parameters: ICliCommandParameterDescriptor[] = [
        { name: 'force', aliases: ['f'], description: 'Skip confirmation', type: 'boolean', required: false },
    ];

    private usersStore!: ICliUsersStoreService;
    private sessionService!: ICliUserSessionService;

    async initialize(context: ICliExecutionContext): Promise<void> {
        this.usersStore = context.services.get<ICliUsersStoreService>(ICliUsersStoreService_TOKEN);
        this.sessionService = context.services.get<ICliUserSessionService>(ICliUserSessionService_TOKEN);
    }

    async processCommand(command: CliProcessCommand, context: ICliExecutionContext): Promise<void> {
        if (!requireAdmin(context)) return;

        const target = command.value as string;
        const user = await firstValueFrom(this.usersStore.getUser(target));

        if (!user) {
            context.writer.writeError(`userdel: user '${target}' does not exist`);
            return;
        }

        const session = await firstValueFrom(this.sessionService.getUserSession());
        if (session && session.user.id === user.id) {
            context.writer.writeError(`userdel: cannot delete the currently logged-in user`);
            return;
        }

        if (!command.args['force'] && !command.args['f']) {
            const confirmed = await context.reader.readConfirm(`Delete user '${user.name}'?`);
            if (!confirmed) {
                context.writer.writeln('Cancelled.');
                return;
            }
        }

        await this.usersStore.deleteUser(user.id);
        context.writer.writeSuccess(`userdel: user '${user.name}' deleted`);
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Delete a user from the system');
        writer.writeln();
        writer.writeln(`  ${writer.wrapInColor('userdel <username>', CliForegroundColor.Cyan)}`);
        writer.writeln(`  ${writer.wrapInColor('userdel <username> --force', CliForegroundColor.Cyan)}    Skip confirmation`);
    }
}
```

**Step 2: `usermod` command**

Accepts `[username]` as value. Parameters: `--email`, `--groups` (replace), `--add-groups`, `--remove-groups`, `--home`, `--disable`, `--enable`. Requires admin. Uses `usersStore.updateUser()`.

**Step 3: `passwd` command**

Accepts optional `[username]` (defaults to current user). If changing own password: prompts for current password first, then new + confirm. If admin changing another user's: prompts for new + confirm only. Uses `authService.setPassword()` and `authService.verifyPassword()`.

Interactive flow:
```
Current password:
New password:
Retype new password:
passwd: password updated successfully
```

**Step 4: Commit**

```bash
git add projects/users/src/lib/processors/
git commit -m "feat(users): add userdel, usermod, passwd command processors"
```

---

## Task 10: Implement New Command Processors — `login`, `logout`, `id`

**Files:**
- Create: `projects/users/src/lib/processors/cli-login-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-logout-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-id-command-processor.ts`

**Step 1: `login` command**

Accepts optional `[username]` as value. If not provided, prompts via `readLine`. Then prompts for password via `readPassword`. Calls `authService.login()`. On success, prints session info. On failure, prints `login: Authentication failure`.

**Step 2: `logout` command**

No parameters. Calls `authService.logout()`. Prints `Logged out.` Session goes to undefined (no user in prompt).

**Step 3: `id` command**

Accepts optional `[username]`. Shows: `uid=<id> name=<name> groups=<group1>,<group2>`. If no username, shows current user's info from session.

**Step 4: Commit**

```bash
git add projects/users/src/lib/processors/
git commit -m "feat(users): add login, logout, id command processors"
```

---

## Task 11: Implement New Command Processors — `groups`, `groupadd`, `groupdel`, `w`

**Files:**
- Create: `projects/users/src/lib/processors/cli-groups-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-groupadd-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-groupdel-command-processor.ts`
- Create: `projects/users/src/lib/processors/cli-who-command-processor.ts`

**Step 1: `groups` command**

Accepts optional `[username]`. Lists group names for the user. If no username, uses current session user. Output: `username : group1 group2 group3`

**Step 2: `groupadd` command**

Accepts `[name]` as value. `--description` parameter. Requires admin. Calls `groupsStore.createGroup()`.

**Step 3: `groupdel` command**

Accepts `[name]` as value. `--force/-f` parameter. Requires admin. Calls `groupsStore.deleteGroup()`. Confirms before deleting.

**Step 4: `w` command**

Aliases: `who`. Shows current session info in a table: USER, TTY (always `web`), LOGIN@, IDLE, WHAT (last command or `-`). Uses session's `loginTime` and `lastActivity`.

**Step 5: Commit**

```bash
git add projects/users/src/lib/processors/
git commit -m "feat(users): add groups, groupadd, groupdel, w command processors"
```

---

## Task 12: Create Permissions Helper

**Files:**
- Create: `projects/users/src/lib/utils/permissions.ts`

**Step 1: Write the helper**

```typescript
import { ICliExecutionContext } from '@qodalis/cli-core';

/**
 * Checks if the current user is in the admin group.
 * Writes an error and returns false if not.
 */
export function requireAdmin(context: ICliExecutionContext): boolean {
    const session = context.userSession;
    if (!session || !session.user.groups.includes('admin')) {
        context.writer.writeError('permission denied');
        return false;
    }
    return true;
}

/**
 * Checks if the current user is the given user or is an admin.
 */
export function requireSelfOrAdmin(context: ICliExecutionContext, targetUserId: string): boolean {
    const session = context.userSession;
    if (!session) {
        context.writer.writeError('permission denied');
        return false;
    }
    if (session.user.id === targetUserId || session.user.groups.includes('admin')) {
        return true;
    }
    context.writer.writeError('permission denied');
    return false;
}
```

**Step 2: Commit**

```bash
git add projects/users/src/lib/utils/
git commit -m "feat(users): add permission helper utilities"
```

Note: This task can be done before or alongside Tasks 9-11. The processors reference `requireAdmin` from this file.

---

## Task 13: Update Processor Exports and Module Registration

**Files:**
- Modify: `projects/users/src/lib/processors/index.ts`
- Modify: `projects/users/src/public-api.ts`

**Step 1: Update processor exports**

```typescript
export { CliWhoamiCommandProcessor } from './cli-whoami-command-processor';
export { CliAddUserCommandProcessor } from './cli-add-user-command-processor';
export { CliListUsersCommandProcessor } from './cli-list-users-command-processor';
export { CliSwitchUserCommandProcessor } from './cli-switch-user-command-processor';
export { CliUserdelCommandProcessor } from './cli-userdel-command-processor';
export { CliUsermodCommandProcessor } from './cli-usermod-command-processor';
export { CliPasswdCommandProcessor } from './cli-passwd-command-processor';
export { CliLoginCommandProcessor } from './cli-login-command-processor';
export { CliLogoutCommandProcessor } from './cli-logout-command-processor';
export { CliIdCommandProcessor } from './cli-id-command-processor';
export { CliGroupsCommandProcessor } from './cli-groups-command-processor';
export { CliGroupaddCommandProcessor } from './cli-groupadd-command-processor';
export { CliGroupdelCommandProcessor } from './cli-groupdel-command-processor';
export { CliWhoCommandProcessor } from './cli-who-command-processor';
```

**Step 2: Define the users module config type**

Create `projects/users/src/lib/models/users-module-config.ts`:

```typescript
import { ICliUser } from '@qodalis/cli-core';

export interface CliUsersModuleConfig {
    /** Default password for seeded users (default: 'root') */
    defaultPassword?: string;
    /** Users to seed on first boot (in addition to root) */
    seedUsers?: Array<Omit<ICliUser, 'id' | 'createdAt' | 'updatedAt'>>;
    /** Whether su requires a password (default: true, admin users skip) */
    requirePasswordOnSu?: boolean;
    /** Session timeout in ms (0 = no timeout, default: 0) */
    sessionTimeout?: number;
}
```

**Step 3: Rewrite the module registration in `public-api.ts`**

```typescript
/*
 * Public API Surface of users
 */

export * from './lib/processors';
export * from './lib/services';
export * from './lib/models/users-module-config';

import {
    ICliModule,
    ICliKeyValueStore,
    ICliUsersStoreService,
    ICliUserSessionService,
    ICliGroupsStoreService,
    ICliAuthService,
    ICliUsersStoreService_TOKEN,
    ICliUserSessionService_TOKEN,
    ICliGroupsStoreService_TOKEN,
    ICliAuthService_TOKEN,
} from '@qodalis/cli-core';

import { CliWhoamiCommandProcessor } from './lib/processors/cli-whoami-command-processor';
import { CliAddUserCommandProcessor } from './lib/processors/cli-add-user-command-processor';
import { CliListUsersCommandProcessor } from './lib/processors/cli-list-users-command-processor';
import { CliSwitchUserCommandProcessor } from './lib/processors/cli-switch-user-command-processor';
import { CliUserdelCommandProcessor } from './lib/processors/cli-userdel-command-processor';
import { CliUsermodCommandProcessor } from './lib/processors/cli-usermod-command-processor';
import { CliPasswdCommandProcessor } from './lib/processors/cli-passwd-command-processor';
import { CliLoginCommandProcessor } from './lib/processors/cli-login-command-processor';
import { CliLogoutCommandProcessor } from './lib/processors/cli-logout-command-processor';
import { CliIdCommandProcessor } from './lib/processors/cli-id-command-processor';
import { CliGroupsCommandProcessor } from './lib/processors/cli-groups-command-processor';
import { CliGroupaddCommandProcessor } from './lib/processors/cli-groupadd-command-processor';
import { CliGroupdelCommandProcessor } from './lib/processors/cli-groupdel-command-processor';
import { CliWhoCommandProcessor } from './lib/processors/cli-who-command-processor';

import { CliDefaultUsersStoreService } from './lib/services/cli-default-users-store.service';
import { CliDefaultUserSessionService } from './lib/services/cli-default-user-session.service';
import { CliDefaultGroupsStoreService } from './lib/services/cli-default-groups-store.service';
import { CliDefaultAuthService } from './lib/services/cli-default-auth.service';
import { CliUsersModuleConfig } from './lib/models/users-module-config';

import { LIBRARY_VERSION } from './lib/version';

export const usersModule: ICliModule = {
    name: '@qodalis/cli-users',
    version: LIBRARY_VERSION,
    description: 'Linux-style user and group management with authentication',
    processors: [
        new CliWhoamiCommandProcessor(),
        new CliAddUserCommandProcessor(),
        new CliListUsersCommandProcessor(),
        new CliSwitchUserCommandProcessor(),
        new CliUserdelCommandProcessor(),
        new CliUsermodCommandProcessor(),
        new CliPasswdCommandProcessor(),
        new CliLoginCommandProcessor(),
        new CliLogoutCommandProcessor(),
        new CliIdCommandProcessor(),
        new CliGroupsCommandProcessor(),
        new CliGroupaddCommandProcessor(),
        new CliGroupdelCommandProcessor(),
        new CliWhoCommandProcessor(),
    ],
    services: [
        { provide: ICliUsersStoreService_TOKEN, useValue: new CliDefaultUsersStoreService() },
        { provide: ICliGroupsStoreService_TOKEN, useValue: new CliDefaultGroupsStoreService() },
    ],

    configure(config: CliUsersModuleConfig): ICliModule {
        return { ...this, config };
    },

    async onInit(context) {
        const moduleConfig = (this.config || {}) as CliUsersModuleConfig;
        const kvStore = context.services.get<ICliKeyValueStore>('cli-key-value-store');

        // Initialize users store
        const usersStore = context.services.get<ICliUsersStoreService>(ICliUsersStoreService_TOKEN);
        await (usersStore as CliDefaultUsersStoreService).initialize(kvStore);

        // Initialize groups store (depends on users store)
        const groupsStore = context.services.get<ICliGroupsStoreService>(ICliGroupsStoreService_TOKEN);
        await (groupsStore as CliDefaultGroupsStoreService).initialize(kvStore, usersStore);

        // Initialize session service
        const sessionService = new CliDefaultUserSessionService();
        await sessionService.initialize(kvStore);
        context.services.set([
            { provide: ICliUserSessionService_TOKEN, useValue: sessionService },
        ]);

        // Initialize auth service (depends on users store and session service)
        const authService = new CliDefaultAuthService();
        await authService.initialize(kvStore, usersStore, sessionService);
        context.services.set([
            { provide: ICliAuthService_TOKEN, useValue: authService },
        ]);

        // Seed additional users from config
        if (moduleConfig.seedUsers) {
            for (const seedUser of moduleConfig.seedUsers) {
                try {
                    const created = await usersStore.createUser(seedUser);
                    const password = moduleConfig.defaultPassword || 'root';
                    await authService.setPassword(created.id, password);
                } catch {
                    // User may already exist from previous boot — skip
                }
            }
        }

        // Restore session from IndexedDB, or stay anonymous
        await sessionService.restoreSession();

        // Subscribe session changes to execution context
        sessionService.getUserSession().subscribe(session => {
            if (session) {
                context.userSession = session;
            }
        });
    },
};

// Usage example:
// usersModule.configure({
//     defaultPassword: 'admin',
//     seedUsers: [{ name: 'dev', email: 'dev@company.com', groups: ['devs'] }],
//     requirePasswordOnSu: false,
// })
```
```

**Step 3: Commit**

```bash
git add projects/users/src/lib/processors/index.ts projects/users/src/public-api.ts
git commit -m "feat(users): wire up all v2 processors and services in module registration"
```

---

## Task 14: Update Demo App

**Files:**
- Modify: `projects/demo-angular/src/app/services/custom-users-store.service.ts`
- Modify: `projects/demo-angular/src/app/app.component.ts` (if needed)

**Step 1: Update custom users store to implement the v2 interface**

The demo's `CliCustomUsersStoreService` extends `CliDefaultUsersStoreService`. Since the base class API changed (constructor no longer auto-initializes from localStorage, now requires `initialize(kvStore)`), the custom service needs updating. It should override the seed data by providing custom default users after `initialize()` is called, or by overriding `initialize()`.

**Step 2: Verify the demo app registers the users module correctly**

Check `app.component.ts` — it should still register `usersModule` the same way. No changes expected unless it references old types.

**Step 3: Commit**

```bash
git add projects/demo-angular/src/app/
git commit -m "feat(demo): update custom users store for v2 API"
```

---

## Task 15: Build and Smoke Test

**Step 1: Build all**

Run: `npm run "build all"` from the `angular-web-cli` directory.
Expected: All projects build successfully.

**Step 2: Run tests**

Run: `npm test`
Expected: All existing tests pass. The users module spec (`projects/users/src/tests/index.spec.ts`) will need updating — processor count changed from 4 to 14.

**Step 3: Update the users module test**

```typescript
import { usersModule } from '../public-api';

describe('CliUsersModule', () => {
    it('should be defined', () => {
        expect(usersModule).toBeDefined();
    });

    it('should have the correct name', () => {
        expect(usersModule.name).toBe('@qodalis/cli-users');
    });

    it('should have 14 processors', () => {
        expect(usersModule.processors?.length).toBe(14);
    });

    it('should have services', () => {
        expect(usersModule.services?.length).toBeGreaterThan(0);
    });

    it('should have an onInit hook', () => {
        expect(usersModule.onInit).toBeDefined();
    });
});
```

**Step 4: Serve demo and manually verify**

Run: `npm run "start demo"`
Test commands: `whoami`, `id`, `passwd`, `su root`, `adduser test --email=test@test.com`, `groups`, `groupadd devs`, `userdel test`, `login`, `logout`, `w`

**Step 5: Commit**

```bash
git add projects/users/src/tests/
git commit -m "test(users): update module tests for v2 processor count"
```

---

## Task Order and Dependencies

```
Task 0  (module config support in core)
  └── Task 1  (core models)
        └── Task 2  (core interfaces + tokens)
              ├── Task 12 (permissions helper) — no deps on other tasks
              ├── Task 3  (groups store)
              ├── Task 4  (users store)
              │     └── Task 5  (auth service) — depends on users store
              └── Task 6  (session service)
                    └── Task 8  (rewrite existing processors) — depends on all services
                          ├── Task 9  (userdel, usermod, passwd)
                          ├── Task 10 (login, logout, id)
                          └── Task 11 (groups, groupadd, groupdel, w)
                                └── Task 7  (service exports)
                                      └── Task 13 (module registration + configure())
                                            └── Task 14 (demo app)
                                                  └── Task 15 (build + smoke test)
```

Task 0 can be done first (or in parallel with Task 1 since it touches different files).
Tasks 3, 4, 6, and 12 can be done in parallel after Task 2.
Tasks 9, 10, 11 can be done in parallel after Task 8.
