# Server-Side Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-backed user and session management to the CLI ecosystem — a UsersModule plugin for all 3 servers (Node.js, .NET, Python) and a `server` config flag on the client-side `@qodalis/cli-users` module that switches to server-backed service implementations.

**Architecture:** Each server gets a mountable plugin with REST endpoints for user CRUD, authentication (opaque tokens), session management (with kick), groups, and audit. The client-side users module gains a `server` config option; when set, `onInit()` creates HTTP-backed service implementations instead of the default in-memory ones. Storage is interface-based with in-memory defaults, swappable for database implementations.

**Tech Stack:** Node.js/Express, .NET 8/ASP.NET Core, Python/FastAPI, TypeScript (web-cli), RxJS, xterm.js

**Spec:** `docs/superpowers/specs/2026-04-07-server-side-session-management-design.md`

---

## Decomposition

This feature spans 4 independent codebases. Each sub-plan produces working, testable software on its own:

1. **Part A: Node.js Server UsersModule** (Tasks 1–8) — standalone, testable with supertest
2. **Part B: .NET Server UsersModule** (Tasks 9–12) — same API, standalone
3. **Part C: Python Server UsersModule** (Tasks 13–16) — same API, standalone
4. **Part D: Client-Side Server Mode** (Tasks 17–22) — requires at least one server

---

## Part A: Node.js Server UsersModule

### File Structure

```
cli-server-node/plugins/users/
  index.ts                          # UsersModule class + UsersPlugin builder
  models.ts                         # User, Session, Credentials, AuditEntry, DTOs
  stores/
    interfaces.ts                   # ICliUserStore, ICliSessionStore, ICliCredentialStore, ICliAuditStore
    in-memory-user-store.ts         # InMemoryUserStore
    in-memory-session-store.ts      # InMemorySessionStore
    in-memory-credential-store.ts   # InMemoryCredentialStore
    in-memory-audit-store.ts        # InMemoryAuditStore
  services/
    user-service.ts                 # UserService (orchestrates stores)
    auth-service.ts                 # AuthService (password hashing, token generation)
    session-service.ts              # SessionService (session lifecycle)
  middleware/
    auth-middleware.ts              # Express middleware: Bearer token → req.user
  controllers/
    users-controller.ts             # /users routes
    auth-controller.ts              # /auth routes
    sessions-controller.ts          # /sessions routes
    groups-controller.ts            # /groups routes
    audit-controller.ts             # /audit routes
cli-server-node/tests/
  users-stores.test.ts              # Unit tests for all 4 stores
  users-auth.test.ts                # Unit tests for auth service
  users-api.test.ts                 # Integration tests for all endpoints
```

---

### Task 1: Models and Storage Interfaces

**Files:**
- Create: `cli-server-node/plugins/users/models.ts`
- Create: `cli-server-node/plugins/users/stores/interfaces.ts`

- [ ] **Step 1: Create data models**

```typescript
// cli-server-node/plugins/users/models.ts

export interface User {
    id: string;
    name: string;
    email: string;
    groups: string[];
    disabled?: boolean;
    data?: Record<string, any>;
    lastLoginAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface CreateUserDto {
    name: string;
    email: string;
    password?: string;
    groups?: string[];
    data?: Record<string, any>;
}

export interface UpdateUserDto {
    name?: string;
    email?: string;
    groups?: string[];
    disabled?: boolean;
    data?: Record<string, any>;
}

export interface Credentials {
    userId: string;
    passwordHash: string;
    salt: string;
    lastChanged: number;
}

export interface Session {
    id: string;
    token: string;
    userId: string;
    user: User;
    loginTime: number;
    lastActivity: number;
    metadata: SessionMetadata;
}

export interface SessionMetadata {
    remoteAddress?: string;
    userAgent?: string;
}

export interface AuditEntry {
    timestamp: number;
    event: string;
    username: string;
    details?: string;
    metadata?: {
        remoteAddress?: string;
        sessionId?: string;
    };
}

export interface AuditQueryOptions {
    limit?: number;
    event?: string;
    username?: string;
}

export interface Group {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
}

export interface UsersModuleOptions {
    userStore?: import('./stores/interfaces').ICliUserStore;
    sessionStore?: import('./stores/interfaces').ICliSessionStore;
    credentialStore?: import('./stores/interfaces').ICliCredentialStore;
    auditStore?: import('./stores/interfaces').ICliAuditStore;
    sessionTimeoutMs?: number;
    defaultAdminPassword?: string;
}
```

- [ ] **Step 2: Create storage interfaces**

```typescript
// cli-server-node/plugins/users/stores/interfaces.ts

import { User, CreateUserDto, UpdateUserDto, Session, SessionMetadata, Credentials, AuditEntry, AuditQueryOptions, Group } from '../models';

export interface ICliUserStore {
    getUsers(): Promise<User[]>;
    getUser(idOrName: string): Promise<User | undefined>;
    createUser(data: CreateUserDto): Promise<User>;
    updateUser(id: string, data: UpdateUserDto): Promise<User>;
    deleteUser(id: string): Promise<void>;
}

export interface ICliSessionStore {
    createSession(userId: string, token: string, user: User, metadata: SessionMetadata): Promise<Session>;
    getSession(token: string): Promise<Session | undefined>;
    getSessionById(id: string): Promise<Session | undefined>;
    getActiveSessions(): Promise<Session[]>;
    deleteSession(token: string): Promise<void>;
    deleteSessionById(id: string): Promise<void>;
    deleteUserSessions(userId: string): Promise<void>;
    updateLastActivity(token: string): Promise<void>;
    cleanup(maxAgeMs: number): Promise<void>;
}

export interface ICliCredentialStore {
    setPassword(userId: string, hash: string, salt: string): Promise<void>;
    getCredentials(userId: string): Promise<Credentials | undefined>;
    deleteCredentials(userId: string): Promise<void>;
}

export interface ICliAuditStore {
    log(entry: AuditEntry): Promise<void>;
    getEntries(options?: AuditQueryOptions): Promise<AuditEntry[]>;
    clear(): Promise<void>;
}

export interface ICliGroupStore {
    getGroups(): Promise<Group[]>;
    getGroup(name: string): Promise<Group | undefined>;
    createGroup(name: string, description?: string): Promise<Group>;
    deleteGroup(name: string): Promise<void>;
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/models.ts plugins/users/stores/interfaces.ts
git commit -m "feat(users): add data models and storage interfaces"
```

---

### Task 2: In-Memory Store Implementations

**Files:**
- Create: `cli-server-node/plugins/users/stores/in-memory-user-store.ts`
- Create: `cli-server-node/plugins/users/stores/in-memory-session-store.ts`
- Create: `cli-server-node/plugins/users/stores/in-memory-credential-store.ts`
- Create: `cli-server-node/plugins/users/stores/in-memory-audit-store.ts`
- Create: `cli-server-node/plugins/users/stores/in-memory-group-store.ts`
- Test: `cli-server-node/tests/users-stores.test.ts`

- [ ] **Step 1: Write failing tests for InMemoryUserStore**

