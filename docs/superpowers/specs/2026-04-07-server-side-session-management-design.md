# Server-Side Session Management for @qodalis/cli-users

## Overview

Add server-backed user and session management to the existing `@qodalis/cli-users` plugin. By default, the module uses client-side (in-memory/IndexedDB) services. When configured with a `server` flag, it switches to server-backed service implementations that delegate all user CRUD, authentication, session tracking, and audit operations to a CLI server.

All three server implementations (Node.js, .NET, Python) get a new opt-in `UsersModule` plugin with REST endpoints, interface-based storage (in-memory default, swappable for database), and opaque-token session management with session kick support.

## Client-Side Changes

### Configuration

```ts
// Client-only (default, works offline)
engine.registerModule(usersModule);

// Server-backed
engine.registerModule(usersModule.configure({
    server: 'my-server'   // matches a name from CliServerConfig
}));
```

### Boot Behavior (`onInit`)

When `config.server` is **not set** (default):
- Creates client-side services: `CliDefaultUsersStoreService`, `CliDefaultAuthService`, `CliDefaultUserSessionService`, `CliDefaultGroupsStoreService`, `CliDefaultAuditService`, `CliDefaultUserEventService`
- Seeds initial admin user
- Starts session timeout interval
- Wires audit auto-logging from events

When `config.server` **is set**:
- Creates server-backed services: `CliServerUsersStoreService`, `CliServerAuthService`, `CliServerUserSessionService`, `CliServerGroupsStoreService`
- Audit service delegates to `GET /api/v1/qcli/audit`
- Skips seed user creation (server owns the data)
- Registers an `ICliServerAuthTokenProvider` that attaches the session token to all requests to the configured server
- Registers 2 additional processors: `sessions` (list active sessions) and `session kick <id>` (force-logout, admin only)
- Session timeout checking delegates to server (server tracks `lastActivity`)

### Server-Backed Service Implementations

All services use `ICliHttpClient` from the execution context to make HTTP requests. The base URL is resolved from the `CliServerConfig` matching `config.server`.

#### `CliServerUsersStoreService` (implements `ICliUsersStoreService`)

| Method | Server Call |
|---|---|
| `getUsers()` | `GET /api/v1/qcli/users` |
| `getUser(idOrName)` | `GET /api/v1/qcli/users/:idOrName` |
| `createUser(data)` | `POST /api/v1/qcli/users` |
| `updateUser(id, data)` | `PUT /api/v1/qcli/users/:id` |
| `deleteUser(id)` | `DELETE /api/v1/qcli/users/:id` |

Returns `Observable` wrappers around HTTP calls to match the existing interface.

#### `CliServerAuthService` (implements `ICliAuthService`)

| Method | Server Call |
|---|---|
| `login(username, password)` | `POST /api/v1/qcli/auth/login` — returns `{ token, session }` |
| `logout()` | `POST /api/v1/qcli/auth/logout` |
| `verifyPassword(userId, password)` | `POST /api/v1/qcli/auth/verify` |
| `setPassword(userId, password)` | `PUT /api/v1/qcli/users/:id/password` |
| `hashPassword(password, salt)` | Not used (server handles hashing) |
| `validatePassword(password)` | Server validates on `setPassword`; client can optionally pre-validate |

On successful login:
1. Server returns a session token
2. Token stored in local `ICliKeyValueStore` (persists across page reloads)
3. Token registered via `ICliServerAuthTokenProvider` for automatic `Authorization: Bearer <token>` on all requests to that server

On 401 response from any server request:
- Clear local token
- Emit `logout` event
- Reset session to undefined

#### `CliServerUserSessionService` (implements `ICliUserSessionService`)

| Method | Server Call |
|---|---|
| `getUserSession()` | Returns local `BehaviorSubject` (populated from server on init/login) |
| `setUserSession(session)` | Updates local subject (server sets session on login) |
| `clearSession()` | Clears local subject and token |
| `restoreSession()` | `GET /api/v1/qcli/sessions/current` — validates stored token, returns session or clears if expired |
| `persistSession()` | No-op (server owns persistence) |
| `isExpired(timeoutMs)` | `GET /api/v1/qcli/sessions/current` — server checks expiry |

#### `CliServerGroupsStoreService` (implements `ICliGroupsStoreService`)

| Method | Server Call |
|---|---|
| `getGroups()` | `GET /api/v1/qcli/groups` |
| `getGroup(name)` | `GET /api/v1/qcli/groups/:name` |
| `createGroup(data)` | `POST /api/v1/qcli/groups` |
| `deleteGroup(name)` | `DELETE /api/v1/qcli/groups/:name` |
| `addUserToGroup(userId, groupName)` | `PUT /api/v1/qcli/groups/:name/members/:userId` |
| `removeUserFromGroup(userId, groupName)` | `DELETE /api/v1/qcli/groups/:name/members/:userId` |

### New Processors (Server Mode Only)

