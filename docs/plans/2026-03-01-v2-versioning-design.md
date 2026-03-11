# Qodalis CLI v2 Versioning Design

**Date:** 2026-03-01
**Status:** Approved

## Problem

The Qodalis CLI ecosystem (frontend plugins + three backend implementations: .NET, Node.js, Python) has no enforced versioning. A v1 plugin loads silently in a v2 runtime. Backend endpoints are unversioned across all three server implementations. There is no mechanism to reject incompatible plugins or negotiate API versions between frontend and backend.

## Goals

1. v1 plugins are detected and skipped with a warning when loaded in a v2 runtime
2. Plugins declare explicit API version compatibility and semver ranges for core/cli
3. Plugin dependencies are resolved as a DAG with deterministic boot order
4. Backend REST and WebSocket endpoints are versioned in URL paths
5. Frontend CLI auto-negotiates the backend API version on connect

## Design

### 1. Plugin Versioning (Dual-Layer)

#### 1.1 API Version (Hard Break)

New required field on `ICliModule`:

```typescript
export interface ICliModule {
    apiVersion: number;  // NEW - required
    name: string;
    version?: string;
    // ... existing fields
}
```

- `apiVersion: 2` = v2 plugin
- `apiVersion: 1` or missing = v1 plugin (rejected by v2 runtime)

#### 1.2 Semver Ranges (Granular Compat)

Existing metadata fields become enforced:

```typescript
metadata: {
    requiredCoreVersion: '>=2.0.0 <3.0.0',
    requiredCliVersion: '>=2.0.0 <3.0.0',
}
```

Checked at boot via `semver.satisfies()`. Plugins failing the check are warned and skipped.

#### 1.3 version.ts Evolution

The auto-generated `version.ts` per plugin becomes:

```typescript
export const LIBRARY_VERSION = '2.0.0';
export const API_VERSION = 2;
```

The `inject-versions` script reads `package.json` version for `LIBRARY_VERSION` and derives `API_VERSION` from the major version. The scaffold tool (`tools/create-library.js`) generates this for new plugins.

#### 1.4 Boot Sequence

When the CLI runtime loads plugins:

1. **Check `apiVersion`** — if missing or `< 2`, log: `"Plugin @qodalis/cli-foo requires API version 1, but this runtime requires API version 2. Skipping. See https://qodalis.com/upgrade-v2"` and skip.
2. **Check semver ranges** — if `requiredCoreVersion` or `requiredCliVersion` is set and the installed version doesn't satisfy, log warning and skip.
3. **Resolve dependency graph** (see section 2).
4. **Boot in topological order**, respecting `priority` as a tiebreaker.

### 2. Plugin Dependency Resolution

#### 2.1 Dependency Declaration

`ICliModule.dependencies` (existing field) becomes enforced:

```typescript
const module: ICliModule = {
    apiVersion: 2,
    name: '@qodalis/cli-todo',
    dependencies: ['@qodalis/cli-core'],  // required modules
    // ...
};
```

All plugins implicitly depend on `@qodalis/cli-core`. Explicit inter-plugin dependencies are declared by name.

#### 2.2 Resolution Algorithm

1. Collect all registered `ICliModule` instances
2. Filter out incompatible modules (failed apiVersion/semver checks)
3. Build directed acyclic graph from `dependencies`
4. Detect cycles — hard error with clear message naming the cycle
5. Topological sort (Kahn's algorithm)
6. If a dependency is missing: warn `"Plugin @qodalis/cli-todo depends on @qodalis/cli-string which is not loaded. Skipping."` and remove the dependent module
7. Boot modules in sorted order, `priority` breaks ties within the same topological level

### 3. Backend API Versioning (URL Path)

#### 3.1 Route Migration

| Current (unversioned) | v1 (explicit) | v2 (new) |
|---|---|---|
| `GET /api/cli/version` | `GET /api/v1/cli/version` | `GET /api/v2/cli/version` |
| `GET /api/cli/commands` | `GET /api/v1/cli/commands` | `GET /api/v2/cli/commands` |
| `POST /api/cli/execute` | `POST /api/v1/cli/execute` | `POST /api/v2/cli/execute` |
| `/ws/cli` | `/ws/v1/cli` | `/ws/v2/cli` |
| `/ws/cli/events` | `/ws/v1/cli/events` | `/ws/v2/cli/events` |

Unversioned `/api/cli/*` paths return `301 Redirect` to `/api/v1/cli/*` (configurable to `410 Gone`).

#### 3.2 Version Discovery Endpoint

A single unversioned endpoint remains for discovery:

```
GET /api/cli/versions
```

Response:
```json
{
    "supportedVersions": [1, 2],
    "preferredVersion": 2,
    "serverVersion": "2.0.0"
}
```

#### 3.3 Backend Command Processor Versioning

All three backend implementations add `ApiVersion` / `api_version` to their `ICliCommandProcessor`:

**.NET** — `ICliCommandProcessor.cs`:
```csharp
int ApiVersion { get; }  // NEW, default 1
```

**Node.js** — `cli-command-processor.ts`:
```typescript
apiVersion: number;  // NEW, default 1
```

**Python** — `cli_command_processor.py`:
```python
@property
def api_version(self) -> int:  # NEW, default 1
    return 1
```

The `CliCommandRegistry` in each backend filters processors by the requested API version. v2 endpoints only serve v2 processors.

#### 3.4 Consistency Across Backends

All three backends implement the same API contract:
- Same route structure (`/api/v1/cli/*`, `/api/v2/cli/*`)
- Same discovery endpoint (`/api/cli/versions`)
- Same response shapes
- Same WebSocket versioned paths

### 4. Frontend-Backend Version Negotiation

#### 4.1 Auto-Negotiation Flow

```
CLI Engine                          Server
    |                                  |
    |  GET /api/cli/versions           |
    |--------------------------------->|
    |  { supportedVersions: [1,2] }    |
    |<---------------------------------|
    |                                  |
    |  (pick highest compatible: 2)    |
    |                                  |
    |  POST /api/v2/cli/execute        |
    |--------------------------------->|
    |  response                        |
    |<---------------------------------|
```

1. On first server connection, `GET /api/cli/versions`
2. Intersect server's `supportedVersions` with client's supported versions
3. Pick highest from intersection
4. Cache the negotiated version for the session
5. All subsequent calls use `/api/v{n}/cli/*`
6. If no compatible version exists, display error: `"Server supports API v[1], but this CLI requires v[2]. Please update the server."`

#### 4.2 WebSocket Version

The negotiated version determines the WebSocket path before the upgrade handshake. No in-band version negotiation needed.

### 5. Package Version Strategy

All `@qodalis/*` packages bump to `2.0.0` for the v2 release:

- `@qodalis/cli-core@2.0.0`
- `@qodalis/cli@2.0.0`
- `@qodalis/angular-cli@2.0.0`
- `@qodalis/react-cli@2.0.0`
- `@qodalis/vue-cli@2.0.0`
- All plugins: `@qodalis/cli-*@2.0.0`

npm semver ensures `npm install @qodalis/cli-core@^1.0.0` never pulls v2. Users must explicitly opt in.

Backend packages bump to `2.0.0`:
- .NET: `Qodalis.Cli.Abstractions@2.0.0`, `Qodalis.Cli@2.0.0`
- Node.js: `@qodalis/cli-server-node@2.0.0`
- Python: `qodalis-cli-server@2.0.0`

## Non-Goals

- Backward compatibility shim for v1 plugins (decided against)
- Header-based or query-param API versioning
- Plugin marketplace or remote plugin discovery (future)