```typescript
// cli-server-node/tests/users-stores.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryUserStore } from '../plugins/users/stores/in-memory-user-store';
import { InMemorySessionStore } from '../plugins/users/stores/in-memory-session-store';
import { InMemoryCredentialStore } from '../plugins/users/stores/in-memory-credential-store';
import { InMemoryAuditStore } from '../plugins/users/stores/in-memory-audit-store';
import { InMemoryGroupStore } from '../plugins/users/stores/in-memory-group-store';
import { User } from '../plugins/users/models';

describe('InMemoryUserStore', () => {
    let store: InMemoryUserStore;

    beforeEach(() => {
        store = new InMemoryUserStore();
    });

    it('should create a user with generated id and timestamps', async () => {
        const user = await store.createUser({ name: 'alice', email: 'alice@test.com' });
        expect(user.id).toBeDefined();
        expect(user.name).toBe('alice');
        expect(user.email).toBe('alice@test.com');
        expect(user.groups).toEqual([]);
        expect(user.createdAt).toBeGreaterThan(0);
        expect(user.updatedAt).toBeGreaterThan(0);
    });

    it('should reject duplicate usernames', async () => {
        await store.createUser({ name: 'alice', email: 'a@test.com' });
        await expect(store.createUser({ name: 'alice', email: 'b@test.com' })).rejects.toThrow('already exists');
    });

    it('should get user by id', async () => {
        const created = await store.createUser({ name: 'bob', email: 'bob@test.com' });
        const found = await store.getUser(created.id);
        expect(found?.name).toBe('bob');
    });

    it('should get user by name', async () => {
        await store.createUser({ name: 'charlie', email: 'c@test.com' });
        const found = await store.getUser('charlie');
        expect(found?.name).toBe('charlie');
    });

    it('should return undefined for unknown user', async () => {
        const found = await store.getUser('nobody');
        expect(found).toBeUndefined();
    });

    it('should list all users', async () => {
        await store.createUser({ name: 'a', email: 'a@t.com' });
        await store.createUser({ name: 'b', email: 'b@t.com' });
        const users = await store.getUsers();
        expect(users.length).toBe(2);
    });

    it('should update a user', async () => {
        const user = await store.createUser({ name: 'dave', email: 'old@t.com' });
        const updated = await store.updateUser(user.id, { email: 'new@t.com' });
        expect(updated.email).toBe('new@t.com');
        expect(updated.updatedAt).toBeGreaterThanOrEqual(user.updatedAt);
    });

    it('should throw when updating nonexistent user', async () => {
        await expect(store.updateUser('fake', { email: 'x@t.com' })).rejects.toThrow('not found');
    });

    it('should delete a user', async () => {
        const user = await store.createUser({ name: 'eve', email: 'e@t.com' });
        await store.deleteUser(user.id);
        const found = await store.getUser(user.id);
        expect(found).toBeUndefined();
    });
});

describe('InMemorySessionStore', () => {
    let store: InMemorySessionStore;
    const mockUser: User = {
        id: 'u1', name: 'alice', email: 'a@t.com', groups: [],
        createdAt: Date.now(), updatedAt: Date.now(),
    };

    beforeEach(() => {
        store = new InMemorySessionStore();
    });

    it('should create a session', async () => {
        const session = await store.createSession('u1', 'tok123', mockUser, {});
        expect(session.id).toBeDefined();
        expect(session.token).toBe('tok123');
        expect(session.userId).toBe('u1');
        expect(session.loginTime).toBeGreaterThan(0);
    });

    it('should get session by token', async () => {
        await store.createSession('u1', 'tok123', mockUser, {});
        const session = await store.getSession('tok123');
        expect(session?.userId).toBe('u1');
    });

    it('should get session by id', async () => {
        const created = await store.createSession('u1', 'tok123', mockUser, {});
        const session = await store.getSessionById(created.id);
        expect(session?.token).toBe('tok123');
    });

    it('should list active sessions', async () => {
        await store.createSession('u1', 't1', mockUser, {});
        await store.createSession('u1', 't2', mockUser, {});
        const sessions = await store.getActiveSessions();
        expect(sessions.length).toBe(2);
    });

    it('should delete session by token', async () => {
        await store.createSession('u1', 'tok123', mockUser, {});
        await store.deleteSession('tok123');
        expect(await store.getSession('tok123')).toBeUndefined();
    });

    it('should delete session by id', async () => {
        const created = await store.createSession('u1', 'tok123', mockUser, {});
        await store.deleteSessionById(created.id);
        expect(await store.getSession('tok123')).toBeUndefined();
    });

    it('should delete all sessions for a user', async () => {
        await store.createSession('u1', 't1', mockUser, {});
        await store.createSession('u1', 't2', mockUser, {});
        await store.deleteUserSessions('u1');
        const sessions = await store.getActiveSessions();
        expect(sessions.length).toBe(0);
    });

    it('should update lastActivity', async () => {
        const session = await store.createSession('u1', 'tok123', mockUser, {});
        const before = session.lastActivity;
        await new Promise(r => setTimeout(r, 10));
        await store.updateLastActivity('tok123');
        const updated = await store.getSession('tok123');
        expect(updated!.lastActivity).toBeGreaterThan(before);
    });

    it('should cleanup expired sessions', async () => {
        await store.createSession('u1', 'old', mockUser, {});
        // Manually set lastActivity to the past
        const session = await store.getSession('old');
        (session as any).lastActivity = Date.now() - 100000;
        await store.cleanup(50000);
        expect(await store.getSession('old')).toBeUndefined();
    });
});

describe('InMemoryCredentialStore', () => {
    let store: InMemoryCredentialStore;

    beforeEach(() => {
        store = new InMemoryCredentialStore();
    });

    it('should set and get credentials', async () => {
        await store.setPassword('u1', 'hash123', 'salt123');
        const creds = await store.getCredentials('u1');
        expect(creds?.passwordHash).toBe('hash123');
        expect(creds?.salt).toBe('salt123');
    });

    it('should overwrite existing credentials', async () => {
        await store.setPassword('u1', 'old', 'oldsalt');
        await store.setPassword('u1', 'new', 'newsalt');
        const creds = await store.getCredentials('u1');
        expect(creds?.passwordHash).toBe('new');
    });

    it('should delete credentials', async () => {
        await store.setPassword('u1', 'hash', 'salt');
        await store.deleteCredentials('u1');
        expect(await store.getCredentials('u1')).toBeUndefined();
    });
});

describe('InMemoryAuditStore', () => {
    let store: InMemoryAuditStore;

    beforeEach(() => {
        store = new InMemoryAuditStore();
    });

    it('should log and retrieve entries', async () => {
        await store.log({ timestamp: Date.now(), event: 'login', username: 'alice' });
        const entries = await store.getEntries();
        expect(entries.length).toBe(1);
        expect(entries[0].event).toBe('login');
    });

    it('should filter by event', async () => {
        await store.log({ timestamp: Date.now(), event: 'login', username: 'alice' });
        await store.log({ timestamp: Date.now(), event: 'logout', username: 'alice' });
        const entries = await store.getEntries({ event: 'login' });
        expect(entries.length).toBe(1);
    });

    it('should filter by username', async () => {
        await store.log({ timestamp: Date.now(), event: 'login', username: 'alice' });
        await store.log({ timestamp: Date.now(), event: 'login', username: 'bob' });
        const entries = await store.getEntries({ username: 'alice' });
        expect(entries.length).toBe(1);
    });

    it('should limit results', async () => {
        for (let i = 0; i < 10; i++) {
            await store.log({ timestamp: Date.now(), event: 'login', username: `u${i}` });
        }
        const entries = await store.getEntries({ limit: 3 });
        expect(entries.length).toBe(3);
    });

    it('should return newest first', async () => {
        await store.log({ timestamp: 100, event: 'login', username: 'first' });
        await store.log({ timestamp: 200, event: 'login', username: 'second' });
        const entries = await store.getEntries();
        expect(entries[0].username).toBe('second');
    });

    it('should clear all entries', async () => {
        await store.log({ timestamp: Date.now(), event: 'login', username: 'alice' });
        await store.clear();
        const entries = await store.getEntries();
        expect(entries.length).toBe(0);
    });
});

describe('InMemoryGroupStore', () => {
    let store: InMemoryGroupStore;

    beforeEach(() => {
        store = new InMemoryGroupStore();
    });

    it('should create and get a group', async () => {
        const group = await store.createGroup('developers', 'Dev team');
        expect(group.name).toBe('developers');
        const found = await store.getGroup('developers');
        expect(found?.description).toBe('Dev team');
    });

    it('should reject duplicate group names', async () => {
        await store.createGroup('dev');
        await expect(store.createGroup('dev')).rejects.toThrow('already exists');
    });

    it('should list all groups', async () => {
        await store.createGroup('a');
        await store.createGroup('b');
        const groups = await store.getGroups();
        expect(groups.length).toBe(2);
    });

    it('should delete a group', async () => {
        await store.createGroup('temp');
        await store.deleteGroup('temp');
        expect(await store.getGroup('temp')).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm test -- tests/users-stores.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement InMemoryUserStore**

```typescript
// cli-server-node/plugins/users/stores/in-memory-user-store.ts

import { randomUUID } from 'crypto';
import { ICliUserStore } from './interfaces';
import { User, CreateUserDto, UpdateUserDto } from '../models';

export class InMemoryUserStore implements ICliUserStore {
    private users: User[] = [];

    async getUsers(): Promise<User[]> {
        return [...this.users];
    }

    async getUser(idOrName: string): Promise<User | undefined> {
        return this.users.find(
            u => u.id === idOrName || u.name.toLowerCase() === idOrName.toLowerCase(),
        );
    }

    async createUser(data: CreateUserDto): Promise<User> {
        const existing = this.users.find(
            u => u.name.toLowerCase() === data.name.toLowerCase(),
        );
        if (existing) {
            throw new Error(`User '${data.name}' already exists`);
        }

        const now = Date.now();
        const user: User = {
            id: randomUUID(),
            name: data.name,
            email: data.email,
            groups: data.groups || [],
            data: data.data,
            createdAt: now,
            updatedAt: now,
        };
        this.users.push(user);
        return user;
    }

    async updateUser(id: string, data: UpdateUserDto): Promise<User> {
        const idx = this.users.findIndex(u => u.id === id);
        if (idx === -1) {
            throw new Error(`User not found: ${id}`);
        }
        const user = this.users[idx];
        this.users[idx] = {
            ...user,
            ...data,
            id: user.id,
            createdAt: user.createdAt,
            updatedAt: Date.now(),
        };
        return this.users[idx];
    }

    async deleteUser(id: string): Promise<void> {
        this.users = this.users.filter(u => u.id !== id);
    }
}
```

- [ ] **Step 4: Implement InMemorySessionStore**

```typescript
// cli-server-node/plugins/users/stores/in-memory-session-store.ts

import { randomUUID } from 'crypto';
import { ICliSessionStore } from './interfaces';
import { Session, SessionMetadata, User } from '../models';

export class InMemorySessionStore implements ICliSessionStore {
    private sessions: Session[] = [];

    async createSession(userId: string, token: string, user: User, metadata: SessionMetadata): Promise<Session> {
        const now = Date.now();
        const session: Session = {
            id: randomUUID(),
            token,
            userId,
            user,
            loginTime: now,
            lastActivity: now,
            metadata,
        };
        this.sessions.push(session);
        return session;
    }

    async getSession(token: string): Promise<Session | undefined> {
        return this.sessions.find(s => s.token === token);
    }

    async getSessionById(id: string): Promise<Session | undefined> {
        return this.sessions.find(s => s.id === id);
    }

    async getActiveSessions(): Promise<Session[]> {
        return [...this.sessions];
    }

    async deleteSession(token: string): Promise<void> {
        this.sessions = this.sessions.filter(s => s.token !== token);
    }

    async deleteSessionById(id: string): Promise<void> {
        this.sessions = this.sessions.filter(s => s.id !== id);
    }

    async deleteUserSessions(userId: string): Promise<void> {
        this.sessions = this.sessions.filter(s => s.userId !== userId);
    }

    async updateLastActivity(token: string): Promise<void> {
        const session = this.sessions.find(s => s.token === token);
        if (session) {
            session.lastActivity = Date.now();
        }
    }

    async cleanup(maxAgeMs: number): Promise<void> {
        const cutoff = Date.now() - maxAgeMs;
        this.sessions = this.sessions.filter(s => s.lastActivity > cutoff);
    }
}
```

- [ ] **Step 5: Implement InMemoryCredentialStore**

```typescript
// cli-server-node/plugins/users/stores/in-memory-credential-store.ts

import { ICliCredentialStore } from './interfaces';
import { Credentials } from '../models';

export class InMemoryCredentialStore implements ICliCredentialStore {
    private credentials = new Map<string, Credentials>();

    async setPassword(userId: string, hash: string, salt: string): Promise<void> {
        this.credentials.set(userId, {
            userId,
            passwordHash: hash,
            salt,
            lastChanged: Date.now(),
        });
    }

    async getCredentials(userId: string): Promise<Credentials | undefined> {
        return this.credentials.get(userId);
    }

    async deleteCredentials(userId: string): Promise<void> {
        this.credentials.delete(userId);
    }
}
```

- [ ] **Step 6: Implement InMemoryAuditStore**

```typescript
// cli-server-node/plugins/users/stores/in-memory-audit-store.ts