#### `sessions` Command
- Lists active sessions from `GET /api/v1/qcli/sessions`
- Displays as table: Session ID, User, Login Time, Last Activity, IP
- Admin only

#### `session kick <id>` Command
- Force-logout a session via `DELETE /api/v1/qcli/sessions/:id`
- Admin only
- Server invalidates the token; the kicked client gets 401 on next request

## Server-Side Changes

### Architecture

Each server gets a `UsersModule` plugin following the existing module pattern (like the weather plugin). The module registers:
- HTTP routes (Express router / ASP.NET controller / FastAPI router)
- Storage interfaces with in-memory defaults
- Auth middleware for protected endpoints
- WebSocket event broadcasting for session events

### Storage Interfaces

Four storage interfaces, each with an in-memory default implementation:

```
ICliUserStore
    getUsers(): Promise<User[]>
    getUser(idOrName: string): Promise<User | undefined>
    createUser(data: CreateUserDto): Promise<User>
    updateUser(id: string, data: UpdateUserDto): Promise<User>
    deleteUser(id: string): Promise<void>

ICliSessionStore
    createSession(userId: string, metadata: SessionMetadata): Promise<Session>
    getSession(token: string): Promise<Session | undefined>
    getActiveSessions(): Promise<Session[]>
    deleteSession(token: string): Promise<void>
    deleteUserSessions(userId: string): Promise<void>
    cleanup(maxAgeMs: number): Promise<void>

ICliCredentialStore
    setPassword(userId: string, hash: string, salt: string): Promise<void>
    getCredentials(userId: string): Promise<Credentials | undefined>
    deleteCredentials(userId: string): Promise<void>

ICliAuditStore
    log(entry: AuditEntry): Promise<void>
    getEntries(options?: AuditQueryOptions): Promise<AuditEntry[]>
    clear(): Promise<void>
```

Custom storage (e.g., PostgreSQL, MongoDB) is provided via the module constructor:

```ts
// Node.js
builder.addModule(new UsersModule());                                    // in-memory
builder.addModule(new UsersModule({ userStore: new PostgresUserStore(pool) })); // custom

// .NET
services.AddCliUsers();                                                  // in-memory
services.AddCliUsers(options => options.UsePostgres(connectionString));   // custom

// Python
builder.add_module(UsersModule())                                        // in-memory
builder.add_module(UsersModule(user_store=PostgresUserStore(pool)))       // custom
```

### API Endpoints

All under `/api/v1/qcli/` prefix:

#### Users (`/users`)

| Endpoint | Method | Auth | Body / Query | Response |
|---|---|---|---|---|
| `/users` | GET | Required | — | `User[]` |
| `/users/:idOrName` | GET | Required | — | `User` |
| `/users` | POST | Admin | `{ name, email, password, groups? }` | `User` |
| `/users/:id` | PUT | Admin | `{ name?, email?, groups?, disabled? }` | `User` |
| `/users/:id` | DELETE | Admin | — | `204` |
| `/users/:id/password` | PUT | Self or Admin | `{ currentPassword?, newPassword }` | `204` |

#### Authentication (`/auth`)

| Endpoint | Method | Auth | Body | Response |
|---|---|---|---|---|
| `/auth/login` | POST | None | `{ username, password }` | `{ token, session: { user, loginTime } }` |
| `/auth/logout` | POST | Required | — | `204` |
| `/auth/verify` | POST | Required | `{ userId, password }` | `{ valid: boolean }` |

#### Sessions (`/sessions`)

| Endpoint | Method | Auth | Query | Response |
|---|---|---|---|---|
| `/sessions` | GET | Admin | — | `Session[]` |
| `/sessions/current` | GET | Required | — | `Session` |
| `/sessions/:id` | DELETE | Admin | — | `204` (kick) |

#### Groups (`/groups`)

| Endpoint | Method | Auth | Body | Response |
|---|---|---|---|---|
| `/groups` | GET | Required | — | `Group[]` |
| `/groups/:name` | GET | Required | — | `Group` |
| `/groups` | POST | Admin | `{ name, description? }` | `Group` |
| `/groups/:name` | DELETE | Admin | — | `204` |
| `/groups/:name/members/:userId` | PUT | Admin | — | `204` |
| `/groups/:name/members/:userId` | DELETE | Admin | — | `204` |

#### Audit (`/audit`)

| Endpoint | Method | Auth | Query | Response |
|---|---|---|---|---|
| `/audit` | GET | Admin | `?event=&username=&limit=` | `AuditEntry[]` |
| `/audit` | DELETE | Admin | — | `204` (clear) |

### Authentication Middleware

- Token format: Opaque random string (not JWT — simpler, server-validated, revocable)
- Token lookup: `Authorization: Bearer <token>` header → `ICliSessionStore.getSession(token)`
- On valid token: attach `session.user` to request context, update `lastActivity`
- On invalid/expired/missing token: return `401 Unauthorized`
- Protected endpoints: all except `POST /auth/login`

### Session Model