import { ICliAuditStore } from './interfaces';
import { AuditEntry, AuditQueryOptions } from '../models';

const MAX_ENTRIES = 1000;

export class InMemoryAuditStore implements ICliAuditStore {
    private entries: AuditEntry[] = [];

    async log(entry: AuditEntry): Promise<void> {
        this.entries.push(entry);
        if (this.entries.length > MAX_ENTRIES) {
            this.entries = this.entries.slice(-MAX_ENTRIES);
        }
    }

    async getEntries(options?: AuditQueryOptions): Promise<AuditEntry[]> {
        let result = [...this.entries];

        if (options?.event) {
            result = result.filter(e => e.event === options.event);
        }
        if (options?.username) {
            result = result.filter(e => e.username === options.username);
        }

        result.reverse(); // newest first

        if (options?.limit && options.limit > 0) {
            result = result.slice(0, options.limit);
        }

        return result;
    }

    async clear(): Promise<void> {
        this.entries = [];
    }
}
```

- [ ] **Step 7: Implement InMemoryGroupStore**

```typescript
// cli-server-node/plugins/users/stores/in-memory-group-store.ts

import { randomUUID } from 'crypto';
import { ICliGroupStore } from './interfaces';
import { Group } from '../models';

export class InMemoryGroupStore implements ICliGroupStore {
    private groups: Group[] = [];

    async getGroups(): Promise<Group[]> {
        return [...this.groups];
    }

    async getGroup(name: string): Promise<Group | undefined> {
        return this.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
    }

    async createGroup(name: string, description?: string): Promise<Group> {
        const existing = await this.getGroup(name);
        if (existing) {
            throw new Error(`Group '${name}' already exists`);
        }
        const group: Group = {
            id: randomUUID(),
            name,
            description,
            createdAt: Date.now(),
        };
        this.groups.push(group);
        return group;
    }

    async deleteGroup(name: string): Promise<void> {
        this.groups = this.groups.filter(g => g.name.toLowerCase() !== name.toLowerCase());
    }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm test -- tests/users-stores.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/stores/ tests/users-stores.test.ts
git commit -m "feat(users): add in-memory store implementations with tests"
```

---

### Task 3: Auth Service (Password Hashing + Token Generation)

**Files:**
- Create: `cli-server-node/plugins/users/services/auth-service.ts`
- Test: `cli-server-node/tests/users-auth.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli-server-node/tests/users-auth.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../plugins/users/services/auth-service';
import { InMemoryCredentialStore } from '../plugins/users/stores/in-memory-credential-store';
import { InMemoryUserStore } from '../plugins/users/stores/in-memory-user-store';
import { InMemorySessionStore } from '../plugins/users/stores/in-memory-session-store';
import { InMemoryAuditStore } from '../plugins/users/stores/in-memory-audit-store';

describe('AuthService', () => {
    let auth: AuthService;
    let userStore: InMemoryUserStore;
    let sessionStore: InMemorySessionStore;
    let credStore: InMemoryCredentialStore;
    let auditStore: InMemoryAuditStore;

    beforeEach(() => {
        userStore = new InMemoryUserStore();
        sessionStore = new InMemorySessionStore();
        credStore = new InMemoryCredentialStore();
        auditStore = new InMemoryAuditStore();
        auth = new AuthService(credStore, userStore, sessionStore, auditStore);
    });

    describe('setPassword + verifyPassword', () => {
        it('should hash and verify a password', async () => {
            await auth.setPassword('u1', 'secret');
            expect(await auth.verifyPassword('u1', 'secret')).toBe(true);
        });

        it('should reject wrong password', async () => {
            await auth.setPassword('u1', 'secret');
            expect(await auth.verifyPassword('u1', 'wrong')).toBe(false);
        });

        it('should return false for unknown user', async () => {
            expect(await auth.verifyPassword('nobody', 'pass')).toBe(false);
        });
    });

    describe('login', () => {
        it('should return session with token on valid login', async () => {
            const user = await userStore.createUser({ name: 'alice', email: 'a@t.com' });
            await auth.setPassword(user.id, 'pass');
            const result = await auth.login('alice', 'pass', {});
            expect(result.token).toBeDefined();
            expect(result.session.user.name).toBe('alice');
            expect(result.session.loginTime).toBeGreaterThan(0);
        });

        it('should throw for unknown user', async () => {
            await expect(auth.login('nobody', 'pass', {})).rejects.toThrow('Authentication failure');
        });

        it('should throw for wrong password', async () => {
            const user = await userStore.createUser({ name: 'bob', email: 'b@t.com' });
            await auth.setPassword(user.id, 'correct');
            await expect(auth.login('bob', 'wrong', {})).rejects.toThrow('Authentication failure');
        });

        it('should throw for disabled user', async () => {
            const user = await userStore.createUser({ name: 'locked', email: 'l@t.com' });
            await auth.setPassword(user.id, 'pass');
            await userStore.updateUser(user.id, { disabled: true });
            await expect(auth.login('locked', 'pass', {})).rejects.toThrow('disabled');
        });

        it('should update lastLoginAt on successful login', async () => {
            const user = await userStore.createUser({ name: 'carol', email: 'c@t.com' });
            await auth.setPassword(user.id, 'pass');
            await auth.login('carol', 'pass', {});
            const updated = await userStore.getUser('carol');
            expect(updated?.lastLoginAt).toBeGreaterThan(0);
        });

        it('should log audit entry on login', async () => {
            const user = await userStore.createUser({ name: 'dave', email: 'd@t.com' });
            await auth.setPassword(user.id, 'pass');
            await auth.login('dave', 'pass', {});
            const entries = await auditStore.getEntries({ event: 'login' });
            expect(entries.length).toBe(1);
            expect(entries[0].username).toBe('dave');
        });

        it('should log audit entry on failed login', async () => {
            const user = await userStore.createUser({ name: 'eve', email: 'e@t.com' });
            await auth.setPassword(user.id, 'pass');
            await auth.login('eve', 'wrong', {}).catch(() => {});
            const entries = await auditStore.getEntries({ event: 'login_failed' });
            expect(entries.length).toBe(1);
        });
    });

    describe('logout', () => {
        it('should delete session and log audit', async () => {
            const user = await userStore.createUser({ name: 'frank', email: 'f@t.com' });
            await auth.setPassword(user.id, 'pass');
            const { token } = await auth.login('frank', 'pass', {});

            await auth.logout(token);

            expect(await sessionStore.getSession(token)).toBeUndefined();
            const entries = await auditStore.getEntries({ event: 'logout' });
            expect(entries.length).toBe(1);
        });
    });

    describe('generateToken', () => {
        it('should produce unique tokens', () => {
            const t1 = auth.generateToken();
            const t2 = auth.generateToken();
            expect(t1).not.toBe(t2);
            expect(t1.length).toBeGreaterThanOrEqual(32);
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm test -- tests/users-auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement AuthService**

```typescript
// cli-server-node/plugins/users/services/auth-service.ts

import { createHash, randomBytes } from 'crypto';
import { ICliCredentialStore, ICliSessionStore, ICliUserStore, ICliAuditStore } from '../stores/interfaces';
import { Session, SessionMetadata } from '../models';

export class AuthService {
    constructor(
        private readonly credentialStore: ICliCredentialStore,
        private readonly userStore: ICliUserStore,
        private readonly sessionStore: ICliSessionStore,
        private readonly auditStore: ICliAuditStore,
    ) {}

    async setPassword(userId: string, password: string): Promise<void> {
        const salt = randomBytes(16).toString('hex');
        const hash = this.hashPassword(password, salt);
        await this.credentialStore.setPassword(userId, hash, salt);
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const creds = await this.credentialStore.getCredentials(userId);
        if (!creds) return false;
        const hash = this.hashPassword(password, creds.salt);
        return hash === creds.passwordHash;
    }

    async login(
        username: string,
        password: string,
        metadata: SessionMetadata,
    ): Promise<{ token: string; session: Session }> {
        const user = await this.userStore.getUser(username);
        if (!user) {
            await this.auditStore.log({
                timestamp: Date.now(),
                event: 'login_failed',
                username,
                details: 'Unknown user',
            });
            throw new Error('Authentication failure');
        }

        if (user.disabled) {
            await this.auditStore.log({
                timestamp: Date.now(),
                event: 'login_failed',
                username,
                details: 'Account disabled',
            });
            throw new Error('Account is disabled');
        }

        const valid = await this.verifyPassword(user.id, password);
        if (!valid) {
            await this.auditStore.log({
                timestamp: Date.now(),
                event: 'login_failed',
                username,
                details: 'Wrong password',
                metadata: { remoteAddress: metadata.remoteAddress },
            });
            throw new Error('Authentication failure');
        }

        // Update lastLoginAt
        await this.userStore.updateUser(user.id, { lastLoginAt: Date.now() } as any);
        const updatedUser = await this.userStore.getUser(user.id);

        const token = this.generateToken();
        const session = await this.sessionStore.createSession(
            user.id,
            token,
            updatedUser || user,
            metadata,
        );

        await this.auditStore.log({
            timestamp: Date.now(),
            event: 'login',
            username,
            metadata: {
                remoteAddress: metadata.remoteAddress,
                sessionId: session.id,
            },
        });

        return { token, session };
    }

    async logout(token: string): Promise<void> {
        const session = await this.sessionStore.getSession(token);
        if (session) {
            await this.auditStore.log({
                timestamp: Date.now(),
                event: 'logout',
                username: session.user.name,
                metadata: { sessionId: session.id },
            });
        }
        await this.sessionStore.deleteSession(token);
    }

    generateToken(): string {
        return randomBytes(32).toString('hex');
    }

    private hashPassword(password: string, salt: string): string {
        return createHash('sha256').update(salt + password).digest('hex');
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm test -- tests/users-auth.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/services/auth-service.ts tests/users-auth.test.ts
git commit -m "feat(users): add auth service with password hashing and token generation"
```

---

### Task 4: Auth Middleware

**Files:**
- Create: `cli-server-node/plugins/users/middleware/auth-middleware.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
// cli-server-node/plugins/users/middleware/auth-middleware.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ICliSessionStore, ICliUserStore } from '../stores/interfaces';
import { Session } from '../models';

// Extend Express Request to carry session info
declare global {
    namespace Express {
        interface Request {
            session?: Session;
        }
    }
}

export function createAuthMiddleware(
    sessionStore: ICliSessionStore,
): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authorization required' });
            return;
        }

        const token = authHeader.slice(7);
        const session = await sessionStore.getSession(token);

        if (!session) {
            res.status(401).json({ error: 'Invalid or expired session' });
            return;
        }

        // Update last activity
        await sessionStore.updateLastActivity(token);

        req.session = session;
        next();
    };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!req.session) {
        res.status(401).json({ error: 'Authorization required' });
        return;
    }
    if (!req.session.user.groups.includes('admin')) {
        res.status(403).json({ error: 'Admin access required' });
        return;
    }
    next();
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/middleware/auth-middleware.ts
git commit -m "feat(users): add auth middleware for bearer token validation"
```

---

### Task 5: REST Controllers

**Files:**
- Create: `cli-server-node/plugins/users/controllers/users-controller.ts`
- Create: `cli-server-node/plugins/users/controllers/auth-controller.ts`
- Create: `cli-server-node/plugins/users/controllers/sessions-controller.ts`
- Create: `cli-server-node/plugins/users/controllers/groups-controller.ts`
- Create: `cli-server-node/plugins/users/controllers/audit-controller.ts`

- [ ] **Step 1: Create auth controller (login/logout — no auth required for login)**

```typescript
// cli-server-node/plugins/users/controllers/auth-controller.ts

import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth-service';
import { createAuthMiddleware } from '../middleware/auth-middleware';
import { ICliSessionStore } from '../stores/interfaces';

export function createAuthController(
    authService: AuthService,
    sessionStore: ICliSessionStore,
): Router {
    const router = Router();
    const auth = createAuthMiddleware(sessionStore);

    router.post('/login', async (req: Request, res: Response) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                res.status(400).json({ error: 'username and password required' });
                return;
            }
            const result = await authService.login(username, password, {
                remoteAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            res.json({
                token: result.token,
                session: {
                    user: result.session.user,
                    loginTime: result.session.loginTime,
                },
            });
        } catch (e: any) {
            res.status(401).json({ error: e.message });
        }
    });

    router.post('/logout', auth, async (req: Request, res: Response) => {
        const token = req.headers.authorization!.slice(7);
        await authService.logout(token);
        res.status(204).end();
    });

    router.post('/verify', auth, async (req: Request, res: Response) => {
        try {
            const { userId, password } = req.body;
            if (!userId || !password) {
                res.status(400).json({ error: 'userId and password required' });
                return;
            }
            const valid = await authService.verifyPassword(userId, password);
            res.json({ valid });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
```

- [ ] **Step 2: Create users controller**

```typescript
// cli-server-node/plugins/users/controllers/users-controller.ts

import { Router, Request, Response } from 'express';
import { ICliUserStore, ICliCredentialStore } from '../stores/interfaces';
import { AuthService } from '../services/auth-service';
import { requireAdmin } from '../middleware/auth-middleware';

export function createUsersController(
    userStore: ICliUserStore,
    authService: AuthService,
): Router {
    const router = Router();

    router.get('/', async (_req: Request, res: Response) => {
        const users = await userStore.getUsers();
        res.json(users);
    });

    router.get('/:idOrName', async (req: Request, res: Response) => {
        const user = await userStore.getUser(req.params.idOrName);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    });

    router.post('/', requireAdmin, async (req: Request, res: Response) => {
        try {
            const { name, email, password, groups, data } = req.body;
            if (!name || !email) {
                res.status(400).json({ error: 'name and email required' });
                return;
            }
            const user = await userStore.createUser({ name, email, groups, data });
            if (password) {
                await authService.setPassword(user.id, password);
            }
            res.status(201).json(user);
        } catch (e: any) {
            res.status(409).json({ error: e.message });
        }
    });

    router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
        try {
            const user = await userStore.updateUser(req.params.id, req.body);
            res.json(user);
        } catch (e: any) {
            res.status(404).json({ error: e.message });
        }
    });

    router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
        await userStore.deleteUser(req.params.id);
        res.status(204).end();
    });

    router.put('/:id/password', async (req: Request, res: Response) => {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword) {
            res.status(400).json({ error: 'newPassword required' });
            return;
        }

        const isAdmin = req.session?.user.groups.includes('admin');
        const isSelf = req.session?.userId === req.params.id;

        if (!isAdmin && !isSelf) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        if (isSelf && !isAdmin) {
            if (!currentPassword) {
                res.status(400).json({ error: 'currentPassword required' });
                return;
            }
            const valid = await authService.verifyPassword(req.params.id, currentPassword);
            if (!valid) {
                res.status(401).json({ error: 'Current password incorrect' });
                return;
            }
        }

        await authService.setPassword(req.params.id, newPassword);
        res.status(204).end();
    });

    return router;
}
```

- [ ] **Step 3: Create sessions controller**

```typescript
// cli-server-node/plugins/users/controllers/sessions-controller.ts

import { Router, Request, Response } from 'express';
import { ICliSessionStore } from '../stores/interfaces';
import { requireAdmin } from '../middleware/auth-middleware';

export function createSessionsController(
    sessionStore: ICliSessionStore,
    broadcastEvent?: (msg: Record<string, unknown>) => void,
): Router {
    const router = Router();

    router.get('/', requireAdmin, async (_req: Request, res: Response) => {
        const sessions = await sessionStore.getActiveSessions();
        res.json(sessions.map(s => ({
            id: s.id,
            userId: s.userId,
            user: { id: s.user.id, name: s.user.name, email: s.user.email },
            loginTime: s.loginTime,
            lastActivity: s.lastActivity,
            metadata: s.metadata,
        })));
    });

    router.get('/current', async (req: Request, res: Response) => {
        if (!req.session) {
            res.status(401).json({ error: 'No active session' });
            return;
        }
        res.json(req.session);
    });

    router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
        const session = await sessionStore.getSessionById(req.params.id);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        await sessionStore.deleteSessionById(req.params.id);

        // Broadcast session-kicked event via WebSocket
        broadcastEvent?.({
            type: 'session-kicked',
            data: { sessionId: session.id, userId: session.userId },
        });

        res.status(204).end();
    });

    return router;
}
```

- [ ] **Step 4: Create groups controller**

```typescript
// cli-server-node/plugins/users/controllers/groups-controller.ts

import { Router, Request, Response } from 'express';
import { ICliGroupStore, ICliUserStore } from '../stores/interfaces';
import { requireAdmin } from '../middleware/auth-middleware';

export function createGroupsController(
    groupStore: ICliGroupStore,
    userStore: ICliUserStore,
): Router {
    const router = Router();

    router.get('/', async (_req: Request, res: Response) => {
        const groups = await groupStore.getGroups();
        res.json(groups);
    });

    router.get('/:name', async (req: Request, res: Response) => {
        const group = await groupStore.getGroup(req.params.name);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        res.json(group);
    });

    router.post('/', requireAdmin, async (req: Request, res: Response) => {
        try {
            const { name, description } = req.body;
            if (!name) {
                res.status(400).json({ error: 'name required' });
                return;
            }
            const group = await groupStore.createGroup(name, description);
            res.status(201).json(group);
        } catch (e: any) {
            res.status(409).json({ error: e.message });
        }
    });

    router.delete('/:name', requireAdmin, async (req: Request, res: Response) => {
        await groupStore.deleteGroup(req.params.name);
        res.status(204).end();
    });

    router.put('/:name/members/:userId', requireAdmin, async (req: Request, res: Response) => {
        const user = await userStore.getUser(req.params.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const group = await groupStore.getGroup(req.params.name);
        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }
        if (!user.groups.includes(group.name)) {
            await userStore.updateUser(user.id, {
                groups: [...user.groups, group.name],
            });
        }
        res.status(204).end();
    });

    router.delete('/:name/members/:userId', requireAdmin, async (req: Request, res: Response) => {
        const user = await userStore.getUser(req.params.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await userStore.updateUser(user.id, {
            groups: user.groups.filter(g => g !== req.params.name),
        });
        res.status(204).end();
    });

    return router;
}
```

- [ ] **Step 5: Create audit controller**

```typescript
// cli-server-node/plugins/users/controllers/audit-controller.ts

import { Router, Request, Response } from 'express';
import { ICliAuditStore } from '../stores/interfaces';
import { requireAdmin } from '../middleware/auth-middleware';

export function createAuditController(auditStore: ICliAuditStore): Router {
    const router = Router();

    router.get('/', requireAdmin, async (req: Request, res: Response) => {
        const options = {
            event: req.query.event as string | undefined,
            username: req.query.username as string | undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        };
        const entries = await auditStore.getEntries(options);
        res.json(entries);
    });

    router.delete('/', requireAdmin, async (_req: Request, res: Response) => {
        await auditStore.clear();
        res.status(204).end();
    });

    return router;
}
```

- [ ] **Step 6: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/controllers/ plugins/users/middleware/
git commit -m "feat(users): add REST controllers and auth middleware"
```

---

### Task 6: UsersModule Entry Point and Plugin Builder

**Files:**
- Create: `cli-server-node/plugins/users/index.ts`

- [ ] **Step 1: Create the UsersModule and plugin builder**

```typescript
// cli-server-node/plugins/users/index.ts

import { Router } from 'express';
import { InMemoryUserStore } from './stores/in-memory-user-store';
import { InMemorySessionStore } from './stores/in-memory-session-store';
import { InMemoryCredentialStore } from './stores/in-memory-credential-store';
import { InMemoryAuditStore } from './stores/in-memory-audit-store';
import { InMemoryGroupStore } from './stores/in-memory-group-store';
import { ICliUserStore, ICliSessionStore, ICliCredentialStore, ICliAuditStore, ICliGroupStore } from './stores/interfaces';
import { AuthService } from './services/auth-service';
import { createAuthMiddleware } from './middleware/auth-middleware';
import { createAuthController } from './controllers/auth-controller';
import { createUsersController } from './controllers/users-controller';
import { createSessionsController } from './controllers/sessions-controller';
import { createGroupsController } from './controllers/groups-controller';
import { createAuditController } from './controllers/audit-controller';
import { UsersModuleOptions } from './models';

export interface UsersPluginResult {
    prefix: string;
    router: Router;
    authService: AuthService;
    userStore: ICliUserStore;
    sessionStore: ICliSessionStore;
    groupStore: ICliGroupStore;
    auditStore: ICliAuditStore;
    dispose: () => void;
}

export async function buildUsersPlugin(
    options: UsersModuleOptions = {},
    broadcastEvent?: (msg: Record<string, unknown>) => void,
): Promise<UsersPluginResult> {
    const userStore = options.userStore || new InMemoryUserStore();
    const sessionStore = options.sessionStore || new InMemorySessionStore();
    const credentialStore = options.credentialStore || new InMemoryCredentialStore();
    const auditStore = options.auditStore || new InMemoryAuditStore();
    const groupStore = new InMemoryGroupStore();

    const authService = new AuthService(credentialStore, userStore, sessionStore, auditStore);

    // Seed default admin user if no users exist
    const existingUsers = await userStore.getUsers();
    if (existingUsers.length === 0) {
        const admin = await userStore.createUser({
            name: 'root',
            email: 'root@localhost',
            groups: ['admin'],
        });
        await authService.setPassword(admin.id, options.defaultAdminPassword || 'root');

        // Seed admin group
        await groupStore.createGroup('admin', 'Administrators');
    }

    const auth = createAuthMiddleware(sessionStore);

    const router = Router();

    // Auth routes (login does NOT need auth)
    router.use('/auth', createAuthController(authService, sessionStore));

    // All other routes require auth
    router.use('/users', auth, createUsersController(userStore, authService));
    router.use('/sessions', auth, createSessionsController(sessionStore, broadcastEvent));
    router.use('/groups', auth, createGroupsController(groupStore, userStore));
    router.use('/audit', auth, createAuditController(auditStore));

    // Session cleanup interval (every 5 minutes)
    const sessionTimeoutMs = options.sessionTimeoutMs || 30 * 60 * 1000; // 30 min default
    const cleanupInterval = setInterval(async () => {
        await sessionStore.cleanup(sessionTimeoutMs);
    }, 5 * 60 * 1000);

    return {
        prefix: '/api/v1/qcli',
        router,
        authService,
        userStore,
        sessionStore,
        groupStore,
        auditStore,
        dispose: () => clearInterval(cleanupInterval),
    };
}

// Re-export for consumer use
export { UsersModuleOptions } from './models';
export { ICliUserStore, ICliSessionStore, ICliCredentialStore, ICliAuditStore, ICliGroupStore } from './stores/interfaces';
```

- [ ] **Step 2: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add plugins/users/index.ts
git commit -m "feat(users): add UsersModule entry point with plugin builder"
```

---

### Task 7: API Integration Tests

**Files:**
- Create: `cli-server-node/tests/users-api.test.ts`
- Modify: `cli-server-node/demo/src/index.ts` — register UsersModule

- [ ] **Step 1: Write integration tests using supertest**

```typescript
// cli-server-node/tests/users-api.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildUsersPlugin, UsersPluginResult } from '../plugins/users/index';

describe('Users API Integration', () => {
    let app: express.Express;
    let plugin: UsersPluginResult;
    let adminToken: string;

    beforeAll(async () => {
        app = express();
        app.use(express.json());
        plugin = await buildUsersPlugin({ defaultAdminPassword: 'admin123' });
        app.use(plugin.prefix, plugin.router);

        // Login as admin to get token
        const res = await request(app)
            .post('/api/v1/qcli/auth/login')
            .send({ username: 'root', password: 'admin123' });
        adminToken = res.body.token;
    });

    afterAll(() => {
        plugin.dispose();
    });

    // --- Auth ---

    describe('POST /auth/login', () => {
        it('should return token for valid credentials', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'root', password: 'admin123' });
            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.session.user.name).toBe('root');
        });

        it('should return 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'root', password: 'wrong' });
            expect(res.status).toBe(401);
        });

        it('should return 400 for missing fields', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'root' });
            expect(res.status).toBe(400);
        });
    });

    describe('POST /auth/logout', () => {
        it('should invalidate session', async () => {
            // Login first
            const loginRes = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'root', password: 'admin123' });
            const token = loginRes.body.token;

            // Logout
            const res = await request(app)
                .post('/api/v1/qcli/auth/logout')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(204);

            // Token should no longer work
            const checkRes = await request(app)
                .get('/api/v1/qcli/sessions/current')
                .set('Authorization', `Bearer ${token}`);
            expect(checkRes.status).toBe(401);
        });
    });

    // --- Users ---

    describe('GET /users', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/v1/qcli/users');
            expect(res.status).toBe(401);
        });

        it('should list users', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.length).toBeGreaterThanOrEqual(1);
            expect(res.body[0].name).toBe('root');
        });
    });

    describe('POST /users', () => {
        it('should create a user (admin)', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'bob', email: 'bob@test.com', password: 'bobpass' });
            expect(res.status).toBe(201);
            expect(res.body.name).toBe('bob');
        });

        it('should reject duplicate username', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'bob', email: 'bob2@test.com' });
            expect(res.status).toBe(409);
        });
    });

    describe('PUT /users/:id', () => {
        it('should update a user', async () => {
            const users = await request(app)
                .get('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${adminToken}`);
            const bob = users.body.find((u: any) => u.name === 'bob');

            const res = await request(app)
                .put(`/api/v1/qcli/users/${bob.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ email: 'bob-updated@test.com' });
            expect(res.status).toBe(200);
            expect(res.body.email).toBe('bob-updated@test.com');
        });
    });

    describe('DELETE /users/:id', () => {
        it('should delete a user', async () => {
            // Create a temp user
            const createRes = await request(app)
                .post('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'temp', email: 'temp@test.com' });
            const userId = createRes.body.id;

            const res = await request(app)
                .delete(`/api/v1/qcli/users/${userId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(204);
        });
    });

    // --- Sessions ---

    describe('GET /sessions', () => {
        it('should list active sessions (admin)', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/sessions')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /sessions/current', () => {
        it('should return current session', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/sessions/current')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.user.name).toBe('root');
        });
    });

    describe('DELETE /sessions/:id (kick)', () => {
        it('should kick a session', async () => {
            // Login as bob to create a session
            const loginRes = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'bob', password: 'bobpass' });
            const bobToken = loginRes.body.token;

            // Get bob's session id
            const sessions = await request(app)
                .get('/api/v1/qcli/sessions')
                .set('Authorization', `Bearer ${adminToken}`);
            const bobSession = sessions.body.find((s: any) => s.user.name === 'bob');

            // Kick bob's session
            const res = await request(app)
                .delete(`/api/v1/qcli/sessions/${bobSession.id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(204);

            // Bob's token should no longer work
            const checkRes = await request(app)
                .get('/api/v1/qcli/sessions/current')
                .set('Authorization', `Bearer ${bobToken}`);
            expect(checkRes.status).toBe(401);
        });
    });

    // --- Groups ---

    describe('groups CRUD', () => {
        it('should create, list, get, and delete a group', async () => {
            // Create
            let res = await request(app)
                .post('/api/v1/qcli/groups')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'developers', description: 'Dev team' });
            expect(res.status).toBe(201);

            // List
            res = await request(app)
                .get('/api/v1/qcli/groups')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.body.some((g: any) => g.name === 'developers')).toBe(true);

            // Get
            res = await request(app)
                .get('/api/v1/qcli/groups/developers')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.body.description).toBe('Dev team');

            // Delete
            res = await request(app)
                .delete('/api/v1/qcli/groups/developers')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(204);
        });
    });

    // --- Audit ---

    describe('GET /audit', () => {
        it('should return audit entries', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/audit')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            // Should have login entries from our test setup
            expect(res.body.some((e: any) => e.event === 'login')).toBe(true);
        });

        it('should filter by event', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/audit?event=login')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            res.body.forEach((e: any) => expect(e.event).toBe('login'));
        });
    });

    // --- Non-admin access ---

    describe('non-admin restrictions', () => {
        let userToken: string;

        beforeAll(async () => {
            // Login as bob (non-admin)
            const res = await request(app)
                .post('/api/v1/qcli/auth/login')
                .send({ username: 'bob', password: 'bobpass' });
            userToken = res.body.token;
        });

        it('should deny creating users', async () => {
            const res = await request(app)
                .post('/api/v1/qcli/users')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ name: 'hacker', email: 'h@t.com' });
            expect(res.status).toBe(403);
        });

        it('should deny listing sessions', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/sessions')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(403);
        });

        it('should allow getting own session', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/sessions/current')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
        });

        it('should deny accessing audit', async () => {
            const res = await request(app)
                .get('/api/v1/qcli/audit')
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(403);
        });
    });
});
```

- [ ] **Step 2: Run integration tests**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm test -- tests/users-api.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add tests/users-api.test.ts
git commit -m "test(users): add API integration tests"
```

---

### Task 8: Register UsersModule in Demo Server

**Files:**
- Modify: `cli-server-node/demo/src/index.ts`

- [ ] **Step 1: Add users plugin to demo server**

Add after the existing `builder.addModule(new WeatherModule())` block, before the server starts:

```typescript
// Add to imports at top of file
import { buildUsersPlugin } from '../../plugins/users/index';

// After createCliServer(), before app.listen():
const usersPlugin = await buildUsersPlugin(
    { defaultAdminPassword: 'admin' },
    (msg) => eventSocketManager.broadcastMessage(msg),
);
app.use(usersPlugin.prefix, usersPlugin.router);
```

- [ ] **Step 2: Verify demo builds and starts**

Run: `cd /home/nicolae/work/cli-workspace/cli-server-node && npm run build`
Expected: Success

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/cli-server-node
git add demo/src/index.ts
git commit -m "feat(users): register UsersModule in demo server"
```

---

## Part B: .NET Server UsersModule (Tasks 9–12)

> Follow the same API surface as Node.js. Use ASP.NET Core controllers with `[Route]` attributes, register via `CliBuilder.AddApplicationPart()`. Use the same storage interface pattern with in-memory defaults. Tests via xUnit + `WebApplicationFactory`.

### Task 9: Models + Storage Interfaces + In-Memory Stores

**Files:**
- Create: `cli-server-dotnet/plugins/users/Models/` — User.cs, Session.cs, Credentials.cs, AuditEntry.cs, Group.cs, DTOs
- Create: `cli-server-dotnet/plugins/users/Stores/` — interfaces (IUserStore, ISessionStore, etc.) + InMemory implementations

Follow exact same data shapes as Node.js Task 1-2. Use C# conventions: PascalCase properties, `async Task<T>` return types, `Guid.NewGuid().ToString()` for IDs.

### Task 10: Services (AuthService) + Auth Middleware

**Files:**
- Create: `cli-server-dotnet/plugins/users/Services/AuthService.cs`
- Create: `cli-server-dotnet/plugins/users/Middleware/AuthMiddleware.cs`

Same logic as Node.js Task 3-4. Use `System.Security.Cryptography.SHA256` for hashing, `RandomNumberGenerator.GetBytes()` for salt/token.

### Task 11: Controllers + UsersModule

**Files:**
- Create: `cli-server-dotnet/plugins/users/Controllers/` — AuthController.cs, UsersController.cs, SessionsController.cs, GroupsController.cs, AuditController.cs
- Create: `cli-server-dotnet/plugins/users/UsersModule.cs`
- Create: `cli-server-dotnet/plugins/users/Extensions/CliBuilderUsersExtensions.cs`

Controllers use `[ApiController]` + `[Route("api/v1/qcli/...")]` attributes. Extension method `AddUsers()` on `CliBuilder` registers services and adds the assembly part.

### Task 12: Tests + Demo Registration

**Files:**
- Create: `cli-server-dotnet/tests/Qodalis.Cli.Tests/UsersApiTests.cs`
- Modify: `cli-server-dotnet/demo/Program.cs` — add `cli.AddUsers()`

---

## Part C: Python Server UsersModule (Tasks 13–16)

> Follow the same API surface. Use FastAPI APIRouter, Pydantic models, `secrets.token_hex()` for tokens, `hashlib.sha256` for hashing.

### Task 13: Models + Storage Interfaces + In-Memory Stores

**Files:**
- Create: `cli-server-python/plugins/users/qodalis_cli_users/models.py`
- Create: `cli-server-python/plugins/users/qodalis_cli_users/stores/` — interfaces + in-memory implementations

### Task 14: Services + Auth Middleware

**Files:**
- Create: `cli-server-python/plugins/users/qodalis_cli_users/services/auth_service.py`
- Create: `cli-server-python/plugins/users/qodalis_cli_users/middleware/auth_middleware.py`

FastAPI dependency injection: `async def get_current_user(authorization: str = Header(...), session_store = Depends(get_session_store))`.

### Task 15: Controllers + Module

**Files:**
- Create: `cli-server-python/plugins/users/qodalis_cli_users/controllers/` — 5 router files
- Create: `cli-server-python/plugins/users/qodalis_cli_users/__init__.py` — `build_users_plugin()` factory

### Task 16: Tests + Demo Registration

**Files:**
- Create: `cli-server-python/tests/test_users_api.py`
- Modify: `cli-server-python/demo/main.py` — mount users plugin

---

## Part D: Client-Side Server Mode (Tasks 17–22)

### Task 17: Add `server` Config Option

**Files:**
- Modify: `web-cli/packages/plugins/users/src/lib/models/users-module-config.ts`

- [ ] **Step 1: Add server field to config**

Add to the `CliUsersModuleConfig` interface:

```typescript
/** When set, delegates user management to this CLI server (must match a CliServerConfig.name) */
server?: string;
```

- [ ] **Step 2: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/plugins/users/src/lib/models/users-module-config.ts
git commit -m "feat(users): add server config option"
```

---

### Task 18: Server-Backed Services

**Files:**
- Create: `web-cli/packages/plugins/users/src/lib/services/cli-server-users-store.service.ts`
- Create: `web-cli/packages/plugins/users/src/lib/services/cli-server-auth.service.ts`
- Create: `web-cli/packages/plugins/users/src/lib/services/cli-server-user-session.service.ts`
- Create: `web-cli/packages/plugins/users/src/lib/services/cli-server-groups-store.service.ts`

Each service:
1. Takes `baseUrl: string` and `http: ICliHttpClient` in constructor
2. Implements the same interface as the default client-side service
3. Delegates to HTTP calls against the server API
4. For `ICliUsersStoreService`, wraps HTTP responses in `Observable` (using `from()`)
5. The auth service stores and manages the bearer token via `ICliKeyValueStore`

- [ ] **Step 1: Implement CliServerUsersStoreService**

```typescript
// web-cli/packages/plugins/users/src/lib/services/cli-server-users-store.service.ts

import {
    ICliUsersStoreService,
    ICliUser,
    ICliHttpClient,
    CliAddUser,
    CliUpdateUser,
} from '@qodalis/cli-core';
import { Observable, from } from 'rxjs';

export class CliServerUsersStoreService implements ICliUsersStoreService {
    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    getUsers(options?: { query?: string; skip?: number; take?: number }): Observable<ICliUser[]> {
        return from(
            this.http.get<ICliUser[]>(`${this.baseUrl}/users`, {
                headers: this.getHeaders(),
            }),
        );
    }

    getUser(id: string): Observable<ICliUser | undefined> {
        return from(
            this.http.get<ICliUser>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, {
                headers: this.getHeaders(),
            }).catch(() => undefined),
        );
    }

    async createUser(user: CliAddUser): Promise<ICliUser> {
        return this.http.post<ICliUser>(`${this.baseUrl}/users`, user, {
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        });
    }

    async updateUser(id: string, updates: CliUpdateUser): Promise<ICliUser> {
        return this.http.put<ICliUser>(`${this.baseUrl}/users/${encodeURIComponent(id)}`, updates, {
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        });
    }

    async deleteUser(id: string): Promise<void> {
        await this.http.delete(`${this.baseUrl}/users/${encodeURIComponent(id)}`, {
            headers: this.getHeaders(),
        });
    }
}
```

- [ ] **Step 2: Implement CliServerAuthService**

```typescript
// web-cli/packages/plugins/users/src/lib/services/cli-server-auth.service.ts

import {
    ICliAuthService,
    ICliUserSession,
    ICliHttpClient,
    ICliKeyValueStore,
} from '@qodalis/cli-core';

const SERVER_TOKEN_KEY = 'cli-server-auth-token';

export class CliServerAuthService implements ICliAuthService {
    private token: string | undefined;

    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly kvStore: ICliKeyValueStore,
        private readonly onTokenChange: (token: string | undefined) => void,
    ) {}

    async initialize(): Promise<void> {
        this.token = await this.kvStore.get<string>(SERVER_TOKEN_KEY);
        this.onTokenChange(this.token);
    }

    getToken(): string | undefined {
        return this.token;
    }

    getAuthHeaders(): Record<string, string> {
        if (!this.token) return {};
        return { Authorization: `Bearer ${this.token}` };
    }

    async login(username: string, password: string): Promise<ICliUserSession> {
        const result = await this.http.post<{
            token: string;
            session: { user: any; loginTime: number };
        }>(`${this.baseUrl}/auth/login`, { username, password }, {
            headers: { 'Content-Type': 'application/json' },
        });

        this.token = result.token;
        await this.kvStore.set(SERVER_TOKEN_KEY, this.token);
        this.onTokenChange(this.token);

        return {
            user: result.session.user,
            loginTime: result.session.loginTime,
            lastActivity: Date.now(),
        };
    }

    async logout(): Promise<void> {
        if (this.token) {
            try {
                await this.http.post(`${this.baseUrl}/auth/logout`, undefined, {
                    headers: this.getAuthHeaders(),
                });
            } catch {
                // Server may already have invalidated
            }
        }
        this.token = undefined;
        await this.kvStore.remove(SERVER_TOKEN_KEY);
        this.onTokenChange(undefined);
    }

    async setPassword(userId: string, password: string): Promise<void> {
        await this.http.put(`${this.baseUrl}/users/${encodeURIComponent(userId)}/password`, {
            newPassword: password,
        }, {
            headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' },
        });
    }

    async verifyPassword(userId: string, password: string): Promise<boolean> {
        const result = await this.http.post<{ valid: boolean }>(
            `${this.baseUrl}/auth/verify`,
            { userId, password },
            { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } },
        );
        return result.valid;
    }

    async hashPassword(_password: string, _salt: string): Promise<string> {
        throw new Error('Server handles password hashing');
    }
}
```

- [ ] **Step 3: Implement CliServerUserSessionService**

```typescript
// web-cli/packages/plugins/users/src/lib/services/cli-server-user-session.service.ts

import {
    ICliUserSessionService,
    ICliUserSession,
    ICliHttpClient,
} from '@qodalis/cli-core';
import { BehaviorSubject, Observable } from 'rxjs';

export class CliServerUserSessionService implements ICliUserSessionService {
    private sessionSubject = new BehaviorSubject<ICliUserSession | undefined>(undefined);

    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    getUserSession(): Observable<ICliUserSession | undefined> {
        return this.sessionSubject.asObservable();
    }

    async setUserSession(session: ICliUserSession): Promise<void> {
        this.sessionSubject.next(session);
    }

    async clearSession(): Promise<void> {
        this.sessionSubject.next(undefined);
    }

    async persistSession(): Promise<void> {
        // No-op — server owns persistence
    }

    async restoreSession(): Promise<ICliUserSession | undefined> {
        try {
            const session = await this.http.get<any>(`${this.baseUrl}/sessions/current`, {
                headers: this.getHeaders(),
            });
            if (session?.user) {
                const userSession: ICliUserSession = {
                    user: session.user,
                    loginTime: session.loginTime,
                    lastActivity: session.lastActivity,
                };
                this.sessionSubject.next(userSession);
                return userSession;
            }
        } catch {
            // Token invalid or expired
        }
        this.sessionSubject.next(undefined);
        return undefined;
    }

    isExpired(_timeoutMs: number): boolean {
        // Server handles expiry — if we have a session, it's valid
        return false;
    }
}
```

- [ ] **Step 4: Implement CliServerGroupsStoreService**

```typescript
// web-cli/packages/plugins/users/src/lib/services/cli-server-groups-store.service.ts

import {
    ICliGroupsStoreService,
    ICliGroup,
    ICliUser,
    ICliHttpClient,
} from '@qodalis/cli-core';
import { Observable, from, of } from 'rxjs';

export class CliServerGroupsStoreService implements ICliGroupsStoreService {
    constructor(
        private readonly baseUrl: string,
        private readonly http: ICliHttpClient,
        private readonly getHeaders: () => Record<string, string>,
    ) {}

    getGroups(): Observable<ICliGroup[]> {
        return from(
            this.http.get<ICliGroup[]>(`${this.baseUrl}/groups`, {
                headers: this.getHeaders(),
            }),
        );
    }

    getGroup(id: string): Observable<ICliGroup | undefined> {
        return from(
            this.http.get<ICliGroup>(`${this.baseUrl}/groups/${encodeURIComponent(id)}`, {
                headers: this.getHeaders(),
            }).catch(() => undefined),
        );
    }

    async createGroup(name: string, description?: string): Promise<ICliGroup> {
        return this.http.post<ICliGroup>(`${this.baseUrl}/groups`, { name, description }, {
            headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        });
    }

    async deleteGroup(id: string): Promise<void> {
        await this.http.delete(`${this.baseUrl}/groups/${encodeURIComponent(id)}`, {
            headers: this.getHeaders(),
        });
    }

    getGroupMembers(_groupId: string): Observable<ICliUser[]> {
        // Server doesn't have a dedicated members endpoint; filter from users
        return of([]);
    }
}
```

- [ ] **Step 5: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/plugins/users/src/lib/services/cli-server-*.ts
git commit -m "feat(users): add server-backed service implementations"
```

---

### Task 19: Server-Mode Processors (sessions, session kick)

**Files:**
- Create: `web-cli/packages/plugins/users/src/lib/processors/cli-sessions-command-processor.ts`
- Create: `web-cli/packages/plugins/users/src/lib/processors/cli-session-kick-command-processor.ts`

- [ ] **Step 1: Implement sessions command**

```typescript
// web-cli/packages/plugins/users/src/lib/processors/cli-sessions-command-processor.ts

import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliCommandParameterDescriptor,
    ICliHttpClient,
    ICliHttpClient_TOKEN,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';

export class CliSessionsCommandProcessor implements ICliCommandProcessor {
    command = 'sessions';
    description = 'List active sessions (admin only, server mode)';
    author = DefaultLibraryAuthor;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    processors: ICliCommandProcessor[] = [];
    private baseUrl!: string;
    private http!: ICliHttpClient;
    private getHeaders!: () => Record<string, string>;

    configure(baseUrl: string, http: ICliHttpClient, getHeaders: () => Record<string, string>): void {
        this.baseUrl = baseUrl;
        this.http = http;
        this.getHeaders = getHeaders;
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session = context.userSession;
        if (!session?.user.groups.includes('admin')) {
            context.writer.writeError('sessions: admin access required');
            return;
        }

        try {
            const sessions = await this.http.get<any[]>(`${this.baseUrl}/sessions`, {
                headers: this.getHeaders(),
            });

            if (sessions.length === 0) {
                context.writer.writeInfo('No active sessions');
                return;
            }

            const rows = sessions.map((s: any) => ({
                ID: s.id.slice(0, 8),
                USER: s.user.name,
                'LOGIN TIME': new Date(s.loginTime).toLocaleString(),
                'LAST ACTIVITY': new Date(s.lastActivity).toLocaleString(),
                IP: s.metadata?.remoteAddress || '-',
            }));

            context.writer.writeObjectsAsTable(rows);
        } catch (e: any) {
            context.writer.writeError(`sessions: ${e.message}`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('List all active sessions on the server');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('sessions', CliForegroundColor.Cyan)}              List active sessions`,
        );
    }
}
```

- [ ] **Step 2: Implement session kick sub-command**

The `session kick <id>` command will be added as a sub-processor of `sessions`:

```typescript
// web-cli/packages/plugins/users/src/lib/processors/cli-session-kick-command-processor.ts

import {
    ICliCommandProcessor,
    ICliExecutionContext,
    CliProcessCommand,
    CliProcessorMetadata,
    CliIcon,
    CliForegroundColor,
    ICliHttpClient,
    DefaultLibraryAuthor,
} from '@qodalis/cli-core';

export class CliSessionKickCommandProcessor implements ICliCommandProcessor {
    command = 'kick';
    description = 'Force-logout a session (admin only)';
    author = DefaultLibraryAuthor;
    acceptsRawInput = true;
    valueRequired = true;
    metadata: CliProcessorMetadata = {
        sealed: true,
        module: 'users',
        icon: CliIcon.User,
    };

    private baseUrl!: string;
    private http!: ICliHttpClient;
    private getHeaders!: () => Record<string, string>;

    configure(baseUrl: string, http: ICliHttpClient, getHeaders: () => Record<string, string>): void {
        this.baseUrl = baseUrl;
        this.http = http;
        this.getHeaders = getHeaders;
    }

    async processCommand(
        command: CliProcessCommand,
        context: ICliExecutionContext,
    ): Promise<void> {
        const session = context.userSession;
        if (!session?.user.groups.includes('admin')) {
            context.writer.writeError('session kick: admin access required');
            return;
        }

        const sessionId = command.value as string;
        if (!sessionId) {
            context.writer.writeError('session kick: session ID required');
            return;
        }

        try {
            await this.http.delete(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`, {
                headers: this.getHeaders(),
            });
            context.writer.writeSuccess(`Session ${sessionId} has been terminated`);
        } catch (e: any) {
            context.writer.writeError(`session kick: ${e.message}`);
        }
    }

    writeDescription(context: ICliExecutionContext): void {
        const { writer } = context;
        writer.writeln('Force-logout a session by ID');
        writer.writeln();
        writer.writeln(
            `  ${writer.wrapInColor('sessions kick <id>', CliForegroundColor.Cyan)}    Terminate a session`,
        );
    }
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/nicolas/work/cli-workspace/web-cli
git add packages/plugins/users/src/lib/processors/cli-sessions-command-processor.ts packages/plugins/users/src/lib/processors/cli-session-kick-command-processor.ts
git commit -m "feat(users): add sessions and session kick processors for server mode"
```

---

### Task 20: Wire Server Mode into public-api.ts onInit

**Files:**
- Modify: `web-cli/packages/plugins/users/src/public-api.ts`

- [ ] **Step 1: Add server mode branch to onInit**

At the beginning of `onInit()`, after config is resolved, add a check for `config.server`. When set:

1. Resolve the server's base URL from `CliServerConfig` via the server manager
2. Get `ICliHttpClient` from context
3. Create `CliServerAuthService`, initialize it, register at `ICliAuthService_TOKEN`
4. Create `CliServerUsersStoreService`, register at `ICliUsersStoreService_TOKEN`
5. Create `CliServerUserSessionService`, register at `ICliUserSessionService_TOKEN`
6. Create `CliServerGroupsStoreService`, register at `ICliGroupsStoreService_TOKEN`
7. Register `ICliServerAuthTokenProvider` that returns the auth headers
8. Create and register `CliSessionsCommandProcessor` and `CliSessionKickCommandProcessor`
9. Try to restore session from server (validates stored token)
10. Skip all the client-side service initialization code
11. Return early (skip seed user, client session setup, etc.)

The key code addition at the top of `onInit()`:

```typescript
if (config.server) {
    // Server mode — delegate to server-backed services
    const serverConnection = context.services.get<any>('cli-server-manager')
        ?.getConnection(config.server);
    if (!serverConnection) {
        context.writer.writeError(`users: server '${config.server}' not found`);
        return;
    }
    const baseUrl = serverConnection.baseUrl;
    const http = context.http;
    const kvStore = context.services.getRequired<ICliKeyValueStore>(CliKeyValueStore_TOKEN);

    // Create server auth service
    const serverAuth = new CliServerAuthService(baseUrl, http, kvStore, (token) => {
        // Token change callback — could trigger session refresh
    });
    await serverAuth.initialize();

    const getHeaders = () => serverAuth.getAuthHeaders();

    // Register server-backed services
    context.services.set({ provide: ICliAuthService_TOKEN, useValue: serverAuth });
    context.services.set({
        provide: ICliUsersStoreService_TOKEN,
        useValue: new CliServerUsersStoreService(baseUrl, http, getHeaders),
    });
    const serverSession = new CliServerUserSessionService(baseUrl, http, getHeaders);
    context.services.set({ provide: ICliUserSessionService_TOKEN, useValue: serverSession });
    context.services.set({
        provide: ICliGroupsStoreService_TOKEN,
        useValue: new CliServerGroupsStoreService(baseUrl, http, getHeaders),
    });

    // Register token provider for server auth headers
    context.services.set({
        provide: ICliServerAuthTokenProvider_TOKEN,
        useValue: { getHeaders: (serverName: string) => serverName === config.server ? getHeaders() : {} },
    });

    // Register server-mode processors
    const sessionsProcessor = new CliSessionsCommandProcessor();
    const kickProcessor = new CliSessionKickCommandProcessor();
    sessionsProcessor.configure(baseUrl, http, getHeaders);
    kickProcessor.configure(baseUrl, http, getHeaders);
    sessionsProcessor.processors = [kickProcessor];

    // Try to restore session
    const restored = await serverSession.restoreSession();
    if (restored) {
        context.userSession = restored;
    }

    return; // Skip client-side initialization
}
```

- [ ] **Step 2: Add imports for server services**

Add at top of `public-api.ts`:

```typescript
import { CliServerUsersStoreService } from './lib/services/cli-server-users-store.service';
import { CliServerAuthService } from './lib/services/cli-server-auth.service';
import { CliServerUserSessionService } from './lib/services/cli-server-user-session.service';
import { CliServerGroupsStoreService } from './lib/services/cli-server-groups-store.service';
import { CliSessionsCommandProcessor } from './lib/processors/cli-sessions-command-processor';
import { CliSessionKickCommandProcessor } from './lib/processors/cli-session-kick-command-processor';
```

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/plugins/users/src/public-api.ts
git commit -m "feat(users): wire server mode into onInit with service switching"
```

---

### Task 21: Client-Side Tests for Server Mode

**Files:**
- Create: `web-cli/packages/plugins/users/src/tests/server-services.spec.ts`

- [ ] **Step 1: Write unit tests for server-backed services**

Tests mock the HTTP client and verify each service delegates correctly.

```typescript
// web-cli/packages/plugins/users/src/tests/server-services.spec.ts

import { CliServerUsersStoreService } from '../lib/services/cli-server-users-store.service';
import { CliServerAuthService } from '../lib/services/cli-server-auth.service';
import { CliServerUserSessionService } from '../lib/services/cli-server-user-session.service';
import { CliServerGroupsStoreService } from '../lib/services/cli-server-groups-store.service';
import { ICliHttpClient, ICliKeyValueStore } from '@qodalis/cli-core';
import { firstValueFrom } from 'rxjs';

class MockHttpClient implements Partial<ICliHttpClient> {
    calls: { method: string; url: string; body?: any }[] = [];
    nextResponse: any = {};

    async get<T>(url: string, options?: any): Promise<T> {
        this.calls.push({ method: 'GET', url });
        return this.nextResponse as T;
    }

    async post<T>(url: string, body?: any, options?: any): Promise<T> {
        this.calls.push({ method: 'POST', url, body });
        return this.nextResponse as T;
    }

    async put<T>(url: string, body?: any, options?: any): Promise<T> {
        this.calls.push({ method: 'PUT', url, body });
        return this.nextResponse as T;
    }

    async delete<T>(url: string, options?: any): Promise<T> {
        this.calls.push({ method: 'DELETE', url });
        return this.nextResponse as T;
    }

    async fetch(url: string, init?: any): Promise<Response> {
        return new Response();
    }
    async head(url: string): Promise<Response> {
        return new Response();
    }
    async options<T>(url: string): Promise<T> {
        return {} as T;
    }
    async patch<T>(url: string): Promise<T> {
        return {} as T;
    }
}

class MockKvStore implements ICliKeyValueStore {
    private store = new Map<string, any>();
    async get<T>(key: string): Promise<T | undefined> { return this.store.get(key); }
    async set(key: string, value: any): Promise<void> { this.store.set(key, value); }
    async remove(key: string): Promise<void> { this.store.delete(key); }
    async clear(): Promise<void> { this.store.clear(); }
}

describe('CliServerUsersStoreService', () => {
    let http: MockHttpClient;
    let service: CliServerUsersStoreService;

    beforeEach(() => {
        http = new MockHttpClient();
        service = new CliServerUsersStoreService(
            'http://localhost:8047/api/v1/qcli',
            http as any,
            () => ({ Authorization: 'Bearer tok' }),
        );
    });

    it('getUsers should call GET /users', async () => {
        http.nextResponse = [{ id: '1', name: 'alice' }];
        const users = await firstValueFrom(service.getUsers());
        expect(users.length).toBe(1);
        expect(http.calls[0].method).toBe('GET');
        expect(http.calls[0].url).toContain('/users');
    });

    it('createUser should call POST /users', async () => {
        http.nextResponse = { id: '2', name: 'bob' };
        const user = await service.createUser({ name: 'bob', email: 'b@t.com', groups: [] } as any);
        expect(user.name).toBe('bob');
        expect(http.calls[0].method).toBe('POST');
    });

    it('deleteUser should call DELETE /users/:id', async () => {
        await service.deleteUser('u1');
        expect(http.calls[0].method).toBe('DELETE');
        expect(http.calls[0].url).toContain('/users/u1');
    });
});

describe('CliServerAuthService', () => {
    let http: MockHttpClient;
    let kvStore: MockKvStore;
    let service: CliServerAuthService;
    let lastToken: string | undefined;

    beforeEach(() => {
        http = new MockHttpClient();
        kvStore = new MockKvStore();
        service = new CliServerAuthService(
            'http://localhost:8047/api/v1/qcli',
            http as any,
            kvStore,
            (t) => { lastToken = t; },
        );
    });

    it('login should store token', async () => {
        http.nextResponse = {
            token: 'server-token-123',
            session: { user: { id: '1', name: 'alice' }, loginTime: Date.now() },
        };
        const session = await service.login('alice', 'pass');
        expect(session.user.name).toBe('alice');
        expect(lastToken).toBe('server-token-123');
        expect(service.getToken()).toBe('server-token-123');
    });

    it('logout should clear token', async () => {
        http.nextResponse = {
            token: 'tok',
            session: { user: { id: '1', name: 'a' }, loginTime: 0 },
        };
        await service.login('a', 'p');

        http.nextResponse = {};
        await service.logout();
        expect(service.getToken()).toBeUndefined();
        expect(lastToken).toBeUndefined();
    });

    it('getAuthHeaders should return bearer header', async () => {
        http.nextResponse = {
            token: 'my-token',
            session: { user: { id: '1', name: 'a' }, loginTime: 0 },
        };
        await service.login('a', 'p');
        expect(service.getAuthHeaders()).toEqual({ Authorization: 'Bearer my-token' });
    });
});

describe('CliServerUserSessionService', () => {
    let http: MockHttpClient;
    let service: CliServerUserSessionService;

    beforeEach(() => {
        http = new MockHttpClient();
        service = new CliServerUserSessionService(
            'http://localhost:8047/api/v1/qcli',
            http as any,
            () => ({ Authorization: 'Bearer tok' }),
        );
    });

    it('restoreSession should fetch from server', async () => {
        http.nextResponse = {
            user: { id: '1', name: 'alice' },
            loginTime: 1000,
            lastActivity: 2000,
        };
        const session = await service.restoreSession();
        expect(session?.user.name).toBe('alice');
        expect(http.calls[0].url).toContain('/sessions/current');
    });

    it('restoreSession should return undefined on error', async () => {
        http.get = async () => { throw new Error('401'); };
        const session = await service.restoreSession();
        expect(session).toBeUndefined();
    });

    it('isExpired should always return false (server handles)', () => {
        expect(service.isExpired(60000)).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests**

Run: `cd /home/nicolae/work/cli-workspace/web-cli && npx nx test users`
Expected: ALL PASS (including existing 206 tests + new server service tests)

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add packages/plugins/users/src/tests/server-services.spec.ts
git commit -m "test(users): add unit tests for server-backed services"
```

---

### Task 22: Example Files

**Files:**
- Create: `web-cli/examples/vanilla/21-server-session-management.ts`

- [ ] **Step 1: Create example showing client-only vs server-backed usage**

```typescript
// web-cli/examples/vanilla/21-server-session-management.ts

/**
 * Example 21: Server-Side Session Management
 *
 * Shows how to configure the users module to delegate user management
 * to a CLI server. When `server` is set in the config, all user CRUD,
 * authentication, and session tracking happens server-side.
 *
 * Docs: https://qodalis-solutions.github.io/web-cli/docs/plugins/users
 */

import { CliEngine } from '@qodalis/cli';
import { usersModule } from '@qodalis/cli-users';

// ─── Option A: Client-Only (default) ─────────────────────────────────
//
// Users, passwords, sessions are stored in the browser (IndexedDB).
// Works offline, no server required.

const clientOnlyEngine = new CliEngine({
    modules: [
        usersModule.configure({
            defaultPassword: 'changeme',
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
        }),
    ],
});

// ─── Option B: Server-Backed ─────────────────────────────────────────
//
// When `server` is set, the users module delegates all operations to
// the named CLI server. The server must have the UsersModule plugin
// installed (see cli-server-node/plugins/users).
//
// Server handles:
//   - User CRUD (adduser, userdel, usermod, listusers)
//   - Authentication (login, logout, passwd)
//   - Session tracking (sessions, session kick)
//   - Audit logging (last)
//   - Groups (groupadd, groupdel, groups)
//
// The client stores only the session token locally for auto-login
// across page reloads.

const serverBackedEngine = new CliEngine({
    servers: [
        {
            name: 'my-server',
            url: 'http://localhost:8047',
        },
    ],
    modules: [
        usersModule.configure({
            server: 'my-server', // ← this is the key flag
        }),
    ],
});

// ─── Server Setup (Node.js) ─────────────────────────────────────────
//
// On the server side, install and register the UsersModule:
//
//   import { buildUsersPlugin } from './plugins/users';
//
//   const usersPlugin = await buildUsersPlugin({
//       defaultAdminPassword: 'admin',
//       sessionTimeoutMs: 30 * 60 * 1000,
//   });
//   app.use(usersPlugin.prefix, usersPlugin.router);
//
// Custom storage (e.g., PostgreSQL):
//
//   const usersPlugin = await buildUsersPlugin({
//       userStore: new PostgresUserStore(pool),
//       sessionStore: new PostgresSessionStore(pool),
//       credentialStore: new PostgresCredentialStore(pool),
//       auditStore: new PostgresAuditStore(pool),
//   });

// ─── Server-Mode Commands ────────────────────────────────────────────
//
// When in server mode, two additional commands are available:
//
//   sessions              List all active sessions (admin only)
//   sessions kick <id>    Force-logout a session (admin only)
//
// These commands are only registered when `config.server` is set.

// ─── Session Kick Flow ──────────────────────────────────────────────
//
// 1. Admin runs: sessions
//    → Shows table of active sessions with IDs
//
// 2. Admin runs: sessions kick abc123
//    → Server invalidates the session token
//    → Server broadcasts "session-kicked" WebSocket event
//    → Kicked client receives 401 on next request → auto-logout
```

- [ ] **Step 2: Update examples README**

Add entry to `web-cli/examples/README.md`:

```markdown
| 21 | [Server Session Management](vanilla/21-server-session-management.ts) | Server-backed user management, session tracking, session kick |
```

- [ ] **Step 3: Commit**

```bash
cd /home/nicolae/work/cli-workspace/web-cli
git add examples/vanilla/21-server-session-management.ts examples/README.md
git commit -m "docs(examples): add server session management example"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `cd cli-server-node && npm test` — all tests pass (including users-stores, users-auth, users-api)
- [ ] `cd cli-server-node && npm run build` — builds successfully
- [ ] `cd web-cli && npx nx test users` — all tests pass (existing + new server service tests)
- [ ] `cd web-cli && pnpm run build` — full build succeeds
- [ ] Start Node.js demo server, verify login/logout/sessions endpoints work via curl
- [ ] .NET and Python servers build and pass tests (Parts B & C)