```
Session {
    id: string              // unique session identifier
    token: string           // opaque bearer token
    userId: string
    user: User              // denormalized for convenience
    loginTime: number       // timestamp
    lastActivity: number    // updated on each authenticated request
    metadata: {
        remoteAddress?: string
        userAgent?: string
    }
}
```

### Server Boot

When the UsersModule is added:
1. Creates storage instances (in-memory or custom)
2. Seeds a default admin user if no users exist (name: `root`, password: `root`)
3. Registers auth middleware on all `/users`, `/sessions`, `/groups`, `/audit` routes
4. Registers routes
5. Starts session cleanup interval (removes expired sessions every 5 minutes)

### WebSocket Integration

When a session is kicked (`DELETE /sessions/:id`), the server broadcasts a `session-kicked` event via the existing events WebSocket:

```json
{ "type": "session-kicked", "data": { "sessionId": "...", "userId": "..." } }
```

The client's server-backed session service listens for this event and auto-logs out if the kicked session matches the local token.

## Data Models

### User (shared between client and server)

```ts
{
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
```

### AuditEntry

```ts
{
    timestamp: number;
    event: string;       // login, logout, login_failed, user_created, user_deleted, password_changed
    username: string;
    details?: string;
    metadata?: {
        remoteAddress?: string;
        sessionId?: string;
    };
}
```

## Testing Strategy

### Server Tests
- Unit tests for each storage interface (in-memory implementation)
- Integration tests for each endpoint (Node: supertest, .NET: xUnit + TestServer, Python: httpx + pytest)
- Auth middleware tests (valid token, expired token, missing token, admin-only)
- Session kick flow test

### Client Tests
- Unit tests for each server-backed service (mock HTTP responses)
- Integration tests using `CliTestHarness` with mocked server responses
- Test mode switching: verify same processors work with both client and server services

## Files Changed

### Client (`web-cli/`)
| File | Action |
|---|---|
| `packages/plugins/users/src/lib/models/users-module-config.ts` | Edit — add `server?: string` to config |
| `packages/plugins/users/src/public-api.ts` | Edit — branch `onInit()` on `config.server` |
| `packages/plugins/users/src/lib/services/cli-server-users-store.service.ts` | Create |
| `packages/plugins/users/src/lib/services/cli-server-auth.service.ts` | Create |
| `packages/plugins/users/src/lib/services/cli-server-user-session.service.ts` | Create |
| `packages/plugins/users/src/lib/services/cli-server-groups-store.service.ts` | Create |
| `packages/plugins/users/src/lib/processors/cli-sessions-command-processor.ts` | Create |
| `packages/plugins/users/src/lib/processors/cli-session-kick-command-processor.ts` | Create |
| `packages/plugins/users/src/tests/server-*.spec.ts` | Create (unit + integration tests) |

### Node.js Server (`cli-server-node/`)
| File | Action |
|---|---|
| `plugins/users/index.ts` | Create — module entry point |
| `plugins/users/controllers/users-controller.ts` | Create |
| `plugins/users/controllers/auth-controller.ts` | Create |
| `plugins/users/controllers/sessions-controller.ts` | Create |
| `plugins/users/controllers/groups-controller.ts` | Create |
| `plugins/users/controllers/audit-controller.ts` | Create |
| `plugins/users/middleware/auth-middleware.ts` | Create |
| `plugins/users/services/user-service.ts` | Create |
| `plugins/users/services/auth-service.ts` | Create |
| `plugins/users/services/session-service.ts` | Create |
| `plugins/users/stores/in-memory-*.ts` | Create (4 store implementations) |
| `plugins/users/stores/interfaces.ts` | Create (storage interfaces) |
| `plugins/users/models.ts` | Create |
| `demo/index.ts` | Edit — register UsersModule |
| `tests/users-*.test.ts` | Create |

### .NET Server (`cli-server-dotnet/`)
| File | Action |
|---|---|
| `plugins/users/UsersModule.cs` | Create |
| `plugins/users/Controllers/` | Create (5 controllers) |
| `plugins/users/Middleware/AuthMiddleware.cs` | Create |
| `plugins/users/Services/` | Create (3 services) |
| `plugins/users/Stores/` | Create (interfaces + in-memory) |
| `plugins/users/Models/` | Create |
| `demo/Program.cs` | Edit — register UsersModule |

### Python Server (`cli-server-python/`)
| File | Action |
|---|---|
| `plugins/users/__init__.py` | Create |
| `plugins/users/controllers/` | Create (5 routers) |
| `plugins/users/middleware/` | Create |
| `plugins/users/services/` | Create |
| `plugins/users/stores/` | Create (interfaces + in-memory) |
| `plugins/users/models.py` | Create |
| `demo/main.py` | Edit — register UsersModule |

## Out of Scope

- Database-backed store implementations (PostgreSQL, MongoDB, etc.) — only interfaces and in-memory defaults
- OAuth/OIDC integration — future work
- Multi-server session sync — each server is independent
- Role-based access control beyond admin/non-admin — future work
